import { NextRequest, NextResponse } from "next/server"
import { headers } from "next/headers"
import { requireAdmin } from "@/lib/admin-auth"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"
import { approvalRequestSchema } from "@/lib/validations/approval"
import {
  loadApprovers,
  findMissingRoles,
  issueTokensAndSendEmails,
} from "@/lib/approval-logic"
import {
  loadSeafileConfig,
  uploadToSeafile,
  sanitizeFileName,
} from "@/lib/seafile"
import { decrypt } from "@/lib/encryption"
import { isRateLimited } from "@/lib/rate-limit"
import {
  detectFileTypeFromBuffer,
  sanitizeDocumentName,
  isValidDocumentUrl,
} from "@/lib/approval-file-validation"

// BUG-10: Rate-Limit für Antragserstellung (10 pro Stunde pro Admin)
const CREATE_RATE_LIMIT_MAX = 10
const CREATE_RATE_LIMIT_WINDOW_SECONDS = 3600

type ApprovalRoleType = "vorstand" | "zweiter_vorstand"

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/heic",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
])

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB

const ROLE_LABELS: Record<ApprovalRoleType, string> = {
  vorstand: "Vorstand",
  zweiter_vorstand: "2. Vorstand",
}

const MAX_FILES_PER_REQUEST = 10

/**
 * POST /api/admin/approvals
 * Erstellt einen neuen Genehmigungsantrag.
 * Erwartet multipart/form-data mit Feldern:
 *   files[]         – ein oder mehrere Belege (mindestens 1)
 *   note            – Bemerkung (string)
 *   required_roles  – JSON-Array: ["vorstand", "zweiter_vorstand"]
 *   link_type       – "und" | "oder"
 */
export async function POST(request: NextRequest) {
  const adminResult = await requireAdmin()
  if (adminResult.error) return adminResult.error

  const adminProfile = adminResult.profile

  // BUG-10: Rate-Limiting pro Admin-Benutzer
  const headersList = await headers()
  const ip = headersList.get("x-forwarded-for")?.split(",")[0] ?? "unknown"
  const limited = await isRateLimited(
    `admin-approvals-create:${adminProfile.id}:${ip}`,
    CREATE_RATE_LIMIT_MAX,
    CREATE_RATE_LIMIT_WINDOW_SECONDS
  )
  if (limited) {
    return NextResponse.json(
      {
        error:
          "Zu viele Anträge in kurzer Zeit. Bitte später erneut versuchen.",
      },
      { status: 429 }
    )
  }

  const adminClient = createAdminSupabaseClient()

  // 1. Multipart-Body lesen
  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json(
      { error: "Ungültige Anfrage (kein multipart-Body)." },
      { status: 400 }
    )
  }

  const rawFiles = formData.getAll("files")
  const note = formData.get("note")
  const requiredRolesRaw = formData.get("required_roles")
  const linkTypeRaw = formData.get("link_type")

  const files = rawFiles.filter((f): f is File => f instanceof File && f.size > 0)

  if (files.length > MAX_FILES_PER_REQUEST) {
    return NextResponse.json(
      { error: `Maximal ${MAX_FILES_PER_REQUEST} Belege pro Antrag erlaubt.` },
      { status: 400 }
    )
  }

  // 2. Dateityp & Größe serverseitig validieren
  for (const file of files) {
    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return NextResponse.json(
        {
          error: `Dateityp nicht erlaubt (${file.name}). Erlaubt: PDF, JPG, PNG, HEIC, DOC, DOCX.`,
        },
        { status: 400 }
      )
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `Die Datei "${file.name}" ist zu groß (maximal 10 MB).` },
        { status: 400 }
      )
    }
  }

  // 3. Text-Felder validieren
  let parsedRoles: unknown
  try {
    parsedRoles = JSON.parse(String(requiredRolesRaw ?? "[]"))
  } catch {
    return NextResponse.json(
      { error: "Ungültiges Format für required_roles." },
      { status: 400 }
    )
  }

  const validation = approvalRequestSchema.safeParse({
    note: typeof note === "string" ? note : "",
    required_roles: parsedRoles,
    link_type: typeof linkTypeRaw === "string" ? linkTypeRaw : "und",
  })

  if (!validation.success) {
    const firstError = validation.error.issues[0]?.message ?? "Ungültige Eingabe."
    return NextResponse.json({ error: firstError }, { status: 400 })
  }

  const { note: validNote, required_roles, link_type } = validation.data
  const requiredRoles = required_roles as ApprovalRoleType[]

  // 4. Prüfen ob mindestens ein Benutzer pro gewählter Rolle existiert
  const approvers = await loadApprovers(adminClient, requiredRoles)
  const missingRoles = findMissingRoles(approvers, requiredRoles)

  if (missingRoles.length > 0) {
    const names = missingRoles.map((r) => ROLE_LABELS[r]).join(" und ")
    return NextResponse.json(
      {
        error: `Es gibt keinen Benutzer mit der Rolle ${names}. Bitte weise die Rolle zuerst zu.`,
      },
      { status: 400 }
    )
  }

  // 5. + 6. Optional: Dateien auf Seafile hochladen (falls vorhanden)
  type UploadedDoc = { url: string; name: string; path: string }
  const uploaded: UploadedDoc[] = []

  if (files.length > 0) {
    const seafileSetup = await loadSeafileConfig(adminClient, decrypt)
    if (!seafileSetup) {
      return NextResponse.json(
        {
          error:
            "Seafile ist nicht konfiguriert. Bitte die Einstellungen im Admin-Bereich prüfen.",
        },
        { status: 500 }
      )
    }

    const year = new Date().getFullYear().toString()
    const basePath = "/Förderverein/Genehmigungen/"
    const timestampPrefix = new Date().toISOString().split("T")[0]

    for (const file of files) {
      const buffer = Buffer.from(await file.arrayBuffer())
      const detected = detectFileTypeFromBuffer(buffer)
      if (detected.kind === "unknown" || !ALLOWED_MIME_TYPES.has(detected.mimeType)) {
        return NextResponse.json(
          {
            error: `Der Dateiinhalt von "${file.name}" entspricht keinem erlaubten Format (PDF, JPG, PNG, HEIC, DOC, DOCX).`,
          },
          { status: 400 }
        )
      }

      const safeDocumentName = sanitizeDocumentName(file.name || "beleg")
      const sanitized = sanitizeFileName(safeDocumentName)
      const finalName = `${timestampPrefix}_${sanitized}`

      try {
        const upload = await uploadToSeafile(
          seafileSetup.config,
          basePath,
          year,
          finalName,
          buffer,
          detected.mimeType
        )
        if (!isValidDocumentUrl(upload.shareLink)) {
          console.error("Ungültige Seafile-Share-URL:", upload.shareLink)
          return NextResponse.json(
            {
              error: "Seafile lieferte einen ungültigen Share-Link (nur https erlaubt).",
            },
            { status: 502 }
          )
        }
        uploaded.push({
          url: upload.shareLink,
          name: safeDocumentName,
          path: upload.filePath,
        })
      } catch (err) {
        console.error("Seafile-Upload fehlgeschlagen:", err)
        return NextResponse.json(
          {
            error: `Beleg "${file.name}" konnte nicht auf Seafile hochgeladen werden. Bitte später erneut versuchen.`,
          },
          { status: 502 }
        )
      }
    }
  }

  // 7. Antrag in DB speichern (document_url/name/path = erster Beleg, falls vorhanden)
  const primaryDoc = uploaded[0] ?? null
  const { data: inserted, error: insertError } = await adminClient
    .from("approval_requests")
    .insert({
      created_by: adminProfile.id,
      note: validNote,
      document_url: primaryDoc?.url ?? null,
      document_name: primaryDoc?.name ?? null,
      document_path: primaryDoc?.path ?? null,
      required_roles: requiredRoles,
      link_type,
      status: "offen",
    })
    .select("id, created_at")
    .single()

  if (insertError || !inserted) {
    console.error("Antrag-Insert-Fehler:", insertError)
    return NextResponse.json(
      { error: "Antrag konnte nicht gespeichert werden." },
      { status: 500 }
    )
  }

  // 7b. Alle Dokumente in approval_documents speichern (falls vorhanden)
  if (uploaded.length > 0) {
    const documentRows = uploaded.map((doc, index) => ({
      request_id: inserted.id,
      document_url: doc.url,
      document_name: doc.name,
      document_path: doc.path,
      display_order: index,
    }))

    const { error: docsInsertError } = await adminClient
      .from("approval_documents")
      .insert(documentRows)

    if (docsInsertError) {
      console.error("Dokumente-Insert-Fehler:", docsInsertError)
      // Antrag wieder löschen, weil Belege inkonsistent wären
      await adminClient.from("approval_requests").delete().eq("id", inserted.id)
      return NextResponse.json(
        { error: "Belege konnten nicht gespeichert werden." },
        { status: 500 }
      )
    }
  }

  // 9. Tokens generieren + E-Mails versenden
  let result: { sent: number; failed: number }
  try {
    result = await issueTokensAndSendEmails(adminClient, {
      requestId: inserted.id,
      note: validNote,
      documents: uploaded.map((d) => ({ url: d.url, name: d.name })),
      createdAt: inserted.created_at,
      requesterEmail: adminProfile.email,
      approvers,
    })
  } catch (err) {
    console.error("Token-/E-Mail-Versand fehlgeschlagen:", err)
    // BUG-6: Antrag auf Entwurf setzen, damit er im UI erneut ausgelöst werden kann
    await adminClient
      .from("approval_requests")
      .update({ status: "entwurf" })
      .eq("id", inserted.id)

    return NextResponse.json(
      {
        error:
          "Der Antrag wurde als Entwurf gespeichert, konnte aber nicht versendet werden. Bitte später erneut auslösen.",
        requestId: inserted.id,
      },
      { status: 502 }
    )
  }

  // BUG-6: Wenn komplett alle E-Mails fehlschlugen → Entwurf
  if (result.sent === 0 && result.failed > 0) {
    await adminClient
      .from("approval_requests")
      .update({ status: "entwurf" })
      .eq("id", inserted.id)

    return NextResponse.json(
      {
        error:
          "Der Antrag wurde als Entwurf gespeichert. Keine E-Mail konnte versendet werden — bitte später erneut auslösen.",
        requestId: inserted.id,
      },
      { status: 502 }
    )
  }

  return NextResponse.json(
    {
      message:
        result.failed > 0
          ? `Antrag erstellt. ${result.sent} E-Mails gesendet, ${result.failed} fehlgeschlagen.`
          : "Antrag erstellt und Genehmiger benachrichtigt.",
      id: inserted.id,
      sent: result.sent,
      failed: result.failed,
    },
    { status: 201 }
  )
}

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

/**
 * POST /api/admin/approvals
 * Erstellt einen neuen Genehmigungsantrag.
 * Erwartet multipart/form-data mit Feldern:
 *   file            – der Beleg
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

  const file = formData.get("file")
  const note = formData.get("note")
  const requiredRolesRaw = formData.get("required_roles")
  const linkTypeRaw = formData.get("link_type")

  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "Bitte einen Beleg hochladen." },
      { status: 400 }
    )
  }

  // 2. Dateityp & Größe serverseitig validieren
  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: "Dateityp nicht erlaubt. Erlaubt: PDF, JPG, PNG, HEIC, DOC, DOCX." },
      { status: 400 }
    )
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: "Die Datei ist zu groß (maximal 10 MB)." },
      { status: 400 }
    )
  }

  if (file.size === 0) {
    return NextResponse.json(
      { error: "Die Datei ist leer." },
      { status: 400 }
    )
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

  // 5. Seafile-Konfiguration laden
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

  // 6. Datei in Buffer lesen und Magic-Bytes prüfen (BUG-7)
  const buffer = Buffer.from(await file.arrayBuffer())
  const detected = detectFileTypeFromBuffer(buffer)
  if (detected.kind === "unknown" || !ALLOWED_MIME_TYPES.has(detected.mimeType)) {
    return NextResponse.json(
      {
        error:
          "Der Dateiinhalt entspricht keinem erlaubten Format (PDF, JPG, PNG, HEIC, DOC, DOCX).",
      },
      { status: 400 }
    )
  }

  // 7. Dateiname sanitizen (BUG-11) + Seafile-Upload
  const safeDocumentName = sanitizeDocumentName(file.name || "beleg")
  const year = new Date().getFullYear().toString()
  const sanitized = sanitizeFileName(safeDocumentName)
  const timestampPrefix = new Date().toISOString().split("T")[0]
  const finalName = `${timestampPrefix}_${sanitized}`

  // Separater Ordner für Genehmigungs-Belege
  const basePath = "/Förderverein/Genehmigungen/"

  let documentUrl: string
  let documentPath: string
  try {
    const upload = await uploadToSeafile(
      seafileSetup.config,
      basePath,
      year,
      finalName,
      buffer,
      detected.mimeType
    )
    documentUrl = upload.shareLink
    documentPath = upload.filePath
  } catch (err) {
    console.error("Seafile-Upload fehlgeschlagen:", err)
    return NextResponse.json(
      {
        error:
          "Beleg konnte nicht auf Seafile hochgeladen werden. Bitte später erneut versuchen.",
      },
      { status: 502 }
    )
  }

  // 8. Seafile-URL validieren (BUG-12): nur https erlaubt
  if (!isValidDocumentUrl(documentUrl)) {
    console.error("Ungültige Seafile-Share-URL:", documentUrl)
    return NextResponse.json(
      {
        error:
          "Seafile lieferte einen ungültigen Share-Link (nur https erlaubt).",
      },
      { status: 502 }
    )
  }

  // 7. Antrag in DB speichern
  const { data: inserted, error: insertError } = await adminClient
    .from("approval_requests")
    .insert({
      created_by: adminProfile.id,
      note: validNote,
      document_url: documentUrl,
      document_name: safeDocumentName,
      document_path: documentPath,
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

  // 9. Tokens generieren + E-Mails versenden
  let result: { sent: number; failed: number }
  try {
    result = await issueTokensAndSendEmails(adminClient, {
      requestId: inserted.id,
      note: validNote,
      documentUrl,
      documentName: safeDocumentName,
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

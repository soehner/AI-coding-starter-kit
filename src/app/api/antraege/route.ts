import { NextRequest, NextResponse } from "next/server"
import { headers } from "next/headers"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"
import { requireAdminOrAntragGenehmiger } from "@/lib/admin-auth"
import { createAntragSchema } from "@/lib/validations/antrag"
import {
  loadAntragGenehmiger,
  issueAntragTokensAndSendEmails,
} from "@/lib/antrag-logic"
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

// Öffentliches Formular: 3 Anträge pro Stunde pro IP
const SUBMIT_RATE_LIMIT_MAX = 3
const SUBMIT_RATE_LIMIT_WINDOW_SECONDS = 3600

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/heic",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
])

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB
const MAX_FILES_PER_ANTRAG = 5

/**
 * GET /api/antraege
 * Liefert alle Anträge inkl. Entscheidungen und Dokumente.
 * Zugriff: Administratoren oder im antrag_genehmiger-Pool eingetragene Benutzer.
 */
export async function GET() {
  const auth = await requireAdminOrAntragGenehmiger()
  if (auth.error) return auth.error

  const adminClient = createAdminSupabaseClient()

  const { data, error } = await adminClient
    .from("antraege")
    .select(
      `
      *,
      antrag_entscheidungen (
        id,
        approver_user_id,
        decision,
        comment,
        decided_at
      ),
      antrag_dokumente (
        id,
        document_url,
        document_name,
        display_order
      )
    `
    )
    .order("created_at", { ascending: false })
    .limit(200)

  if (error) {
    console.error("Fehler beim Laden der Anträge:", error)
    return NextResponse.json(
      { error: "Anträge konnten nicht geladen werden." },
      { status: 500 }
    )
  }

  // E-Mails der Genehmiger nachladen
  const approverIds = new Set<string>()
  for (const antrag of data ?? []) {
    for (const e of (antrag as { antrag_entscheidungen: Array<{ approver_user_id: string }> })
      .antrag_entscheidungen ?? []) {
      approverIds.add(e.approver_user_id)
    }
  }

  const emailMap = new Map<string, string>()
  if (approverIds.size > 0) {
    const { data: profiles } = await adminClient
      .from("user_profiles")
      .select("id, email")
      .in("id", Array.from(approverIds))

    for (const p of profiles ?? []) {
      emailMap.set(p.id, p.email)
    }
  }

  const enriched = (data ?? []).map((antrag) => {
    const a = antrag as {
      antrag_entscheidungen: Array<{
        approver_user_id: string
        decision: string
        comment: string | null
        decided_at: string
      }>
      antrag_dokumente: Array<{
        id: string
        document_url: string
        document_name: string
        display_order: number
      }>
    }
    return {
      ...antrag,
      antrag_entscheidungen: a.antrag_entscheidungen.map((e) => ({
        ...e,
        approver_email: emailMap.get(e.approver_user_id) ?? "",
      })),
      antrag_dokumente: [...a.antrag_dokumente].sort(
        (x, y) => x.display_order - y.display_order
      ),
    }
  })

  return NextResponse.json(enriched)
}

/**
 * POST /api/antraege
 * Öffentliche Route: Kostenübernahme-Antrag einreichen (multipart/form-data).
 *
 * Felder:
 *   firstName, lastName, email, amount, purpose (Text)
 *   files[]  – 0 bis 5 Anhänge (PDF/JPG/PNG/HEIC/DOC/DOCX)
 */
export async function POST(request: NextRequest) {
  // Rate-Limit (DB-basiert)
  const headersList = await headers()
  const ip = headersList.get("x-forwarded-for")?.split(",")[0] ?? "unknown"

  const limited = await isRateLimited(
    `antraege-submit:${ip}`,
    SUBMIT_RATE_LIMIT_MAX,
    SUBMIT_RATE_LIMIT_WINDOW_SECONDS
  )
  if (limited) {
    return NextResponse.json(
      {
        error: "Zu viele Anträge in kurzer Zeit. Bitte später erneut versuchen.",
      },
      { status: 429 }
    )
  }

  // Multipart-Body lesen
  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json(
      { error: "Ungültige Anfrage (kein multipart-Body)." },
      { status: 400 }
    )
  }

  // Text-Felder extrahieren
  const firstName = String(formData.get("firstName") ?? "")
  const lastName = String(formData.get("lastName") ?? "")
  const email = String(formData.get("email") ?? "")
  const purpose = String(formData.get("purpose") ?? "")
  const amountRaw = String(formData.get("amount") ?? "")
  const amount = parseFloat(amountRaw.replace(",", "."))

  const parsed = createAntragSchema.safeParse({
    firstName,
    lastName,
    email: email.toLowerCase(),
    amount,
    purpose,
  })
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: parsed.error.issues[0]?.message ?? "Validierungsfehler.",
      },
      { status: 400 }
    )
  }

  // Dateien extrahieren
  const rawFiles = formData.getAll("files")
  const files = rawFiles.filter((f): f is File => f instanceof File && f.size > 0)

  if (files.length > MAX_FILES_PER_ANTRAG) {
    return NextResponse.json(
      { error: `Maximal ${MAX_FILES_PER_ANTRAG} Anhänge pro Antrag erlaubt.` },
      { status: 400 }
    )
  }

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

  const adminClient = createAdminSupabaseClient()

  // Genehmiger-Pool prüfen
  const genehmiger = await loadAntragGenehmiger(adminClient)
  if (genehmiger.length === 0) {
    return NextResponse.json(
      {
        error:
          "Das Antragssystem ist momentan nicht konfiguriert. Bitte kontaktieren Sie den CBS-Mannheim Förderverein direkt.",
      },
      { status: 503 }
    )
  }

  // Anhänge nach Seafile hochladen (falls vorhanden)
  type UploadedDoc = { url: string; name: string; path: string }
  const uploaded: UploadedDoc[] = []

  if (files.length > 0) {
    const seafileSetup = await loadSeafileConfig(adminClient, decrypt)
    if (!seafileSetup) {
      return NextResponse.json(
        {
          error:
            "Die Dateiablage ist momentan nicht konfiguriert. Bitte später erneut versuchen.",
        },
        { status: 503 }
      )
    }

    const year = new Date().getFullYear().toString()
    const basePath = "/CBS-Finanz-Data/Antraege/"
    const timestampPrefix = new Date().toISOString().split("T")[0]

    for (const file of files) {
      const buffer = Buffer.from(await file.arrayBuffer())
      const detected = detectFileTypeFromBuffer(buffer)
      if (detected.kind === "unknown" || !ALLOWED_MIME_TYPES.has(detected.mimeType)) {
        return NextResponse.json(
          {
            error: `Der Dateiinhalt von "${file.name}" entspricht keinem erlaubten Format.`,
          },
          { status: 400 }
        )
      }

      const safeDocumentName = sanitizeDocumentName(file.name || "anhang")
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
              error: "Die Dateiablage lieferte einen ungültigen Link.",
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
            error: `Anhang "${file.name}" konnte nicht hochgeladen werden. Bitte später erneut versuchen.`,
          },
          { status: 502 }
        )
      }
    }
  }

  const {
    firstName: validFirstName,
    lastName: validLastName,
    email: validEmail,
    amount: validAmount,
    purpose: validPurpose,
  } = parsed.data
  const amountCents = Math.round(validAmount * 100)

  // Antrag speichern
  const { data: inserted, error: insertError } = await adminClient
    .from("antraege")
    .insert({
      applicant_first_name: validFirstName,
      applicant_last_name: validLastName,
      applicant_email: validEmail,
      amount_cents: amountCents,
      purpose: validPurpose,
      status: "offen",
      email_status: "ausstehend",
    })
    .select("id, created_at")
    .single()

  if (insertError || !inserted) {
    console.error("Antrag-Insert-Fehler:", insertError)
    return NextResponse.json(
      { error: "Antrag konnte nicht gespeichert werden. Bitte später erneut versuchen." },
      { status: 500 }
    )
  }

  // Anhänge in antrag_dokumente speichern
  if (uploaded.length > 0) {
    const rows = uploaded.map((doc, index) => ({
      antrag_id: inserted.id,
      document_url: doc.url,
      document_name: doc.name,
      document_path: doc.path,
      display_order: index,
    }))
    const { error: docsError } = await adminClient
      .from("antrag_dokumente")
      .insert(rows)
    if (docsError) {
      console.error("Antrag-Dokumente-Insert-Fehler:", docsError)
      await adminClient.from("antraege").delete().eq("id", inserted.id)
      return NextResponse.json(
        { error: "Anhänge konnten nicht gespeichert werden." },
        { status: 500 }
      )
    }
  }

  // Tokens + E-Mails
  let result: { sent: number; failed: number }
  try {
    result = await issueAntragTokensAndSendEmails(
      adminClient,
      {
        id: inserted.id,
        applicantName: `${validFirstName} ${validLastName}`,
        applicantEmail: validEmail,
        amountCents,
        purpose: validPurpose,
        createdAt: inserted.created_at,
        documents: uploaded.map((d) => ({ url: d.url, name: d.name })),
      },
      genehmiger
    )
  } catch (err) {
    console.error("Antrag-Token-/E-Mail-Versand fehlgeschlagen:", err)
    await adminClient
      .from("antraege")
      .update({ email_status: "fehlgeschlagen" })
      .eq("id", inserted.id)
    return NextResponse.json(
      {
        error:
          "Der Antrag wurde gespeichert, konnte aber nicht an die Genehmiger versendet werden. Der Vorstand wurde informiert.",
        id: inserted.id,
      },
      { status: 502 }
    )
  }

  const emailStatus =
    result.sent === 0 && result.failed > 0
      ? "fehlgeschlagen"
      : result.failed > 0
        ? "fehlgeschlagen"
        : "gesendet"

  await adminClient
    .from("antraege")
    .update({ email_status: emailStatus })
    .eq("id", inserted.id)

  return NextResponse.json(
    {
      success: true,
      id: inserted.id,
      message:
        "Ihr Antrag wurde erfolgreich eingereicht. Die zuständigen Personen werden per E-Mail benachrichtigt.",
    },
    { status: 201 }
  )
}

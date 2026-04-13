import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin-auth"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"
import {
  loadApprovers,
  findMissingRoles,
  issueTokensAndSendEmails,
} from "@/lib/approval-logic"
import { approvalRequestSchema } from "@/lib/validations/approval"
import {
  loadSeafileConfig,
  uploadToSeafile,
  sanitizeFileName,
} from "@/lib/seafile"
import { decrypt } from "@/lib/encryption"
import {
  detectFileTypeFromBuffer,
  sanitizeDocumentName,
  isValidDocumentUrl,
} from "@/lib/approval-file-validation"

type ApprovalRoleType = "vorstand" | "zweiter_vorstand"

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const ROLE_LABELS: Record<ApprovalRoleType, string> = {
  vorstand: "Vorstand",
  zweiter_vorstand: "2. Vorstand",
}

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/heic",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
])

const MAX_FILE_SIZE = 10 * 1024 * 1024
const MAX_FILES_PER_REQUEST = 10

/**
 * POST /api/approvals/[id]/resubmit
 * Reicht einen abgelehnten Antrag erneut ein — mit optionaler Überarbeitung.
 *
 * BUG-3: Erwartet multipart/form-data mit optionalen Feldern:
 *   note            – neue Bemerkung (optional, überschreibt alte)
 *   required_roles  – JSON-Array (optional)
 *   link_type       – "und" | "oder" (optional)
 *   file            – neuer Beleg (optional, ersetzt alten)
 *
 * Ohne Felder verhält sich der Endpunkt wie vorher (reine Re-Tokenisierung).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const adminResult = await requireAdmin()
  if (adminResult.error) return adminResult.error

  const { id } = await params
  if (!UUID_REGEX.test(id)) {
    return NextResponse.json(
      { error: "Ungültige Antrags-ID." },
      { status: 400 }
    )
  }

  const adminClient = createAdminSupabaseClient()

  // 1. Antrag inkl. Dokumente laden
  const { data: existing, error: loadError } = await adminClient
    .from("approval_requests")
    .select(
      `
      id, note, document_url, document_name, required_roles, link_type, status, created_by,
      approval_documents ( id, document_url, document_name, display_order )
      `
    )
    .eq("id", id)
    .single()

  if (loadError || !existing) {
    return NextResponse.json(
      { error: "Antrag nicht gefunden." },
      { status: 404 }
    )
  }

  if (existing.status !== "abgelehnt") {
    return NextResponse.json(
      { error: "Nur abgelehnte Anträge können erneut eingereicht werden." },
      { status: 400 }
    )
  }

  // 2. Body lesen — multipart bevorzugt, leerer Body fallback auf Re-Tokenisierung
  let newNote: string | null = null
  let newRoles: ApprovalRoleType[] | null = null
  let newLinkType: "und" | "oder" | null = null
  let newFiles: File[] = []

  const contentType = request.headers.get("content-type") ?? ""
  if (contentType.includes("multipart/form-data")) {
    let formData: FormData
    try {
      formData = await request.formData()
    } catch {
      return NextResponse.json(
        { error: "Ungültige Anfrage." },
        { status: 400 }
      )
    }

    const noteRaw = formData.get("note")
    const rolesRaw = formData.get("required_roles")
    const linkRaw = formData.get("link_type")
    const filesRaw = formData.getAll("files")

    const patchPayload: Record<string, unknown> = {}
    if (typeof noteRaw === "string" && noteRaw.trim().length > 0) {
      patchPayload.note = noteRaw
    }
    if (typeof rolesRaw === "string" && rolesRaw.trim().length > 0) {
      try {
        patchPayload.required_roles = JSON.parse(rolesRaw)
      } catch {
        return NextResponse.json(
          { error: "Ungültiges Format für required_roles." },
          { status: 400 }
        )
      }
    }
    if (typeof linkRaw === "string" && linkRaw.trim().length > 0) {
      patchPayload.link_type = linkRaw
    }

    if (Object.keys(patchPayload).length > 0) {
      // Felder mit dem bestehenden Schema validieren
      const mergedForValidation = {
        note: patchPayload.note ?? existing.note,
        required_roles: patchPayload.required_roles ?? existing.required_roles,
        link_type: patchPayload.link_type ?? existing.link_type,
      }
      const validation = approvalRequestSchema.safeParse(mergedForValidation)
      if (!validation.success) {
        const firstError =
          validation.error.issues[0]?.message ?? "Ungültige Eingabe."
        return NextResponse.json({ error: firstError }, { status: 400 })
      }
      if (patchPayload.note !== undefined) newNote = validation.data.note
      if (patchPayload.required_roles !== undefined)
        newRoles = validation.data.required_roles as ApprovalRoleType[]
      if (patchPayload.link_type !== undefined)
        newLinkType = validation.data.link_type
    }

    newFiles = filesRaw.filter(
      (f): f is File => f instanceof File && f.size > 0
    )

    if (newFiles.length > MAX_FILES_PER_REQUEST) {
      return NextResponse.json(
        { error: `Maximal ${MAX_FILES_PER_REQUEST} Belege pro Antrag erlaubt.` },
        { status: 400 }
      )
    }
  }

  // 3. Neue Belege? → validieren und zu Seafile hochladen
  type UploadedDoc = { url: string; name: string; path: string }
  let uploadedDocs: UploadedDoc[] = []

  if (newFiles.length > 0) {
    for (const file of newFiles) {
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

    const seafileSetup = await loadSeafileConfig(adminClient, decrypt)
    if (!seafileSetup) {
      return NextResponse.json(
        { error: "Seafile ist nicht konfiguriert." },
        { status: 500 }
      )
    }

    const year = new Date().getFullYear().toString()
    const timestampPrefix = new Date().toISOString().split("T")[0]

    for (const file of newFiles) {
      const buffer = Buffer.from(await file.arrayBuffer())
      const detected = detectFileTypeFromBuffer(buffer)
      if (
        detected.kind === "unknown" ||
        !ALLOWED_MIME_TYPES.has(detected.mimeType)
      ) {
        return NextResponse.json(
          {
            error: `Der Dateiinhalt von "${file.name}" entspricht keinem erlaubten Format.`,
          },
          { status: 400 }
        )
      }

      const safeName = sanitizeDocumentName(file.name || "beleg")
      const sanitized = sanitizeFileName(safeName)
      const finalName = `${timestampPrefix}_${sanitized}`

      try {
        const upload = await uploadToSeafile(
          seafileSetup.config,
          "/CBS-Finanz-Data/Genehmigungen/",
          year,
          finalName,
          buffer,
          detected.mimeType
        )
        if (!isValidDocumentUrl(upload.shareLink)) {
          return NextResponse.json(
            { error: "Seafile lieferte einen ungültigen Share-Link." },
            { status: 502 }
          )
        }
        uploadedDocs.push({
          url: upload.shareLink,
          name: safeName,
          path: upload.filePath,
        })
      } catch (err) {
        console.error("Seafile-Upload beim Resubmit fehlgeschlagen:", err)
        return NextResponse.json(
          { error: `Beleg "${file.name}" konnte nicht hochgeladen werden.` },
          { status: 502 }
        )
      }
    }
  }

  // 4. Antrag aktualisieren (Überarbeitung + Status zurück auf offen)
  const updatePayload: Record<string, unknown> = { status: "offen" }
  if (newNote !== null) updatePayload.note = newNote
  if (newRoles !== null) updatePayload.required_roles = newRoles
  if (newLinkType !== null) updatePayload.link_type = newLinkType
  if (uploadedDocs.length > 0) {
    // Primärbeleg (Kompatibilität) = erster neuer Beleg
    updatePayload.document_url = uploadedDocs[0].url
    updatePayload.document_path = uploadedDocs[0].path
    updatePayload.document_name = uploadedDocs[0].name
  }

  const effectiveRoles =
    newRoles ?? (existing.required_roles as ApprovalRoleType[])

  // 5. Genehmiger für (ggf. neue) Rollen prüfen
  const approvers = await loadApprovers(adminClient, effectiveRoles)
  const missingRoles = findMissingRoles(approvers, effectiveRoles)
  if (missingRoles.length > 0) {
    const names = missingRoles.map((r) => ROLE_LABELS[r]).join(" und ")
    return NextResponse.json(
      {
        error: `Es gibt keinen Benutzer mit der Rolle ${names}. Bitte weise die Rolle zuerst zu.`,
      },
      { status: 400 }
    )
  }

  // 6. Ersteller-E-Mail laden
  const { data: creator } = await adminClient
    .from("user_profiles")
    .select("email")
    .eq("id", existing.created_by)
    .single()

  // 7. Alte Entscheidungen & Tokens löschen
  const { error: deleteDecisionsError } = await adminClient
    .from("approval_decisions")
    .delete()
    .eq("request_id", id)

  if (deleteDecisionsError) {
    console.error("Fehler beim Löschen der Entscheidungen:", deleteDecisionsError)
    return NextResponse.json(
      { error: "Bestehende Entscheidungen konnten nicht zurückgesetzt werden." },
      { status: 500 }
    )
  }

  const { error: deleteTokensError } = await adminClient
    .from("approval_tokens")
    .delete()
    .eq("request_id", id)

  if (deleteTokensError) {
    console.error("Fehler beim Löschen der Tokens:", deleteTokensError)
    return NextResponse.json(
      { error: "Bestehende Tokens konnten nicht zurückgesetzt werden." },
      { status: 500 }
    )
  }

  // 8. Antrag aktualisieren
  const { error: updateError } = await adminClient
    .from("approval_requests")
    .update(updatePayload)
    .eq("id", id)

  if (updateError) {
    console.error("Fehler beim Update des Antrags:", updateError)
    return NextResponse.json(
      { error: "Antrag konnte nicht aktualisiert werden." },
      { status: 500 }
    )
  }

  // 8b. Dokumente austauschen, falls neue hochgeladen wurden
  if (uploadedDocs.length > 0) {
    await adminClient.from("approval_documents").delete().eq("request_id", id)

    const { error: insertDocsError } = await adminClient
      .from("approval_documents")
      .insert(
        uploadedDocs.map((d, index) => ({
          request_id: id,
          document_url: d.url,
          document_name: d.name,
          document_path: d.path,
          display_order: index,
        }))
      )

    if (insertDocsError) {
      console.error("Fehler beim Ersetzen der Dokumente:", insertDocsError)
      return NextResponse.json(
        { error: "Belege konnten nicht aktualisiert werden." },
        { status: 500 }
      )
    }
  }

  // 9. Neue Tokens + E-Mails mit den aktuellen Daten
  const finalNote = newNote ?? existing.note

  type DocRow = {
    id: string
    document_url: string
    document_name: string
    display_order: number
  }
  const existingDocs = (
    (existing as unknown as { approval_documents: DocRow[] }).approval_documents ?? []
  )
    .slice()
    .sort((a, b) => a.display_order - b.display_order)

  const documentsForEmail =
    uploadedDocs.length > 0
      ? uploadedDocs.map((d) => ({ url: d.url, name: d.name }))
      : existingDocs.length > 0
        ? existingDocs.map((d) => ({ url: d.document_url, name: d.document_name }))
        : existing.document_url && existing.document_name
          ? [{ url: existing.document_url, name: existing.document_name }]
          : []

  try {
    const result = await issueTokensAndSendEmails(adminClient, {
      requestId: id,
      note: finalNote,
      documents: documentsForEmail,
      createdAt: new Date().toISOString(),
      requesterEmail: creator?.email ?? adminResult.profile.email,
      approvers,
    })

    if (result.sent === 0 && result.failed > 0) {
      await adminClient
        .from("approval_requests")
        .update({ status: "entwurf" })
        .eq("id", id)

      return NextResponse.json(
        {
          error:
            "Der Antrag wurde überarbeitet, aber keine E-Mail konnte versendet werden. Als Entwurf gespeichert.",
        },
        { status: 502 }
      )
    }
  } catch (err) {
    console.error("Token-/E-Mail-Versand bei Resubmit fehlgeschlagen:", err)
    await adminClient
      .from("approval_requests")
      .update({ status: "entwurf" })
      .eq("id", id)

    return NextResponse.json(
      {
        error:
          "Der Antrag wurde überarbeitet und als Entwurf gespeichert — E-Mails konnten nicht versendet werden.",
      },
      { status: 502 }
    )
  }

  return NextResponse.json({ message: "Antrag erneut eingereicht." })
}

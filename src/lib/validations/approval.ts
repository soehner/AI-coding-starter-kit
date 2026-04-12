import { z } from "zod"

const ALLOWED_FILE_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/heic",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB

export const approvalRequestSchema = z.object({
  note: z
    .string()
    .min(1, "Bitte eine Bemerkung eingeben.")
    .max(2000, "Bemerkung darf maximal 2000 Zeichen lang sein."),
  required_roles: z
    .array(z.enum(["vorstand", "zweiter_vorstand"]))
    .min(1, "Bitte mindestens eine Genehmiger-Rolle auswählen."),
  link_type: z.enum(["und", "oder"], {
    message: "Bitte eine Verknüpfung auswählen.",
  }),
})

export type ApprovalRequestInput = z.infer<typeof approvalRequestSchema>

export function validateApprovalFile(file: File): string | null {
  if (!ALLOWED_FILE_TYPES.includes(file.type)) {
    return "Erlaubte Dateitypen: PDF, JPG, PNG, HEIC, DOC, DOCX"
  }
  if (file.size > MAX_FILE_SIZE) {
    return "Die Datei ist zu groß (maximal 10 MB)."
  }
  return null
}

export const approvalDecisionSchema = z.object({
  decision: z.enum(["genehmigt", "abgelehnt"], {
    message: "Bitte eine Entscheidung treffen.",
  }),
  comment: z.string().max(1000, "Kommentar darf maximal 1000 Zeichen lang sein.").optional(),
})

export type ApprovalDecisionInput = z.infer<typeof approvalDecisionSchema>

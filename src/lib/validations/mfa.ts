import { z } from "zod"

// Backup-Code-Verifizierung beim Login
export const backupCodeVerifySchema = z.object({
  code: z
    .string()
    .min(1, "Backup-Code ist erforderlich.")
    .max(50, "Backup-Code ist zu lang."),
})

export type BackupCodeVerifyInput = z.infer<typeof backupCodeVerifySchema>

// Backup-Code-Login abschliessen (Challenge/Verify)
export const backupCodeCompleteSchema = z.object({
  factorId: z.string().min(1, "Factor-ID ist erforderlich."),
  challengeId: z.string().min(1, "Challenge-ID ist erforderlich."),
})

export type BackupCodeCompleteInput = z.infer<typeof backupCodeCompleteSchema>

// Rate-Limit-Aktionen
export const rateLimitActionSchema = z.object({
  action: z.enum(["check", "fail", "reset"], {
    message: "Ungültige Aktion. Erlaubt: check, fail, reset.",
  }),
})

export type RateLimitActionInput = z.infer<typeof rateLimitActionSchema>

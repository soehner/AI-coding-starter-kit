import { z } from "zod"

export const settingsSchema = z.object({
  provider: z.enum(["openai", "anthropic"], {
    message: "Bitte einen gültigen KI-Provider auswählen.",
  }),
  token: z
    .string()
    .min(1, "API-Token ist erforderlich.")
    .optional(),
})

export type SettingsInput = z.infer<typeof settingsSchema>

export const testTokenSchema = z.object({
  provider: z.enum(["openai", "anthropic"], {
    message: "Bitte einen gültigen KI-Provider auswählen.",
  }),
  token: z.string().optional(),
})

export type TestTokenInput = z.infer<typeof testTokenSchema>

export const confirmImportSchema = z.object({
  statement_number: z
    .string()
    .min(1, "Kontoauszugsnummer ist erforderlich."),
  statement_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Datum muss im Format YYYY-MM-DD sein."),
  file_name: z
    .string()
    .min(1, "Dateiname ist erforderlich."),
  file_path: z
    .string()
    .min(1, "Dateipfad ist erforderlich."),
  start_balance: z.number(),
  end_balance: z.number(),
  transactions: z
    .array(
      z.object({
        id: z.string(),
        booking_date: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/, "Buchungsdatum muss im Format YYYY-MM-DD sein."),
        value_date: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/, "Wertstellungsdatum muss im Format YYYY-MM-DD sein."),
        description: z.string().min(1, "Buchungstext ist erforderlich."),
        counterpart: z.string().max(300).nullable().optional(),
        amount: z.number(),
        balance_after: z.number(),
      })
    )
    .min(1, "Mindestens eine Buchung ist erforderlich."),
})

export type ConfirmImportInput = z.infer<typeof confirmImportSchema>

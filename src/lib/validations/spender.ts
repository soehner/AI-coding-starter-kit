import { z } from "zod"
import { istGueltigeIban } from "@/lib/validations/iban"

/**
 * PROJ-17: Validierung für Spender-Datensätze (Spender-Datenbank).
 *
 * Spender enthalten DSGVO-sensible Daten – nur Pflichtfeld ist der Name,
 * alle anderen Felder sind optional und werden bei Bedarf nachgepflegt.
 */
export const spenderSchema = z.object({
  name: z
    .string()
    .min(1, "Name ist erforderlich.")
    .max(200, "Name darf maximal 200 Zeichen lang sein."),
  strasse: z
    .string()
    .max(200, "Straße darf maximal 200 Zeichen lang sein.")
    .nullable()
    .optional(),
  plz: z
    .string()
    .max(10, "PLZ darf maximal 10 Zeichen lang sein.")
    .nullable()
    .optional(),
  ort: z
    .string()
    .max(100, "Ort darf maximal 100 Zeichen lang sein.")
    .nullable()
    .optional(),
  email: z
    .union([
      z.literal(""),
      z
        .email("Bitte eine gültige E-Mail-Adresse eingeben.")
        .max(200, "E-Mail darf maximal 200 Zeichen lang sein."),
    ])
    .nullable()
    .optional(),
  iban: z
    .string()
    .max(34, "IBAN darf maximal 34 Zeichen lang sein.")
    .refine(istGueltigeIban, {
      message:
        "Ungültige IBAN (Format oder Prüfziffer). Bitte vollständige IBAN inklusive Länderkürzel eingeben.",
    })
    .nullable()
    .optional(),
})

export type SpenderInput = z.infer<typeof spenderSchema>

/**
 * Partielles Schema für PATCH-Updates – mindestens ein Feld muss gesetzt sein.
 */
export const spenderUpdateSchema = spenderSchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  { message: "Mindestens ein Feld muss angegeben werden." }
)

export type SpenderUpdateInput = z.infer<typeof spenderUpdateSchema>

import { z } from "zod"

export const createAntragSchema = z.object({
  firstName: z
    .string()
    .trim()
    .min(1, "Vorname ist erforderlich.")
    .max(100, "Vorname darf maximal 100 Zeichen lang sein."),
  lastName: z
    .string()
    .trim()
    .min(1, "Nachname ist erforderlich.")
    .max(100, "Nachname darf maximal 100 Zeichen lang sein."),
  email: z
    .string()
    .trim()
    .min(1, "E-Mail-Adresse ist erforderlich.")
    .email("Bitte eine gültige E-Mail-Adresse eingeben."),
  amount: z
    .number({ message: "Betrag muss eine Zahl sein." })
    .positive("Bitte geben Sie einen Betrag größer als 0 Euro ein.")
    .max(999999.99, "Betrag darf maximal 999.999,99 € betragen."),
  purpose: z
    .string()
    .trim()
    .min(1, "Verwendungszweck ist erforderlich.")
    .max(2000, "Verwendungszweck darf maximal 2000 Zeichen lang sein."),
})

export type CreateAntragInput = z.infer<typeof createAntragSchema>

export const antragDecisionSchema = z.object({
  decision: z.enum(["genehmigt", "abgelehnt"], {
    message: "Bitte eine Entscheidung treffen.",
  }),
  comment: z
    .string()
    .max(1000, "Kommentar darf maximal 1000 Zeichen lang sein.")
    .optional(),
})

export type AntragDecisionInput = z.infer<typeof antragDecisionSchema>

export const updateAntragSchema = z.object({
  firstName: z
    .string()
    .trim()
    .min(1, "Vorname ist erforderlich.")
    .max(100, "Vorname darf maximal 100 Zeichen lang sein."),
  lastName: z
    .string()
    .trim()
    .min(1, "Nachname ist erforderlich.")
    .max(100, "Nachname darf maximal 100 Zeichen lang sein."),
  email: z
    .string()
    .trim()
    .min(1, "E-Mail-Adresse ist erforderlich.")
    .email("Bitte eine gültige E-Mail-Adresse eingeben."),
  amount: z
    .number({ message: "Betrag muss eine Zahl sein." })
    .positive("Betrag muss größer als 0 Euro sein.")
    .max(999999.99, "Betrag darf maximal 999.999,99 € betragen."),
  purpose: z
    .string()
    .trim()
    .min(1, "Verwendungszweck ist erforderlich.")
    .max(2000, "Verwendungszweck darf maximal 2000 Zeichen lang sein."),
})

export type UpdateAntragInput = z.infer<typeof updateAntragSchema>

export const genehmigerPoolUpdateSchema = z.object({
  user_ids: z.array(z.string().uuid()).max(50),
})

export type GenehmigerPoolUpdate = z.infer<typeof genehmigerPoolUpdateSchema>

import { z } from "zod"

export const createCostRequestSchema = z.object({
  firstName: z
    .string()
    .min(1, "Vorname ist erforderlich.")
    .max(100, "Vorname darf maximal 100 Zeichen lang sein."),
  lastName: z
    .string()
    .min(1, "Nachname ist erforderlich.")
    .max(100, "Nachname darf maximal 100 Zeichen lang sein."),
  email: z
    .string()
    .min(1, "E-Mail-Adresse ist erforderlich.")
    .email("Bitte eine gültige E-Mail-Adresse eingeben."),
  amount: z
    .number({ message: "Betrag muss eine Zahl sein." })
    .positive("Bitte geben Sie einen Betrag größer als 0 Euro ein.")
    .max(999999.99, "Betrag darf maximal 999.999,99 € betragen."),
  purpose: z
    .string()
    .min(1, "Verwendungszweck ist erforderlich.")
    .max(2000, "Verwendungszweck darf maximal 2000 Zeichen lang sein."),
})

export type CreateCostRequestInput = z.infer<typeof createCostRequestSchema>

export const voteDecisionSchema = z.object({
  token: z.string().min(1, "Token ist erforderlich."),
  decision: z.enum(["genehmigt", "abgelehnt"], {
    message: "Entscheidung muss 'genehmigt' oder 'abgelehnt' sein.",
  }),
})

export type VoteDecisionInput = z.infer<typeof voteDecisionSchema>

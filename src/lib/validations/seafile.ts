import { z } from "zod"

export const seafileSettingsSchema = z.object({
  seafile_url: z
    .string()
    .url("Bitte eine gültige URL eingeben.")
    .min(1, "Seafile Server-URL ist erforderlich."),
  seafile_token: z
    .string()
    .min(1, "API-Token ist erforderlich.")
    .optional(),
  seafile_repo_id: z
    .string()
    .min(1, "Bibliotheks-ID ist erforderlich."),
  seafile_receipt_path: z
    .string()
    .min(1, "Basispfad für Belege ist erforderlich.")
    .default("/Förderverein/Belege/"),
  seafile_statement_path: z
    .string()
    .min(1, "Basispfad für Kontoauszüge ist erforderlich.")
    .default("/Förderverein/Kontoauszüge/"),
})

export type SeafileSettingsInput = z.infer<typeof seafileSettingsSchema>

export const seafileTestSchema = z.object({
  url: z
    .string()
    .url("Bitte eine gültige URL eingeben.")
    .min(1, "Seafile Server-URL ist erforderlich."),
  token: z
    .string()
    .min(1, "API-Token ist erforderlich.")
    .optional(),
  repo_id: z
    .string()
    .min(1, "Bibliotheks-ID ist erforderlich."),
})

export type SeafileTestInput = z.infer<typeof seafileTestSchema>

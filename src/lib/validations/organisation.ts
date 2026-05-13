import { z } from "zod"

/**
 * PROJ-17: Validierung der Organisationseinstellungen (Vereinsdaten für die
 * Zuwendungsbestätigung). Wird in app_settings unter den Keys org_* abgelegt.
 *
 * Alle Felder sind beim ersten Befüllen Pflicht – andernfalls kann keine
 * Quittung erstellt werden. Beim Speichern erlauben wir leere Strings,
 * damit der Benutzer den Datensatz inkrementell aufbaut.
 */
export const organisationSettingsSchema = z.object({
  verein_name: z
    .string()
    .min(1, "Vereinsname ist erforderlich.")
    .max(200, "Vereinsname darf maximal 200 Zeichen lang sein."),
  adresse_zeile1: z
    .string()
    .min(1, "Adresse (Zeile 1) ist erforderlich.")
    .max(200, "Adresse darf maximal 200 Zeichen lang sein."),
  adresse_zeile2: z
    .string()
    .max(200, "Adresse darf maximal 200 Zeichen lang sein.")
    .optional()
    .default(""),
  plz: z
    .string()
    .min(1, "PLZ ist erforderlich.")
    .max(10, "PLZ darf maximal 10 Zeichen lang sein."),
  ort: z
    .string()
    .min(1, "Ort ist erforderlich.")
    .max(100, "Ort darf maximal 100 Zeichen lang sein."),
  steuernummer: z
    .string()
    .min(1, "Steuernummer ist erforderlich.")
    .max(50, "Steuernummer darf maximal 50 Zeichen lang sein."),
  finanzamt: z
    .string()
    .min(1, "Finanzamt ist erforderlich.")
    .max(200, "Finanzamt darf maximal 200 Zeichen lang sein."),
  freistellungsbescheid_datum: z
    .string()
    .regex(
      /^\d{4}-\d{2}-\d{2}$/,
      "Bescheid-Datum muss im Format YYYY-MM-DD sein."
    ),
  freistellungsbescheid_aktenzeichen: z
    .string()
    .min(1, "Aktenzeichen ist erforderlich.")
    .max(100, "Aktenzeichen darf maximal 100 Zeichen lang sein."),
  satzungszweck: z
    .string()
    .min(1, "Satzungsmäßiger Zweck ist erforderlich.")
    .max(500, "Zweck darf maximal 500 Zeichen lang sein."),
  unterzeichner_name: z
    .string()
    .min(1, "Unterzeichner-Name ist erforderlich.")
    .max(200, "Name darf maximal 200 Zeichen lang sein."),
  letzter_veranlagungszeitraum: z
    .string()
    .min(1, "Veranlagungszeitraum ist erforderlich.")
    .max(100, "Veranlagungszeitraum darf maximal 100 Zeichen lang sein."),
  // Optionale Vorstandsdaten – werden für CC-Versand beim E-Mail-Versand der
  // Quittungen genutzt. Leere Strings = nicht hinterlegt.
  vorstand1_name: z
    .string()
    .max(200, "Name darf maximal 200 Zeichen lang sein.")
    .optional()
    .default(""),
  vorstand1_email: z
    .union([
      z.literal(""),
      z
        .email("Bitte eine gültige E-Mail-Adresse für den 1. Vorsitzenden eingeben.")
        .max(200, "E-Mail darf maximal 200 Zeichen lang sein."),
    ])
    .optional()
    .default(""),
  vorstand2_name: z
    .string()
    .max(200, "Name darf maximal 200 Zeichen lang sein.")
    .optional()
    .default(""),
  vorstand2_email: z
    .union([
      z.literal(""),
      z
        .email("Bitte eine gültige E-Mail-Adresse für den 2. Vorsitzenden eingeben.")
        .max(200, "E-Mail darf maximal 200 Zeichen lang sein."),
    ])
    .optional()
    .default(""),
})

export type OrganisationSettingsInput = z.infer<
  typeof organisationSettingsSchema
>

/**
 * Liste aller app_settings-Keys, die zur Organisation gehören.
 * Wird vom GET- und POST-Endpoint /api/admin/settings verwendet.
 */
export const ORGANISATION_SETTING_KEYS = [
  "org_verein_name",
  "org_adresse_zeile1",
  "org_adresse_zeile2",
  "org_plz",
  "org_ort",
  "org_steuernummer",
  "org_finanzamt",
  "org_freistellungsbescheid_datum",
  "org_freistellungsbescheid_aktenzeichen",
  "org_satzungszweck",
  "org_unterzeichner_name",
  "org_letzter_veranlagungszeitraum",
  "org_vorstand1_name",
  "org_vorstand1_email",
  "org_vorstand2_name",
  "org_vorstand2_email",
] as const

export type OrganisationSettingKey = (typeof ORGANISATION_SETTING_KEYS)[number]

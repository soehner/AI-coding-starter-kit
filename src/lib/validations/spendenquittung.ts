import { z } from "zod"
import { istGueltigeIban } from "@/lib/validations/iban"

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Datum muss im Format YYYY-MM-DD sein.")

/**
 * PROJ-17: Validierung beim Erstellen einer neuen Spendenquittung.
 *
 * Der API-Aufruf erfolgt entweder mit `spender_id` (bestehender Spender)
 * oder mit `spender_neu` (neuer Spender, der inline angelegt wird).
 * Genau eine der beiden Varianten muss gesetzt sein.
 */
export const spendenquittungCreateSchema = z
  .object({
    transaction_id: z.uuid("Ungültige Buchungs-ID.").nullable().optional(),
    spender_id: z.uuid("Ungültige Spender-ID.").optional(),
    spender_neu: z
      .object({
        name: z
          .string()
          .min(1, "Spendername ist erforderlich.")
          .max(200, "Spendername darf maximal 200 Zeichen lang sein."),
        strasse: z
          .string()
          .max(200, "Straße darf maximal 200 Zeichen lang sein.")
          .optional(),
        plz: z
          .string()
          .max(10, "PLZ darf maximal 10 Zeichen lang sein.")
          .optional(),
        ort: z
          .string()
          .max(100, "Ort darf maximal 100 Zeichen lang sein.")
          .optional(),
        email: z
          .union([
            z.literal(""),
            z
              .email("Bitte eine gültige E-Mail-Adresse eingeben.")
              .max(200, "E-Mail darf maximal 200 Zeichen lang sein."),
          ])
          .optional(),
        iban: z
          .string()
          .max(34, "IBAN darf maximal 34 Zeichen lang sein.")
          .refine(istGueltigeIban, {
            message:
              "Ungültige IBAN (Format oder Prüfziffer). Bitte vollständige IBAN eingeben oder Feld leer lassen.",
          })
          .optional(),
      })
      .optional(),
    betrag: z
      .number()
      .finite("Betrag muss eine gültige Zahl sein.")
      .positive("Betrag muss größer als 0 sein.")
      .max(1_000_000, "Betrag außerhalb des erlaubten Bereichs."),
    spende_datum: isoDate,
    quittung_datum: isoDate.optional(),
    zweck: z
      .string()
      .min(1, "Satzungsmäßiger Zweck ist erforderlich.")
      .max(500, "Zweck darf maximal 500 Zeichen lang sein."),
  })
  .refine(
    (data) =>
      (data.spender_id && !data.spender_neu) ||
      (!data.spender_id && data.spender_neu),
    {
      message:
        "Entweder spender_id oder spender_neu angeben (genau eines).",
      path: ["spender_id"],
    }
  )

export type SpendenquittungCreateInput = z.infer<
  typeof spendenquittungCreateSchema
>

/**
 * Validierung beim Bearbeiten einer bestehenden Quittung.
 *
 * Alle Felder sind optional – es werden nur die übergebenen Felder
 * aktualisiert. Bei Änderungen an betrag, spende_datum, quittung_datum,
 * zweck oder spender wird das PDF serverseitig neu generiert.
 */
export const spendenquittungUpdateSchema = z
  .object({
    spender_id: z.uuid("Ungültige Spender-ID.").optional(),
    betrag: z
      .number()
      .finite("Betrag muss eine gültige Zahl sein.")
      .positive("Betrag muss größer als 0 sein.")
      .max(1_000_000, "Betrag außerhalb des erlaubten Bereichs.")
      .optional(),
    spende_datum: isoDate.optional(),
    quittung_datum: isoDate.optional(),
    zweck: z
      .string()
      .min(1, "Satzungsmäßiger Zweck darf nicht leer sein.")
      .max(500, "Zweck darf maximal 500 Zeichen lang sein.")
      .optional(),
  })
  .refine(
    (data) => Object.keys(data).length > 0,
    "Mindestens ein Feld muss zur Aktualisierung angegeben werden."
  )

export type SpendenquittungUpdateInput = z.infer<
  typeof spendenquittungUpdateSchema
>

/**
 * Validierung für den E-Mail-Versand einer bestehenden Quittung.
 */
export const spendenquittungEmailSchema = z.object({
  empfaenger: z
    .email("Bitte eine gültige E-Mail-Adresse eingeben.")
    .max(200, "E-Mail darf maximal 200 Zeichen lang sein."),
  betreff: z
    .string()
    .min(1, "Betreff ist erforderlich.")
    .max(200, "Betreff darf maximal 200 Zeichen lang sein."),
  text: z
    .string()
    .min(1, "Nachricht darf nicht leer sein.")
    .max(5000, "Nachricht darf maximal 5000 Zeichen lang sein."),
  /** Optionale CC-Empfänger – aktuell vom Frontend für „Kopie an Vorstand" genutzt. */
  cc: z
    .array(
      z
        .email("Ungültige CC-E-Mail.")
        .max(200, "CC-E-Mail darf maximal 200 Zeichen lang sein.")
    )
    .max(5, "Maximal 5 CC-Empfänger erlaubt.")
    .optional(),
})

export type SpendenquittungEmailInput = z.infer<
  typeof spendenquittungEmailSchema
>

/**
 * Query-Parameter für GET /api/admin/spendenquittungen
 */
export const spendenquittungListQuerySchema = z.object({
  jahr: z
    .string()
    .regex(/^\d{4}$/, "Jahr muss vierstellig sein.")
    .optional(),
  spender_suche: z
    .string()
    .max(200, "Suchtext darf maximal 200 Zeichen lang sein.")
    .optional(),
  versand_status: z.enum(["alle", "versendet", "nicht_versendet"]).optional(),
  page: z
    .string()
    .regex(/^\d+$/, "Seite muss eine Zahl sein.")
    .optional(),
  /** BUG-2-Fix: Filter auf eine einzelne Buchungs-ID (zur Doppel-Quittungs-Prüfung). */
  transaction_id: z.uuid("Ungültige Buchungs-ID.").optional(),
})

export type SpendenquittungListQuery = z.infer<
  typeof spendenquittungListQuerySchema
>

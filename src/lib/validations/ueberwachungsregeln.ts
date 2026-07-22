import { z } from "zod"

/**
 * PROJ-18: Zod-Schemas für Überwachungsregeln.
 *
 * Die `bedingung` einer Regel wird sowohl von der KI-Antwort (Übersetzung)
 * als auch beim Speichern (POST/PATCH) mit demselben Schema strikt
 * validiert — es gelangt niemals unvalidiertes KI-JSON in die Datenbank.
 */

// ---------------------------------------------------------------------------
// Einzelkriterien
// ---------------------------------------------------------------------------

const criterionTermSchema = z
  .string()
  .trim()
  .min(1, "Suchbegriff darf nicht leer sein.")
  .max(200, "Suchbegriff darf maximal 200 Zeichen lang sein.")

export const ueberwachungsTextContainsSchema = z.object({
  type: z.literal("text_contains"),
  term: criterionTermSchema,
})

export const ueberwachungsCounterpartContainsSchema = z.object({
  type: z.literal("counterpart_contains"),
  term: criterionTermSchema,
})

export const ueberwachungsAmountRangeSchema = z
  .object({
    type: z.literal("amount_range"),
    min: z
      .number({ message: "Von-Betrag muss eine Zahl sein." })
      .finite("Von-Betrag muss eine Zahl sein.")
      .min(0, "Von-Betrag darf nicht negativ sein."),
    max: z
      .number({ message: "Bis-Betrag muss eine Zahl sein." })
      .finite("Bis-Betrag muss eine Zahl sein.")
      .min(0, "Bis-Betrag darf nicht negativ sein."),
    direction: z.enum(["both", "in", "out"], {
      message: "Richtung muss 'both', 'in' oder 'out' sein.",
    }),
  })
  .refine((d) => d.min <= d.max, {
    message: "Von-Betrag muss kleiner oder gleich dem Bis-Betrag sein.",
    path: ["max"],
  })

export const ueberwachungsIbanEqualsSchema = z.object({
  type: z.literal("iban_equals"),
  iban: z
    .string()
    .trim()
    .min(15, "IBAN ist zu kurz.")
    .max(34, "IBAN ist zu lang.")
    .regex(
      /^[A-Z]{2}[0-9A-Z]+$/,
      "IBAN muss mit einem Ländercode beginnen und darf keine Leerzeichen enthalten."
    ),
})

export const ueberwachungsCriterionSchema = z.discriminatedUnion("type", [
  ueberwachungsTextContainsSchema,
  ueberwachungsCounterpartContainsSchema,
  ueberwachungsAmountRangeSchema,
  ueberwachungsIbanEqualsSchema,
])

export const ueberwachungsCombinatorSchema = z.enum(["AND", "OR"], {
  message: "Verknüpfung muss 'AND' oder 'OR' sein.",
})

export const ueberwachungsCriteriaListSchema = z
  .array(ueberwachungsCriterionSchema)
  .min(1, "Mindestens ein Kriterium ist erforderlich.")
  .max(10, "Maximal 10 Kriterien pro Regel.")

// ---------------------------------------------------------------------------
// Muster-Parameter
// ---------------------------------------------------------------------------

export const ueberwachungsMusterSchema = z.object({
  art: z.enum(["anzahl", "summe"], {
    message: "Muster-Art muss 'anzahl' oder 'summe' sein.",
  }),
  schwelle: z
    .number({ message: "Schwellwert muss eine Zahl sein." })
    .finite("Schwellwert muss eine Zahl sein.")
    .positive("Schwellwert muss größer als 0 sein."),
  zeitfenster_tage: z
    .number({ message: "Zeitfenster muss eine Zahl sein." })
    .int("Zeitfenster muss eine ganze Zahl (Tage) sein.")
    .min(1, "Zeitfenster muss mindestens 1 Tag betragen.")
    .max(366, "Zeitfenster darf maximal 366 Tage betragen."),
})

// ---------------------------------------------------------------------------
// Bedingung (typabhängig)
// ---------------------------------------------------------------------------

/**
 * Vollständige Bedingung inkl. Regeltyp. `muster` ist bei
 * regel_typ='muster' Pflicht und bei 'einzelbuchung' verboten.
 */
export const ueberwachungsBedingungSchema = z
  .object({
    regel_typ: z.enum(["einzelbuchung", "muster"], {
      message: "Regeltyp muss 'einzelbuchung' oder 'muster' sein.",
    }),
    combinator: ueberwachungsCombinatorSchema,
    criteria: ueberwachungsCriteriaListSchema,
    muster: ueberwachungsMusterSchema.optional(),
  })
  .refine(
    (d) => (d.regel_typ === "muster" ? d.muster !== undefined : true),
    {
      message: "Für eine Muster-Regel müssen Muster-Parameter angegeben werden.",
      path: ["muster"],
    }
  )
  .refine(
    (d) => (d.regel_typ === "einzelbuchung" ? d.muster === undefined : true),
    {
      message: "Eine Einzelbuchungs-Regel darf keine Muster-Parameter enthalten.",
      path: ["muster"],
    }
  )

export type UeberwachungsBedingungInput = z.infer<
  typeof ueberwachungsBedingungSchema
>

// ---------------------------------------------------------------------------
// Empfänger
// ---------------------------------------------------------------------------

export const empfaengerListeSchema = z
  .array(
    z
      .string()
      .trim()
      .toLowerCase()
      .email("Ungültige E-Mail-Adresse.")
      .max(200, "E-Mail-Adresse darf maximal 200 Zeichen lang sein.")
  )
  .min(1, "Mindestens ein Empfänger ist erforderlich.")
  .max(20, "Maximal 20 Empfänger pro Regel.")
  // Duplikate entfernen
  .transform((list) => Array.from(new Set(list)))

export const regelNameSchema = z
  .string()
  .trim()
  .min(1, "Der Regelname darf nicht leer sein.")
  .max(120, "Der Regelname darf maximal 120 Zeichen lang sein.")

const freitextSchema = z
  .string()
  .trim()
  .max(2000, "Der Freitext darf maximal 2000 Zeichen lang sein.")

// ---------------------------------------------------------------------------
// KI-Übersetzung
// ---------------------------------------------------------------------------

export const uebersetzenRequestSchema = z.object({
  freitext: z
    .string()
    .trim()
    .min(5, "Bitte beschreibe die Regel in mindestens ein paar Worten.")
    .max(2000, "Der Freitext darf maximal 2000 Zeichen lang sein."),
})

export type UebersetzenRequestInput = z.infer<typeof uebersetzenRequestSchema>

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

export const createUeberwachungsregelSchema = z.object({
  name: regelNameSchema,
  freitext_original: freitextSchema.optional(),
  bedingung: ueberwachungsBedingungSchema,
  empfaenger: empfaengerListeSchema,
  ist_aktiv: z.boolean().optional(),
})

export type CreateUeberwachungsregelInput = z.infer<
  typeof createUeberwachungsregelSchema
>

export const updateUeberwachungsregelSchema = z
  .object({
    name: regelNameSchema.optional(),
    freitext_original: freitextSchema.optional(),
    bedingung: ueberwachungsBedingungSchema.optional(),
    empfaenger: empfaengerListeSchema.optional(),
    ist_aktiv: z.boolean().optional(),
    sortierung: z.number().int().min(0).optional(),
  })
  .refine((d) => Object.keys(d).length > 0, {
    message: "Es wurden keine Änderungen übermittelt.",
  })

export type UpdateUeberwachungsregelInput = z.infer<
  typeof updateUeberwachungsregelSchema
>

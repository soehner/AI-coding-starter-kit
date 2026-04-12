import { z } from "zod"

/**
 * PROJ-13: Zod-Schemas für Kategorisierungsregeln.
 *
 * Die `condition` einer Regel ist typ-abhängig (JSONB):
 *  - text_contains / counterpart_contains: { term: string }
 *  - amount_range:                        { min, max, direction }
 *  - month_quarter:                       { months?: number[], quarters?: number[] }
 */

export const ruleNameSchema = z
  .string()
  .trim()
  .min(1, "Der Regelname darf nicht leer sein.")
  .max(120, "Der Regelname darf maximal 120 Zeichen lang sein.")

export const textContainsConditionSchema = z.object({
  term: z
    .string()
    .trim()
    .min(1, "Suchbegriff darf nicht leer sein.")
    .max(200, "Suchbegriff darf maximal 200 Zeichen lang sein."),
})

export const counterpartContainsConditionSchema = textContainsConditionSchema

export const amountRangeConditionSchema = z
  .object({
    min: z
      .number({ message: "Von-Betrag muss eine Zahl sein." })
      .finite("Von-Betrag muss eine Zahl sein."),
    max: z
      .number({ message: "Bis-Betrag muss eine Zahl sein." })
      .finite("Bis-Betrag muss eine Zahl sein."),
    direction: z.enum(["both", "in", "out"], {
      message: "Richtung muss 'both', 'in' oder 'out' sein.",
    }),
  })
  .refine((d) => d.min <= d.max, {
    message: "Von-Betrag muss kleiner oder gleich dem Bis-Betrag sein.",
    path: ["max"],
  })

export const monthQuarterConditionSchema = z
  .object({
    months: z
      .array(z.number().int().min(1).max(12))
      .max(12, "Maximal 12 Monate möglich.")
      .optional(),
    quarters: z
      .array(z.number().int().min(1).max(4))
      .max(4, "Maximal 4 Quartale möglich.")
      .optional(),
  })
  .refine(
    (d) => (d.months && d.months.length > 0) || (d.quarters && d.quarters.length > 0),
    {
      message: "Mindestens ein Monat oder Quartal muss gewählt werden.",
      path: ["months"],
    }
  )
  // BUG-005: Monate und Quartale dürfen nicht gleichzeitig gesetzt sein.
  // Das UI verhindert das bereits, aber der Server muss manipulierte
  // Requests abweisen, damit die Regel-Matching-Logik nicht stillschweigend
  // einen der beiden Werte ignoriert.
  .refine(
    (d) =>
      !(
        d.months &&
        d.months.length > 0 &&
        d.quarters &&
        d.quarters.length > 0
      ),
    {
      message:
        "Monate und Quartale können nicht gleichzeitig gewählt werden. Bitte nur eine Auswahl treffen.",
      path: ["quarters"],
    }
  )

export const createCategorizationRuleSchema = z
  .object({
    name: ruleNameSchema,
    rule_type: z.enum(
      ["text_contains", "counterpart_contains", "amount_range", "month_quarter"],
      { message: "Ungültiger Regeltyp." }
    ),
    category_id: z.string().uuid("Ungültige Kategorie-ID."),
    is_active: z.boolean().optional(),
    condition: z.unknown(),
  })
  .superRefine((data, ctx) => {
    switch (data.rule_type) {
      case "text_contains": {
        const res = textContainsConditionSchema.safeParse(data.condition)
        if (!res.success) {
          ctx.addIssue({
            code: "custom",
            path: ["condition"],
            message: res.error.issues[0]?.message ?? "Ungültige Bedingung.",
          })
        }
        break
      }
      case "counterpart_contains": {
        const res = counterpartContainsConditionSchema.safeParse(data.condition)
        if (!res.success) {
          ctx.addIssue({
            code: "custom",
            path: ["condition"],
            message: res.error.issues[0]?.message ?? "Ungültige Bedingung.",
          })
        }
        break
      }
      case "amount_range": {
        const res = amountRangeConditionSchema.safeParse(data.condition)
        if (!res.success) {
          ctx.addIssue({
            code: "custom",
            path: ["condition"],
            message: res.error.issues[0]?.message ?? "Ungültige Bedingung.",
          })
        }
        break
      }
      case "month_quarter": {
        const res = monthQuarterConditionSchema.safeParse(data.condition)
        if (!res.success) {
          ctx.addIssue({
            code: "custom",
            path: ["condition"],
            message: res.error.issues[0]?.message ?? "Ungültige Bedingung.",
          })
        }
        break
      }
    }
  })

export type CreateCategorizationRuleInput = z.infer<
  typeof createCategorizationRuleSchema
>

export const updateCategorizationRuleSchema = z.object({
  name: ruleNameSchema.optional(),
  category_id: z.string().uuid("Ungültige Kategorie-ID.").optional(),
  is_active: z.boolean().optional(),
  condition: z.unknown().optional(),
  sort_order: z.number().int().min(0).optional(),
})

export type UpdateCategorizationRuleInput = z.infer<
  typeof updateCategorizationRuleSchema
>

/**
 * Scope-basierter Plan-Request: liefert die Liste der zu verarbeitenden
 * Buchungs-IDs, damit der Client die eigentliche Anwendung in kleinen
 * Chunks mit echter Progress-Anzeige ausführen kann (BUG-004).
 */
export const planCategorizationRulesSchema = z.object({
  scope: z.enum(["uncategorized", "all"], {
    message: "Scope muss 'uncategorized' oder 'all' sein.",
  }),
})

export type PlanCategorizationRulesInput = z.infer<
  typeof planCategorizationRulesSchema
>

/**
 * Apply-Request: Entweder ein ganzer Scope (abwärtskompatibel) oder
 * eine explizite ID-Liste (vom Plan-Endpunkt, chunk-weise durch das
 * Frontend). `transaction_ids` hat Vorrang.
 */
export const applyCategorizationRulesSchema = z
  .object({
    scope: z
      .enum(["uncategorized", "all"], {
        message: "Scope muss 'uncategorized' oder 'all' sein.",
      })
      .optional(),
    transaction_ids: z
      .array(z.string().uuid("Ungültige Buchungs-ID."))
      .max(1000, "Maximal 1000 Buchungen pro Chunk.")
      .optional(),
  })
  .refine(
    (d) =>
      (d.scope !== undefined) !== (d.transaction_ids !== undefined) ||
      // Beide gesetzt ist erlaubt, aber sinnlos — wir verlangen mindestens eines.
      d.scope !== undefined ||
      d.transaction_ids !== undefined,
    {
      message: "Entweder 'scope' oder 'transaction_ids' angeben.",
    }
  )

export type ApplyCategorizationRulesInput = z.infer<
  typeof applyCategorizationRulesSchema
>

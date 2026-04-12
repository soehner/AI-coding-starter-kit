import { z } from "zod"

/**
 * PROJ-15: Zod-Schemas für zusammengesetzte Kategorisierungsregeln.
 *
 * Eine Regel besteht aus:
 *  - name
 *  - combinator: "AND" | "OR"
 *  - criteria: Liste (min 1, max 10) von typisierten Kriterien
 *  - category_id
 *  - is_active
 *
 * Jedes Kriterium trägt seinen eigenen `type` plus typ-spezifische
 * Parameter. Die Validierung nutzt eine `z.discriminatedUnion` über
 * das `type`-Feld.
 */

export const ruleNameSchema = z
  .string()
  .trim()
  .min(1, "Der Regelname darf nicht leer sein.")
  .max(120, "Der Regelname darf maximal 120 Zeichen lang sein.")

const criterionTermSchema = z
  .string()
  .trim()
  .min(1, "Suchbegriff darf nicht leer sein.")
  .max(200, "Suchbegriff darf maximal 200 Zeichen lang sein.")

export const textContainsCriterionSchema = z.object({
  type: z.literal("text_contains"),
  term: criterionTermSchema,
})

export const counterpartContainsCriterionSchema = z.object({
  type: z.literal("counterpart_contains"),
  term: criterionTermSchema,
})

export const amountRangeCriterionSchema = z
  .object({
    type: z.literal("amount_range"),
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

export const monthQuarterCriterionSchema = z
  .object({
    type: z.literal("month_quarter"),
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
    (d) =>
      (d.months && d.months.length > 0) ||
      (d.quarters && d.quarters.length > 0),
    {
      message: "Mindestens ein Monat oder Quartal muss gewählt werden.",
      path: ["months"],
    }
  )
  // PROJ-13 BUG-005: Monate und Quartale dürfen nicht gleichzeitig gesetzt sein.
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

/**
 * Discriminated Union über alle Kriteriums-Typen. Jedes Kriterium
 * wird anhand seines `type`-Feldes an das passende Schema gegeben.
 */
export const ruleCriterionSchema = z.discriminatedUnion("type", [
  textContainsCriterionSchema,
  counterpartContainsCriterionSchema,
  amountRangeCriterionSchema,
  monthQuarterCriterionSchema,
])

export const ruleCombinatorSchema = z.enum(["AND", "OR"], {
  message: "Combinator muss 'AND' oder 'OR' sein.",
})

export const ruleCriteriaListSchema = z
  .array(ruleCriterionSchema)
  .min(1, "Mindestens ein Kriterium ist erforderlich.")
  .max(10, "Maximal 10 Kriterien pro Regel.")

export const createCategorizationRuleSchema = z.object({
  name: ruleNameSchema,
  combinator: ruleCombinatorSchema,
  criteria: ruleCriteriaListSchema,
  category_id: z.string().uuid("Ungültige Kategorie-ID."),
  is_active: z.boolean().optional(),
})

export type CreateCategorizationRuleInput = z.infer<
  typeof createCategorizationRuleSchema
>

export const updateCategorizationRuleSchema = z.object({
  name: ruleNameSchema.optional(),
  combinator: ruleCombinatorSchema.optional(),
  criteria: ruleCriteriaListSchema.optional(),
  category_id: z.string().uuid("Ungültige Kategorie-ID.").optional(),
  is_active: z.boolean().optional(),
  sort_order: z.number().int().min(0).optional(),
})

export type UpdateCategorizationRuleInput = z.infer<
  typeof updateCategorizationRuleSchema
>

/**
 * Scope-basierter Plan-Request: liefert die Liste der zu
 * verarbeitenden Buchungs-IDs, damit der Client die eigentliche
 * Anwendung in kleinen Chunks mit echter Progress-Anzeige
 * ausführen kann (PROJ-13 BUG-004).
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
    (d) => d.scope !== undefined || d.transaction_ids !== undefined,
    {
      message: "Entweder 'scope' oder 'transaction_ids' angeben.",
    }
  )

export type ApplyCategorizationRulesInput = z.infer<
  typeof applyCategorizationRulesSchema
>

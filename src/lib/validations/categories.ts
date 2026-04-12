import { z } from "zod"
import { CATEGORY_COLOR_PALETTE } from "@/lib/category-colors"

/**
 * Farbvalidierung: strikt auf die 8 Werte aus CATEGORY_COLOR_PALETTE
 * beschränkt (BUG-006, siehe Spec PROJ-12 → „Farbwahl"-Design-Entscheidung).
 * Der Vergleich erfolgt case-insensitive.
 */
const PALETTE_VALUES = new Set(
  CATEGORY_COLOR_PALETTE.map((c) => c.value.toLowerCase())
)

export const hexColorSchema = z
  .string()
  .regex(
    /^#[0-9a-fA-F]{6}$/,
    "Farbe muss ein gültiger 6-stelliger Hex-Code sein (z. B. #22c55e)."
  )
  .refine((value) => PALETTE_VALUES.has(value.toLowerCase()), {
    message:
      "Farbe muss aus der vordefinierten Palette stammen (Schiefer, Rot, Orange, Gelb, Grün, Cyan, Blau, Violett).",
  })

export const categoryNameSchema = z
  .string()
  .trim()
  .min(1, "Der Kategoriename darf nicht leer sein.")
  .max(100, "Der Kategoriename darf maximal 100 Zeichen lang sein.")

export const createCategorySchema = z.object({
  name: categoryNameSchema,
  color: hexColorSchema,
})

export type CreateCategoryInput = z.infer<typeof createCategorySchema>

export const updateCategorySchema = z
  .object({
    name: categoryNameSchema.optional(),
    color: hexColorSchema.optional(),
  })
  .refine((data) => data.name !== undefined || data.color !== undefined, {
    message: "Mindestens ein Feld (Name oder Farbe) muss angegeben werden.",
  })

export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>

/**
 * Body-Schema für POST /api/transactions/[id]/categories
 * Setzt die komplette Kategorienliste einer Buchung.
 */
export const setTransactionCategoriesSchema = z.object({
  category_ids: z
    .array(z.string().uuid("Ungültige Kategorie-ID."))
    .max(50, "Maximal 50 Kategorien pro Buchung."),
})

export type SetTransactionCategoriesInput = z.infer<
  typeof setTransactionCategoriesSchema
>

/**
 * Body-Schema für POST /api/transactions/bulk-categorize
 */
export const bulkCategorizeSchema = z.object({
  action: z.enum(["assign", "remove"], {
    message: "Aktion muss 'assign' oder 'remove' sein.",
  }),
  transaction_ids: z
    .array(z.string().uuid("Ungültige Buchungs-ID."))
    .min(1, "Mindestens eine Buchung muss ausgewählt sein.")
    .max(1000, "Maximal 1000 Buchungen pro Bulk-Operation."),
  category_id: z.string().uuid("Ungültige Kategorie-ID."),
})

export type BulkCategorizeInput = z.infer<typeof bulkCategorizeSchema>

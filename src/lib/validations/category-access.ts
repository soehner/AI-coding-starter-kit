import { z } from "zod"

const uuidSchema = z
  .string()
  .regex(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    "Ungültige Kategorie-ID."
  )

/**
 * PROJ-14: Request-Body für PUT /api/admin/users/[id]/category-access
 *
 * - `unrestricted: true`  → alle bestehenden Einträge werden gelöscht
 *   (Benutzer sieht danach alle Kategorien). `category_ids` wird ignoriert.
 * - `unrestricted: false` → der Benutzer sieht ausschließlich die in
 *   `category_ids` aufgeführten Kategorien. Mindestens eine ID erforderlich.
 */
export const updateCategoryAccessSchema = z
  .object({
    unrestricted: z.boolean(),
    category_ids: z
      .array(uuidSchema)
      .max(100, "Es können maximal 100 Kategorien zugewiesen werden.")
      .optional()
      .default([]),
  })
  .refine(
    (data) => data.unrestricted || data.category_ids.length > 0,
    {
      message:
        "Mindestens eine Kategorie auswählen oder 'Alle Kategorien' aktivieren.",
      path: ["category_ids"],
    }
  )

export type UpdateCategoryAccessInput = z.infer<
  typeof updateCategoryAccessSchema
>

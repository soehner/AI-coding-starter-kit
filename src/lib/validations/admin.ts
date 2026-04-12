import { z } from "zod"

export const inviteUserSchema = z.object({
  email: z
    .string()
    .min(1, "E-Mail-Adresse ist erforderlich.")
    .email("Bitte eine gültige E-Mail-Adresse eingeben."),
  role: z.enum(["admin", "viewer"], {
    message: "Bitte eine Rolle auswählen.",
  }),
  ist_vorstand: z.boolean().optional(),
  ist_zweiter_vorstand: z.boolean().optional(),
})

export type InviteUserInput = z.infer<typeof inviteUserSchema>

export const updateRoleSchema = z.object({
  role: z.enum(["admin", "viewer"], {
    message: "Bitte eine Rolle auswählen.",
  }),
})

export type UpdateRoleInput = z.infer<typeof updateRoleSchema>

// PROJ-10: Zusatzrollen separat aktualisieren
export const updateExtraRolesSchema = z.object({
  ist_vorstand: z.boolean(),
  ist_zweiter_vorstand: z.boolean(),
})

export type UpdateExtraRolesInput = z.infer<typeof updateExtraRolesSchema>

// PROJ-7: Granulare Feature-Berechtigungen
export const updatePermissionsSchema = z.object({
  permission: z.enum(["edit_transactions", "export_excel", "import_statements"], {
    message: "Ungültige Berechtigung.",
  }),
  value: z.boolean({
    message: "Wert muss true oder false sein.",
  }),
})

export type UpdatePermissionsInput = z.infer<typeof updatePermissionsSchema>

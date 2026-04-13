import { z } from "zod"

/**
 * PROJ-16: Validierungs-Schemas fuer die PSD2-Endpunkte.
 */

export const psd2ConnectSchema = z.object({
  // Optional: Der Admin kann eine andere ASPSP wählen; default BBBank (DE)
  aspsp_name: z.string().min(1).optional(),
  aspsp_country: z.string().length(2).optional(),
})

export type Psd2ConnectInput = z.infer<typeof psd2ConnectSchema>

export const psd2CallbackQuerySchema = z.object({
  code: z.string().min(1, "Authorisierungs-Code fehlt."),
  state: z.string().min(1, "State-Token fehlt."),
  error: z.string().optional(),
})

export type Psd2CallbackQuery = z.infer<typeof psd2CallbackQuerySchema>

export const abgleichEntscheidungSchema = z.object({
  entscheidung: z.enum(["bestaetigt", "getrennt"], {
    message: "Entscheidung muss 'bestaetigt' oder 'getrennt' sein.",
  }),
  /** Die ID des Partner-Eintrags (der andere Teil des Vorschlags). */
  partner_id: z.string().uuid("Ungueltige Partner-ID."),
})

export type AbgleichEntscheidungInput = z.infer<
  typeof abgleichEntscheidungSchema
>

export const backfillHashesSchema = z.object({
  /** Verarbeitungs-Batch-Groesse, default 100. */
  batch_size: z.number().int().min(1).max(1000).optional(),
})

export type BackfillHashesInput = z.infer<typeof backfillHashesSchema>

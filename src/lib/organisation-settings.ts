import type { SupabaseClient } from "@supabase/supabase-js"
import {
  ORGANISATION_SETTING_KEYS,
  type OrganisationSettingKey,
} from "@/lib/validations/organisation"

/**
 * PROJ-17: Repräsentation der Vereinsdaten zur Laufzeit (lesefertig).
 * Alle Felder sind Strings; leerer String = nicht gesetzt.
 */
export interface OrganisationSettings {
  verein_name: string
  adresse_zeile1: string
  adresse_zeile2: string
  plz: string
  ort: string
  steuernummer: string
  finanzamt: string
  freistellungsbescheid_datum: string
  freistellungsbescheid_aktenzeichen: string
  satzungszweck: string
  unterzeichner_name: string
  letzter_veranlagungszeitraum: string
  // Optionale Vorstandsdaten (für CC-Versand beim E-Mail-Versand der Quittungen)
  vorstand1_name: string
  vorstand1_email: string
  vorstand2_name: string
  vorstand2_email: string
}

/** Pflichtfelder, ohne die keine Quittung ausgestellt werden darf. */
const PFLICHTFELDER: (keyof OrganisationSettings)[] = [
  "verein_name",
  "adresse_zeile1",
  "plz",
  "ort",
  "steuernummer",
  "finanzamt",
  "freistellungsbescheid_datum",
  "freistellungsbescheid_aktenzeichen",
  "satzungszweck",
  "unterzeichner_name",
  "letzter_veranlagungszeitraum",
]

/**
 * Lädt alle Organisations-Settings aus app_settings.
 * Fehlende Keys werden mit leerem String zurückgegeben, damit der Aufrufer
 * über `validateOrganisationSettings` prüfen kann, was noch fehlt.
 */
export async function loadOrganisationSettings(
  supabase: SupabaseClient
): Promise<OrganisationSettings> {
  const { data } = await supabase
    .from("app_settings")
    .select("key, value")
    .in("key", ORGANISATION_SETTING_KEYS as unknown as string[])
    .limit(ORGANISATION_SETTING_KEYS.length)

  const get = (key: OrganisationSettingKey) =>
    data?.find((row) => row.key === key)?.value ?? ""

  return {
    verein_name: get("org_verein_name"),
    adresse_zeile1: get("org_adresse_zeile1"),
    adresse_zeile2: get("org_adresse_zeile2"),
    plz: get("org_plz"),
    ort: get("org_ort"),
    steuernummer: get("org_steuernummer"),
    finanzamt: get("org_finanzamt"),
    freistellungsbescheid_datum: get("org_freistellungsbescheid_datum"),
    freistellungsbescheid_aktenzeichen: get(
      "org_freistellungsbescheid_aktenzeichen"
    ),
    satzungszweck: get("org_satzungszweck"),
    unterzeichner_name: get("org_unterzeichner_name"),
    letzter_veranlagungszeitraum: get("org_letzter_veranlagungszeitraum"),
    vorstand1_name: get("org_vorstand1_name"),
    vorstand1_email: get("org_vorstand1_email"),
    vorstand2_name: get("org_vorstand2_name"),
    vorstand2_email: get("org_vorstand2_email"),
  }
}

/**
 * Prüft, ob alle Pflichtfelder gesetzt sind.
 * @returns Liste der fehlenden Felder (leer = alles vollständig)
 */
export function findFehlendeOrganisationsfelder(
  org: OrganisationSettings
): (keyof OrganisationSettings)[] {
  return PFLICHTFELDER.filter((field) => !org[field] || org[field].trim() === "")
}

/**
 * Prüft, ob der Freistellungsbescheid älter als die angegebene Anzahl Jahre ist.
 * Wird im UI für die proaktive Erinnerung verwendet (warnt ab 4 Jahren,
 * blockiert nicht).
 */
export function bescheidAelterAls(
  org: OrganisationSettings,
  jahre: number
): boolean {
  if (!org.freistellungsbescheid_datum) return false
  const bescheidDatum = new Date(org.freistellungsbescheid_datum)
  if (isNaN(bescheidDatum.getTime())) return false
  const grenze = new Date()
  grenze.setFullYear(grenze.getFullYear() - jahre)
  return bescheidDatum < grenze
}

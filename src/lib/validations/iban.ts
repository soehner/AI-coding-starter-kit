/**
 * PROJ-17: IBAN-Validierung mit Mod-97-Prüfziffer (ISO 13616).
 *
 * Wird in Spender- und Spendenquittungs-Schemas eingesetzt, damit weder im
 * Manual-Modus noch beim Importieren aus PSD2-Daten ungültige IBANs landen.
 * Akzeptiert IBAN mit oder ohne Leerzeichen.
 */

/** Mindest- und Maximallängen laut ISO 13616 (DE = 22, längste = 34). */
const IBAN_MIN_LENGTH = 15
const IBAN_MAX_LENGTH = 34

/**
 * Prüft eine IBAN syntaktisch (Format) und numerisch (Mod-97 = 1).
 * Leere Strings und null/undefined sind „nicht-IBAN" → true (Feld ist optional).
 */
export function istGueltigeIban(input: string | null | undefined): boolean {
  if (input === null || input === undefined) return true
  const raw = input.replace(/\s+/g, "").toUpperCase()
  if (raw === "") return true

  if (raw.length < IBAN_MIN_LENGTH || raw.length > IBAN_MAX_LENGTH) return false
  // Format: 2 Buchstaben Land + 2 Prüfziffern + alphanumerisch
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]+$/.test(raw)) return false

  // Mod-97: erste 4 Zeichen ans Ende, Buchstaben → Zahlen (A=10..Z=35)
  const rotated = raw.slice(4) + raw.slice(0, 4)
  let rest = 0
  for (const ch of rotated) {
    const code = ch.charCodeAt(0)
    const value =
      code >= 65 && code <= 90 ? code - 55 // A=10..Z=35
        : code - 48 // 0=0..9=9
    rest = (rest * (value >= 10 ? 100 : 10) + value) % 97
  }
  return rest === 1
}

/** Normalisiert eine IBAN: Leerzeichen weg, Buchstaben groß. */
export function normalisiereIban(input: string): string {
  return input.replace(/\s+/g, "").toUpperCase()
}

import { createHash } from "crypto"

/**
 * PROJ-16: Normalisiert einen Verwendungszweck fuer den Matching-Hash.
 * - Lowercase
 * - Alle Whitespace-Folgen (inkl. Zeilenumbrueche, Tabs) zu Einzel-Leerzeichen
 * - Trim
 * Umlaute bleiben erhalten (keine ae/oe/ue-Ersetzung).
 */
export function normalisiereVerwendungszweck(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim()
}

/**
 * PROJ-16: Berechnet den deterministischen Matching-Hash fuer einen Umsatz.
 *
 * Formel: SHA-256(buchungsdatum_iso + "|" + betrag_cent + "|" + iban_gegenseite + "|" + verwendungszweck_normalized)
 *
 * - buchungsdatum_iso: "YYYY-MM-DD"
 * - betrag_cent: Ganzzahl (negativ fuer Belastungen)
 * - iban_gegenseite: Grossbuchstaben, ohne Leerzeichen; bei fehlender IBAN leerer String
 * - verwendungszweck_normalized: siehe normalisiereVerwendungszweck()
 *
 * Der Trenner "|" verhindert Kollisionen zwischen Feldgrenzen.
 */
export function berechneMatchingHash(input: {
  buchungsdatum: string
  betrag_cent: number
  iban_gegenseite: string | null | undefined
  verwendungszweck: string
}): string {
  const iban = (input.iban_gegenseite ?? "").toUpperCase().replace(/\s+/g, "")
  const zweck = normalisiereVerwendungszweck(input.verwendungszweck)
  const betrag = Math.round(input.betrag_cent).toString()
  const payload = `${input.buchungsdatum}|${betrag}|${iban}|${zweck}`
  return createHash("sha256").update(payload, "utf8").digest("hex")
}

/**
 * Wandelt einen Euro-Betrag (numerisch) in Cent um. Rundet auf 2 Nachkomma-
 * stellen, um Float-Ungenauigkeiten bei der Hash-Berechnung zu vermeiden.
 */
export function euroZuCent(betrag: number): number {
  return Math.round(betrag * 100)
}

/**
 * PROJ-17: Wandelt einen EUR-Betrag in deutsche Zahlworte um.
 *
 * Beispiele:
 *   12,34       → "Zwölf Euro und 34 Cent"
 *   1234,56     → "Eintausendzweihundertvierunddreißig Euro und 56 Cent"
 *   1000000,00  → "Eine Million Euro und 00 Cent"
 *
 * Verwendet wird der Cent-Anteil bewusst als zweistellige Zahl
 * (gemäß BMF-Mustertext), nicht als Wort. Das ist auf
 * Zuwendungsbestätigungen üblich und gut lesbar.
 */

const EINSEN = [
  "null",
  "ein",
  "zwei",
  "drei",
  "vier",
  "fünf",
  "sechs",
  "sieben",
  "acht",
  "neun",
]

const ZEHN_NEUNZEHN = [
  "zehn",
  "elf",
  "zwölf",
  "dreizehn",
  "vierzehn",
  "fünfzehn",
  "sechzehn",
  "siebzehn",
  "achtzehn",
  "neunzehn",
]

const ZEHNER = [
  "",
  "",
  "zwanzig",
  "dreißig",
  "vierzig",
  "fünfzig",
  "sechzig",
  "siebzig",
  "achtzig",
  "neunzig",
]

/**
 * Wandelt eine Zahl von 0–999 in Worte um.
 */
function unterTausend(n: number, einsAlsEins = false): string {
  if (n === 0) return ""
  if (n === 1) return einsAlsEins ? "eins" : "ein"
  if (n < 10) return EINSEN[n]
  if (n < 20) return ZEHN_NEUNZEHN[n - 10]
  if (n < 100) {
    const z = Math.floor(n / 10)
    const e = n % 10
    if (e === 0) return ZEHNER[z]
    // einundzwanzig, zweiundzwanzig, …
    return `${EINSEN[e]}und${ZEHNER[z]}`
  }
  // 100–999
  const h = Math.floor(n / 100)
  const rest = n % 100
  const hundert = `${EINSEN[h]}hundert`
  if (rest === 0) return hundert
  return `${hundert}${unterTausend(rest, einsAlsEins)}`
}

/**
 * Wandelt eine ganze Zahl in deutsche Zahlworte um.
 */
function ganzzahlInWorten(n: number): string {
  if (n === 0) return "null"
  // Sonderfall: genau "1" als ganze Zahl wird zu "ein" — für den
  // Quittungstext „Ein Euro und … Cent" (statt „Eins Euro").
  if (n === 1) return "ein"

  const milliarden = Math.floor(n / 1_000_000_000)
  const millionen = Math.floor((n % 1_000_000_000) / 1_000_000)
  const tausender = Math.floor((n % 1_000_000) / 1_000)
  const rest = n % 1_000

  const parts: string[] = []

  if (milliarden > 0) {
    parts.push(
      milliarden === 1
        ? "eine Milliarde"
        : `${unterTausend(milliarden)} Milliarden`
    )
  }

  if (millionen > 0) {
    parts.push(
      millionen === 1
        ? "eine Million"
        : `${unterTausend(millionen)} Millionen`
    )
  }

  // Tausender und Hunderter werden in einem zusammenhängenden Block
  // geschrieben (z. B. "eintausendzweihundertvierunddreißig").
  let blockTausenderRest = ""
  if (tausender > 0) {
    blockTausenderRest =
      tausender === 1 ? "eintausend" : `${unterTausend(tausender)}tausend`
  }
  if (rest > 0) {
    // Wenn vorher schon Milliarden/Millionen stehen und Tausender + Rest
    // beide 0 sind, ist hier nichts zu tun. Wenn nur der Rest da ist und
    // er "1" lautet, schreiben wir "eins" – außer es wurde ein Tausender-
    // oder Hunderter-Präfix gebaut, dann gehört "ein" davor.
    if (blockTausenderRest.length > 0) {
      blockTausenderRest += unterTausend(rest)
    } else if (parts.length > 0 && rest === 1) {
      blockTausenderRest = "eins"
    } else {
      blockTausenderRest = unterTausend(rest, true)
    }
  }

  if (blockTausenderRest.length > 0) {
    parts.push(blockTausenderRest)
  }

  return parts.join(" ")
}

/**
 * Hauptfunktion: wandelt einen Geldbetrag in den BMF-üblichen Text um.
 *
 * @param betrag  Geldbetrag (z. B. 1234.56)
 * @returns       "Eintausendzweihundertvierunddreißig Euro und 56 Cent"
 */
export function betragInWorten(betrag: number): string {
  if (!Number.isFinite(betrag) || betrag < 0) {
    return "Null Euro und 00 Cent"
  }

  // Auf zwei Nachkommastellen runden (Geldgenauigkeit)
  const gerundet = Math.round(betrag * 100) / 100
  const euros = Math.floor(gerundet)
  const cents = Math.round((gerundet - euros) * 100)

  const euroWort = ganzzahlInWorten(euros)
  const centStr = String(cents).padStart(2, "0")

  // Erster Buchstabe groß (Satzanfang auf der Quittung)
  const firstChar = euroWort.charAt(0).toUpperCase()
  const rest = euroWort.slice(1)

  return `${firstChar}${rest} Euro und ${centStr} Cent`
}

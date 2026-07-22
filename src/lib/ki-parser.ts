import "@/lib/pdfjs-polyfills"
import OpenAI from "openai"
import Anthropic from "@anthropic-ai/sdk"
import type {
  KiProvider,
  ParsedTransaction,
  ParsedStatementResult,
  UeberwachungsRegelVorschlag,
} from "@/lib/types"
import { ueberwachungsBedingungSchema } from "@/lib/validations/ueberwachungsregeln"
import { beschreibeUeberwachungsregel } from "@/lib/ueberwachungsregeln"

const SYSTEM_PROMPT = `Du bist ein Experte für das Parsen von Kontoauszügen der Badischen Beamtenbank (BW-Bank).

Analysiere den Kontoauszug und extrahiere ALLE Buchungen. Gib das Ergebnis als JSON zurück.

Regeln:
- Datumsformat: YYYY-MM-DD
- Beträge als Zahl (negativ für Abbuchungen, positiv für Gutschriften)
- Saldo nach jeder Buchung angeben
- Kontoauszugsnummer und -datum aus dem Header extrahieren
- Anfangs- und Endsaldo extrahieren
- Buchungstext ("description") vollständig übernehmen (inkl. Verwendungszweck, IBAN, Referenznummern etc.)
- Name des Auftraggebers/Empfängers separat in "counterpart" extrahieren (z.B. "Stadtwerke Mannheim GmbH", "Max Mustermann"). Wenn kein eindeutiger Name erkennbar ist, "counterpart" auf null setzen.
- IBAN des Zahlungspartners (Gegenseite) separat in "counterpart_iban" extrahieren. Das ist die IBAN der ANDEREN Partei (nicht das Vereinskonto selbst). Suche im Verwendungszweck, in "Auftraggeber"-Zeilen oder in Zahlungsreferenzen nach einer IBAN (22 Zeichen, beginnt mit "DE" oder einem anderen 2-stelligen Länder-Code). Formatierung: Großbuchstaben, ohne Leerzeichen, ohne Trennstriche. Wenn keine IBAN des Partners erkennbar ist, "counterpart_iban" auf null setzen.
- Jede Buchung bekommt eine fortlaufende ID (tx-1, tx-2, ...)

Antwort NUR als valides JSON im folgenden Format (keine Erklärung, kein Markdown):
{
  "statement_number": "1/2026",
  "statement_date": "2026-01-15",
  "start_balance": 12345.67,
  "end_balance": 11234.56,
  "transactions": [
    {
      "id": "tx-1",
      "booking_date": "2026-01-02",
      "value_date": "2026-01-02",
      "description": "SEPA-Lastschrift Strom Dez 2025 DE89370400440532013000",
      "counterpart": "Stadtwerke Mannheim GmbH",
      "counterpart_iban": "DE89370400440532013000",
      "amount": -89.50,
      "balance_after": 12256.17
    }
  ]
}`

/**
 * Parst einen PDF-Kontoauszug mit der konfigurierten KI-API.
 */
export async function parseBankStatement(
  pdfBuffer: Buffer,
  provider: KiProvider,
  apiToken: string
): Promise<ParsedStatementResult> {
  if (provider === "anthropic") {
    return parseWithAnthropic(pdfBuffer, apiToken)
  }
  return parseWithOpenAI(pdfBuffer, apiToken)
}

/**
 * Anthropic Claude: PDF nativ als document-Typ senden.
 */
async function parseWithAnthropic(
  pdfBuffer: Buffer,
  apiToken: string
): Promise<ParsedStatementResult> {
  const client = new Anthropic({ apiKey: apiToken })

  const pdfBase64 = pdfBuffer.toString("base64")

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 8192,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "document",
            source: {
              type: "base64",
              media_type: "application/pdf",
              data: pdfBase64,
            },
          },
          {
            type: "text",
            text: SYSTEM_PROMPT,
          },
        ],
      },
    ],
  })

  const textBlock = response.content.find((block) => block.type === "text")
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Keine Textantwort von Anthropic erhalten.")
  }

  return parseKiResponse(textBlock.text)
}

/**
 * OpenAI: Text aus PDF extrahieren und als Prompt senden.
 * Verwendet pdfjs-dist für serverless-kompatible Text-Extraktion.
 */
async function parseWithOpenAI(
  pdfBuffer: Buffer,
  apiToken: string
): Promise<ParsedStatementResult> {
  const pageTexts = await extractPdfText(pdfBuffer)
  const fullText = pageTexts
    .map((text, i) => `--- Seite ${i + 1} ---\n${text}`)
    .join("\n\n")

  const client = new OpenAI({ apiKey: apiToken })

  const response = await client.chat.completions.create({
    model: "gpt-4o",
    max_tokens: 8192,
    messages: [
      {
        role: "user",
        content: `${SYSTEM_PROMPT}\n\nHier ist der extrahierte Text des Kontoauszugs:\n\n${fullText}`,
      },
    ],
  })

  const text = response.choices[0]?.message?.content
  if (!text) {
    throw new Error("Keine Antwort von OpenAI erhalten.")
  }

  return parseKiResponse(text)
}

/**
 * Extrahiert Text aus allen PDF-Seiten mit pdfjs-dist.
 */
async function extractPdfText(pdfBuffer: Buffer): Promise<string[]> {
  const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs")

  const data = new Uint8Array(pdfBuffer)
  const doc = await pdfjsLib.getDocument({ data }).promise

  const pages: string[] = []

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const textContent = await page.getTextContent()

    const pageText = textContent.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ")

    pages.push(pageText)
    page.cleanup()
  }

  doc.destroy()
  return pages
}

/**
 * Parst die KI-Antwort (JSON-String) in ein ParsedStatementResult.
 */
function parseKiResponse(responseText: string): ParsedStatementResult {
  let jsonText = responseText.trim()

  // Markdown-Codeblock entfernen falls vorhanden
  const jsonMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (jsonMatch) {
    jsonText = jsonMatch[1].trim()
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(jsonText)
  } catch {
    throw new Error(
      "KI-Antwort konnte nicht als JSON geparst werden. Bitte erneut versuchen."
    )
  }

  const result = parsed as ParsedStatementResult

  if (!result.statement_number || !result.statement_date) {
    throw new Error(
      "KI-Antwort enthaelt keine Kontoauszugsnummer oder -datum."
    )
  }

  if (!Array.isArray(result.transactions) || result.transactions.length === 0) {
    throw new Error(
      "KI-Antwort enthaelt keine Buchungen. PDF-Inhalt moeglicherweise nicht lesbar."
    )
  }

  // IDs sicherstellen
  result.transactions = result.transactions.map(
    (tx: ParsedTransaction, index: number) => ({
      ...tx,
      id: tx.id || `tx-${index + 1}`,
    })
  )

  return result
}

// ===========================================================================
// PROJ-18: Übersetzung von Freitext-Überwachungsregeln in strukturiertes JSON
// ===========================================================================

const WATCH_RULE_PROMPT = `Du bist ein Assistent, der Überwachungsregeln für ein Vereins-Kassenbuch aus natürlicher Sprache in ein striktes JSON-Format übersetzt.

Der Kassenwart beschreibt in eigenen Worten, wann er über eine Kontobewegung benachrichtigt werden möchte. Übersetze diese Beschreibung in eine strukturierte Regel.

Es gibt zwei Regeltypen:
1. "einzelbuchung": Die Regel prüft jede einzelne Buchung. Trifft sie zu, wird alarmiert.
2. "muster": Die Regel erkennt wiederkehrende Buchungen über ein Zeitfenster (z.B. "derselbe kleine Betrag mehrfach im Monat" oder "Summe an einen Empfänger übersteigt X € in Y Tagen").

Verfügbare Kriterien (Bausteine, die eine einzelne Buchung beschreiben):
- {"type":"amount_range","min":<Zahl in Euro, absolut>,"max":<Zahl in Euro, absolut>,"direction":"out"|"in"|"both"}
  direction: "out" = Abbuchung/Ausgang, "in" = Gutschrift/Eingang, "both" = egal. min/max sind IMMER positive Absolutbeträge.
- {"type":"text_contains","term":"<Text im Verwendungszweck>"}
- {"type":"counterpart_contains","term":"<Name des Empfängers/Auftraggebers>"}
- {"type":"iban_equals","iban":"<IBAN der Gegenseite, Großbuchstaben, ohne Leerzeichen>"}

Kriterien werden über "combinator" verknüpft: "AND" (alle müssen zutreffen) oder "OR" (mindestens eines).

Bei regel_typ "muster" kommt zusätzlich ein "muster"-Objekt hinzu:
- {"art":"anzahl","schwelle":<N>,"zeitfenster_tage":<X>}  → mindestens N passende Buchungen in X Tagen
- {"art":"summe","schwelle":<Y in Euro>,"zeitfenster_tage":<X>} → Summe der passenden Buchungen übersteigt Y € in X Tagen

Wichtige Regeln:
- Antworte NUR mit validem JSON, ohne Erklärung, ohne Markdown.
- Beträge sind IMMER positive Euro-Zahlen (Punkt als Dezimaltrennzeichen).
- Wählst du "muster", MUSS ein "muster"-Objekt vorhanden sein. Bei "einzelbuchung" darf KEIN "muster"-Objekt vorhanden sein.
- Formuliere einen kurzen, prägnanten "name_vorschlag" (max. 80 Zeichen).
- Ist die Beschreibung nicht in eine sinnvolle Regel übersetzbar, gib {"error":"<kurze Begründung auf Deutsch>"} zurück.

Antwortformat:
{
  "name_vorschlag": "Große Abbuchungen über 1000 €",
  "regel_typ": "einzelbuchung",
  "combinator": "AND",
  "criteria": [
    {"type":"amount_range","min":1000,"max":1000000,"direction":"out"}
  ]
}

Beispiel Muster:
{
  "name_vorschlag": "Wiederkehrende Kleinbeträge",
  "regel_typ": "muster",
  "combinator": "AND",
  "criteria": [
    {"type":"amount_range","min":0,"max":100,"direction":"out"}
  ],
  "muster": {"art":"anzahl","schwelle":3,"zeitfenster_tage":31}
}`

interface RawWatchRuleResponse {
  error?: string
  name_vorschlag?: string
  regel_typ?: string
  combinator?: string
  criteria?: unknown
  muster?: unknown
}

/**
 * Übersetzt einen Freitext in eine strukturierte Überwachungsregel.
 * Nutzt dieselbe Provider-/Token-Infrastruktur wie der PDF-Parser.
 *
 * Wirft einen Error mit benutzerfreundlicher Meldung, wenn die KI keine
 * gültige Regel liefert.
 */
export async function uebersetzeUeberwachungsregel(
  freitext: string,
  provider: KiProvider,
  apiToken: string
): Promise<UeberwachungsRegelVorschlag> {
  const rohantwort =
    provider === "anthropic"
      ? await frageAnthropicText(WATCH_RULE_PROMPT, freitext, apiToken)
      : await frageOpenAiText(WATCH_RULE_PROMPT, freitext, apiToken)

  return verarbeiteWatchRuleAntwort(rohantwort)
}

async function frageAnthropicText(
  systemPrompt: string,
  userText: string,
  apiToken: string
): Promise<string> {
  const client = new Anthropic({ apiKey: apiToken })
  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: `${systemPrompt}\n\nBeschreibung des Kassenwarts:\n"""${userText}"""`,
      },
    ],
  })
  const textBlock = response.content.find((block) => block.type === "text")
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Keine Textantwort von Anthropic erhalten.")
  }
  return textBlock.text
}

async function frageOpenAiText(
  systemPrompt: string,
  userText: string,
  apiToken: string
): Promise<string> {
  const client = new OpenAI({ apiKey: apiToken })
  const response = await client.chat.completions.create({
    model: "gpt-4o",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: `${systemPrompt}\n\nBeschreibung des Kassenwarts:\n"""${userText}"""`,
      },
    ],
  })
  const text = response.choices[0]?.message?.content
  if (!text) {
    throw new Error("Keine Antwort von OpenAI erhalten.")
  }
  return text
}

/**
 * Parst und validiert die KI-Antwort strikt gegen das Regel-Schema.
 * KI-Rohausgaben werden niemals ungeprüft weitergereicht.
 */
function verarbeiteWatchRuleAntwort(
  responseText: string
): UeberwachungsRegelVorschlag {
  let jsonText = responseText.trim()

  const jsonMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (jsonMatch) {
    jsonText = jsonMatch[1].trim()
  }

  let parsed: RawWatchRuleResponse
  try {
    parsed = JSON.parse(jsonText) as RawWatchRuleResponse
  } catch {
    throw new Error(
      "Die Regel konnte nicht verstanden werden. Bitte formuliere sie etwas klarer und versuche es erneut."
    )
  }

  if (parsed.error) {
    throw new Error(
      `Die Regel konnte nicht übersetzt werden: ${parsed.error}`
    )
  }

  // Strikte Validierung gegen das Zod-Schema (regel_typ + Kriterien + Muster).
  const validation = ueberwachungsBedingungSchema.safeParse({
    regel_typ: parsed.regel_typ,
    combinator: parsed.combinator,
    criteria: parsed.criteria,
    muster: parsed.muster,
  })

  if (!validation.success) {
    throw new Error(
      "Die übersetzte Regel war nicht schlüssig. Bitte formuliere deine Beschreibung etwas konkreter und versuche es erneut."
    )
  }

  const { regel_typ, combinator, criteria, muster } = validation.data
  const bedingung = { combinator, criteria, ...(muster ? { muster } : {}) }

  const nameVorschlag =
    typeof parsed.name_vorschlag === "string" && parsed.name_vorschlag.trim()
      ? parsed.name_vorschlag.trim().slice(0, 120)
      : "Neue Überwachungsregel"

  return {
    name_vorschlag: nameVorschlag,
    regel_typ,
    bedingung,
    zusammenfassung: beschreibeUeberwachungsregel(regel_typ, bedingung),
  }
}

/**
 * Testet ob ein API-Token gueltig ist.
 */
export async function testApiToken(
  provider: KiProvider,
  apiToken: string
): Promise<{ success: boolean; message: string }> {
  try {
    if (provider === "anthropic") {
      const client = new Anthropic({ apiKey: apiToken })
      await client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 10,
        messages: [{ role: "user", content: "Antworte mit OK." }],
      })
      return { success: true, message: "Anthropic API-Token ist gueltig." }
    }

    const client = new OpenAI({ apiKey: apiToken })
    await client.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 10,
      messages: [{ role: "user", content: "Antworte mit OK." }],
    })
    return { success: true, message: "OpenAI API-Token ist gueltig." }
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Token-Validierung fehlgeschlagen."

    if (
      message.includes("401") ||
      message.includes("auth") ||
      message.includes("API key") ||
      message.includes("Incorrect API key")
    ) {
      return {
        success: false,
        message: "API-Token ist ungueltig oder abgelaufen.",
      }
    }

    return {
      success: false,
      message: `Token-Test fehlgeschlagen: ${message}`,
    }
  }
}

import "@/lib/pdfjs-polyfills"
import OpenAI from "openai"
import Anthropic from "@anthropic-ai/sdk"
import type { KiProvider, ParsedTransaction, ParsedStatementResult } from "@/lib/types"

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

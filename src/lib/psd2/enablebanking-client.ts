/**
 * PROJ-16: Thin Wrapper um die Enable Banking API (PSD2).
 * Ersetzt den vorherigen GoCardless-Client (Produkt dauerhaft eingestellt).
 *
 * Doku: https://enablebanking.com/docs/api/reference/
 *
 * Authentifizierung: JWT RS256 pro Request im Authorization-Header.
 * Der JWT wird für ~50 Minuten modul-lokal gecacht, um die CPU-Last der
 * RSA-Signierung zu senken. Der Private Key wird entweder aus einer PEM-Datei
 * (ENABLEBANKING_PRIVATE_KEY_PATH) oder inline (ENABLEBANKING_PRIVATE_KEY, z. B.
 * für Vercel) geladen. Wenn beides gesetzt ist, hat die Inline-Variante Vorrang.
 *
 * Es werden ausschließlich deutsche Fehlermeldungen nach außen gegeben; Stack-
 * Traces bleiben im Serverlog. Der Private Key wird niemals geloggt.
 */

import { createSign } from "crypto"
import { readFileSync } from "fs"
import { resolve } from "path"

const DEFAULT_BASE_URL = "https://api.enablebanking.com"

function getBaseUrl(): string {
  return process.env.ENABLEBANKING_API_URL || DEFAULT_BASE_URL
}

function getAppId(): string {
  const id = process.env.ENABLEBANKING_APP_ID
  if (!id) {
    throw new Error(
      "Enable Banking nicht konfiguriert — bitte ENABLEBANKING_APP_ID in .env.local setzen."
    )
  }
  return id
}

// ----------------------------------------------------------------
// Private Key laden (einmalig, modul-lokal cachen)
// ----------------------------------------------------------------

let gecachterPrivateKey: string | null = null

function getPrivateKey(): string {
  if (gecachterPrivateKey) return gecachterPrivateKey

  const inline = process.env.ENABLEBANKING_PRIVATE_KEY
  if (inline && inline.trim()) {
    // Vercel speichert PEMs oft mit literalen "\n"-Sequenzen.
    const normalisiert = inline.includes("\\n")
      ? inline.replace(/\\n/g, "\n")
      : inline
    gecachterPrivateKey = normalisiert.trim() + "\n"
    return gecachterPrivateKey
  }

  const pfad = process.env.ENABLEBANKING_PRIVATE_KEY_PATH
  if (!pfad) {
    throw new Error(
      "Enable Banking nicht konfiguriert — bitte ENABLEBANKING_PRIVATE_KEY_PATH oder ENABLEBANKING_PRIVATE_KEY in .env.local setzen."
    )
  }

  try {
    const absolut = resolve(process.cwd(), pfad)
    const inhalt = readFileSync(absolut, "utf8")
    gecachterPrivateKey = inhalt.trim() + "\n"
    return gecachterPrivateKey
  } catch {
    // Bewusst keine Ausgabe des Pfades ins Clientlog, um keine Dateisystem-
    // Struktur zu leaken; der Fehler geht nur über das Serverlog.
    throw new Error(
      "Enable Banking Private Key konnte nicht gelesen werden — bitte Pfad in ENABLEBANKING_PRIVATE_KEY_PATH prüfen."
    )
  }
}

// ----------------------------------------------------------------
// JWT RS256 signieren (mit 50-Minuten-Cache)
// ----------------------------------------------------------------

interface CachedJwt {
  token: string
  ablauf_ms: number
}

let gecachterJwt: CachedJwt | null = null

function base64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=+$/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
}

function erzeugeJwt(): string {
  if (gecachterJwt && gecachterJwt.ablauf_ms > Date.now() + 60_000) {
    return gecachterJwt.token
  }

  const appId = getAppId()
  const privateKey = getPrivateKey()

  const jetzt = Math.floor(Date.now() / 1000)
  // 50-Minuten-Lebensdauer (max. erlaubt ist 1 Stunde).
  const exp = jetzt + 50 * 60

  const header = {
    typ: "JWT",
    alg: "RS256",
    kid: appId,
  }

  const payload = {
    iss: "enablebanking.com",
    aud: "api.enablebanking.com",
    iat: jetzt,
    exp,
  }

  const headerB64 = base64url(JSON.stringify(header))
  const payloadB64 = base64url(JSON.stringify(payload))
  const unsigniert = `${headerB64}.${payloadB64}`

  let signaturB64: string
  try {
    const signer = createSign("RSA-SHA256")
    signer.update(unsigniert)
    signer.end()
    const signaturBuf = signer.sign(privateKey)
    signaturB64 = base64url(signaturBuf)
  } catch {
    throw new Error(
      "Enable Banking JWT-Signatur fehlgeschlagen — ist der Private Key korrekt?"
    )
  }

  const token = `${unsigniert}.${signaturB64}`
  gecachterJwt = {
    token,
    ablauf_ms: exp * 1000,
  }
  return token
}

// ----------------------------------------------------------------
// Fetch-Wrapper
// ----------------------------------------------------------------

async function ebFetch<T>(
  pfad: string,
  init: RequestInit = {}
): Promise<T> {
  const jwt = erzeugeJwt()
  const res = await fetch(`${getBaseUrl()}${pfad}`, {
    ...init,
    headers: {
      ...(init.headers || {}),
      Authorization: `Bearer ${jwt}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
  })

  if (!res.ok) {
    const text = await res.text().catch(() => "")
    // 401 → JWT verworfen, nächster Aufruf baut einen neuen
    if (res.status === 401) {
      gecachterJwt = null
    }
    throw new Error(
      `Enable-Banking-API-Fehler (${init.method ?? "GET"} ${pfad}): HTTP ${res.status} — ${text.slice(0, 500)}`
    )
  }

  if (res.status === 204) {
    return undefined as unknown as T
  }
  return (await res.json()) as T
}

// ----------------------------------------------------------------
// Typen (nur die Felder, die wir tatsächlich verwenden)
// ----------------------------------------------------------------

export interface EbApplication {
  name?: string
  kid?: string
  active?: boolean
  // ... weitere Felder nicht benötigt
}

export interface EbAspsp {
  name: string
  country: string
  logo?: string
  psu_types?: string[]
  // ... weitere Felder nicht benötigt
}

export interface EbAuthStartResponse {
  url: string
  authorization_id: string
}

export interface EbAccount {
  uid: string
  identification_hash?: string
  iban?: string
  account_id?: { iban?: string; other?: unknown }
  name?: string
  product?: string
  currency?: string
}

export interface EbSession {
  session_id: string
  status?: string
  accounts: EbAccount[]
  access?: {
    valid_until?: string
  }
  aspsp?: { name: string; country: string }
}

export interface EbTransaction {
  entry_reference?: string | null
  transaction_id?: string | null
  transaction_amount: { amount: string; currency: string }
  credit_debit_indicator: "CRDT" | "DBIT"
  status?: string
  booking_date?: string | null
  value_date?: string | null
  transaction_date?: string | null
  creditor?: { name?: string | null } | null
  creditor_account?: { iban?: string | null } | null
  debtor?: { name?: string | null } | null
  debtor_account?: { iban?: string | null } | null
  remittance_information?: string[] | null
  bank_transaction_code?: string | null
}

export interface EbTransactionsResponse {
  transactions: EbTransaction[]
  continuation_key?: string | null
}

// ----------------------------------------------------------------
// Öffentliche API
// ----------------------------------------------------------------

/** Ping: liefert die eigene Application zurück, nützlich für Status-Test. */
export async function pingApplication(): Promise<EbApplication> {
  return ebFetch<EbApplication>("/application")
}

/** Liste aller ASPSPs für ein Land (z. B. "DE"). */
export async function listAspsps(country: string): Promise<EbAspsp[]> {
  const res = await ebFetch<{ aspsps: EbAspsp[] }>(
    `/aspsps?country=${encodeURIComponent(country)}`
  )
  return res.aspsps ?? []
}

/**
 * Startet einen AIS-Authorisierungs-Flow bei der gewählten Bank.
 * Die Rückgabe enthält die URL, zu der der Benutzer weitergeleitet werden
 * muss, sowie eine authorization_id für Tracking.
 */
export async function startAuth(args: {
  aspspName: string
  aspspCountry: string
  redirectUrl: string
  stateToken: string
  validUntilIso: string
  psuType?: "personal" | "business"
}): Promise<EbAuthStartResponse> {
  return ebFetch<EbAuthStartResponse>("/auth", {
    method: "POST",
    body: JSON.stringify({
      access: { valid_until: args.validUntilIso },
      aspsp: { name: args.aspspName, country: args.aspspCountry },
      state: args.stateToken,
      redirect_url: args.redirectUrl,
      psu_type: args.psuType ?? "personal",
    }),
  })
}

/**
 * Wandelt einen Authorisierungs-Code (aus dem Callback) in eine dauerhafte
 * Session um. Die Session enthält die Konto-Liste und die Gültigkeitsdauer.
 */
export async function createSession(code: string): Promise<EbSession> {
  return ebFetch<EbSession>("/sessions", {
    method: "POST",
    body: JSON.stringify({ code }),
  })
}

/** Liest eine bestehende Session (z. B. für Status-Checks). */
export async function getSession(sessionId: string): Promise<EbSession> {
  return ebFetch<EbSession>(`/sessions/${encodeURIComponent(sessionId)}`)
}

/** Löscht eine Session bei Enable Banking (Best-Effort beim Disconnect). */
export async function deleteSession(sessionId: string): Promise<void> {
  await ebFetch<void>(`/sessions/${encodeURIComponent(sessionId)}`, {
    method: "DELETE",
  })
}

/**
 * Holt alle gebuchten Umsätze eines Kontos im angegebenen Zeitraum.
 * Die Enable-Banking-API liefert paginiert; wir folgen der continuation_key
 * bis zum Ende und geben die vollständige Liste zurück.
 */
export async function getTransactions(
  accountUid: string,
  dateFrom: string,
  dateTo: string
): Promise<EbTransaction[]> {
  const alle: EbTransaction[] = []
  let continuationKey: string | null = null
  let sicherheitsZaehler = 0

  do {
    const params = new URLSearchParams({
      date_from: dateFrom,
      date_to: dateTo,
    })
    if (continuationKey) {
      params.set("continuation_key", continuationKey)
    }
    const url = `/accounts/${encodeURIComponent(accountUid)}/transactions?${params.toString()}`
    const res: EbTransactionsResponse = await ebFetch<EbTransactionsResponse>(url)
    if (Array.isArray(res.transactions)) {
      alle.push(...res.transactions)
    }
    continuationKey = res.continuation_key ?? null
    sicherheitsZaehler++
    if (sicherheitsZaehler > 100) {
      // Schutz vor Endlosschleife bei unerwartetem API-Verhalten
      throw new Error(
        "Enable Banking: Zu viele Pagination-Seiten — Abbruch zur Sicherheit."
      )
    }
  } while (continuationKey)

  return alle
}

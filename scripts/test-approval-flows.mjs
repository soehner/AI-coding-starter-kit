#!/usr/bin/env node
/**
 * End-to-End-Test der Genehmigungs-Flows gegen Produktion.
 *
 * Erzeugt Test-Anträge direkt in der DB (über Management API),
 * generiert valide HMAC-Tokens, hittet die echten Endpunkte
 * und prüft die Antworten.
 *
 * Aufruf: node scripts/test-approval-flows.mjs
 */
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"

// ─── ENV laden ────────────────────────────────────────────────────────
const envPath = path.resolve(".env.test.local")
const env = Object.fromEntries(
  fs
    .readFileSync(envPath, "utf-8")
    .split("\n")
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=")
      return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, "")]
    })
)

const APPROVAL_TOKEN_SECRET = env.APPROVAL_TOKEN_SECRET
const SITE_URL = env.NEXT_PUBLIC_SITE_URL || "https://cbs-finanz.vercel.app"
const SUPA_REF = "ompxpttzomueeyxejhyb"
const SUPA_MGMT_TOKEN = "sbp_5f60ee47482ab206e9bf34411342236bde8ca390"

if (!APPROVAL_TOKEN_SECRET) {
  console.error("APPROVAL_TOKEN_SECRET fehlt in .env.test.local")
  process.exit(1)
}

// ─── Test-User (existieren bereits in Prod) ───────────────────────────
const VORSTAND_1 = "d0968c36-9859-4f0a-98f5-5e9658949846" // vorstand1@bisscon.com
const VORSTAND_2 = "4151fc0d-9f87-44da-85fc-8e223f825173" // vorstand2@bisscon.com
const CREATOR = VORSTAND_1 // als Creator beliebiger Nutzer möglich

// ─── Helpers ──────────────────────────────────────────────────────────
async function sql(query) {
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${SUPA_REF}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SUPA_MGMT_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query }),
    }
  )
  const text = await res.text()
  if (!res.ok) throw new Error(`SQL-Fehler: ${res.status} ${text}`)
  return JSON.parse(text)
}

function generateApprovalToken(requestId, approverId, approverRole) {
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + 7)
  const nonce = crypto.randomBytes(16).toString("hex")
  const payload = `${requestId}|${approverId}|${approverRole}|${expiresAt.toISOString()}|${nonce}`
  const hmac = crypto.createHmac("sha256", APPROVAL_TOKEN_SECRET)
  hmac.update(payload)
  const signature = hmac.digest("hex")
  const token = Buffer.from(`${payload}|${signature}`).toString("base64url")
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex")
  return { token, tokenHash, expiresAt }
}

async function createTestRequest({ linkType, requiredRoles, note }) {
  const rows = await sql(
    `INSERT INTO approval_requests (created_by, note, required_roles, link_type, status)
     VALUES ('${CREATOR}', '${note.replace(/'/g, "''")}', ARRAY[${requiredRoles.map((r) => `'${r}'`).join(",")}]::text[], '${linkType}', 'offen')
     RETURNING id;`
  )
  return rows[0].id
}

async function createToken(requestId, approverId, approverRole) {
  const { token, tokenHash, expiresAt } = generateApprovalToken(
    requestId,
    approverId,
    approverRole
  )
  await sql(
    `INSERT INTO approval_tokens (request_id, approver_id, approver_role, token_hash, status, expires_at)
     VALUES ('${requestId}', '${approverId}', '${approverRole}', '${tokenHash}', 'aktiv', '${expiresAt.toISOString()}');`
  )
  return token
}

async function apiGet(token) {
  const res = await fetch(`${SITE_URL}/api/approvals/decide/${token}`)
  const body = await res.json()
  return { status: res.status, body }
}

async function apiPost(token, decision, comment) {
  const res = await fetch(`${SITE_URL}/api/approvals/decide/${token}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ decision, comment }),
  })
  const body = await res.json()
  return { status: res.status, body }
}

// ─── Testläufe ────────────────────────────────────────────────────────
const results = []

function assert(label, cond, detail) {
  results.push({ label, ok: cond, detail })
  const icon = cond ? "✓" : "✗"
  console.log(`  ${icon} ${label}`)
  if (!cond && detail) console.log(`      → ${JSON.stringify(detail)}`)
}

async function runCase(name, { linkType, required, actions, expected }) {
  console.log(`\n━━━ ${name} ━━━`)
  const requestId = await createTestRequest({
    linkType,
    requiredRoles: required,
    note: `TEST ${name}`,
  })
  const tokens = {}
  for (const role of required) {
    const approverId = role === "vorstand" ? VORSTAND_1 : VORSTAND_2
    tokens[role] = await createToken(requestId, approverId, role)
  }

  for (const action of actions) {
    const { role, kind, decision, expectStatus, expectKey } = action
    const tok = tokens[role]
    const res = kind === "POST" ? await apiPost(tok, decision) : await apiGet(tok)
    const label = `${role} ${kind}${decision ? ` (${decision})` : ""} → HTTP ${res.status}`
    const ok = res.status === expectStatus && (!expectKey || res.body[expectKey] !== undefined)
    assert(label, ok, { expected: expectStatus, got: res.status, body: res.body })
  }

  const [row] = await sql(
    `SELECT status FROM approval_requests WHERE id = '${requestId}';`
  )
  assert(
    `Finaler Antragsstatus = ${expected.finalStatus}`,
    row.status === expected.finalStatus,
    { got: row.status }
  )

  // Cleanup
  await sql(`DELETE FROM approval_requests WHERE id = '${requestId}';`)
}

// ─── Szenarien ────────────────────────────────────────────────────────
await runCase("UND · V1 genehmigt · V2 genehmigt", {
  linkType: "und",
  required: ["vorstand", "zweiter_vorstand"],
  actions: [
    { role: "vorstand", kind: "POST", decision: "genehmigt", expectStatus: 200 },
    { role: "zweiter_vorstand", kind: "POST", decision: "genehmigt", expectStatus: 200 },
  ],
  expected: { finalStatus: "genehmigt" },
})

await runCase("UND · V1 genehmigt · V2 lehnt ab", {
  linkType: "und",
  required: ["vorstand", "zweiter_vorstand"],
  actions: [
    { role: "vorstand", kind: "POST", decision: "genehmigt", expectStatus: 200 },
    { role: "zweiter_vorstand", kind: "POST", decision: "abgelehnt", expectStatus: 200 },
  ],
  expected: { finalStatus: "abgelehnt" },
})

await runCase("UND · V1 lehnt ab · V2 Link öffnen (GET)", {
  linkType: "und",
  required: ["vorstand", "zweiter_vorstand"],
  actions: [
    { role: "vorstand", kind: "POST", decision: "abgelehnt", expectStatus: 200 },
    { role: "zweiter_vorstand", kind: "GET", expectStatus: 410, expectKey: "alreadyFinalized" },
    { role: "zweiter_vorstand", kind: "POST", decision: "genehmigt", expectStatus: 410, expectKey: "alreadyFinalized" },
  ],
  expected: { finalStatus: "abgelehnt" },
})

await runCase("ODER · V1 genehmigt · V2 Link öffnen (GET)", {
  linkType: "oder",
  required: ["vorstand", "zweiter_vorstand"],
  actions: [
    { role: "vorstand", kind: "POST", decision: "genehmigt", expectStatus: 200 },
    { role: "zweiter_vorstand", kind: "GET", expectStatus: 410, expectKey: "alreadyFinalized" },
    { role: "zweiter_vorstand", kind: "POST", decision: "abgelehnt", expectStatus: 410, expectKey: "alreadyFinalized" },
  ],
  expected: { finalStatus: "genehmigt" },
})

await runCase("ODER · V1 lehnt ab · V2 genehmigt (Antrag noch offen)", {
  linkType: "oder",
  required: ["vorstand", "zweiter_vorstand"],
  actions: [
    { role: "vorstand", kind: "POST", decision: "abgelehnt", expectStatus: 200 },
    { role: "zweiter_vorstand", kind: "POST", decision: "genehmigt", expectStatus: 200 },
  ],
  expected: { finalStatus: "genehmigt" },
})

await runCase("ODER · V1 lehnt ab · V2 lehnt ab (final abgelehnt)", {
  linkType: "oder",
  required: ["vorstand", "zweiter_vorstand"],
  actions: [
    { role: "vorstand", kind: "POST", decision: "abgelehnt", expectStatus: 200 },
    { role: "zweiter_vorstand", kind: "POST", decision: "abgelehnt", expectStatus: 200 },
  ],
  expected: { finalStatus: "abgelehnt" },
})

await runCase("Eigener Token ein zweites Mal (UND · Selfdecided)", {
  linkType: "und",
  required: ["vorstand", "zweiter_vorstand"],
  actions: [
    { role: "vorstand", kind: "POST", decision: "genehmigt", expectStatus: 200 },
    { role: "vorstand", kind: "POST", decision: "abgelehnt", expectStatus: 410 },
    { role: "vorstand", kind: "GET", expectStatus: 410 },
  ],
  expected: { finalStatus: "offen" },
})

// ─── Zusammenfassung ──────────────────────────────────────────────────
console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
const passed = results.filter((r) => r.ok).length
console.log(`Ergebnis: ${passed}/${results.length} Checks bestanden`)
const failed = results.filter((r) => !r.ok)
if (failed.length) {
  console.log("\nFehlgeschlagen:")
  failed.forEach((f) => {
    console.log(`  ✗ ${f.label}`)
    console.log(`    ${JSON.stringify(f.detail)}`)
  })
  process.exit(1)
}

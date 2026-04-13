import { NextResponse } from "next/server"
import { requirePermission } from "@/lib/require-permission"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"
import { confirmImportSchema } from "@/lib/validations/import"
import { applyCategorizationRules } from "@/lib/categorization-rules"
import { pruefeAbgleich } from "@/lib/psd2/matching-engine"
import { berechneMatchingHash, euroZuCent } from "@/lib/psd2/matching-hash"

/**
 * POST /api/admin/import/confirm
 * Speichert die geprüften Buchungen in der Datenbank.
 */
export async function POST(request: Request) {
  // Auth + Berechtigung (import_statements) prüfen
  const authResult = await requirePermission("import_statements")
  if (authResult.error) {
    return authResult.error
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: "Ungültiger Request-Body." },
      { status: 400 }
    )
  }

  const validation = confirmImportSchema.safeParse(body)
  if (!validation.success) {
    const firstError =
      validation.error.issues[0]?.message ?? "Ungültige Eingabe."
    return NextResponse.json({ error: firstError }, { status: 400 })
  }

  const {
    statement_number,
    statement_date,
    file_name,
    file_path,
    start_balance,
    end_balance,
    transactions,
  } = validation.data
  const { profile } = authResult
  const adminClient = createAdminSupabaseClient()

  // PostgreSQL-Fehler in eine verständliche deutsche Meldung übersetzen
  function describeDbError(err: { code?: string; message?: string }): string {
    if (err.code === "23505") {
      // unique_violation — z.B. schon vorhandener Kontoauszug oder Buchung
      return "Eintrag existiert bereits in der Datenbank (Duplikat)."
    }
    if (err.code === "23503") {
      // foreign_key_violation
      return "Abhängiger Datensatz fehlt (Foreign-Key-Verletzung)."
    }
    if (err.code === "23502") {
      return "Pflichtfeld fehlt (NOT-NULL-Verletzung)."
    }
    return err.message || "Unbekannter Datenbankfehler."
  }

  // 1. Bank-Statement Eintrag erstellen
  const { data: statement, error: statementError } = await adminClient
    .from("bank_statements")
    .insert({
      file_name,
      statement_date,
      statement_number,
      transaction_count: transactions.length,
      start_balance,
      end_balance,
      file_path,
      uploaded_by: profile.id,
    })
    .select("id")
    .single()

  if (statementError || !statement) {
    console.error(
      "Fehler beim Erstellen des Kontoauszugs:",
      statementError?.code,
      statementError?.message
    )
    return NextResponse.json(
      {
        error: `Kontoauszug konnte nicht gespeichert werden: ${describeDbError(
          statementError ?? {}
        )}`,
      },
      { status: 500 }
    )
  }

  // 2. Buchungen einfügen — mit PROJ-16-Abgleich:
  // Fuer jeden Eintrag wird der Matching-Hash berechnet und gegen bereits
  // vorhandene PSD2-Eintraege geprueft. Treffer werden gemerged / als
  // Vorschlag / Konflikt markiert statt als Neueintrag angelegt.
  const insertedIdsAkkumuliert: string[] = []
  let bestaetigt = 0
  let vorschlaege = 0
  let konflikte = 0
  let neuAngelegt = 0
  let abgleichWarning: string | null = null

  try {
    for (const tx of transactions) {
      // PROJ-16 / M1: IBAN der Gegenseite aus dem KI-Parser normalisieren
      // (Großbuchstaben, keine Leerzeichen). Leere Werte → null, damit der
      // Fuzzy-Match korrekt greift.
      const ibanGegenseite = tx.counterpart_iban
        ? tx.counterpart_iban.toUpperCase().replace(/\s+/g, "")
        : null

      const ergebnis = await pruefeAbgleich(adminClient, {
        booking_date: tx.booking_date,
        value_date: tx.value_date,
        description: tx.description,
        counterpart: tx.counterpart ?? null,
        amount: tx.amount,
        balance_after: tx.balance_after,
        iban_gegenseite: ibanGegenseite,
      })

      if (ergebnis.aktion === "bestaetigt" && ergebnis.kandidat) {
        // Exakter Hash-Match mit existierendem PSD2-Eintrag → mergen.
        const { error: updErr } = await adminClient
          .from("transactions")
          .update({
            // PDF ist Source of Truth → Felder vom PDF uebernehmen
            statement_id: statement.id,
            booking_date: tx.booking_date,
            value_date: tx.value_date,
            description: tx.description,
            counterpart: tx.counterpart ?? null,
            iban_gegenseite: ibanGegenseite,
            amount: tx.amount,
            balance_after: tx.balance_after,
            quelle: "beide",
            status: "bestaetigt",
            matching_hash: ergebnis.hash,
          })
          .eq("id", ergebnis.kandidat.id)
        if (updErr) throw new Error(updErr.message)
        insertedIdsAkkumuliert.push(ergebnis.kandidat.id)
        bestaetigt++
        continue
      }

      if (ergebnis.aktion === "konflikt" && ergebnis.kandidat) {
        // Betrag weicht ab → PDF gewinnt, alten PSD2-Wert sichern
        const { data: alterEintrag } = await adminClient
          .from("transactions")
          .select("amount, booking_date, description, counterpart, psd2_original_data")
          .eq("id", ergebnis.kandidat.id)
          .single()

        const { error: updErr } = await adminClient
          .from("transactions")
          .update({
            statement_id: statement.id,
            booking_date: tx.booking_date,
            value_date: tx.value_date,
            description: tx.description,
            counterpart: tx.counterpart ?? null,
            iban_gegenseite: ibanGegenseite,
            amount: tx.amount,
            balance_after: tx.balance_after,
            quelle: "beide",
            status: "konflikt",
            matching_hash: berechneMatchingHash({
              buchungsdatum: tx.booking_date,
              betrag_cent: euroZuCent(tx.amount),
              iban_gegenseite: ibanGegenseite,
              verwendungszweck: tx.description,
            }),
            psd2_original_data: alterEintrag ?? null,
          })
          .eq("id", ergebnis.kandidat.id)
        if (updErr) throw new Error(updErr.message)
        insertedIdsAkkumuliert.push(ergebnis.kandidat.id)
        konflikte++
        continue
      }

      if (ergebnis.aktion === "vorschlag" && ergebnis.kandidat) {
        // Neuer PDF-Eintrag anlegen, beide als Vorschlag markieren
        const { data: neu, error: insErr } = await adminClient
          .from("transactions")
          .insert({
            statement_id: statement.id,
            booking_date: tx.booking_date,
            value_date: tx.value_date,
            description: tx.description,
            counterpart: tx.counterpart ?? null,
            iban_gegenseite: ibanGegenseite,
            amount: tx.amount,
            balance_after: tx.balance_after,
            matching_hash: ergebnis.hash,
            quelle: "pdf",
            status: "vorschlag",
          })
          .select("id")
          .single()
        if (insErr || !neu) throw new Error(insErr?.message ?? "Insert fehlgeschlagen.")

        await adminClient
          .from("transactions")
          .update({ status: "vorschlag" })
          .eq("id", ergebnis.kandidat.id)

        insertedIdsAkkumuliert.push(neu.id as string)
        vorschlaege++
        continue
      }

      // Default: neuer PDF-Eintrag
      const { data: neu, error: insErr } = await adminClient
        .from("transactions")
        .insert({
          statement_id: statement.id,
          booking_date: tx.booking_date,
          value_date: tx.value_date,
          description: tx.description,
          counterpart: tx.counterpart ?? null,
          iban_gegenseite: ibanGegenseite,
          amount: tx.amount,
          balance_after: tx.balance_after,
          matching_hash: ergebnis.hash,
          quelle: "pdf",
          status: "nur_pdf",
        })
        .select("id")
        .single()
      if (insErr || !neu) throw new Error(insErr?.message ?? "Insert fehlgeschlagen.")
      insertedIdsAkkumuliert.push(neu.id as string)
      neuAngelegt++
    }
  } catch (err) {
    const meldung = err instanceof Error ? err.message : "Unbekannter Fehler."
    console.error("Fehler beim Einfuegen der Buchungen:", meldung)

    // Kontoauszug-Eintrag wieder löschen (Rollback)
    await adminClient.from("bank_statements").delete().eq("id", statement.id)

    return NextResponse.json(
      { error: `Buchungen konnten nicht gespeichert werden: ${meldung}` },
      { status: 500 }
    )
  }

  // Referenzvoid-Use, um unbenutzte Warnung fuer describeDbError zu vermeiden
  void describeDbError

  const insertedTxs = insertedIdsAkkumuliert.map((id) => ({ id }))

  // PROJ-13: Automatische Kategorisierung der frisch importierten Buchungen.
  // Fehler in der Regelanwendung dürfen den erfolgreichen Import NICHT rückgängig
  // machen – sie werden geloggt und als Warnung zurückgegeben.
  let autoCategorized = 0
  let autoAssignments = 0
  let rulesWarning: string | null = null
  const newTxIds = (insertedTxs ?? []).map((row) => row.id as string)
  if (newTxIds.length > 0) {
    try {
      const result = await applyCategorizationRules(adminClient, newTxIds)
      autoCategorized = result.categorized
      autoAssignments = result.assignmentsCreated
    } catch (err) {
      console.error("Fehler bei automatischer Kategorisierung:", err)
      rulesWarning =
        err instanceof Error
          ? err.message
          : "Regeln konnten nicht angewendet werden."
    }
  }

  return NextResponse.json(
    {
      message: `${transactions.length} Buchungen erfolgreich gespeichert.`,
      statement_id: statement.id,
      transaction_count: transactions.length,
      auto_categorized: autoCategorized,
      auto_assignments: autoAssignments,
      rules_warning: rulesWarning,
      // PROJ-16: Abgleichs-Kennzahlen
      psd2_abgleich: {
        bestaetigt,
        vorschlaege,
        konflikte,
        neu_angelegt: neuAngelegt,
      },
    },
    { status: 201 }
  )
}

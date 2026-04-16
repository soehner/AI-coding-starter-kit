import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase-server"
import { getCategoryFilter } from "@/lib/category-access"
import { z } from "zod"

const PAGE_SIZE = 50

/**
 * Spezial-Wert für den Filter „Ohne Kategorie". Muss mit der Konstante
 * UNCATEGORIZED_FILTER_VALUE in src/components/transaction-filter-bar.tsx
 * übereinstimmen.
 */
const UNCATEGORIZED = "__uncategorized__"

const transactionsQuerySchema = z.object({
  year: z
    .string()
    .regex(/^\d{4}$/, "Jahr muss vierstellig sein.")
    .optional(),
  month: z
    .string()
    .regex(/^([1-9]|1[0-2])$/, "Monat muss zwischen 1 und 12 liegen.")
    .optional(),
  search: z
    .string()
    .max(200, "Suchtext darf maximal 200 Zeichen lang sein.")
    .optional(),
  page: z
    .string()
    .regex(/^\d+$/, "Seite muss eine Zahl sein.")
    .optional(),
  sort: z
    .enum(["booking_date", "amount", "description"], {
      message: "Ungültiges Sortierfeld.",
    })
    .optional(),
  dir: z
    .enum(["asc", "desc"], {
      message: "Ungültige Sortierrichtung.",
    })
    .optional(),
  /**
   * Kategorie-Filter: kommaseparierte Liste von UUIDs. Zusätzlich der
   * Spezial-Wert `__uncategorized__` für Buchungen ohne Kategorie.
   */
  categories: z
    .string()
    .max(2000, "Kategorie-Filter ist zu lang.")
    .optional(),
  /**
   * PROJ-16: Filter nach Herkunfts-/Abgleich-Status. Wenn "unconfirmed"
   * gesetzt ist, werden nur Buchungen mit Status ungleich "bestaetigt"
   * und "nur_pdf" zurückgegeben (also Vorschläge, Konflikte und reine
   * PSD2-Einträge). Zusätzlich kann direkt ein einzelner Status gesetzt
   * werden.
   */
  only_unconfirmed: z.enum(["true", "false"]).optional(),
  status: z
    .enum(["nur_psd2", "nur_pdf", "bestaetigt", "vorschlag", "konflikt"])
    .optional(),
})

export async function GET(request: Request) {
  try {
    const supabase = await createServerSupabaseClient()

    // Auth prüfen
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: "Nicht authentifiziert" },
        { status: 401 }
      )
    }

    // PROJ-14: Kategorie-Einschränkung des Benutzers ermitteln
    const { data: profile, error: profileError } = await supabase
      .from("user_profiles")
      .select("id, role")
      .eq("id", user.id)
      .single()

    if (profileError || !profile) {
      return NextResponse.json(
        { error: "Profil nicht gefunden" },
        { status: 404 }
      )
    }

    const accessFilter = await getCategoryFilter(profile.id, profile.role)

    const { searchParams } = new URL(request.url)
    const rawParams = {
      year: searchParams.get("year") || undefined,
      month: searchParams.get("month") || undefined,
      search: searchParams.get("search") || undefined,
      page: searchParams.get("page") || undefined,
      sort: searchParams.get("sort") || undefined,
      dir: searchParams.get("dir") || undefined,
      categories: searchParams.get("categories") || undefined,
      only_unconfirmed: searchParams.get("only_unconfirmed") || undefined,
      status: searchParams.get("status") || undefined,
    }

    const validation = transactionsQuerySchema.safeParse(rawParams)
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0]?.message ?? "Ungültige Parameter." },
        { status: 400 }
      )
    }

    const { year, month, search } = validation.data
    const page = Math.max(1, parseInt(validation.data.page || "1", 10))
    const sortBy = validation.data.sort || "booking_date"
    const sortDir = validation.data.dir || "desc"

    // --- Kategorie-Filter parsen ---
    const categoryFilterValues = (validation.data.categories || "")
      .split(",")
      .map((v) => v.trim())
      .filter((v) => v.length > 0)

    const wantUncategorized = categoryFilterValues.includes(UNCATEGORIZED)
    const wantCategoryIds = categoryFilterValues.filter(
      (v) => v !== UNCATEGORIZED
    )

    // UUID-Validierung für übergebene Kategorie-IDs
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    for (const id of wantCategoryIds) {
      if (!uuidRegex.test(id)) {
        return NextResponse.json(
          { error: "Ungültige Kategorie-ID im Filter." },
          { status: 400 }
        )
      }
    }

    // --- Effektiven Kategorie-Filter bestimmen ---
    //
    // Zwei Quellen können eine Einschränkung verursachen:
    //   1. Der Kategorie-Filter aus dem Query-String (wantCategoryIds +
    //      wantUncategorized)
    //   2. Die PROJ-14-Zugriffseinschränkung (accessFilter)
    //
    // Wir lösen beides ohne Vorab-Auflösung von Transaktions-IDs, indem wir
    // auf `transaction_categories.category_id` filtern (Schnittmenge der
    // Listen SQL-seitig via JOIN). Damit bleibt die URL stets kurz — die
    // Anzahl der Kategorien pro Benutzer ist klein, anders als die Anzahl
    // der zugeordneten Buchungen.
    //
    // Nur der Sonderfall "wantUncategorized" erfordert weiterhin einen
    // Vorab-Lookup, weil PostgREST nicht nativ nach "fehlender Kind-Row"
    // filtern kann — dieser Pfad wird aber für eingeschränkte Betrachter
    // komplett blockiert (unkategorisierte Buchungen sind nicht sichtbar).

    let effectiveCategoryIds: string[] | null = null
    let uncategorizedIds: string[] | null = null
    let forceEmpty = false

    if (accessFilter.restricted) {
      // Eingeschränkte Betrachter: unkategorisierte Buchungen sind nicht
      // sichtbar. Wenn sie sie explizit anfordern, wird dies ignoriert.
      if (wantCategoryIds.length > 0) {
        const allowedSet = new Set(accessFilter.allowedCategoryIds)
        effectiveCategoryIds = wantCategoryIds.filter((id) =>
          allowedSet.has(id)
        )
        if (effectiveCategoryIds.length === 0) {
          forceEmpty = true
        }
      } else if (wantUncategorized) {
        // Nur "Ohne Kategorie" angefragt → für eingeschränkte Betrachter
        // nichts sichtbar.
        forceEmpty = true
      } else {
        effectiveCategoryIds = accessFilter.allowedCategoryIds
        if (effectiveCategoryIds.length === 0) {
          forceEmpty = true
        }
      }
    } else {
      // Uneingeschränkte Benutzer: bestehendes Verhalten.
      if (wantCategoryIds.length > 0) {
        effectiveCategoryIds = wantCategoryIds
      }
      if (wantUncategorized) {
        const { data: uncat, error: uncatErr } = await supabase.rpc(
          "uncategorized_transaction_ids",
          {
            p_year: year ?? null,
            p_month: month ?? null,
            p_search: search ?? null,
          }
        )

        if (uncatErr) {
          return NextResponse.json(
            {
              error:
                "Fehler beim Kategorie-Filter: " + uncatErr.message,
            },
            { status: 500 }
          )
        }

        uncategorizedIds = (uncat ?? []).map(
          (row: { id: string }) => row.id
        )
      }
    }

    if (forceEmpty) {
      return NextResponse.json({
        transactions: [],
        total: 0,
        page,
        pageSize: PAGE_SIZE,
        totalPages: 0,
      })
    }

    // Wenn kombiniert: uncategorized + wantCategoryIds (uneingeschränkt),
    // erzeugt jeder Pfad unterschiedliche Transaktionen. Wir müssen beide
    // Mengen per OR vereinen. Der einfachste Weg: Vorab-IDs für den
    // uncategorized-Teil + Filter auf category_id für den Rest. Da PostgREST
    // kein natives OR über JOIN-Filter bietet, fallen wir für diesen Misch-
    // Fall zurück auf Vorab-ID-Auflösung. Betrifft nur Admins/Uneingeschränkte
    // und ist vom PROJ-14-Leak unberührt.
    let allowedTxIds: string[] | null = null
    if (
      uncategorizedIds !== null &&
      effectiveCategoryIds !== null &&
      effectiveCategoryIds.length > 0
    ) {
      const { data: matched, error: matchErr } = await supabase
        .from("transaction_categories")
        .select("transaction_id")
        .in("category_id", effectiveCategoryIds)
        .limit(100000)

      if (matchErr) {
        return NextResponse.json(
          { error: "Fehler beim Kategorie-Filter: " + matchErr.message },
          { status: 500 }
        )
      }

      const idSet = new Set<string>(uncategorizedIds)
      for (const row of matched ?? []) {
        idSet.add(row.transaction_id as string)
      }
      allowedTxIds = Array.from(idSet)
      // Der category-Filter wird jetzt über allowedTxIds abgebildet,
      // daher den join-basierten Filter deaktivieren.
      effectiveCategoryIds = null

      if (allowedTxIds.length === 0) {
        return NextResponse.json({
          transactions: [],
          total: 0,
          page,
          pageSize: PAGE_SIZE,
          totalPages: 0,
        })
      }
    } else if (uncategorizedIds !== null) {
      // Nur uncategorized (uneingeschränkt)
      allowedTxIds = uncategorizedIds
      if (allowedTxIds.length === 0) {
        return NextResponse.json({
          transactions: [],
          total: 0,
          page,
          pageSize: PAGE_SIZE,
          totalPages: 0,
        })
      }
    }

    // Wenn die Hauptquery den Kategorie-Filter per JOIN anwenden soll,
    // nutzen wir !inner — dadurch werden Buchungen OHNE passende Kategorie
    // zuverlässig ausgeschlossen, ohne eine potenziell riesige ID-Liste über
    // die URL zu schicken.
    const useCategoryJoin =
      effectiveCategoryIds !== null && effectiveCategoryIds.length > 0

    const categoryJoinSelect = useCategoryJoin
      ? "transaction_categories!inner(category:categories(id, name, color, created_at))"
      : "transaction_categories(category:categories(id, name, color, created_at))"

    // --- Hauptquery ---
    let query = supabase
      .from("transactions")
      .select(
        `
        id,
        booking_date,
        value_date,
        description,
        counterpart,
        amount,
        balance_after,
        category,
        note,
        document_ref,
        statement_ref,
        updated_at,
        updated_by,
        statement_id,
        matching_hash,
        quelle,
        status,
        psd2_abgerufen_am,
        psd2_original_data,
        iban_gegenseite,
        nicht_matchen_mit,
        bank_statements(statement_number, file_name, file_path),
        transaction_documents(id, document_url, document_name, display_order, created_at),
        ${categoryJoinSelect}
      `,
        { count: "exact" }
      )

    if (useCategoryJoin) {
      query = query.in(
        "transaction_categories.category_id",
        effectiveCategoryIds as string[]
      )
    }

    // Filter
    if (year) {
      query = query
        .gte("booking_date", `${year}-01-01`)
        .lte("booking_date", `${year}-12-31`)
    }

    if (month && year) {
      const monthNum = month.padStart(2, "0")
      query = query
        .gte("booking_date", `${year}-${monthNum}-01`)
        .lte("booking_date", `${year}-${monthNum}-31`)
    }

    if (search) {
      query = query.ilike("description", `%${search}%`)
    }

    // PROJ-16: Filter nach Abgleich-Status
    if (validation.data.status) {
      query = query.eq("status", validation.data.status)
    } else if (validation.data.only_unconfirmed === "true") {
      // "Nur unbestätigte" blendet vollständig bestätigte und reine
      // PDF-Einträge aus. Sichtbar bleiben: nur_psd2, vorschlag, konflikt.
      query = query.in("status", ["nur_psd2", "vorschlag", "konflikt"])
    }

    if (allowedTxIds !== null) {
      query = query.in("id", allowedTxIds)
    }

    // Sortierung
    query = query.order(sortBy, { ascending: sortDir === "asc" })

    if (sortBy !== "booking_date") {
      query = query.order("booking_date", { ascending: false })
    } else {
      query = query.order("created_at", { ascending: false })
    }

    // Paginierung
    const from = (page - 1) * PAGE_SIZE
    const to = from + PAGE_SIZE - 1
    query = query.range(from, to)

    const { data, count, error } = await query

    if (error) {
      // PostgREST-Code "PGRST103" / HTTP 416: Seite existiert nicht
      // (typischerweise nach Löschungen, wenn der Client noch eine
      // zu hohe Seitenzahl anfragt). Statt Fehler → leere Seite
      // zurückgeben, damit der Client auf Seite 1 zurückspringen kann.
      const isRangeError =
        error.code === "PGRST103" ||
        /range not satisfiable/i.test(error.message)
      if (isRangeError) {
        // Gesamt-Anzahl separat nachschlagen, damit der Client weiss,
        // wohin er gültig springen kann.
        const { count: gesamtCount } = await supabase
          .from("transactions")
          .select("id", { count: "exact", head: true })
        const total = gesamtCount || 0
        return NextResponse.json({
          transactions: [],
          total,
          page,
          pageSize: PAGE_SIZE,
          totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
          outOfRange: true,
        })
      }
      return NextResponse.json(
        { error: "Fehler beim Laden der Buchungen: " + error.message },
        { status: 500 }
      )
    }

    // Categories & Belege flach in die Transaktion übernehmen
    type RawRow = {
      id: string
      transaction_categories?: Array<{
        category: {
          id: string
          name: string
          color: string
          created_at: string
        } | null
      }> | null
      transaction_documents?: Array<{
        id: string
        document_url: string
        document_name: string
        display_order: number
        created_at: string
      }> | null
    } & Record<string, unknown>

    const rows = (data || []) as unknown as RawRow[]

    const transformed = rows.map((row) => {
      const { transaction_categories, transaction_documents, ...rest } = row
      const categories = (transaction_categories ?? [])
        .map((tc) => tc.category)
        .filter(
          (c): c is {
            id: string
            name: string
            color: string
            created_at: string
          } => c !== null
        )
      const documents = [...(transaction_documents ?? [])].sort(
        (a, b) => a.display_order - b.display_order
      )
      return { ...rest, categories, documents }
    })

    return NextResponse.json({
      transactions: transformed,
      total: count || 0,
      page,
      pageSize: PAGE_SIZE,
      totalPages: Math.ceil((count || 0) / PAGE_SIZE),
    })
  } catch (error) {
    console.error("Transactions API Fehler:", error)
    return NextResponse.json(
      { error: "Interner Serverfehler" },
      { status: 500 }
    )
  }
}

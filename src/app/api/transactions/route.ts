import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase-server"
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

    const { searchParams } = new URL(request.url)
    const rawParams = {
      year: searchParams.get("year") || undefined,
      month: searchParams.get("month") || undefined,
      search: searchParams.get("search") || undefined,
      page: searchParams.get("page") || undefined,
      sort: searchParams.get("sort") || undefined,
      dir: searchParams.get("dir") || undefined,
      categories: searchParams.get("categories") || undefined,
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

    // --- Kategorie-Vorfilter: erlaubte Transaktions-IDs bestimmen ---
    // Wir ermitteln einmalig, welche Transaktions-IDs dem Kategorie-Filter
    // entsprechen, und schränken die Hauptquery darauf ein (serverseitig).
    let allowedTxIds: string[] | null = null

    if (categoryFilterValues.length > 0) {
      allowedTxIds = []

      if (wantCategoryIds.length > 0) {
        const { data: matched, error: matchErr } = await supabase
          .from("transaction_categories")
          .select("transaction_id")
          .in("category_id", wantCategoryIds)
          .limit(100000)

        if (matchErr) {
          return NextResponse.json(
            {
              error:
                "Fehler beim Kategorie-Filter: " + matchErr.message,
            },
            { status: 500 }
          )
        }

        const ids = new Set(
          (matched ?? []).map((r) => r.transaction_id as string)
        )
        allowedTxIds.push(...ids)
      }

      if (wantUncategorized) {
        // BUG-005 Fix: Statt zweier limit(100000)-Queries die SQL-Funktion
        // uncategorized_transaction_ids nutzen, die Filterung per WHERE NOT EXISTS
        // direkt in der Datenbank ausführt.
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

        for (const row of (uncat ?? []) as Array<{ id: string }>) {
          allowedTxIds.push(row.id)
        }
      }

      // Duplikate entfernen
      allowedTxIds = Array.from(new Set(allowedTxIds))

      // Leere Ergebnismenge direkt zurückgeben
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

    // --- Hauptquery ---
    let query = supabase
      .from("transactions")
      .select(
        `
        id,
        booking_date,
        value_date,
        description,
        amount,
        balance_after,
        category,
        note,
        document_ref,
        statement_ref,
        updated_at,
        updated_by,
        statement_id,
        bank_statements!inner(statement_number, file_name, file_path),
        transaction_categories(
          category:categories(id, name, color, created_at)
        )
      `,
        { count: "exact" }
      )

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
      return NextResponse.json(
        { error: "Fehler beim Laden der Buchungen: " + error.message },
        { status: 500 }
      )
    }

    // Categories flach in die Transaktion übernehmen
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
    } & Record<string, unknown>

    const rows = (data || []) as unknown as RawRow[]

    const transformed = rows.map((row) => {
      const { transaction_categories, ...rest } = row
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
      return { ...rest, categories }
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

import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase-server"
import { z } from "zod"

const PAGE_SIZE = 50

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

    // Query aufbauen
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
        bank_statements!inner(statement_number, file_name, file_path)
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

    // Sortierung
    query = query.order(sortBy, { ascending: sortDir === "asc" })

    // Sekundärsortierung bei gleichem Datum
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

    return NextResponse.json({
      transactions: data || [],
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

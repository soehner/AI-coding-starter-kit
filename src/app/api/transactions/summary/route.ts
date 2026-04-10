import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase-server"
import { z } from "zod"

const summaryQuerySchema = z.object({
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
    }

    const validation = summaryQuerySchema.safeParse(rawParams)
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0]?.message ?? "Ungültige Parameter." },
        { status: 400 }
      )
    }

    const { year, month, search } = validation.data

    // 1. Verfügbare Jahre per SQL DISTINCT abfragen (BUG-5 Fix)
    const { data: yearsData, error: yearsError } = await supabase
      .rpc("get_available_years")

    if (yearsError) {
      return NextResponse.json(
        { error: "Fehler beim Laden der Jahre: " + yearsError.message },
        { status: 500 }
      )
    }

    const availableYears = (yearsData || []).map(
      (row: { year: string }) => row.year
    )

    // 2. Gesamtsaldo (aktuellste Buchung)
    const { data: latestTransaction, error: latestError } = await supabase
      .from("transactions")
      .select("balance_after")
      .order("booking_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (latestError) {
      return NextResponse.json(
        { error: "Fehler beim Laden des Saldos: " + latestError.message },
        { status: 500 }
      )
    }

    const currentBalance = latestTransaction?.balance_after ?? 0

    // 3. Summen per SQL-Aggregation berechnen (BUG-6 Fix)
    const { data: sumsData, error: sumError } = await supabase
      .rpc("get_transaction_sums", {
        p_year: year ? parseInt(year, 10) : null,
        p_month: month ? parseInt(month, 10) : null,
        p_search: search || null,
      })

    if (sumError) {
      return NextResponse.json(
        { error: "Fehler beim Laden der Summen: " + sumError.message },
        { status: 500 }
      )
    }

    const sums = sumsData?.[0] ?? { total_income: 0, total_expenses: 0 }

    return NextResponse.json({
      currentBalance: Number(currentBalance),
      totalIncome: Number(sums.total_income),
      totalExpenses: Number(sums.total_expenses),
      availableYears,
    })
  } catch (error) {
    console.error("Summary API Fehler:", error)
    return NextResponse.json(
      { error: "Interner Serverfehler" },
      { status: 500 }
    )
  }
}

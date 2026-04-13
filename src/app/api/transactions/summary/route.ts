import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase-server"
import { getCategoryFilter } from "@/lib/category-access"
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
    const categoryFilterParam = accessFilter.restricted
      ? accessFilter.allowedCategoryIds
      : null

    // Wenn ein eingeschränkter Benutzer keine erlaubten Kategorien hat,
    // geben wir direkt Nullen zurück (keine Buchungen sichtbar).
    if (accessFilter.restricted && accessFilter.allowedCategoryIds.length === 0) {
      return NextResponse.json({
        currentBalance: 0,
        totalIncome: 0,
        totalExpenses: 0,
        availableYears: [],
      })
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

    // 1. Verfügbare Jahre per SQL DISTINCT abfragen.
    //    BUG-7 Fix: Auch für eingeschränkte Benutzer nutzen wir jetzt eine
    //    RPC mit DISTINCT serverseitig statt 10.000 Zeilen zu laden.
    const { data: yearsData, error: yearsError } = await supabase.rpc(
      "get_available_years_for_categories",
      { p_category_filter: categoryFilterParam }
    )

    if (yearsError) {
      return NextResponse.json(
        { error: "Fehler beim Laden der Jahre: " + yearsError.message },
        { status: 500 }
      )
    }

    const availableYears = (yearsData || []).map(
      (row: { year: string }) => row.year
    )

    // 2. Gesamtsaldo (aktuellste Buchung) — PROJ-14: gefiltert via RPC
    const { data: balanceData, error: latestError } = await supabase.rpc(
      "get_current_balance",
      { p_category_filter: categoryFilterParam }
    )

    if (latestError) {
      return NextResponse.json(
        { error: "Fehler beim Laden des Saldos: " + latestError.message },
        { status: 500 }
      )
    }

    const currentBalance = balanceData ?? 0

    // 3. Summen per SQL-Aggregation berechnen (BUG-6 Fix, PROJ-14 erweitert)
    const { data: sumsData, error: sumError } = await supabase
      .rpc("get_transaction_sums", {
        p_year: year ? parseInt(year, 10) : null,
        p_month: month ? parseInt(month, 10) : null,
        p_search: search || null,
        p_category_filter: categoryFilterParam,
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

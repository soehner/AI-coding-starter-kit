import { NextResponse } from "next/server"
import { requirePermission } from "@/lib/require-permission"
import { createServerSupabaseClient } from "@/lib/supabase-server"
import { z } from "zod"
import ExcelJS from "exceljs"

/** Validierungsschema für Query-Parameter */
const exportQuerySchema = z.object({
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

/** Formatiert ein ISO-Datum als deutsches Datum (DD.MM.YYYY) */
function formatDateDE(isoDate: string): string {
  const [year, month, day] = isoDate.split("-")
  return `${day}.${month}.${year}`
}

/** Formatiert einen Betrag als deutschen Währungsstring */
function formatCurrencyDE(value: number): string {
  return (
    value.toLocaleString("de-DE", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }) + " \u20AC"
  )
}

/** Berechnet Start- und Enddatum für den Filterzeitraum */
function getDateRange(
  year?: string,
  month?: string
): { startDate: string; endDate: string } | null {
  if (!year) return null

  if (month) {
    const m = month.padStart(2, "0")
    const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate()
    return {
      startDate: `${year}-${m}-01`,
      endDate: `${year}-${m}-${String(lastDay).padStart(2, "0")}`,
    }
  }

  return {
    startDate: `${year}-01-01`,
    endDate: `${year}-12-31`,
  }
}

export async function GET(request: Request) {
  try {
    // Authentifizierung: Admins oder Betrachter mit export_excel-Berechtigung
    const authResult = await requirePermission("export_excel")
    if (authResult.error) return authResult.error

    // Query-Parameter validieren
    const { searchParams } = new URL(request.url)
    const rawParams = {
      year: searchParams.get("year") || undefined,
      month: searchParams.get("month") || undefined,
      search: searchParams.get("search") || undefined,
    }

    const validation = exportQuerySchema.safeParse(rawParams)
    if (!validation.success) {
      return NextResponse.json(
        {
          error:
            validation.error.issues[0]?.message ?? "Ungültige Parameter.",
        },
        { status: 400 }
      )
    }

    const { year, month, search } = validation.data
    const dateRange = getDateRange(year, month)

    const supabase = await createServerSupabaseClient()

    // --- Hauptabfrage: Buchungen im Filterzeitraum ---
    let query = supabase
      .from("transactions")
      .select(
        `id, booking_date, value_date, description, amount, balance_after, category, note, document_ref, statement_ref,
         transaction_categories(
           category:categories(id, name)
         )`
      )
      .order("booking_date", { ascending: true })
      .order("id", { ascending: true })
      .limit(10000)

    if (dateRange) {
      query = query
        .gte("booking_date", dateRange.startDate)
        .lte("booking_date", dateRange.endDate)
    }

    if (search) {
      query = query.ilike("description", `%${search}%`)
    }

    const { data: transactions, error: txError } = await query

    if (txError) {
      return NextResponse.json(
        { error: "Fehler beim Laden der Buchungen: " + txError.message },
        { status: 500 }
      )
    }

    type RawTxRow = {
      id: string
      booking_date: string
      value_date: string
      description: string | null
      amount: number
      balance_after: number
      category: string | null
      note: string | null
      document_ref: string | null
      statement_ref: string | null
      transaction_categories?: Array<{
        category: { id: string; name: string } | null
      }> | null
    }

    const rows = ((transactions || []) as unknown as RawTxRow[]).map((t) => {
      const categoryNames = (t.transaction_categories ?? [])
        .map((tc) => tc.category?.name)
        .filter((n): n is string => !!n)
      return { ...t, category_names: categoryNames }
    })

    // --- Eröffnungssaldo berechnen ---
    let openingBalance = 0

    if (dateRange) {
      // Letzter Eintrag VOR dem Filterzeitraum
      const { data: priorEntry } = await supabase
        .from("transactions")
        .select("balance_after")
        .lt("booking_date", dateRange.startDate)
        .order("booking_date", { ascending: false })
        .order("id", { ascending: false })
        .limit(1)
        .single()

      if (priorEntry) {
        openingBalance = priorEntry.balance_after
      }
    }

    // --- Kennzahlen berechnen ---
    let totalIncome = 0
    let totalExpense = 0

    for (const row of rows) {
      if (row.amount > 0) {
        totalIncome += row.amount
      } else {
        totalExpense += Math.abs(row.amount)
      }
    }

    const closingBalance =
      rows.length > 0 ? rows[rows.length - 1].balance_after : openingBalance

    // --- Excel-Datei erstellen ---
    const workbook = new ExcelJS.Workbook()
    workbook.creator = "CBS-Finanz"
    workbook.created = new Date()

    const worksheet = workbook.addWorksheet("Kassenbuch")

    // Spaltenbreiten definieren
    worksheet.columns = [
      { key: "A", width: 12 },
      { key: "B", width: 40 },
      { key: "C", width: 30 },
      { key: "D", width: 15 },
      { key: "E", width: 15 },
      { key: "F", width: 15 },
      { key: "G", width: 15 },
      { key: "H", width: 15 },
      { key: "I", width: 15 },
      { key: "J", width: 15 },
      { key: "K", width: 15 },
      { key: "L", width: 15 },
      { key: "M", width: 18 },
      { key: "N", width: 18 },
      { key: "O", width: 30 },
    ]

    const currencyFormat = '#,##0.00 "€"'

    // --- Zeile 1: Titel ---
    const titleRow = worksheet.getRow(1)
    titleRow.getCell(1).value = "Kassenbuch"
    titleRow.getCell(1).font = { bold: true, size: 14 }

    // --- Zeile 2: Zeitraum ---
    const periodRow = worksheet.getRow(2)
    if (dateRange) {
      periodRow.getCell(1).value = `Zeitraum: ${formatDateDE(dateRange.startDate)} - ${formatDateDE(dateRange.endDate)}`
    } else {
      periodRow.getCell(1).value = "Zeitraum: Alle Buchungen"
    }

    // --- Zeile 3: leer ---

    // --- Zeile 4: Eröffnungs- und Schlusssaldo ---
    const balanceRow = worksheet.getRow(4)
    balanceRow.getCell(1).value = `Eröffnungssaldo: ${formatCurrencyDE(openingBalance)}`
    balanceRow.getCell(1).font = { bold: true }
    balanceRow.getCell(4).value = `Schlusssaldo: ${formatCurrencyDE(closingBalance)}`
    balanceRow.getCell(4).font = { bold: true }

    // --- Zeile 5: Summen ---
    const summaryRow = worksheet.getRow(5)
    summaryRow.getCell(1).value = `Summe Einnahmen: ${formatCurrencyDE(totalIncome)}`
    summaryRow.getCell(4).value = `Summe Ausgaben: ${formatCurrencyDE(totalExpense)}`

    // --- Zeile 6: leer (Trenner) ---

    // --- Zeile 7: Spaltenüberschriften ---
    const headerLabels = [
      "Datum",
      "Buchungstext / Kunde",
      "Bemerkung",
      "Einnahme brutto",
      "Einnahme MwSt-Satz",
      "Einnahme MwSt",
      "Einnahme netto",
      "Ausgabe brutto",
      "Ausgabe MwSt-Satz",
      "Ausgabe MwSt",
      "Ausgabe netto",
      "Saldo",
      "Belege-Referenz",
      "Kontoauszug-Referenz",
      "Kategorien",
    ]

    const headerRow = worksheet.getRow(7)
    headerLabels.forEach((label, index) => {
      const cell = headerRow.getCell(index + 1)
      cell.value = label
      cell.font = { bold: true }
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFE0E0E0" },
      }
      cell.border = {
        bottom: { style: "thin" },
      }
    })

    // --- Datenzeilen (ab Zeile 8) ---
    const DATA_START_ROW = 8

    rows.forEach((tx, index) => {
      const rowNum = DATA_START_ROW + index
      const row = worksheet.getRow(rowNum)

      // Spalte A: Datum
      row.getCell(1).value = formatDateDE(tx.booking_date)

      // Spalte B: Buchungstext
      row.getCell(2).value = tx.description || ""

      // Spalte C: Bemerkung
      row.getCell(3).value = tx.note || ""

      // Spalte D: Einnahme brutto (positiver Betrag)
      if (tx.amount > 0) {
        row.getCell(4).value = tx.amount
        row.getCell(4).numFmt = currencyFormat
      }

      // Spalten E, F, G: MwSt leer

      // Spalte H: Ausgabe brutto (negativer Betrag als Absolutwert)
      if (tx.amount < 0) {
        row.getCell(8).value = Math.abs(tx.amount)
        row.getCell(8).numFmt = currencyFormat
      }

      // Spalten I, J, K: MwSt leer

      // Spalte L: Saldo als Excel-Formel
      const dCol = "D"
      const hCol = "H"
      const lCol = "L"

      if (index === 0) {
        // Erste Datenzeile: Eröffnungssaldo + Einnahme - Ausgabe
        row.getCell(12).value = {
          formula: `${openingBalance}+${dCol}${rowNum}-${hCol}${rowNum}`,
        } as ExcelJS.CellFormulaValue
      } else {
        // Folgezeilen: Vorheriger Saldo + Einnahme - Ausgabe
        const prevRow = rowNum - 1
        row.getCell(12).value = {
          formula: `${lCol}${prevRow}+${dCol}${rowNum}-${hCol}${rowNum}`,
        } as ExcelJS.CellFormulaValue
      }
      row.getCell(12).numFmt = currencyFormat

      // Spalte M: Belege-Referenz
      row.getCell(13).value = tx.document_ref || ""

      // Spalte N: Kontoauszug-Referenz
      row.getCell(14).value = tx.statement_ref || ""

      // Spalte O: Kategorien (kommagetrennt)
      row.getCell(15).value = tx.category_names.join(", ")
    })

    // Währungsformat auf leere Zellen in den Währungsspalten anwenden
    for (let rowNum = DATA_START_ROW; rowNum < DATA_START_ROW + rows.length; rowNum++) {
      const row = worksheet.getRow(rowNum)
      // Spalten D-K und L
      for (const colIdx of [4, 5, 6, 7, 8, 9, 10, 11, 12]) {
        if (!row.getCell(colIdx).value) {
          row.getCell(colIdx).numFmt = currencyFormat
        }
      }
    }

    // --- Dateiname bestimmen ---
    let filename: string
    if (dateRange) {
      filename = `Kassenbuch_${dateRange.startDate}_${dateRange.endDate}.xlsx`
    } else {
      filename = "Kassenbuch_alle.xlsx"
    }

    // --- Excel-Buffer erzeugen und als Response senden ---
    const buffer = await workbook.xlsx.writeBuffer()

    return new NextResponse(buffer as ArrayBuffer, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "X-Frame-Options": "DENY",
        "X-Content-Type-Options": "nosniff",
      },
    })
  } catch (error) {
    console.error("Kassenbuch-Export Fehler:", error)
    return NextResponse.json(
      { error: "Interner Serverfehler beim Export." },
      { status: 500 }
    )
  }
}

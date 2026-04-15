import { NextResponse } from "next/server"
import { requirePermission } from "@/lib/require-permission"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"
import { decrypt } from "@/lib/encryption"
import { loadSeafileConfig, deleteFromSeafile } from "@/lib/seafile"

/**
 * DELETE /api/transactions/[id]/documents/[docId]
 * Entfernt einen einzelnen Beleg einer Buchung. Wenn ein `document_path`
 * hinterlegt ist, wird die Datei zusätzlich auf Seafile gelöscht.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  try {
    const { id, docId } = await params

    const auth = await requirePermission("edit_transactions")
    if (auth.error) return auth.error

    const adminClient = createAdminSupabaseClient()

    const { data: doc, error: docError } = await adminClient
      .from("transaction_documents")
      .select("id, transaction_id, document_path")
      .eq("id", docId)
      .eq("transaction_id", id)
      .single()

    if (docError || !doc) {
      return NextResponse.json(
        { error: "Beleg nicht gefunden." },
        { status: 404 }
      )
    }

    // Datei auf Seafile löschen (falls Pfad bekannt ist – bei Altdaten nicht vorhanden)
    if (doc.document_path) {
      try {
        const seafileResult = await loadSeafileConfig(adminClient, decrypt)
        if (seafileResult) {
          await deleteFromSeafile(seafileResult.config, doc.document_path)
        }
      } catch (err) {
        console.error("Seafile-Delete fehlgeschlagen:", err)
        // Weiter machen – Zeile in der DB entfernen, auch wenn Seafile
        // die Datei nicht mehr findet.
      }
    }

    const { error: deleteError } = await adminClient
      .from("transaction_documents")
      .delete()
      .eq("id", docId)

    if (deleteError) {
      return NextResponse.json(
        { error: "Beleg konnte nicht gelöscht werden." },
        { status: 500 }
      )
    }

    await adminClient
      .from("transactions")
      .update({
        updated_at: new Date().toISOString(),
        updated_by: auth.profile.id,
      })
      .eq("id", id)

    return NextResponse.json({ message: "Beleg entfernt." })
  } catch (error) {
    console.error("Document DELETE Fehler:", error)
    return NextResponse.json(
      { error: "Interner Serverfehler" },
      { status: 500 }
    )
  }
}

/**
 * Serverseitige Validierung von Beleg-Uploads für PROJ-10.
 * Prüft Magic-Bytes (statt nur Client-gemeldetem MIME-Type) und bereinigt Dateinamen.
 *
 * BUG-7: Verhindert dass eine .exe als "application/pdf" akzeptiert wird.
 * BUG-11: Entfernt Pfad-Traversal-Zeichen und begrenzt die Länge.
 */

type DetectedFileKind =
  | "pdf"
  | "jpeg"
  | "png"
  | "heic"
  | "msword"
  | "docx"
  | "unknown"

/**
 * Erkennt den tatsächlichen Dateityp anhand der ersten Bytes.
 * Gibt den erkannten Typ und den passenden MIME-Type zurück.
 */
export function detectFileTypeFromBuffer(buffer: Buffer): {
  kind: DetectedFileKind
  mimeType: string
} {
  if (buffer.length < 12) {
    return { kind: "unknown", mimeType: "application/octet-stream" }
  }

  // PDF: "%PDF-"
  if (
    buffer[0] === 0x25 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x44 &&
    buffer[3] === 0x46 &&
    buffer[4] === 0x2d
  ) {
    return { kind: "pdf", mimeType: "application/pdf" }
  }

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { kind: "jpeg", mimeType: "image/jpeg" }
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return { kind: "png", mimeType: "image/png" }
  }

  // HEIC/HEIF: "ftyp" bei Offset 4 mit heic/heix/hevc/mif1/msf1
  if (
    buffer[4] === 0x66 &&
    buffer[5] === 0x74 &&
    buffer[6] === 0x79 &&
    buffer[7] === 0x70
  ) {
    const brand = buffer.subarray(8, 12).toString("ascii")
    if (
      brand === "heic" ||
      brand === "heix" ||
      brand === "hevc" ||
      brand === "hevx" ||
      brand === "mif1" ||
      brand === "msf1"
    ) {
      return { kind: "heic", mimeType: "image/heic" }
    }
  }

  // DOC (MS OLE2 Compound Document): D0 CF 11 E0 A1 B1 1A E1
  if (
    buffer[0] === 0xd0 &&
    buffer[1] === 0xcf &&
    buffer[2] === 0x11 &&
    buffer[3] === 0xe0 &&
    buffer[4] === 0xa1 &&
    buffer[5] === 0xb1 &&
    buffer[6] === 0x1a &&
    buffer[7] === 0xe1
  ) {
    return { kind: "msword", mimeType: "application/msword" }
  }

  // DOCX/ZIP: PK\x03\x04
  if (
    buffer[0] === 0x50 &&
    buffer[1] === 0x4b &&
    buffer[2] === 0x03 &&
    buffer[3] === 0x04
  ) {
    // Hinweis: echte DOCX-Erkennung würde ZIP entpacken — für unseren Zweck
    // reicht die Kombination aus ZIP-Header + Client-MIME docx.
    return {
      kind: "docx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    }
  }

  return { kind: "unknown", mimeType: "application/octet-stream" }
}

/**
 * Bereinigt einen Dateinamen für DB-Speicherung und Anzeige:
 * - Entfernt Pfad-Zeichen (..\\, /, ..)
 * - Entfernt Steuerzeichen
 * - Begrenzt auf 200 Zeichen
 *
 * BUG-11
 */
export function sanitizeDocumentName(rawName: string): string {
  if (!rawName) return "beleg"

  // Nur der Basename — keine Pfade
  const basename = rawName.replace(/^.*[\\/]/, "")

  // Steuerzeichen entfernen
  const cleaned = basename.replace(/[\x00-\x1f\x7f]/g, "")

  // Länge begrenzen (200 Zeichen reichen für alle praktischen Fälle)
  const MAX = 200
  const truncated = cleaned.length > MAX ? cleaned.slice(0, MAX) : cleaned

  return truncated.trim() || "beleg"
}

/**
 * Validiert einen Seafile-/HTTP-Share-Link — nur https erlaubt.
 *
 * BUG-12
 */
export function isValidDocumentUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.protocol === "https:"
  } catch {
    return false
  }
}

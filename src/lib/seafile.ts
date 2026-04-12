/**
 * Seafile Web API v2.1 Client
 * Alle Aufrufe erfolgen serverseitig — der API-Token wird nie im Browser exponiert.
 */

export interface SeafileConfig {
  url: string       // z.B. https://seafile.example.com
  token: string     // API-Token (Klartext, bereits entschlüsselt)
  repoId: string    // Bibliotheks-ID (UUID)
}

interface SeafileUploadResult {
  /** Öffentlicher Share-Link zur hochgeladenen Datei */
  shareLink: string
  /** Pfad der Datei innerhalb der Bibliothek */
  filePath: string
}

/**
 * Prüft ob die Seafile-Verbindung funktioniert und die Bibliothek existiert.
 */
export async function testSeafileConnection(
  config: SeafileConfig
): Promise<{ success: boolean; message: string }> {
  try {
    // 1. Auth-Token prüfen via /api2/auth/ping/
    const pingRes = await fetch(`${config.url}/api2/auth/ping/`, {
      headers: { Authorization: `Token ${config.token}` },
    })

    if (!pingRes.ok) {
      if (pingRes.status === 401 || pingRes.status === 403) {
        return { success: false, message: "API-Token ist ungültig oder abgelaufen." }
      }
      return { success: false, message: `Server-Fehler: ${pingRes.status} ${pingRes.statusText}` }
    }

    // 2. Bibliothek prüfen
    const repoRes = await fetch(`${config.url}/api2/repos/${config.repoId}/`, {
      headers: { Authorization: `Token ${config.token}` },
    })

    if (!repoRes.ok) {
      if (repoRes.status === 404) {
        return { success: false, message: "Bibliothek nicht gefunden. Bitte die Bibliotheks-ID prüfen." }
      }
      return { success: false, message: `Bibliothek konnte nicht geprüft werden: ${repoRes.status}` }
    }

    const repoData = await repoRes.json()
    return {
      success: true,
      message: `Verbindung erfolgreich. Bibliothek: "${repoData.name}"`,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unbekannter Fehler"
    return { success: false, message: `Seafile-Server nicht erreichbar: ${message}` }
  }
}

/**
 * Legt ein einzelnes Verzeichnis in Seafile an.
 * 200/201 = erstellt, 409 = existiert bereits (beides OK).
 */
async function createSingleDirectory(
  config: SeafileConfig,
  dirPath: string
): Promise<void> {
  const checkRes = await fetch(
    `${config.url}/api2/repos/${config.repoId}/dir/?p=${encodeURIComponent(dirPath)}`,
    { headers: { Authorization: `Token ${config.token}` } }
  )
  if (checkRes.ok) return // existiert schon

  const createRes = await fetch(
    `${config.url}/api2/repos/${config.repoId}/dir/?p=${encodeURIComponent(dirPath)}`,
    {
      method: "POST",
      headers: {
        Authorization: `Token ${config.token}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "operation=mkdir",
    }
  )

  if (!createRes.ok && createRes.status !== 409) {
    const errorText = await createRes.text().catch(() => "")
    throw new Error(
      `Verzeichnis "${dirPath}" konnte nicht erstellt werden: ${createRes.status} ${errorText}`
    )
  }
}

/**
 * Stellt sicher, dass ein Verzeichnis inklusive aller Zwischenverzeichnisse
 * in der Seafile-Bibliothek existiert. Seafile legt keine Pfade rekursiv an,
 * daher müssen wir jede Ebene einzeln anlegen.
 *
 * Beispiel: "/CBS-Finanz-Data/Kontoauszüge/2026" erzeugt (falls fehlend):
 *   - /CBS-Finanz-Data
 *   - /CBS-Finanz-Data/Kontoauszüge
 *   - /CBS-Finanz-Data/Kontoauszüge/2026
 */
async function ensureDirectory(
  config: SeafileConfig,
  dirPath: string
): Promise<void> {
  const segments = dirPath.split("/").filter(Boolean)
  let current = ""
  for (const segment of segments) {
    current += `/${segment}`
    await createSingleDirectory(config, current)
  }
}

/**
 * Holt den Upload-Link für ein Verzeichnis in der Seafile-Bibliothek.
 */
async function getUploadLink(config: SeafileConfig, dirPath: string): Promise<string> {
  const res = await fetch(
    `${config.url}/api2/repos/${config.repoId}/upload-link/?p=${encodeURIComponent(dirPath)}`,
    { headers: { Authorization: `Token ${config.token}` } }
  )

  if (!res.ok) {
    throw new Error(`Upload-Link konnte nicht abgerufen werden: ${res.status}`)
  }

  const uploadLink = await res.json()
  // Seafile gibt den Link als JSON-String zurück (mit Anführungszeichen)
  return typeof uploadLink === "string" ? uploadLink : String(uploadLink)
}

/**
 * Holt einen bereits existierenden Share-Link für eine Datei, falls vorhanden.
 * Seafile erlaubt pro Datei-Content nur einen Share-Link; bei Duplikat-Uploads
 * bleibt der alte Link bestehen, selbst wenn die Datei zwischenzeitlich gelöscht
 * und neu hochgeladen wurde.
 */
async function findExistingShareLink(
  config: SeafileConfig,
  filePath: string
): Promise<string | null> {
  const url = `${config.url}/api/v2.1/share-links/?repo_id=${config.repoId}&path=${encodeURIComponent(filePath)}`
  const res = await fetch(url, {
    headers: { Authorization: `Token ${config.token}` },
  })

  if (!res.ok) return null

  const data = await res.json()
  if (Array.isArray(data) && data.length > 0 && typeof data[0].link === "string") {
    return data[0].link
  }
  return null
}

/**
 * Erstellt einen öffentlichen Share-Link für eine Datei.
 * Fällt bei „Share link already exists" auf den bestehenden Link zurück.
 */
async function createShareLink(
  config: SeafileConfig,
  filePath: string
): Promise<string> {
  const res = await fetch(`${config.url}/api/v2.1/share-links/`, {
    method: "POST",
    headers: {
      Authorization: `Token ${config.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      repo_id: config.repoId,
      path: filePath,
    }),
  })

  if (res.ok) {
    const data = await res.json()
    return data.link as string
  }

  // 400 + "already exists" → bestehenden Link abrufen und zurückgeben
  if (res.status === 400) {
    const errorText = await res.text()
    if (errorText.toLowerCase().includes("already exists")) {
      const existing = await findExistingShareLink(config, filePath)
      if (existing) return existing
    }
    throw new Error(
      `Share-Link konnte nicht erstellt werden: ${res.status} ${errorText}`
    )
  }

  const errorText = await res.text()
  throw new Error(
    `Share-Link konnte nicht erstellt werden: ${res.status} ${errorText}`
  )
}

/**
 * Bereinigt einen Dateinamen für die Seafile-Ablage.
 * - Umlaute werden transliteriert (ä→ae, ö→oe, ü→ue, ß→ss)
 * - Sonderzeichen werden durch Unterstrich ersetzt
 * - Maximal 100 Zeichen
 */
export function sanitizeFileName(name: string): string {
  let sanitized = name
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/Ä/g, "Ae")
    .replace(/Ö/g, "Oe")
    .replace(/Ü/g, "Ue")
    .replace(/ß/g, "ss")

  // Dateierweiterung extrahieren
  const lastDot = sanitized.lastIndexOf(".")
  let baseName = lastDot > 0 ? sanitized.substring(0, lastDot) : sanitized
  const ext = lastDot > 0 ? sanitized.substring(lastDot) : ""

  // Sonderzeichen durch Unterstrich ersetzen (Buchstaben, Ziffern, Bindestrich erlaubt)
  baseName = baseName.replace(/[^a-zA-Z0-9_-]/g, "_").replace(/_+/g, "_")

  // Maximal 100 Zeichen (inkl. Erweiterung)
  const maxBase = 100 - ext.length
  if (baseName.length > maxBase) {
    baseName = baseName.substring(0, maxBase)
  }

  return baseName + ext
}

/**
 * Generiert einen Beleg-Dateinamen aus Buchungsdatum und Buchungstext.
 * Format: JJJJ-MM-TT_Buchungstext_bereinigt.ext
 */
export function generateReceiptFileName(
  bookingDate: string,
  description: string,
  originalFileName: string
): string {
  const ext = originalFileName.substring(originalFileName.lastIndexOf("."))
  const descPart = sanitizeFileName(description).substring(0, 80)
  return sanitizeFileName(`${bookingDate}_${descPart}${ext}`)
}

/**
 * Lädt eine Datei auf Seafile hoch und erstellt einen öffentlichen Share-Link.
 *
 * @param config  Seafile-Verbindungskonfiguration
 * @param basePath  Basispfad (z.B. /Förderverein/Belege/)
 * @param year  Jahr für den Unterordner
 * @param fileName  Bereinigter Dateiname
 * @param fileBuffer  Dateiinhalt als Buffer
 * @param contentType  MIME-Type der Datei
 * @returns  Share-Link und vollständiger Pfad
 */
export async function uploadToSeafile(
  config: SeafileConfig,
  basePath: string,
  year: string,
  fileName: string,
  fileBuffer: Buffer,
  contentType: string
): Promise<SeafileUploadResult> {
  // Pfad normalisieren
  const normalizedBase = basePath.endsWith("/") ? basePath : `${basePath}/`
  const dirPath = `${normalizedBase}${year}`
  const filePath = `${dirPath}/${fileName}`

  // 1. Verzeichnis sicherstellen
  await ensureDirectory(config, dirPath)

  // 2. Prüfen ob Datei mit gleichem Namen existiert, ggf. Suffix anhängen
  const finalFileName = await getUniqueFileName(config, dirPath, fileName)
  const finalFilePath = `${dirPath}/${finalFileName}`

  // 3. Upload-Link abrufen
  const uploadLink = await getUploadLink(config, dirPath)

  // 4. Datei hochladen via multipart/form-data
  const formData = new FormData()
  formData.append("file", new Blob([new Uint8Array(fileBuffer)], { type: contentType }), finalFileName)
  formData.append("parent_dir", dirPath)

  const uploadRes = await fetch(uploadLink, {
    method: "POST",
    headers: { Authorization: `Token ${config.token}` },
    body: formData,
  })

  if (!uploadRes.ok) {
    const errorText = await uploadRes.text()
    throw new Error(`Datei-Upload fehlgeschlagen: ${uploadRes.status} ${errorText}`)
  }

  // 5. Öffentlichen Share-Link erstellen
  const shareLink = await createShareLink(config, finalFilePath)

  return { shareLink, filePath: finalFilePath }
}

/**
 * Prüft ob eine Datei existiert und hängt ggf. einen Suffix an.
 */
async function getUniqueFileName(
  config: SeafileConfig,
  dirPath: string,
  fileName: string
): Promise<string> {
  const res = await fetch(
    `${config.url}/api2/repos/${config.repoId}/file/detail/?p=${encodeURIComponent(`${dirPath}/${fileName}`)}`,
    { headers: { Authorization: `Token ${config.token}` } }
  )

  if (res.status === 404) {
    return fileName // Datei existiert nicht → Name ist frei
  }

  // Datei existiert → Suffix anhängen
  const lastDot = fileName.lastIndexOf(".")
  const baseName = lastDot > 0 ? fileName.substring(0, lastDot) : fileName
  const ext = lastDot > 0 ? fileName.substring(lastDot) : ""

  for (let i = 2; i <= 99; i++) {
    const candidateName = `${baseName}_${i}${ext}`
    const checkRes = await fetch(
      `${config.url}/api2/repos/${config.repoId}/file/detail/?p=${encodeURIComponent(`${dirPath}/${candidateName}`)}`,
      { headers: { Authorization: `Token ${config.token}` } }
    )
    if (checkRes.status === 404) {
      return candidateName
    }
  }

  throw new Error("Zu viele Dateien mit gleichem Namen im Verzeichnis.")
}

/**
 * Löscht eine Datei auf Seafile.
 */
export async function deleteFromSeafile(
  config: SeafileConfig,
  filePath: string
): Promise<void> {
  const res = await fetch(
    `${config.url}/api2/repos/${config.repoId}/file/?p=${encodeURIComponent(filePath)}`,
    {
      method: "DELETE",
      headers: { Authorization: `Token ${config.token}` },
    }
  )

  // 404 ist OK — Datei existiert nicht mehr
  if (!res.ok && res.status !== 404) {
    throw new Error(`Datei konnte nicht gelöscht werden: ${res.status}`)
  }
}

/**
 * Lädt die Seafile-Konfiguration aus den App-Einstellungen.
 * Gibt null zurück, wenn Seafile nicht konfiguriert ist.
 */
export async function loadSeafileConfig(
  adminClient: { from: (table: string) => any },
  decryptFn: (value: string) => string
): Promise<{
  config: SeafileConfig
  receiptPath: string
  statementPath: string
} | null> {
  const { data: settings } = await adminClient
    .from("app_settings")
    .select("key, value")
    .in("key", [
      "seafile_url",
      "seafile_token",
      "seafile_repo_id",
      "seafile_receipt_path",
      "seafile_statement_path",
    ])
    .limit(5)

  if (!settings || settings.length === 0) return null

  const getValue = (key: string) => (settings as { key: string; value: string }[]).find((s) => s.key === key)?.value || ""

  const url = getValue("seafile_url")
  const encryptedToken = getValue("seafile_token")
  const repoId = getValue("seafile_repo_id")
  const receiptPath = getValue("seafile_receipt_path") || "/Förderverein/Belege/"
  const statementPath = getValue("seafile_statement_path") || "/Förderverein/Kontoauszüge/"

  if (!url || !encryptedToken || !repoId) return null

  let token: string
  try {
    token = decryptFn(encryptedToken)
  } catch {
    return null
  }

  return {
    config: { url, token, repoId },
    receiptPath,
    statementPath,
  }
}

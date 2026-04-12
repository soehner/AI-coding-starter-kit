/**
 * Prüft, ob ein file_path / document_ref ein echter Seafile-Share-Link ist
 * oder nur ein Platzhalter aus einem fehlgeschlagenen Upload.
 *
 * Im Import-Flow werden bei Upload-Fehlern Platzhalter-Strings wie
 * "seafile_error:<dateiname>" oder "no_seafile:<dateiname>" in die Datenbank
 * geschrieben, damit der Import trotzdem durchläuft. Diese dürfen niemals
 * als klickbarer Link angeboten werden.
 */
export function isValidSeafileLink(
  filePath: string | null | undefined
): filePath is string {
  if (!filePath) return false
  if (filePath.startsWith("seafile_error:")) return false
  if (filePath.startsWith("no_seafile:")) return false
  return /^https?:\/\//.test(filePath)
}

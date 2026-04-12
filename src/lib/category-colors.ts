/**
 * PROJ-12: Vorgeschlagene Farbpalette für die Kategorien-Verwaltung.
 * Das Backend akzeptiert jeden gültigen 6-stelligen Hex-Wert (#rrggbb);
 * die Palette dient nur als komfortable UI-Auswahl.
 */
export const CATEGORY_COLOR_PALETTE = [
  { label: "Schiefer", value: "#64748b" },
  { label: "Rot", value: "#ef4444" },
  { label: "Orange", value: "#f97316" },
  { label: "Gelb", value: "#eab308" },
  { label: "Grün", value: "#22c55e" },
  { label: "Cyan", value: "#06b6d4" },
  { label: "Blau", value: "#3b82f6" },
  { label: "Violett", value: "#a855f7" },
] as const

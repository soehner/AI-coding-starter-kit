export type UserRole = "admin" | "viewer"

export interface UserProfile {
  id: string
  email: string
  role: UserRole
  created_at: string
  // PROJ-10: Zusatzrollen für Genehmigungssystem (unabhängig von Hauptrolle)
  ist_vorstand?: boolean
  ist_zweiter_vorstand?: boolean
  // PROJ-11: Im Antrag-Genehmiger-Pool für Kostenübernahme-Anträge eingetragen
  is_antrag_genehmiger?: boolean
}

// PROJ-3: KI-Provider Typen
export type KiProvider = "openai" | "anthropic"

export interface KiSettings {
  provider: KiProvider
  hasToken: boolean
}

// PROJ-3: Kontoauszug & Transaktions-Typen
export interface ParsedTransaction {
  id: string
  booking_date: string
  value_date: string
  description: string
  /**
   * PROJ-13 BUG-002: Name des Auftraggebers/Empfängers (vom KI-Parser
   * separat extrahiert). Wird für Regeln vom Typ `counterpart_contains`
   * verwendet. Kann fehlen, wenn das Parser-Modell den Namen nicht
   * zuverlässig bestimmen konnte.
   */
  counterpart?: string | null
  /**
   * PROJ-16: IBAN des Zahlungspartners (Gegenseite). Wird vom KI-Parser aus
   * dem Verwendungszweck oder Buchungstext extrahiert. Fließt in den
   * matching_hash und in das Fuzzy-Match zwischen PDF und PSD2 ein.
   */
  counterpart_iban?: string | null
  amount: number
  balance_after: number
  isDuplicate?: boolean
  isRemoved?: boolean
  /**
   * PROJ-13: Vom Server vorgeschlagene Kategorien basierend auf aktiven
   * Regeln. Wird in der Vorschau angezeigt und beim Bestätigen übernommen.
   */
  auto_category_ids?: string[]
}

export interface ParsedStatementResult {
  statement_number: string
  statement_date: string
  transactions: ParsedTransaction[]
  start_balance: number
  end_balance: number
  file_name?: string
  file_path?: string
  /** Falls der Seafile-Upload fehlgeschlagen ist: Klartext-Grund für das UI. */
  seafile_warning?: string
}

export interface BankStatement {
  id: string
  file_name: string
  statement_date: string
  statement_number: string
  transaction_count: number
  file_path: string
  uploaded_by: string
  created_at: string
}

// PROJ-12: Buchungskategorisierung
export interface Category {
  id: string
  name: string
  color: string
  created_at: string
}

// PROJ-13 / PROJ-15: Kategorisierungsregeln mit zusammengesetzten Kriterien
export type CriterionType =
  | "text_contains"
  | "counterpart_contains"
  | "amount_range"
  | "month_quarter"

export type AmountDirection = "both" | "in" | "out"

export type RuleCombinator = "AND" | "OR"

export interface TextContainsCriterion {
  type: "text_contains"
  term: string
}

export interface CounterpartContainsCriterion {
  type: "counterpart_contains"
  term: string
}

export interface AmountRangeCriterion {
  type: "amount_range"
  min: number
  max: number
  direction: AmountDirection
}

export interface MonthQuarterCriterion {
  type: "month_quarter"
  months?: number[]
  quarters?: number[]
}

export type RuleCriterion =
  | TextContainsCriterion
  | CounterpartContainsCriterion
  | AmountRangeCriterion
  | MonthQuarterCriterion

/**
 * PROJ-15: Die `condition`-JSONB-Spalte trägt jetzt eine
 * zusammengesetzte Bedingung aus mehreren Kriterien + Verknüpfung.
 */
export interface CategorizationRuleCondition {
  combinator: RuleCombinator
  criteria: RuleCriterion[]
}

export interface CategorizationRule {
  id: string
  name: string
  condition: CategorizationRuleCondition
  category_id: string
  category?: Category | null
  is_active: boolean
  sort_order: number
  /** Vom Backend gesetzt, wenn Zielkategorie gelöscht wurde. */
  is_invalid?: boolean
  created_at: string
}

// Mehrere Belege pro Buchung (Seafile-Links), siehe Migration 025.
export interface TransactionDocument {
  id: string
  document_url: string
  document_name: string
  display_order: number
  created_at: string
}

// PROJ-4: Dashboard-Typen
export interface Transaction {
  id: string
  booking_date: string
  value_date: string
  description: string
  /** PROJ-13 BUG-002: Name des Auftraggebers/Empfängers, separat vom Verwendungszweck. */
  counterpart?: string | null
  amount: number
  balance_after: number
  category: string | null
  note: string | null
  /** @deprecated Legacy-Einzelreferenz. Neue Uploads landen in `documents`. */
  document_ref: string | null
  /** Mehrere Belege pro Buchung (max. 5, je 10 MB). Wird vom GET-Endpoint befüllt. */
  documents: TransactionDocument[]
  statement_ref: string | null
  updated_at: string | null
  updated_by: string | null
  statement_id: string
  bank_statements: {
    statement_number: string
    file_name: string
    file_path: string | null
  }
  // PROJ-12: vom GET /api/transactions und PATCH mitgeliefert
  categories: Category[]
  // PROJ-16: Herkunfts- und Abgleichs-Felder
  matching_hash?: string | null
  quelle?: "psd2" | "pdf" | "beide"
  status?: "nur_psd2" | "nur_pdf" | "bestaetigt" | "vorschlag" | "konflikt"
  psd2_abgerufen_am?: string | null
  psd2_original_data?: Record<string, unknown> | null
  iban_gegenseite?: string | null
  nicht_matchen_mit?: string[] | null
}

// PROJ-16: PSD2-Verbindung (seit Migration 024 via Enable Banking)
export interface Psd2Verbindung {
  id: string
  enablebanking_session_id: string | null
  enablebanking_account_id: string | null
  enablebanking_authorization_id: string | null
  enablebanking_aspsp_name: string
  enablebanking_aspsp_country: string
  consent_gueltig_bis: string | null
  letzter_abruf_am: string | null
  letzter_abruf_status: "erfolg" | "fehler" | null
  letzter_abruf_fehler: string | null
  aufeinanderfolgende_fehler: number
  letzte_renewal_mail_am: string | null
  state_token: string | null
  state_token_erstellt_am: string | null
  erstellt_am: string
  erstellt_von: string
}

// PROJ-16: Status-Antwort für /api/admin/psd2/status
export interface Psd2Status {
  verbunden: boolean
  bereit: boolean
  /** Beibehaltener Feldname für das Frontend — enthält jetzt den ASPSP-Namen. */
  institution_id?: string
  aspsp_name?: string
  aspsp_country?: string
  consent_gueltig_bis?: string | null
  tage_bis_ablauf?: number | null
  letzter_abruf_am?: string | null
  letzter_abruf_status?: "erfolg" | "fehler" | null
  letzter_abruf_fehler?: string | null
  aufeinanderfolgende_fehler?: number
}

// PROJ-7: Granulare Feature-Berechtigungen
export interface UserPermissions {
  user_id: string
  edit_transactions: boolean
  export_excel: boolean
  import_statements: boolean
  updated_at: string
}

export type PermissionKey = "edit_transactions" | "export_excel" | "import_statements"

export interface UserProfileWithPermissions extends UserProfile {
  permissions: {
    edit_transactions: boolean
    export_excel: boolean
    import_statements: boolean
  }
}

export interface UserWithPermissions extends UserProfile {
  last_sign_in_at: string | null
  permissions: UserPermissions | null
}

// PROJ-11 (Neu): Kostenübernahme-Anträge aus öffentlichem Formular
export type AntragStatus = "offen" | "genehmigt" | "abgelehnt"
export type AntragEmailStatus = "ausstehend" | "gesendet" | "fehlgeschlagen"

export interface AntragDokument {
  id: string
  document_url: string
  document_name: string
  display_order: number
}

export interface AntragEntscheidung {
  id: string
  approver_user_id: string
  approver_email: string
  decision: "genehmigt" | "abgelehnt"
  comment: string | null
  decided_at: string
}

export interface Antrag {
  id: string
  applicant_first_name: string
  applicant_last_name: string
  applicant_email: string
  amount_cents: number
  purpose: string
  status: AntragStatus
  email_status: AntragEmailStatus
  decided_at: string | null
  created_at: string
  updated_at: string
  antrag_entscheidungen: AntragEntscheidung[]
  antrag_dokumente: AntragDokument[]
}

// PROJ-10: Genehmigungssystem
export type ApprovalStatus = "offen" | "genehmigt" | "abgelehnt" | "entwurf"
export type ApprovalLinkType = "und" | "oder"
export type ApprovalRoleType = "vorstand" | "zweiter_vorstand"

export interface ApprovalDocument {
  id: string
  url: string
  name: string
}

export interface ApprovalRequest {
  id: string
  created_by: string
  created_by_email?: string
  note: string
  /** @deprecated Nutze `documents` — bleibt für Altdaten gefüllt. */
  document_url: string | null
  /** @deprecated Nutze `documents` — bleibt für Altdaten gefüllt. */
  document_name: string | null
  documents: ApprovalDocument[]
  required_roles: ApprovalRoleType[]
  link_type: ApprovalLinkType
  status: ApprovalStatus
  created_at: string
  updated_at: string
}

export interface ApprovalDecision {
  id: string
  request_id: string
  approver_id: string
  approver_email?: string
  approver_role: ApprovalRoleType
  decision: "genehmigt" | "abgelehnt"
  comment: string | null
  decided_at: string
}

export interface ApprovalRequestWithDecisions extends ApprovalRequest {
  approval_decisions: ApprovalDecision[]
}

// PROJ-5: Bearbeitbare Felder
export type EditableTransactionField =
  | "description"
  | "note"
  | "document_ref"
  | "statement_ref"
  | "booking_date"
  | "value_date"
  | "amount"
  | "balance_after"
  | "category"

export interface TransactionUpdatePayload {
  field: EditableTransactionField
  value: string
}

/**
 * Felder, die per Multi-Update-Dialog gleichzeitig bearbeitet werden können.
 * amount und balance_after sind Zahlen, alle Datumsfelder ISO-Strings.
 */
export interface TransactionUpdateFields {
  booking_date?: string
  value_date?: string
  description?: string
  amount?: number
  balance_after?: number
  category?: string | null
  note?: string | null
}

export interface TransactionSummary {
  currentBalance: number
  totalIncome: number
  totalExpenses: number
  availableYears: string[]
}

export interface TransactionsResponse {
  transactions: Transaction[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

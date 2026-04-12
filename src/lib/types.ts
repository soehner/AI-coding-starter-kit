export type UserRole = "admin" | "viewer"

export interface UserProfile {
  id: string
  email: string
  role: UserRole
  created_at: string
  // PROJ-10: Zusatzrollen für Genehmigungssystem (unabhängig von Hauptrolle)
  ist_vorstand?: boolean
  ist_zweiter_vorstand?: boolean
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
  amount: number
  balance_after: number
  isDuplicate?: boolean
  isRemoved?: boolean
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

// PROJ-4: Dashboard-Typen
export interface Transaction {
  id: string
  booking_date: string
  value_date: string
  description: string
  amount: number
  balance_after: number
  category: string | null
  note: string | null
  document_ref: string | null
  statement_ref: string | null
  updated_at: string | null
  updated_by: string | null
  statement_id: string
  bank_statements: {
    statement_number: string
    file_name: string
    file_path: string | null
  }
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

// PROJ-11: Kostenübernahme-Antrag
export type CostRequestStatus = "offen" | "genehmigt" | "abgelehnt"
export type ApprovalRole = "vorsitzender_1" | "vorsitzender_2" | "kassier"

export interface CostRequest {
  id: string
  applicant_first_name: string
  applicant_last_name: string
  applicant_email: string
  amount_cents: number
  purpose: string
  status: CostRequestStatus
  email_status: "ausstehend" | "gesendet" | "fehlgeschlagen"
  decided_at: string | null
  created_at: string
}

export interface CostRequestVote {
  approval_role: ApprovalRole
  decision: "genehmigt" | "abgelehnt"
  voted_at: string
}

export interface CostRequestWithVotes extends CostRequest {
  cost_request_votes: CostRequestVote[]
}

export interface CostRequestApprover {
  id: string
  approval_role: ApprovalRole
  user_id: string
  label: string
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

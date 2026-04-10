export type UserRole = "admin" | "viewer"

export interface UserProfile {
  id: string
  email: string
  role: UserRole
  created_at: string
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
  }
}

// PROJ-5: Bearbeitbare Felder
export type EditableTransactionField = "description" | "note" | "document_ref" | "statement_ref"

export interface TransactionUpdatePayload {
  field: EditableTransactionField
  value: string
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

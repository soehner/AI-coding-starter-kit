export type UserRole = "admin" | "viewer"

export interface UserProfile {
  id: string
  email: string
  role: UserRole
  created_at: string
}

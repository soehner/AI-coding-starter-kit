export const dynamic = "force-dynamic"

import { AppHeader } from "@/components/app-header"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader />
      <main className="flex-1">{children}</main>
    </div>
  )
}

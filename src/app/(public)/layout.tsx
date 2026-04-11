import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "CBS-Mannheim Förderverein",
  description: "Öffentliches Formular des CBS-Mannheim Fördervereins",
}

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-background">
      {children}
    </div>
  )
}

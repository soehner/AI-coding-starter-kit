import type { Metadata } from "next"
import { Toaster } from "@/components/ui/sonner"
import "./globals.css"

export const metadata: Metadata = {
  title: "CBS-Finanz",
  description:
    "Kassenbuch-Verwaltung für den CBS-Mannheim Förderverein",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="de">
      <body className="antialiased">
          {children}
          <Toaster position="bottom-right" richColors closeButton />
        </body>
    </html>
  )
}

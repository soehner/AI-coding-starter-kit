"use client"

import dynamic from "next/dynamic"
import { useAuth } from "@/hooks/use-auth"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle } from "lucide-react"

export default function DashboardPage() {
  const { profile, isLoading, error } = useAuth()

  if (isLoading) {
    return (
      <div className="container px-4 py-8 md:px-6">
        <Skeleton className="mb-6 h-8 w-48" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container px-4 py-8 md:px-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="container px-4 py-8 md:px-6">
      <h2 className="mb-6 text-2xl font-bold tracking-tight">
        Willkommen{profile?.email ? `, ${profile.email}` : ""}
      </h2>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Kontoauszüge</CardTitle>
            <CardDescription>
              Hochgeladene PDF-Kontoauszüge verwalten
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Noch keine Kontoauszüge vorhanden. Diese Funktion wird in PROJ-3
              implementiert.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Bankbewegungen</CardTitle>
            <CardDescription>
              Übersicht aller Transaktionen
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Noch keine Bankbewegungen vorhanden. Diese Funktion wird in PROJ-4
              implementiert.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Kassenbuch</CardTitle>
            <CardDescription>Export als Excel-Datei</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Export-Funktion wird in PROJ-6 implementiert.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

"use client"

import { useAuth } from "@/hooks/use-auth"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Skeleton } from "@/components/ui/skeleton"
import {
  BookOpen,
  CheckSquare,
  ClipboardList,
  FileUp,
  Home,
  LogOut,
  Settings,
  User,
  Users,
} from "lucide-react"
import Link from "next/link"
import Image from "next/image"

function getInitials(email: string): string {
  return email.substring(0, 2).toUpperCase()
}

function getRoleLabel(role: string): string {
  switch (role) {
    case "admin":
      return "Administrator"
    case "viewer":
      return "Betrachter"
    default:
      return role
  }
}

export function AppHeader() {
  const {
    user,
    profile,
    isLoading,
    signOut,
    isAdmin,
    hasPermission,
    canSeeGenehmigungen,
    canSeeAntraege,
  } = useAuth()

  const canImport = hasPermission("import_statements")

  return (
    <header className="sticky top-0 z-50 w-full border-b border-primary/10 bg-background/95 shadow-sm shadow-primary/5 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="container flex h-16 items-center justify-between gap-2 px-4 md:px-6">
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard"
            className="flex items-center gap-3 text-lg font-semibold transition-opacity hover:opacity-80"
            aria-label="Zum Dashboard"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-primary/15 to-secondary ring-1 ring-primary/20">
              <Image
                src="/icon.png"
                alt=""
                width={32}
                height={32}
                className="h-7 w-7 object-contain"
              />
            </div>
            <span className="bg-gradient-to-r from-foreground to-primary bg-clip-text text-transparent">
              CBS-Finanz
            </span>
          </Link>
        </div>

        <div className="flex items-center gap-2">
          {isLoading ? (
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-8 w-8 rounded-full" />
            </div>
          ) : user && profile ? (
            <>
              {/* Primäre Aktionen — im Desktop-Header sichtbar */}
              <nav className="hidden items-center gap-1 md:flex">
                {canImport && (
                  <Button variant="ghost" size="sm" asChild>
                    <Link href="/dashboard/admin/import">
                      <FileUp className="mr-2 h-4 w-4" />
                      Kontoauszug importieren
                    </Link>
                  </Button>
                )}
                {canSeeGenehmigungen && (
                  <Button variant="ghost" size="sm" asChild>
                    <Link href="/dashboard/admin/genehmigungen">
                      <CheckSquare className="mr-2 h-4 w-4" />
                      Genehmigungen
                    </Link>
                  </Button>
                )}
                {canSeeAntraege && (
                  <Button variant="ghost" size="sm" asChild>
                    <Link href="/dashboard/admin/kostenuebernahmen">
                      <ClipboardList className="mr-2 h-4 w-4" />
                      Anträge auf Kostenübernahme
                    </Link>
                  </Button>
                )}
              </nav>

              <Badge
                variant={profile.role === "admin" ? "default" : "secondary"}
                className="hidden sm:inline-flex"
              >
                {getRoleLabel(profile.role)}
              </Badge>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="relative h-8 w-8 rounded-full"
                    aria-label="Benutzermenü öffnen"
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarFallback>
                        {getInitials(profile.email)}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">
                        {profile.email}
                      </p>
                      <p className="text-xs leading-none text-muted-foreground">
                        {getRoleLabel(profile.role)}
                      </p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="sm:hidden">
                    <User className="mr-2 h-4 w-4" />
                    {getRoleLabel(profile.role)}
                  </DropdownMenuItem>

                  {/* Mobile-Fallback: Primäre Aktionen auch im Menü */}
                  <DropdownMenuItem asChild className="md:hidden">
                    <Link href="/dashboard">
                      <Home className="mr-2 h-4 w-4" />
                      Dashboard
                    </Link>
                  </DropdownMenuItem>
                  {canImport && (
                    <DropdownMenuItem asChild className="md:hidden">
                      <Link href="/dashboard/admin/import">
                        <FileUp className="mr-2 h-4 w-4" />
                        Kontoauszug importieren
                      </Link>
                    </DropdownMenuItem>
                  )}
                  {canSeeGenehmigungen && (
                    <DropdownMenuItem asChild className="md:hidden">
                      <Link href="/dashboard/admin/genehmigungen">
                        <CheckSquare className="mr-2 h-4 w-4" />
                        Genehmigungen
                      </Link>
                    </DropdownMenuItem>
                  )}
                  {canSeeAntraege && (
                    <DropdownMenuItem asChild className="md:hidden">
                      <Link href="/dashboard/admin/kostenuebernahmen">
                        <ClipboardList className="mr-2 h-4 w-4" />
                        Anträge auf Kostenübernahme
                      </Link>
                    </DropdownMenuItem>
                  )}
                  {isAdmin && (
                    <>
                      <DropdownMenuSeparator className="md:hidden" />
                      <DropdownMenuItem asChild>
                        <Link href="/dashboard/admin/users">
                          <Users className="mr-2 h-4 w-4" />
                          Benutzerverwaltung
                        </Link>
                      </DropdownMenuItem>
                    </>
                  )}
                  <DropdownMenuItem asChild>
                    <Link href="/dashboard/einstellungen">
                      <Settings className="mr-2 h-4 w-4" />
                      Einstellungen
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <a
                      href="/handbuch"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <BookOpen className="mr-2 h-4 w-4" />
                      Handbuch
                    </a>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={signOut}
                    className="text-destructive focus:text-destructive"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Abmelden
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : null}
        </div>
      </div>
    </header>
  )
}

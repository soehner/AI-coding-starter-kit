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
import { PasswordChangeDialog } from "@/components/password-change-dialog"
import { FileUp, LogOut, Settings, User, Users } from "lucide-react"
import Link from "next/link"

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
  const { user, profile, isLoading, signOut, updatePassword, isAdmin } = useAuth()

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center justify-between px-4 md:px-6">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-semibold">CBS-Finanz</h1>
        </div>

        <div className="flex items-center gap-3">
          {isLoading ? (
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-8 w-8 rounded-full" />
            </div>
          ) : user && profile ? (
            <>
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
                  {isAdmin && (
                    <>
                      <DropdownMenuItem asChild>
                        <Link href="/dashboard/admin/import">
                          <FileUp className="mr-2 h-4 w-4" />
                          Kontoauszug importieren
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href="/dashboard/admin/users">
                          <Users className="mr-2 h-4 w-4" />
                          Benutzerverwaltung
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href="/dashboard/admin/settings">
                          <Settings className="mr-2 h-4 w-4" />
                          Einstellungen
                        </Link>
                      </DropdownMenuItem>
                    </>
                  )}
                  <DropdownMenuItem asChild onSelect={(e) => e.preventDefault()}>
                    <PasswordChangeDialog onUpdatePassword={updatePassword} />
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

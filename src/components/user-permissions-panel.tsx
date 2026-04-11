"use client"

import { useState } from "react"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, AlertCircle } from "lucide-react"
import type { PermissionKey, UserPermissions } from "@/lib/types"

interface PermissionConfig {
  key: PermissionKey
  label: string
  description: string
}

const PERMISSIONS: PermissionConfig[] = [
  {
    key: "edit_transactions",
    label: "Buchungen bearbeiten",
    description: "Buchungstext, Bemerkungen und Beleg-Referenzen bearbeiten",
  },
  {
    key: "export_excel",
    label: "Excel-Export",
    description: "Kassenbuch als Excel-Datei exportieren",
  },
  {
    key: "import_statements",
    label: "Kontoauszüge importieren",
    description: "PDF-Kontoauszüge hochladen und parsen lassen",
  },
]

interface UserPermissionsPanelProps {
  userId: string
  userEmail: string
  permissions: UserPermissions | null
  onPermissionChange: (
    userId: string,
    permission: PermissionKey,
    value: boolean
  ) => Promise<void>
}

export function UserPermissionsPanel({
  userId,
  userEmail,
  permissions,
  onPermissionChange,
}: UserPermissionsPanelProps) {
  const [updatingPermission, setUpdatingPermission] = useState<PermissionKey | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleToggle(permission: PermissionKey, checked: boolean) {
    setUpdatingPermission(permission)
    setError(null)

    try {
      await onPermissionChange(userId, permission, checked)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Berechtigung konnte nicht geändert werden."
      )
    } finally {
      setUpdatingPermission(null)
    }
  }

  return (
    <div className="space-y-4 px-4 py-3">
      <div>
        <h4 className="text-sm font-medium">Feature-Berechtigungen</h4>
        <p className="text-xs text-muted-foreground">
          Zusätzliche Rechte für {userEmail}
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-3">
        {PERMISSIONS.map((perm, index) => {
          const isUpdating = updatingPermission === perm.key
          const currentValue = permissions?.[perm.key] ?? false

          return (
            <div key={perm.key}>
              {index > 0 && <Separator className="mb-3" />}
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <Label
                    htmlFor={`perm-${userId}-${perm.key}`}
                    className="text-sm font-normal"
                  >
                    {perm.label}
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    {perm.description}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {isUpdating && (
                    <Loader2
                      className="h-4 w-4 animate-spin text-muted-foreground"
                      aria-hidden="true"
                    />
                  )}
                  <Switch
                    id={`perm-${userId}-${perm.key}`}
                    checked={currentValue}
                    onCheckedChange={(checked) => handleToggle(perm.key, checked)}
                    disabled={isUpdating}
                    aria-label={`${perm.label} für ${userEmail} ${currentValue ? "deaktivieren" : "aktivieren"}`}
                  />
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

"use client"

import { useEffect } from "react"

/**
 * Globale Error-Boundary für die gesamte App. Wird von Next.js gerendert,
 * wenn eine Client-Exception nicht von einer tieferen Boundary gefangen
 * wurde. Zeigt die tatsächliche Fehlermeldung + Stack, damit Diagnose
 * ohne Browser-Konsole möglich ist.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("Global Error Boundary:", error)
  }, [error])

  return (
    <html lang="de">
      <body
        style={{
          fontFamily:
            "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
          margin: 0,
          padding: "2rem 1rem",
          background: "#fafafa",
          minHeight: "100vh",
        }}
      >
        <div
          style={{
            maxWidth: "720px",
            margin: "0 auto",
            background: "#fff",
            border: "1px solid #fca5a5",
            borderRadius: "8px",
            padding: "1.5rem",
          }}
        >
          <h1
            style={{
              color: "#b91c1c",
              fontSize: "1.25rem",
              marginTop: 0,
              marginBottom: "0.75rem",
            }}
          >
            Anwendungsfehler
          </h1>
          <p
            style={{
              color: "#374151",
              marginTop: 0,
              marginBottom: "1rem",
            }}
          >
            In der Anwendung ist ein unerwarteter Fehler aufgetreten. Bitte
            schicke den folgenden Text an den Entwickler:
          </p>
          <pre
            style={{
              background: "#f3f4f6",
              border: "1px solid #e5e7eb",
              borderRadius: "6px",
              padding: "0.75rem",
              overflow: "auto",
              fontSize: "0.75rem",
              lineHeight: 1.5,
              color: "#111827",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
          >
            <strong>Name:</strong> {error.name}
            {"\n"}
            <strong>Message:</strong> {error.message}
            {error.digest && (
              <>
                {"\n"}
                <strong>Digest:</strong> {error.digest}
              </>
            )}
            {error.stack && (
              <>
                {"\n\n"}
                <strong>Stack:</strong>
                {"\n"}
                {error.stack}
              </>
            )}
          </pre>
          <div style={{ marginTop: "1rem", display: "flex", gap: "0.5rem" }}>
            <button
              type="button"
              onClick={() => reset()}
              style={{
                background: "#111827",
                color: "#fff",
                border: "none",
                borderRadius: "6px",
                padding: "0.5rem 1rem",
                cursor: "pointer",
                fontSize: "0.875rem",
              }}
            >
              Erneut versuchen
            </button>
            <button
              type="button"
              onClick={() => (window.location.href = "/dashboard")}
              style={{
                background: "#fff",
                color: "#111827",
                border: "1px solid #d1d5db",
                borderRadius: "6px",
                padding: "0.5rem 1rem",
                cursor: "pointer",
                fontSize: "0.875rem",
              }}
            >
              Zurück zum Dashboard
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}

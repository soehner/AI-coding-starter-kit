import type { NextConfig } from "next";

// Erlaubte iFrame-Origins aus Umgebungsvariable oder Standardwert
const iframeAllowedOrigins =
  process.env.IFRAME_ALLOWED_ORIGINS || "https://cbs-mannheim.de";
const frameAncestors = `'self' ${iframeAllowedOrigins.split(",").map((o) => o.trim()).join(" ")}`;

const nextConfig: NextConfig = {
  // pdfjs-dist nicht bündeln — Next.js lädt es direkt aus node_modules,
  // damit pdf.worker.mjs unter dem erwarteten Pfad gefunden wird.
  serverExternalPackages: ["pdfjs-dist"],
  async headers() {
    const defaultSecurityHeaders = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "origin-when-cross-origin" },
      {
        key: "Strict-Transport-Security",
        value: "max-age=63072000; includeSubDomains; preload",
      },
    ];

    return [
      // Öffentliche iFrame-taugliche Seiten (Antrag + Abstimmung)
      {
        source: "/antrag/:path*",
        headers: [
          ...defaultSecurityHeaders,
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob:",
              "font-src 'self' data:",
              "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
              `frame-ancestors ${frameAncestors}`,
              "base-uri 'self'",
              "form-action 'self'",
            ].join("; "),
          },
        ],
      },
      {
        source: "/abstimmung/:path*",
        headers: [
          ...defaultSecurityHeaders,
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob:",
              "font-src 'self' data:",
              "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
              `frame-ancestors ${frameAncestors}`,
              "base-uri 'self'",
              "form-action 'self'",
            ].join("; "),
          },
        ],
      },
      // Alle anderen Seiten: iFrame-Einbettung blockiert
      {
        source: "/((?!antrag|abstimmung).*)",
        headers: [
          ...defaultSecurityHeaders,
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob:",
              "font-src 'self' data:",
              "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;

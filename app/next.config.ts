import type { NextConfig } from "next";

/** Hosts für Server-Action Origin-Check (CSRF light, BA14). */
function serverActionOrigins(): string[] {
  const base = [
    "localhost",
    "localhost:80",
    "localhost:3000",
    "127.0.0.1",
    "127.0.0.1:80",
    "127.0.0.1:3000",
  ];
  const appUrl = process.env.APP_URL?.trim();
  if (appUrl) {
    try {
      const u = new URL(appUrl);
      if (u.host) base.push(u.host);
      if (u.hostname && u.hostname !== u.host) base.push(u.hostname);
    } catch {
      // ungültige APP_URL → nur Defaults
    }
  }
  return [...new Set(base)];
}

const nextConfig: NextConfig = {
  output: "standalone",
  // @react-pdf/renderer (ADR-0014) — nativ/Node-side bundling
  // nodemailer (ADR-0010) — SMTP aus Next
  serverExternalPackages: ["@react-pdf/renderer", "nodemailer"],
  // Self-hosted hinter Caddy: Hosts für Server Actions (CSRF-Check)
  experimental: {
    serverActions: {
      // Beleg-PDF/Bilder (PB-Feld max 15 MiB) + Form-Felder
      bodySizeLimit: "16mb",
      allowedOrigins: serverActionOrigins(),
    },
  },
};

export default nextConfig;

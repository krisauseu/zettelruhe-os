/**
 * ENV-Validierung light (BA14).
 * Kein harter Crash im Dev mit Platzhaltern — Warnungen + Guards für Produktion.
 */

/** Nur offensichtliche Template-Werte aus .env.example — keine generischen Teilstrings. */
const PLACEHOLDER_FRAGMENTS = [
  "change-me",
  "changeme",
  "change_me",
  "admin@example.com",
  "example.com",
] as const;

export type EnvCheck = {
  ok: boolean;
  errors: string[];
  warnings: string[];
};

function looksLikePlaceholder(value: string): boolean {
  const lower = value.toLowerCase();
  return PLACEHOLDER_FRAGMENTS.some((p) => lower.includes(p));
}

/** Prüft Pflicht-ENV; für Health und Startup-Log. */
export function checkRuntimeEnv(): EnvCheck {
  const errors: string[] = [];
  const warnings: string[] = [];

  const session = process.env.SESSION_SECRET ?? "";
  if (!session || session.length < 32) {
    errors.push("SESSION_SECRET fehlt oder ist kürzer als 32 Zeichen.");
  } else if (looksLikePlaceholder(session)) {
    warnings.push(
      "SESSION_SECRET wirkt wie ein Platzhalter — in Produktion echten Zufall setzen.",
    );
  }

  if (!process.env.PB_URL?.trim()) {
    errors.push("PB_URL ist nicht gesetzt.");
  }

  const suEmail = process.env.PB_SUPERUSER_EMAIL ?? "";
  const suPass = process.env.PB_SUPERUSER_PASSWORD ?? "";
  if (!suEmail || !suPass) {
    errors.push("PB_SUPERUSER_EMAIL und PB_SUPERUSER_PASSWORD sind Pflicht.");
  } else {
    if (looksLikePlaceholder(suEmail) || looksLikePlaceholder(suPass)) {
      warnings.push(
        "PB-Superuser-Zugangsdaten wirken wie Platzhalter — in Produktion ersetzen.",
      );
    }
  }

  const appUrl = process.env.APP_URL ?? "";
  if (!appUrl.trim()) {
    warnings.push("APP_URL ist leer — Session Secure-Flag und Links können falsch sein.");
  } else if (!appUrl.startsWith("https://") && process.env.NODE_ENV === "production") {
    warnings.push(
      "APP_URL nutzt kein HTTPS — Session-Cookie ohne Secure-Flag (nur hinter vertrauenswürdigem HTTP/LAN ok).",
    );
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
  };
}

/** Loggt Warnungen/Fehler einmalig beim Start (kein throw — Compose soll starten). */
export function logEnvCheckAtStartup(): void {
  const check = checkRuntimeEnv();
  for (const w of check.warnings) {
    console.warn(`[zettelruhe] ENV-Warnung: ${w}`);
  }
  for (const e of check.errors) {
    console.error(`[zettelruhe] ENV-Fehler: ${e}`);
  }
  if (!check.ok) {
    console.error(
      "[zettelruhe] Pflicht-ENV unvollständig — Login/Setup können fehlschlagen. Siehe .env.example und docs/betrieb.md.",
    );
  }
}

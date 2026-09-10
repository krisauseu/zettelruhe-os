import { checkRuntimeEnv } from "@/lib/env";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Liveness/Readiness light — öffentlich, ohne Session.
 * PB-Ping optional: bei Timeout/Fehler status=degraded, HTTP 200 bleibt für Liveness.
 */
export async function GET(): Promise<Response> {
  const env = checkRuntimeEnv();
  let pb: "ok" | "unreachable" | "skipped" = "skipped";

  const pbUrl = process.env.PB_URL?.replace(/\/$/, "");
  if (pbUrl) {
    try {
      const res = await fetch(`${pbUrl}/api/health`, {
        cache: "no-store",
        signal: AbortSignal.timeout(2500),
      });
      pb = res.ok ? "ok" : "unreachable";
    } catch {
      pb = "unreachable";
    }
  }

  const body = {
    ok: env.ok && pb !== "unreachable",
    service: "zettelruhe",
    env: env.ok ? "ok" : "error",
    pocketbase: pb,
    ...(env.errors.length > 0 ? { env_errors: env.errors } : {}),
    ...(env.warnings.length > 0 ? { env_warnings: env.warnings } : {}),
  };

  // Liveness: 200 solange der Next-Prozess antwortet.
  // Compose-Healthcheck kann ok=false bei PB-Ausfall auswerten, wenn gewünscht.
  return Response.json(body, {
    status: 200,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

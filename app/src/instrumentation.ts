/**
 * Next.js instrumentation — ENV-Check light + In-Process-Jobs (ADR-0010).
 * Läuft im Node-Runtime des Next-Containers (Compose).
 */
export async function register(): Promise<void> {
  // Nur Node-Server (nicht Edge)
  if (process.env.NEXT_RUNTIME === "edge") return;

  const { logEnvCheckAtStartup } = await import("@/lib/env");
  logEnvCheckAtStartup();

  const { startInProcessScheduler } = await import("@/modules/jobs/scheduler");
  startInProcessScheduler();
}

/**
 * In-Process-Scheduler im Next-Container (ADR-0010).
 * Start über instrumentation.ts; kein Extra-Worker-Service.
 */

import { runWiederkehrendTick } from "./runner";

const DEFAULT_INTERVAL_MS = 15 * 60 * 1000; // 15 Minuten

declare global {
  var __zettelruhe_scheduler_running: boolean | undefined;
  var __zettelruhe_scheduler_started: boolean | undefined;
  var __zettelruhe_scheduler_timer: ReturnType<typeof setInterval> | undefined;
}

function intervalMs(): number {
  const raw = (process.env.JOB_TICK_INTERVAL_MS ?? "").trim();
  if (raw) {
    const n = Number.parseInt(raw, 10);
    if (Number.isFinite(n) && n >= 60_000) return n;
  }
  return DEFAULT_INTERVAL_MS;
}

function jobsDisabled(): boolean {
  const v = (process.env.JOBS_DISABLED ?? "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

async function safeTick(): Promise<void> {
  if (globalThis.__zettelruhe_scheduler_running) return;
  globalThis.__zettelruhe_scheduler_running = true;
  try {
    const result = await runWiederkehrendTick();
    if (result.status === "fehler") {
      console.error("[jobs] wiederkehrend tick:", result.ergebnis);
    } else if (result.erzeugt > 0) {
      console.info("[jobs] wiederkehrend:", result.ergebnis);
    }
  } catch (e) {
    console.error(
      "[jobs] wiederkehrend tick failed:",
      e instanceof Error ? e.message : e,
    );
  } finally {
    globalThis.__zettelruhe_scheduler_running = false;
  }
}

/**
 * Startet den Intervall-Tick einmal pro Prozess (idempotent).
 * Erster Lauf nach kurzer Verzögerung (PB-Ready nach Container-Start).
 */
export function startInProcessScheduler(): void {
  if (jobsDisabled()) {
    console.info("[jobs] Scheduler deaktiviert (JOBS_DISABLED).");
    return;
  }
  if (globalThis.__zettelruhe_scheduler_started) {
    return;
  }
  globalThis.__zettelruhe_scheduler_started = true;

  const ms = intervalMs();
  console.info(
    `[jobs] In-Process-Scheduler gestartet (Intervall ${Math.round(ms / 1000)}s).`,
  );

  // Verzögerter Erstlauf — Compose-Stack / PB brauchen oft ein paar Sekunden
  setTimeout(() => {
    void safeTick();
  }, 30_000);

  globalThis.__zettelruhe_scheduler_timer = setInterval(() => {
    void safeTick();
  }, ms);

  // Timer darf Node-Prozess nicht künstlich am Leben halten (optional)
  if (
    globalThis.__zettelruhe_scheduler_timer &&
    typeof globalThis.__zettelruhe_scheduler_timer.unref === "function"
  ) {
    globalThis.__zettelruhe_scheduler_timer.unref();
  }
}

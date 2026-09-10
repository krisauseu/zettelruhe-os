/**
 * Modul: jobs — In-Process-Scheduler, DB-Lock, SMTP-Versand (ADR-0010)
 * Bauabschnitt 10: Wiederkehrend-Tick + E-Mail Angebot/Rechnung/Zahlungserinnerung.
 */

export const MODULE_ID = "jobs" as const;

export { JOB_KEY_WIEDERKEHREND } from "./types";
export type { JobLock, JobRun, JobRunStatus } from "./types";

export {
  DEFAULT_LOCK_TTL_MS,
  getLockByKey,
  isLockExpired,
  isLockHeldBy,
  releaseLock,
  tryAcquireLock,
} from "./lock";

export { finishJobRun, listRecentJobRuns, startJobRun } from "./runs";

export { runWiederkehrendTick } from "./runner";
export type { TickErgebnis } from "./runner";

export { startInProcessScheduler } from "./scheduler";

export {
  isSmtpConfigured,
  sendeAngebotPerMail,
  sendeRechnungPerMail,
  sendeZahlungserinnerungPerMail,
  SMTP_NOT_CONFIGURED_ERROR,
} from "./mail";

export {
  runJobsTickAction,
  sendeAngebotMailAction,
  sendeRechnungMailAction,
  sendeZahlungserinnerungAction,
} from "./actions";

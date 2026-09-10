/** Job-Lock / Job-Run Types (ADR-0010) */

export type JobRunStatus = "gestartet" | "ok" | "fehler" | "uebersprungen";

export type JobLock = {
  id: string;
  key: string;
  holder: string;
  /** ISO-8601 UTC */
  expires_at: string;
};

export type JobRun = {
  id: string;
  job_key: string;
  status: JobRunStatus;
  gestartet_am: string;
  beendet_am: string;
  ergebnis: string;
  firma: string | null;
};

/** Bekannte Job-Keys */
export const JOB_KEY_WIEDERKEHREND = "wiederkehrende_rechnungen" as const;

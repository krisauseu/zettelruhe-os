/**
 * Job-Run-Protokoll light (letzter Lauf / Historie).
 */

import {
  createRecord,
  listRecords,
  pbEq,
  updateRecord,
} from "@/lib/pb";
import type { JobRun, JobRunStatus } from "./types";

const COL = "job_runs";

type PbRun = {
  id: string;
  job_key: string;
  status: string;
  gestartet_am: string;
  beendet_am?: string;
  ergebnis?: string;
  firma?: string;
};

const VALID_STATUS = new Set<JobRunStatus>([
  "gestartet",
  "ok",
  "fehler",
  "uebersprungen",
]);

function mapRun(r: PbRun): JobRun {
  const status = VALID_STATUS.has(r.status as JobRunStatus)
    ? (r.status as JobRunStatus)
    : "gestartet";
  return {
    id: r.id,
    job_key: r.job_key,
    status,
    gestartet_am: r.gestartet_am,
    beendet_am: r.beendet_am ?? "",
    ergebnis: r.ergebnis ?? "",
    firma: r.firma || null,
  };
}

export async function startJobRun(
  jobKey: string,
  opts?: { firmaId?: string | null; now?: Date },
): Promise<JobRun> {
  const now = opts?.now ?? new Date();
  const body: Record<string, unknown> = {
    job_key: jobKey,
    status: "gestartet",
    gestartet_am: now.toISOString(),
  };
  if (opts?.firmaId) body.firma = opts.firmaId;
  const r = await createRecord<PbRun>(COL, body);
  return mapRun(r);
}

export async function finishJobRun(
  id: string,
  status: Exclude<JobRunStatus, "gestartet">,
  ergebnis: string,
  opts?: { now?: Date },
): Promise<JobRun> {
  const now = opts?.now ?? new Date();
  const r = await updateRecord<PbRun>(COL, id, {
    status,
    beendet_am: now.toISOString(),
    ergebnis: ergebnis.slice(0, 2000),
  });
  return mapRun(r);
}

export async function listRecentJobRuns(
  jobKey: string,
  limit = 10,
): Promise<JobRun[]> {
  const result = await listRecords<PbRun>(COL, {
    page: 1,
    perPage: limit,
    filter: pbEq("job_key", jobKey),
    // PB 0.39: kein system-created-Sort
    sort: "-gestartet_am,-id",
  });
  return result.items.map(mapRun);
}

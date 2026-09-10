import { releaseOperation } from "@/lib/finanz-transaktion";
/**
 * DB-Lock in PocketBase gegen Doppelausführung (ADR-0010).
 * Create-with-unique-key + TTL; abgelaufene Locks werden übernommen.
 */

import {
  getRecord,
  listRecords,
  pbEq,
} from "@/lib/pb";
import type { JobLock } from "./types";

const COL = "job_locks";

/** Default Lock-TTL (Job sollte kürzer laufen) */
export const DEFAULT_LOCK_TTL_MS = 5 * 60 * 1000;

type PbLock = {
  id: string;
  key: string;
  holder: string;
  expires_at: string;
};

function mapLock(r: PbLock): JobLock {
  return {
    id: r.id,
    key: r.key,
    holder: r.holder,
    expires_at: r.expires_at,
  };
}

export async function getLockByKey(key: string): Promise<JobLock | null> {
  const result = await listRecords<PbLock>(COL, { page: 1, perPage: 1, filter: pbEq("key", key) });
  return result.items[0] ? mapLock(result.items[0]) : null;
}

/** Acquisition and conditional release are serialized inside PocketBase. */
export async function tryAcquireLock(key: string, holder: string, opts?: { now?: Date; ttlMs?: number }): Promise<JobLock | null> {
  return releaseOperation<JobLock | null>("jobs/lock", { key, holder, operation: "acquire", ttlMs: opts?.ttlMs ?? DEFAULT_LOCK_TTL_MS });
}
export async function releaseLock(key: string, holder: string): Promise<void> {
  await releaseOperation("jobs/lock", { key, holder, operation: "release" });
}

/** Prüft, ob Lock von holder gehalten und noch gültig. */
export function isLockHeldBy(
  lock: JobLock | null,
  holder: string,
  now: Date = new Date(),
): boolean {
  if (!lock) return false;
  if (lock.holder !== holder) return false;
  return lock.expires_at > now.toISOString();
}

/** Reine Hilfsfunktion für Tests: Lock abgelaufen? */
export function isLockExpired(
  lock: Pick<JobLock, "expires_at">,
  now: Date = new Date(),
): boolean {
  return !lock.expires_at || lock.expires_at <= now.toISOString();
}

export async function getLockRecord(id: string): Promise<JobLock | null> {
  try {
    const r = await getRecord<PbLock>(COL, id);
    return mapLock(r);
  } catch {
    return null;
  }
}

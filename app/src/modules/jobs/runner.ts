/**
 * Job-Runner: fällige wiederkehrende Vorlagen → Rechnungs-Entwürfe.
 * Mit DB-Lock (ADR-0010). Kein Extra-Worker-Service.
 */

import { listRecords } from "@/lib/pb";
import { finanzSystemAkteur } from "@/lib/finanz-transaktion";
import {
  erzeugeFaelligeAusVorlage,
  listFaelligeWiederkehrende,
} from "@/modules/sales/wiederkehrend-repository";
import { todayBerlin } from "@/modules/sales/wiederkehrend-invariants";
import { tryAcquireLock, releaseLock } from "./lock";
import { finishJobRun, startJobRun } from "./runs";
import { JOB_KEY_WIEDERKEHREND } from "./types";

export type TickErgebnis = {
  acquired: boolean;
  status: "ok" | "fehler" | "uebersprungen";
  erzeugt: number;
  vorlagen: number;
  fehler: string[];
  ergebnis: string;
};

type PbFirma = { id: string };

/**
 * Ein Scheduler-Tick: Lock → alle Firmen → fällige Vorlagen → Entwürfe.
 */
export async function runWiederkehrendTick(opts?: {
  now?: Date;
  holder?: string;
  firmaId?: string;
}): Promise<TickErgebnis> {
  const now = opts?.now ?? new Date();
  const holder = opts?.holder ?? `next-${crypto.randomUUID()}`;
  const heute = todayBerlin(now);
  const jobKey = JOB_KEY_WIEDERKEHREND;

  const lock = await tryAcquireLock(jobKey, holder, { now });
  if (!lock) {
    return {
      acquired: false,
      status: "uebersprungen",
      erzeugt: 0,
      vorlagen: 0,
      fehler: [],
      ergebnis: "Lock gehalten — Tick übersprungen.",
    };
  }

  let runId: string | null = null;
  try {
    const run = await startJobRun(jobKey, {
      now,
      firmaId: opts?.firmaId ?? null,
    });
    runId = run.id;

    let firmaIds: string[] = [];
    if (opts?.firmaId) {
      firmaIds = [opts.firmaId];
    } else {
      for (let page = 1; ; page++) {
        const list = await listRecords<PbFirma>("firmen", { page, perPage: 50, sort: "id" });
        firmaIds.push(...list.items.map((f) => f.id));
        if (page >= list.totalPages) break;
      }
    }

    let erzeugt = 0;
    let vorlagen = 0;
    const fehler: string[] = [];

    for (const firmaId of firmaIds) {
      let akteur: string;
      try {
        akteur = await finanzSystemAkteur(firmaId);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        fehler.push(`Firma ${firmaId}: Akteur — ${msg}`);
        continue;
      }
      let faellig: Awaited<ReturnType<typeof listFaelligeWiederkehrende>>;
      try {
        faellig = await listFaelligeWiederkehrende(firmaId, heute);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        fehler.push(`Firma ${firmaId}: Liste — ${msg}`);
        continue;
      }

      for (const v of faellig) {
        vorlagen += 1;
        try {
          const result = await erzeugeFaelligeAusVorlage(firmaId, v.id, {
            heute,
            now,
            akteur,
          });
          erzeugt += result.rechnungen.length;
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          fehler.push(`${v.bezeichnung || v.id}: ${msg}`);
        }
      }
    }

    const ergebnis =
      fehler.length === 0
        ? `OK: ${erzeugt} Rechnungs-Entwurf/Entwürfe aus ${vorlagen} Vorlage(n).`
        : `Teilweise: ${erzeugt} erzeugt, ${vorlagen} Vorlagen, ${fehler.length} Fehler. ${fehler.slice(0, 5).join("; ")}`;

    const status = fehler.length > 0 && erzeugt === 0 ? "fehler" : "ok";
    if (runId) {
      await finishJobRun(runId, status, ergebnis, { now });
    }

    return {
      acquired: true,
      status,
      erzeugt,
      vorlagen,
      fehler,
      ergebnis,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (runId) {
      try {
        await finishJobRun(runId, "fehler", msg, { now });
      } catch {
        /* ignore */
      }
    }
    return {
      acquired: true,
      status: "fehler",
      erzeugt: 0,
      vorlagen: 0,
      fehler: [msg],
      ergebnis: msg,
    };
  } finally {
    try {
      await releaseLock(jobKey, holder);
    } catch {
      /* TTL räumt auf */
    }
  }
}

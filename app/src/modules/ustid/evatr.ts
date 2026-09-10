/**
 * Dünner Client für die BZSt-eVatR-REST-API (ADR-0021).
 * POST /v1/abfrage — keine Zertifikate, kein ELSTER.
 */

import { normalizeUstId } from "./format";
import {
  evatrStatusMeldung,
  istGueltigZumAnfragezeitpunkt,
} from "./status";
import type { EvatrAbfrage, EvatrAntwort } from "./types";

export const EVATR_DEFAULT_BASE_URL = "https://api.evatr.vies.bzst.de/app";
export const EVATR_TIMEOUT_MS = 30_000;

export function evatrBaseUrl(): string {
  const fromEnv = (process.env.EVATR_URL ?? "").trim().replace(/\/$/, "");
  return fromEnv || EVATR_DEFAULT_BASE_URL;
}

type EvatrRoh = {
  id?: string;
  anfrageZeitpunkt?: string;
  status?: string;
  gueltigAb?: string;
  gueltigBis?: string;
  ergFirmenname?: string;
  ergStrasse?: string;
  ergPlz?: string;
  ergOrt?: string;
};

export function mapEvatrAntwort(raw: EvatrRoh, rohText: string): EvatrAntwort {
  const status = (raw.status ?? "").trim();
  return {
    id: (raw.id ?? "").trim(),
    anfrageZeitpunkt: (raw.anfrageZeitpunkt ?? "").trim(),
    status,
    statusMeldung: evatrStatusMeldung(status),
    gueltigZumAnfragezeitpunkt: istGueltigZumAnfragezeitpunkt(status),
    gueltigAb: (raw.gueltigAb ?? "").trim(),
    gueltigBis: (raw.gueltigBis ?? "").trim(),
    ergFirmenname: (raw.ergFirmenname ?? "").trim(),
    ergStrasse: (raw.ergStrasse ?? "").trim(),
    ergPlz: (raw.ergPlz ?? "").trim(),
    ergOrt: (raw.ergOrt ?? "").trim(),
    roh: rohText.slice(0, 8000),
  };
}

function bodyForAbfrage(req: EvatrAbfrage): Record<string, string> {
  const body: Record<string, string> = {
    anfragendeUstid: normalizeUstId(req.anfragendeUstid),
    angefragteUstid: normalizeUstId(req.angefragteUstid),
  };
  const name = (req.firmenname ?? "").trim();
  const ort = (req.ort ?? "").trim();
  if (name && ort) {
    body.firmenname = name;
    body.ort = ort;
    const strasse = (req.strasse ?? "").trim();
    const plz = (req.plz ?? "").trim();
    if (strasse) body.strasse = strasse;
    if (plz) body.plz = plz;
  }
  return body;
}

export type EvatrFetch = (
  input: string,
  init: RequestInit,
) => Promise<Response>;

/**
 * Einzelabfrage (synchron). 4xx/5xx mit `status` sind fachliche Antworten,
 * kein Transportfehler.
 */
export async function evatrAbfrage(
  req: EvatrAbfrage,
  opts?: { fetch?: EvatrFetch; baseUrl?: string; timeoutMs?: number },
): Promise<EvatrAntwort> {
  const url = `${(opts?.baseUrl ?? evatrBaseUrl()).replace(/\/$/, "")}/v1/abfrage`;
  const timeoutMs = opts?.timeoutMs ?? EVATR_TIMEOUT_MS;
  const doFetch = opts?.fetch ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let res: Response;
  try {
    res = await doFetch(url, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(bodyForAbfrage(req)),
      signal: controller.signal,
      cache: "no-store",
    });
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      throw new Error(
        "Das BZSt hat nicht rechtzeitig geantwortet. Bitte später erneut prüfen (nachts können Wartungsfenster liegen).",
      );
    }
    throw new Error(
      "Das BZSt ist nicht erreichbar. Die Instanz braucht ausgehenden HTTPS-Zugang zu api.evatr.vies.bzst.de.",
    );
  } finally {
    clearTimeout(timer);
  }

  const text = await res.text();
  let parsed: EvatrRoh = {};
  try {
    parsed = text ? (JSON.parse(text) as EvatrRoh) : {};
  } catch {
    throw new Error(
      `Unerwartete Antwort vom BZSt (HTTP ${res.status}). Kein Bestätigungsdatensatz.`,
    );
  }

  if (!parsed.status) {
    throw new Error(
      `Unerwartete Antwort vom BZSt (HTTP ${res.status}). Kein Status im Datensatz.`,
    );
  }

  return mapEvatrAntwort(parsed, text);
}

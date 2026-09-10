/**
 * PocketBase-Zugriff (server-only).
 * Admin/Service über Superuser für Setup und spätere Finanz-Writes (ADR-0006).
 * Bevorzugt fetch statt SDK-XHR, um Edge/Server-Action-Stolpersteine zu vermeiden.
 */

import { eigentuemerCreateBody } from "./setup-verified";

import { getInstanceContext, isCloud, type InstanceContext } from "./instance-context";

async function pbUrl(): Promise<string> {
  const url = (await getInstanceContext()).pocketbaseUrl;
  if (!url) throw new Error("PB_URL ist nicht gesetzt.");
  return url;
}

export type NummernkreisConfig = {
  prefix: string;
  digits: number;
  next: number;
};

export type Nummernkreise = {
  angebot: NummernkreisConfig;
  rechnung: NummernkreisConfig;
  gutschrift: NummernkreisConfig;
  beleg: NummernkreisConfig;
  kasse: NummernkreisConfig;
  kontakt: NummernkreisConfig;
};

export const DEFAULT_NUMMERNKREISE: Nummernkreise = {
  angebot: { prefix: "A-", digits: 4, next: 1 },
  rechnung: { prefix: "R-", digits: 4, next: 1 },
  gutschrift: { prefix: "G-", digits: 4, next: 1 },
  beleg: { prefix: "B-", digits: 4, next: 1 },
  kasse: { prefix: "K-", digits: 4, next: 1 },
  kontakt: { prefix: "KT-", digits: 4, next: 1 },
};

/** Gespeichertes JSON (ältere Firmen ohne neue Keys) mit Defaults auffüllen. */
export function mergeNummernkreise(
  stored?: Partial<Nummernkreise> | null,
): Nummernkreise {
  const base = { ...DEFAULT_NUMMERNKREISE, ...(stored ?? {}) };
  return {
    angebot: { ...DEFAULT_NUMMERNKREISE.angebot, ...base.angebot },
    rechnung: { ...DEFAULT_NUMMERNKREISE.rechnung, ...base.rechnung },
    gutschrift: { ...DEFAULT_NUMMERNKREISE.gutschrift, ...base.gutschrift },
    beleg: { ...DEFAULT_NUMMERNKREISE.beleg, ...base.beleg },
    kasse: { ...DEFAULT_NUMMERNKREISE.kasse, ...base.kasse },
    kontakt: { ...DEFAULT_NUMMERNKREISE.kontakt, ...base.kontakt },
  };
}

/** Prefix plus nächste Nummer mit führenden Nullen. */
export function formatNummernkreis(
  cfg: Pick<NummernkreisConfig, "prefix" | "digits" | "next">,
  defaultPrefix: string,
): string {
  const next = Number(cfg.next) || 1;
  const digits = Math.max(1, Number(cfg.digits) || 4);
  const prefix = typeof cfg.prefix === "string" ? cfg.prefix : defaultPrefix;
  return `${prefix}${String(next).padStart(digits, "0")}`;
}

export const NUMMERNKREIS_MAX_VERSUCHE = 1000;

/**
 * Nächste freie Nummer: überspringt Werte, die `istVergeben` als belegt kennt.
 * `naechste` ist der Zähler nach der vergebenen Nummer (zum Speichern).
 */
export async function nextFreieNummer(opts: {
  start: number;
  format: (n: number) => string;
  istVergeben: (nummer: string) => boolean | Promise<boolean>;
  maxVersuche?: number;
}): Promise<{ nummer: string; naechste: number }> {
  const max = opts.maxVersuche ?? NUMMERNKREIS_MAX_VERSUCHE;
  let n = Number.isFinite(opts.start) ? Math.trunc(opts.start) : 1;
  if (n < 1) n = 1;
  for (let i = 0; i < max; i += 1) {
    const nummer = opts.format(n);
    if (!(await opts.istVergeben(nummer))) {
      return { nummer, naechste: n + 1 };
    }
    n += 1;
  }
  throw new Error("Keine freie Nummer im Nummernkreis gefunden.");
}

export type Steuermodus = "kleinunternehmer" | "regelbesteuerung_ist";
export type SkrWahl = "skr03" | "skr04";

export type FirmaRecord = {
  id: string;
  name: string;
  steuermodus: Steuermodus;
  skr: SkrWahl;
  nummernkreise: Nummernkreise;
  strasse?: string;
  plz?: string;
  ort?: string;
  land?: string;
  steuernummer?: string;
  ust_id?: string;
  /** Elektronische Adresse (E-Rechnung / XRechnung) */
  email?: string;
  telefon?: string;
  /** Öffentliche Webseite; PDF-Fußzeile unter E-Mail */
  webseite?: string;
  /** PB-Dateiname, leer = kein Logo */
  logo?: string;
  dokument_akzentfarbe?: string;
  dokument_kopftext?: string;
  dokument_fusstext?: string;
  /** Default an; false blendet Logo und Firmenblock aus */
  dokument_header_drucken?: boolean;
  /** Default an; false blendet Fußzeile aus */
  dokument_fuss_drucken?: boolean;
  /** Default an; Überweisungstext + GiroCode auf Rechnungen */
  dokument_zahlblock?: boolean;
};

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  role: string;
  firma: string | null;
};

type PbList<T> = {
  items: T[];
  page: number;
  perPage: number;
  totalItems: number;
  totalPages: number;
};

const adminTokens = new WeakMap<InstanceContext, { token: Promise<string>; expiresAt: number }>();

async function pbFetch<T>(
  path: string,
  init: RequestInit & { token?: string | null } = {},
): Promise<T> {
  const { token, headers: extraHeaders, ...rest } = init;
  const headers = new Headers(extraHeaders);
  // JSON nur bei string-Body; FormData braucht Boundary (Browser/fetch setzt Content-Type)
  if (
    !headers.has("Content-Type") &&
    rest.body &&
    typeof rest.body === "string"
  ) {
    headers.set("Content-Type", "application/json");
  }
  if (token) {
    headers.set("Authorization", token);
  }

  const res = await fetch(`${await pbUrl()}${path}`, {
    ...rest,
    headers,
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = (await res.json()) as {
        message?: string;
        data?: Record<string, { message?: string; code?: string }>;
      };
      detail = body.message || JSON.stringify(body);
      // Feldfehler anhängen (z. B. sortierung: Cannot be blank)
      if (body.data && typeof body.data === "object") {
        const fieldMsgs = Object.entries(body.data)
          .map(([field, err]) => {
            const msg =
              err && typeof err === "object" && "message" in err
                ? String(err.message)
                : JSON.stringify(err);
            return `${field}: ${msg}`;
          })
          .filter(Boolean);
        if (fieldMsgs.length) {
          detail = `${detail} (${fieldMsgs.join("; ")})`;
        }
      }
    } catch {
      /* ignore */
    }
    throw new Error(`PocketBase ${res.status}: ${detail}`);
  }

  if (res.status === 204) {
    return undefined as T;
  }
  return (await res.json()) as T;
}

/** Roh-Response (Dateien, Binär) mit Superuser-Token */
export async function pbFetchRaw(
  path: string,
  init: RequestInit & { token?: string | null } = {},
): Promise<Response> {
  const { token, headers: extraHeaders, ...rest } = init;
  const headers = new Headers(extraHeaders);
  if (token) {
    headers.set("Authorization", token);
  }
  const res = await fetch(`${await pbUrl()}${path}`, {
    ...rest,
    headers,
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(30_000),
  });
  return res;
}

export async function getAdminToken(): Promise<string> {
  const context = await getInstanceContext();
  const existing = adminTokens.get(context);
  if (existing && existing.expiresAt > Date.now()) return existing.token;
  const { adminEmail: email, adminPassword: password } = context;
  if (!email || !password) throw new Error("PB_SUPERUSER_EMAIL / PB_SUPERUSER_PASSWORD fehlen.");
  const pending = pbFetch<{ token: string }>("/api/collections/_superusers/auth-with-password", {
    method: "POST", body: JSON.stringify({ identity: email, password }),
  }).then(result => result.token);
  adminTokens.set(context, { token: pending, expiresAt: Date.now() + 10 * 60 * 1000 });
  try { return await pending; } catch (error) { adminTokens.delete(context); throw error; }
}

/** True, wenn noch keine Firma existiert → Setup-Wizard */
export async function isSetupRequired(): Promise<boolean> {
  if (isCloud()) { await getInstanceContext(); return false; }
  try {
    const token = await getAdminToken();
    const list = await pbFetch<PbList<{ id: string }>>(
      "/api/collections/firmen/records?page=1&perPage=1&fields=id",
      { token },
    );
    return list.totalItems === 0;
  } catch {
    return true;
  }
}

type PbFirma = {
  id: string;
  name: string;
  steuermodus: Steuermodus;
  skr: SkrWahl;
  nummernkreise: Nummernkreise;
  strasse?: string;
  plz?: string;
  ort?: string;
  land?: string;
  steuernummer?: string;
  ust_id?: string;
  email?: string;
  telefon?: string;
  webseite?: string;
  logo?: string;
  dokument_akzentfarbe?: string;
  dokument_kopftext?: string;
  dokument_fusstext?: string;
  dokument_header_drucken?: boolean;
  dokument_fuss_drucken?: boolean;
  dokument_zahlblock?: boolean;
};

function mapFirma(r: PbFirma): FirmaRecord {
  return {
    id: r.id,
    name: r.name,
    steuermodus: r.steuermodus,
    skr: r.skr,
    nummernkreise: mergeNummernkreise(r.nummernkreise),
    strasse: r.strasse ?? "",
    plz: r.plz ?? "",
    ort: r.ort ?? "",
    land: r.land ?? "DE",
    steuernummer: r.steuernummer ?? "",
    ust_id: r.ust_id ?? "",
    email: r.email ?? "",
    telefon: r.telefon ?? "",
    webseite: r.webseite ?? "",
    logo: r.logo ?? "",
    dokument_akzentfarbe: r.dokument_akzentfarbe ?? "",
    dokument_kopftext: r.dokument_kopftext ?? "",
    dokument_fusstext: r.dokument_fusstext ?? "",
    dokument_header_drucken: r.dokument_header_drucken !== false,
    dokument_fuss_drucken: r.dokument_fuss_drucken !== false,
    dokument_zahlblock: r.dokument_zahlblock !== false,
  };
}

export async function getFirstFirma(): Promise<FirmaRecord | null> {
  const token = await getAdminToken();
  const list = await pbFetch<PbList<PbFirma>>(
    "/api/collections/firmen/records?page=1&perPage=1",
    { token },
  );

  if (list.totalItems === 0) return null;
  return mapFirma(list.items[0]);
}

/** Alle Firmen der Instanz (ohne Mitgliedschaftsfilter; Jobs/Admin). */
export async function listFirmen(): Promise<FirmaRecord[]> {
  const token = await getAdminToken();
  const list = await pbFetch<PbList<PbFirma>>(
    "/api/collections/firmen/records?page=1&perPage=200&sort=name",
    { token },
  );
  return list.items.map(mapFirma);
}

/**
 * Bevorzugte Firma, sonst erste vorhandene — ohne Mitgliedschaftsprüfung.
 * Login/Session nutzen resolveMitgliedschaftFuerSession (ADR-0025).
 */
export async function resolveAktiveFirmaId(
  preferredId: string | null,
): Promise<string | null> {
  if (preferredId) {
    const existing = await getFirmaById(preferredId);
    if (existing) return existing.id;
  }
  const first = await getFirstFirma();
  return first?.id ?? null;
}

/** Zuletzt aktive Firma der Eigentümer:in (Login-Landung). */
export async function setUserFirma(
  userId: string,
  firmaId: string,
): Promise<void> {
  await updateRecord("users", userId, { firma: firmaId });
}

export type FirmaStammdatenInput = {
  name: string;
  steuermodus: Steuermodus;
  skr?: SkrWahl;
  strasse?: string;
  plz?: string;
  ort?: string;
  land?: string;
  steuernummer?: string;
  ust_id?: string;
  email?: string;
  telefon?: string;
  webseite?: string;

  dokument_akzentfarbe?: string;
  dokument_kopftext?: string;
  dokument_fusstext?: string;
  dokument_header_drucken?: boolean;
  dokument_fuss_drucken?: boolean;
  dokument_zahlblock?: boolean;
  logo?: Blob;
  logo_entfernen?: boolean;
};

export async function createFirma(input: {
  name: string;
  steuermodus: Steuermodus;
  skr: SkrWahl;
  strasse?: string;
  plz?: string;
  ort?: string;
  land?: string;
  steuernummer?: string;
  ust_id?: string;
}): Promise<FirmaRecord> {
  const token = await getAdminToken();
  const r = await pbFetch<PbFirma>("/api/collections/firmen/records", {
    method: "POST",
    token,
    body: JSON.stringify({
      name: input.name,
      steuermodus: input.steuermodus,
      skr: input.skr,
      nummernkreise: DEFAULT_NUMMERNKREISE,
      strasse: (input.strasse ?? "").trim(),
      plz: (input.plz ?? "").trim(),
      ort: (input.ort ?? "").trim(),
      land: (input.land ?? "DE").trim() || "DE",
      steuernummer: (input.steuernummer ?? "").trim(),
      ust_id: (input.ust_id ?? "").replace(/[\s.\-/]/g, "").toUpperCase(),
      dokument_header_drucken: true,
      dokument_fuss_drucken: true,
      dokument_zahlblock: true,
    }),
  });
  return mapFirma(r);
}

export async function updateFirma(
  id: string,
  input: FirmaStammdatenInput,
): Promise<FirmaRecord> {
  const scalars: Record<string, unknown> = {
    name: input.name.trim(),
    steuermodus: input.steuermodus,
    strasse: (input.strasse ?? "").trim(),
    plz: (input.plz ?? "").trim(),
    ort: (input.ort ?? "").trim(),
    land: (input.land ?? "DE").trim() || "DE",
    steuernummer: (input.steuernummer ?? "").trim(),
    ust_id: (input.ust_id ?? "").replace(/[\s.\-/]/g, "").toUpperCase(),
    email: (input.email ?? "").trim(),
    telefon: (input.telefon ?? "").trim(),
    webseite: (input.webseite ?? "").trim(),
  };
  if (input.skr) {
    scalars.skr = input.skr;
  }
  if (input.dokument_akzentfarbe !== undefined) {
    scalars.dokument_akzentfarbe = input.dokument_akzentfarbe;
  }
  if (input.dokument_kopftext !== undefined) {
    scalars.dokument_kopftext = input.dokument_kopftext;
  }
  if (input.dokument_fusstext !== undefined) {
    scalars.dokument_fusstext = input.dokument_fusstext;
  }
  if (input.dokument_header_drucken !== undefined) {
    scalars.dokument_header_drucken = input.dokument_header_drucken;
  }
  if (input.dokument_fuss_drucken !== undefined) {
    scalars.dokument_fuss_drucken = input.dokument_fuss_drucken;
  }
  if (input.dokument_zahlblock !== undefined) {
    scalars.dokument_zahlblock = input.dokument_zahlblock;
  }

  const hasLogo = input.logo instanceof Blob;
  const removeLogo = Boolean(input.logo_entfernen);
  if (hasLogo || removeLogo) {
    const fields: Record<string, string | Blob | null | undefined> = {};
    for (const [key, value] of Object.entries(scalars)) {
      if (value === undefined || value === null) continue;
      fields[key] =
        typeof value === "string" ? value : JSON.stringify(value);
    }
    fields.logo = hasLogo ? input.logo : "";
    const r = await updateRecordMultipart<PbFirma>("firmen", id, fields);
    return mapFirma(r);
  }

  const r = await pbFetch<PbFirma>(`/api/collections/firmen/records/${id}`, {
    method: "PATCH",
    token: await getAdminToken(),
    body: JSON.stringify(scalars),
  });
  return mapFirma(r);
}

/** Erst-User im Setup. verified immer true — Login ohne SMTP. */
export async function createEigentuemer(input: {
  email: string;
  password: string;
  name: string;
  firmaId: string;
}): Promise<AuthUser> {
  const token = await getAdminToken();
  const r = await pbFetch<{
    id: string;
    email: string;
    name: string;
    role: string;
    firma: string;
  }>("/api/collections/users/records", {
    method: "POST",
    token,
    body: JSON.stringify(eigentuemerCreateBody(input)),
  });
  await createRecord("mitgliedschaften", {
    user: r.id,
    firma: input.firmaId,
    rolle: "eigentuemer",
  });
  return {
    id: r.id,
    email: r.email,
    name: r.name,
    role: r.role,
    firma: r.firma || null,
  };
}

/** Login der Eigentümer:in gegen PocketBase Auth */
export async function authWithPassword(
  email: string,
  password: string,
): Promise<AuthUser> {
  const result = await pbFetch<{
    record: {
      id: string;
      email: string;
      name?: string;
      role?: string;
      firma?: string;
    };
  }>("/api/collections/users/auth-with-password", {
    method: "POST",
    body: JSON.stringify({ identity: email, password }),
  });

  const record = result.record;
  return {
    id: record.id,
    email: record.email,
    name: record.name || email,
    role: record.role || "nutzer",
    firma: record.firma || null,
  };
}

// --- Generische Superuser-CRUD-Helfer (ADR-0006: Writes nur serverseitig) ---

export type PbListResult<T> = {
  items: T[];
  page: number;
  perPage: number;
  totalItems: number;
  totalPages: number;
};

export type ListRecordsOptions = {
  page?: number;
  perPage?: number;
  filter?: string;
  sort?: string;
  fields?: string;
};

function encodeFilter(filter: string): string {
  return encodeURIComponent(filter);
}

export async function listRecords<T>(
  collection: string,
  options: ListRecordsOptions = {},
): Promise<PbListResult<T>> {
  const token = await getAdminToken();
  const page = options.page ?? 1;
  const perPage = options.perPage ?? 50;
  const params = new URLSearchParams({
    page: String(page),
    perPage: String(perPage),
  });
  if (options.filter) params.set("filter", options.filter);
  if (options.sort) params.set("sort", options.sort);
  if (options.fields) params.set("fields", options.fields);

  return pbFetch<PbListResult<T>>(
    `/api/collections/${collection}/records?${params.toString()}`,
    { token },
  );
}

export async function getRecord<T>(
  collection: string,
  id: string,
): Promise<T> {
  const token = await getAdminToken();
  return pbFetch<T>(`/api/collections/${collection}/records/${id}`, {
    token,
  });
}

export async function createRecord<T>(
  collection: string,
  body: Record<string, unknown>,
): Promise<T> {
  const token = await getAdminToken();
  return pbFetch<T>(`/api/collections/${collection}/records`, {
    method: "POST",
    token,
    body: JSON.stringify(body),
  });
}

export async function updateRecord<T>(
  collection: string,
  id: string,
  body: Record<string, unknown>,
): Promise<T> {
  const token = await getAdminToken();
  return pbFetch<T>(`/api/collections/${collection}/records/${id}`, {
    method: "PATCH",
    token,
    body: JSON.stringify(body),
  });
}

/** Skalar, eine Datei oder mehrere Werte unter demselben Feldnamen. */
export type MultipartValue = string | Blob | Array<string | Blob>;

function appendMultipartFields(
  fd: FormData,
  fields: Record<string, MultipartValue | null | undefined>,
): void {
  for (const [key, value] of Object.entries(fields)) {
    if (value === null || value === undefined) continue;
    const items = Array.isArray(value) ? value : [value];
    for (const item of items) {
      fd.append(key, item);
    }
  }
}

/**
 * Record anlegen mit Datei(en) — multipart/form-data.
 * Skalare Felder als Strings; Dateien als File/Blob unter dem Feldnamen.
 */
export async function createRecordMultipart<T>(
  collection: string,
  fields: Record<string, MultipartValue | null | undefined>,
): Promise<T> {
  const token = await getAdminToken();
  const fd = new FormData();
  appendMultipartFields(fd, fields);
  return pbFetch<T>(`/api/collections/${collection}/records`, {
    method: "POST",
    token,
    body: fd,
  });
}

/**
 * Record patchen mit optionaler Datei — multipart/form-data.
 * Zum Löschen eines File-Feldes: leeren String senden (PB-Konvention).
 * Einzelne Datei eines Multi-File-Feldes: Schlüssel `feldname-` mit Dateiname.
 */
export async function updateRecordMultipart<T>(
  collection: string,
  id: string,
  fields: Record<string, MultipartValue | null | undefined>,
): Promise<T> {
  const token = await getAdminToken();
  const fd = new FormData();
  appendMultipartFields(fd, fields);
  return pbFetch<T>(`/api/collections/${collection}/records/${id}`, {
    method: "PATCH",
    token,
    body: fd,
  });
}

/**
 * Datei eines Records streamen (Superuser).
 * PB-Pfad: /api/files/{collection}/{recordId}/{filename}
 */
export async function fetchRecordFile(
  collection: string,
  recordId: string,
  filename: string,
): Promise<Response> {
  const token = await getAdminToken();
  // Protected Files benötigen den kurzlebigen Dateitoken, keinen Auth-Header.
  // Er bleibt im Server-Request; Next liefert nur die Bytes nach Firmenprüfung.
  const fileAuth = await pbFetch<{ token: string }>("/api/files/token", {
    method: "POST",
    token,
  });
  const path = `/api/files/${encodeURIComponent(collection)}/${encodeURIComponent(recordId)}/${encodeURIComponent(filename)}?token=${encodeURIComponent(fileAuth.token)}`;
  const res = await pbFetchRaw(path);
  if (!res.ok) {
    throw new Error(`Datei nicht ladbar (${res.status}).`);
  }
  return res;
}

export async function deleteRecord(
  collection: string,
  id: string,
): Promise<void> {
  const token = await getAdminToken();
  await pbFetch<void>(`/api/collections/${collection}/records/${id}`, {
    method: "DELETE",
    token,
  });
}

/** Firma per ID laden (Nummernkreise, Adresse für PDF etc.) */
export async function getFirmaById(id: string): Promise<FirmaRecord | null> {
  try {
    const token = await getAdminToken();
    const r = await pbFetch<PbFirma>(
      `/api/collections/firmen/records/${id}`,
      { token },
    );
    return mapFirma(r);
  } catch {
    return null;
  }
}

/** Shared counter writes are serialized in PB; transitional callers retain their old commit boundary. */
async function allocateNummernkreis(firmaId: string, key: keyof Nummernkreise): Promise<string> {
  const { nummernkreisVergeben } = await import("./finanz-transaktion");
  return nummernkreisVergeben(firmaId, key);
}

/**
 * Nächste Belegnummer aus Firmeneinstellung vergeben und Zähler erhöhen.
 */
export async function allocateBelegnummer(firmaId: string): Promise<string> {
  return allocateNummernkreis(firmaId, "beleg");
}

/**
 * Nächste Rechnungsnummer aus Firmeneinstellung vergeben und Zähler erhöhen.
 * Erst bei Festschreibung aufrufen (Entwürfe verbrauchen keinen Nummernkreis).
 */
export async function allocateRechnungsnummer(
  firmaId: string,
): Promise<string> {
  return allocateNummernkreis(firmaId, "rechnung");
}

/** Unverbindlicher, rein lesender Kandidat für das Rechnungs-PDF. */
export async function getRechnungsnummerKandidat(
  firmaId: string,
): Promise<string> {
  const firma = await getFirmaById(firmaId);
  if (!firma) throw new Error("Firma nicht gefunden.");
  const cfg = firma.nummernkreise.rechnung;
  return (
    await nextFreieNummer({
      start: cfg.next,
      format: (next) =>
        formatNummernkreis({ ...cfg, next }, DEFAULT_NUMMERNKREISE.rechnung.prefix),
      istVergeben: async (nummer) =>
        (
          await listRecords<{ id: string }>("rechnungen", {
            page: 1,
            perPage: 1,
            filter: `${pbEq("firma", firmaId)} && ${pbEq("rechnungsnummer", nummer)}`,
            fields: "id",
          })
        ).totalItems > 0,
    })
  ).nummer;
}

/**
 * Nächste Angebotsnummer aus Firmeneinstellung vergeben und Zähler erhöhen.
 * Erst beim Senden aufrufen (Entwürfe verbrauchen keinen Nummernkreis).
 */
export async function allocateAngebotsnummer(
  firmaId: string,
): Promise<string> {
  return allocateNummernkreis(firmaId, "angebot");
}

/**
 * Nächste Kassenbuch-Belegnummer aus Firmeneinstellung vergeben und Zähler erhöhen.
 * Bei Festschreibung (= Anlegen) aufrufen.
 */
export async function allocateKassenbuchBelegnummer(
  firmaId: string,
): Promise<string> {
  return allocateNummernkreis(firmaId, "kasse");
}

/**
 * Nächste Kontaktnummer aus Firmeneinstellung vergeben und Zähler erhöhen.
 * Bei Neuanlage des Kontakts aufrufen (kein Entwurfsstatus).
 */
export async function allocateKontaktnummer(firmaId: string): Promise<string> {
  return allocateNummernkreis(firmaId, "kontakt");
}

/** PocketBase-Filter: exakte String-Gleichheit (escaped) */
export function pbEq(field: string, value: string): string {
  const escaped = value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `${field}="${escaped}"`;
}

/** LIKE-Suche (case-insensitive via PocketBase ~) */
export function pbLike(field: string, value: string): string {
  const escaped = value
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/%/g, "\\%");
  return `${field}~"${escaped}"`;
}

// encodeFilter exportiert für seltene manuelle Filter-Konstruktion
export { encodeFilter };

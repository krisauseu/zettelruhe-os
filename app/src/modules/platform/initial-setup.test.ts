import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  cookies: vi.fn(), headers: vi.fn(), revalidatePath: vi.fn(), setCookie: vi.fn(), backfill: vi.fn(),
}));
vi.mock("next/headers", () => ({ cookies: mocks.cookies, headers: mocks.headers }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/modules/payments", () => ({ nachziehenZahlungsjournaleEinmal: mocks.backfill }));

import { loginAction, logoutAction } from "./auth-actions";
import { POST as loginSubmit } from "@/app/login/submit/route";
import { completeFirmaEinrichtungAction, createFirmaAction, switchFirmaAction, updateFirmaAction } from "./firma-actions";
import { createKontaktAction } from "@/modules/contacts/actions";
import FirmaPage from "@/app/app/firma/page";
import ProtectedAppLayout from "@/app/app/layout";
import { AppShell } from "@/components/app-shell";
import { setzeNameAction } from "./nutzer-actions";
import {
  getSession, requireFirmaEinrichtungSession, requireFirmaSession,
  requireSession, requireSchreibenSession, requireVerwaltenSession,
} from "@/lib/session";
import { getInitialSetup } from "@/lib/initial-setup";
import { createSessionToken, SESSION_COOKIE } from "@/lib/session-token";
import { DEFAULT_NUMMERNKREISE, type FirmaRecord } from "@/lib/pb";
import type { InstanceContext } from "@/lib/instance-context";
import { proxy } from "@/proxy";

type Marker = { id: string; eigentuemer: string; firma: string; status: "pending" | "complete" };
const context: InstanceContext = {
  tenantId: "t_syntheticsetup", pocketbaseUrl: "http://setup-pb.synthetic.invalid",
  appUrl: "https://setup.synthetic.invalid", configVersion: 1, sessionVersion: 1,
  sessionSecret: "synthetic-setup-session-".repeat(2),
  adminEmail: "admin@synthetic.invalid", adminPassword: "synthetic-only", smtp: null,
};
const initialUser = {
  id: "setup-owner", email: "owner@synthetic.invalid", name: "", role: "eigentuemer", firma: "setup-firma",
};
let user: typeof initialUser;
let firma: FirmaRecord;
let marker: Marker | null;
let membershipRole: string;
let membershipFirma: string;
let token: string;
let hostname: string;
let origin: string;
let controlStatus: number;
let markerStatus: number;
let completeStatus: number;
let writes: string[];
let markerReads: number;

function requestHeaders() {
  return new Headers({ host: hostname, origin,
    "x-instance-ingress": "synthetic-setup-ingress-".repeat(3),
    cookie: token ? `${SESSION_COOKIE}=${token}` : "" });
}
function form(ownerName = "Alex Beispiel") {
  const data = new FormData();
  data.set("name", "Vervollständigte Firma"); data.set("owner_name", ownerName);
  data.set("strasse", "Beispielstraße 1"); data.set("plz", "12345"); data.set("ort", "Beispielstadt");
  data.set("land", "DE"); data.set("steuermodus", firma.steuermodus);
  data.set("nummernkreise_expected", JSON.stringify(firma.nummernkreise));
  for (const [key, value] of Object.entries(firma.nummernkreise)) {
    for (const [field, item] of Object.entries(value)) data.set(`nk_${key}_${field}`, String(item));
  }
  return data;
}
function loginForm() {
  const data = new FormData(); data.set("email", user.email); data.set("password", "synthetic-password"); return data;
}
function list(items: unknown[]) {
  return { items, page: 1, perPage: 200, totalItems: items.length, totalPages: items.length ? 1 : 0 };
}
async function expectRedirect(operation: Promise<unknown>, path: string) {
  await expect(operation).rejects.toMatchObject({ digest: expect.stringContaining(`;${path};`) });
}

beforeEach(async () => {
  vi.clearAllMocks();
  vi.stubEnv("INSTANCE_MODE", "cloud");
  vi.stubEnv("INSTANCE_INGRESS_TOKEN", "synthetic-setup-ingress-".repeat(3));
  vi.stubEnv("INSTANCE_CONTROL_URL", "http://setup-control.synthetic.invalid");
  vi.stubEnv("INSTANCE_CONTROL_TOKEN", "synthetic-setup-control-".repeat(3));
  user = { ...initialUser };
  firma = { id: user.firma, name: "Firma aus Checkout", steuermodus: "kleinunternehmer", skr: "skr03",
    nummernkreise: structuredClone(DEFAULT_NUMMERNKREISE) };
  marker = { id: "initialsetup001", eigentuemer: user.id, firma: firma.id, status: "pending" };
  membershipRole = "eigentuemer"; membershipFirma = firma.id;
  hostname = new URL(context.appUrl).host; origin = context.appUrl;
  controlStatus = 200; markerStatus = 200; completeStatus = 200; writes = []; markerReads = 0;
  token = await createSessionToken({ userId: user.id, email: user.email, name: user.name, role: user.role, firmaId: user.firma }, context);
  mocks.cookies.mockImplementation(async () => ({
    get: (name: string) => name === SESSION_COOKIE && token ? { value: token } : undefined,
    set: mocks.setCookie,
  }));
  mocks.setCookie.mockImplementation((_name: string, value: string) => { token = value; });
  mocks.headers.mockImplementation(async () => requestHeaders());
  // Authentication, session, membership, actions and page rendering are real;
  // this fixture replaces only the HTTP control/PocketBase boundary.
  vi.stubGlobal("fetch", vi.fn(async (input: string, init: RequestInit = {}) => {
    const url = new URL(input);
    if (url.origin === "http://setup-control.synthetic.invalid") {
      expect(new Headers(init.headers).get("Authorization")).toBe(`Bearer ${process.env.INSTANCE_CONTROL_TOKEN}`);
      return Response.json(context, { status: controlStatus });
    }
    expect(url.origin).toBe(context.pocketbaseUrl);
    if (url.pathname === "/api/collections/users/auth-with-password") return Response.json({ record: user, token: "synthetic-user" });
    if (url.pathname.endsWith("/_superusers/auth-with-password")) return Response.json({ token: "synthetic-admin" });
    expect(new Headers(init.headers).get("Authorization")).toBe("synthetic-admin");
    if (url.pathname === `/api/collections/users/records/${user.id}`) {
      if (init.method === "PATCH") { writes.push("user-patch"); user = { ...user, ...JSON.parse(String(init.body)) }; }
      return Response.json(user);
    }
    if (url.pathname === "/api/collections/mitgliedschaften/records") {
      const matches = membershipRole && (url.searchParams.get("filter") ?? "").includes(user.id);
      return Response.json(list(matches ? [{ id: "setup-member", user: user.id, firma: membershipFirma, rolle: membershipRole }] : []));
    }
    if (url.pathname.startsWith("/api/collections/instanz_einrichtung/records")) {
      markerReads++;
      if (markerStatus !== 200) return Response.json({ message: "Marker nicht verfügbar." }, { status: markerStatus });
      if (!marker) return Response.json(list([]));
      return Response.json(url.pathname.endsWith("/records") ? list([marker]) : marker);
    }
    if (url.pathname === "/api/collections/firmen/records") return Response.json(list([firma]));
    if (url.pathname === `/api/collections/firmen/records/${firma.id}`) {
      if (init.method === "PATCH") { writes.push("firma-patch"); firma = { ...firma, ...JSON.parse(String(init.body)) }; }
      return Response.json(firma);
    }
    if (url.pathname === "/internal/zettelruhe/einrichtung/v1/abschliessen") {
      if (completeStatus !== 200) return Response.json({ message: "Speichern fehlgeschlagen." }, { status: completeStatus });
      const data = init.body as FormData;
      expect(data).toBeInstanceOf(FormData);
      const payload = JSON.parse(String(data.get("payload")));
      expect(payload.firma).toBe(firma.id); expect(payload.akteur).toBe(user.id);
      if (marker?.status === "complete") return Response.json({ result: "replayed", firmaId: firma.id, eigentuemerId: user.id, status: "complete" });
      user.name = payload.ownerName; firma = { ...firma, ...payload.values };
      marker = { ...marker!, status: "complete" }; writes.push("setup-transaction");
      return Response.json({ result: "committed", firmaId: firma.id, eigentuemerId: user.id, status: "complete" });
    }
    throw new Error(`Unerwarteter Testrequest: ${url.pathname}`);
  }));
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("Cloud-Ersteinrichtung nach dem Login", () => {
  it("leitet beide bestehenden Loginpfade auf die Firmenstammdaten", async () => {
    await expectRedirect(loginAction(loginForm()), "/app/firma");
    expect((await getSession())?.userId).toBe(initialUser.id);
    const response = await loginSubmit(new Request(`${context.appUrl}/login/submit`, { method: "POST", body: loginForm() }));
    expect(response.status).toBe(303); expect(response.headers.get("location")).toBe(`${context.appUrl}/app/firma`);
    expect(writes).toEqual([]);
  });

  it("sperrt normale Sessions und fachliche Actions auch bei einem Request auf /app/firma", async () => {
    for (const guard of [requireSession, requireFirmaSession, requireSchreibenSession, requireVerwaltenSession]) {
      await expectRedirect(guard(), "/app/firma");
    }
    const data = new FormData(); data.set("name", "Unzulässiger Kontakt"); data.set("ist_kunde", "on");
    await expectRedirect(createKontaktAction(data), "/app/firma");
    await expectRedirect(createFirmaAction(form()), "/app/firma");
    await expectRedirect(switchFirmaAction(form()), "/app/firma");
    expect(writes).toEqual([]);
  });

  it("zeigt den Namen im vorhandenen Firmenformular und hält Logout erreichbar", async () => {
    const html = renderToStaticMarkup(await FirmaPage({ searchParams: Promise.resolve({}) }));
    expect(html).toContain('name="owner_name"'); expect(html).toContain('value="Firma aus Checkout"');
    expect(html).not.toContain("Synthetic Owner");
    await expectRedirect(logoutAction(), "/login"); expect(token).toBe("");
    expect(writes).toEqual([]);
  });

  it("rendert während der Einrichtung weder den internen Namen noch das normale Menü und schreibt keine Zahlungsjournale nach", async () => {
    user.name = "Interner nicht sichtbarer Platzhalter";
    const layout = await ProtectedAppLayout({ children: "Einrichtungsformular" });
    expect(layout.type).toBe(AppShell); expect(layout.props.initialSetup).toBe(true);
    expect(mocks.backfill).not.toHaveBeenCalled();
    const shell = AppShell(layout.props);
    const header = renderToStaticMarkup(shell.props.header);
    expect(header).toContain("Einrichtung abschließen"); expect(header).not.toContain(user.name);
    expect(shell.props.nav.props.items).toEqual([{ href: "/app/firma", label: "Firma einrichten", icon: "firma" }]);
    expect(shell.props.footer).toBeDefined();
  });

  it("speichert Firma und Namen des vorhandenen Eigentümers über eine gemeinsame Operation", async () => {
    const identity = { id: user.id, email: user.email, role: user.role, firma: user.firma };
    const member = { role: membershipRole, firma: membershipFirma };
    await expectRedirect(completeFirmaEinrichtungAction(form("  Alex Beispiel  ")), "/app");
    expect(writes).toEqual(["setup-transaction"]); expect(marker?.status).toBe("complete");
    expect(user.name).toBe("Alex Beispiel"); expect(firma.name).toBe("Vervollständigte Firma");
    expect({ id: user.id, email: user.email, role: user.role, firma: user.firma }).toEqual(identity);
    expect({ role: membershipRole, firma: membershipFirma }).toEqual(member);
    expect((await requireFirmaSession()).userId).toBe(identity.id);
    const html = renderToStaticMarkup(await FirmaPage({ searchParams: Promise.resolve({}) }));
    expect(html).not.toContain('name="owner_name"');
  });

  it("spielt ein erneut gesendetes Einrichtungsformular nach Abschluss wieder ab und erhält spätere Firmen- und Namensänderungen", async () => {
    const staleSetup = form("Alex Ersteinrichtung");
    await expectRedirect(completeFirmaEinrichtungAction(staleSetup), "/app");
    const normalEdit = form(); normalEdit.set("name", "Später geänderte Firma");
    await expectRedirect(updateFirmaAction(normalEdit), "/app/firma?saved=1");
    const nameEdit = new FormData(); nameEdit.set("userId", user.id); nameEdit.set("name", "Alex Neuername");
    await expectRedirect(setzeNameAction(nameEdit), "/app/nutzer?saved=1");
    const writesBeforeReplay = [...writes];
    await expectRedirect(completeFirmaEinrichtungAction(staleSetup), "/app");
    expect(writes).toEqual(writesBeforeReplay);
    expect(user.name).toBe("Alex Neuername"); expect(firma.name).toBe("Später geänderte Firma");
    expect(marker?.status).toBe("complete");
    const completions = vi.mocked(fetch).mock.calls.filter(([url]) => String(url).endsWith("/internal/zettelruhe/einrichtung/v1/abschliessen"));
    expect(completions).toHaveLength(2);
  });

  it("weist einen fehlenden Eigentümernamen vor allen Schreibzugriffen ab", async () => {
    await expect(updateFirmaAction(form(" "))).rejects.toMatchObject({ digest: expect.stringContaining(";/app/firma?error=") });
    expect(writes).toEqual([]); expect(marker?.status).toBe("pending");
  });

  it("ändert den Eigentümernamen später über die vorhandene Nutzerverwaltung ohne neue Identitäten oder Rollen", async () => {
    marker!.status = "complete"; user.name = "Alex Beispiel";
    const data = new FormData(); data.set("userId", user.id); data.set("name", "  Alex  Neuername  ");
    await expectRedirect(setzeNameAction(data), "/app/nutzer?saved=1");
    expect(writes).toEqual(["user-patch"]); expect(user.name).toBe("Alex Neuername");
    const patches = vi.mocked(fetch).mock.calls.filter(([url, init]) => String(url).includes("/users/records/") && init?.method === "PATCH");
    expect(patches).toHaveLength(1); expect(JSON.parse(String(patches[0][1]?.body))).toEqual({ name: "Alex Neuername" });
    expect(user.id).toBe(initialUser.id); expect(user.email).toBe(initialUser.email); expect(user.role).toBe("eigentuemer");
  });

  it("verweigert Namensänderungen an firmenfremden Nutzer:innen und mit einer Lesemitgliedschaft", async () => {
    marker!.status = "complete";
    const data = new FormData(); data.set("userId", "foreign-user"); data.set("name", "Fremder Name");
    await expect(setzeNameAction(data)).rejects.toMatchObject({ digest: expect.stringContaining(";/app/nutzer?error=") });
    membershipRole = "lesen"; data.set("userId", user.id);
    await expect(setzeNameAction(data)).rejects.toMatchObject({ digest: expect.stringContaining(";/app?error=") });
    expect(writes).toEqual([]);
  });

  it("bleibt nach einem Speicherfehler serverseitig pending und lässt denselben Login sicher fortsetzen", async () => {
    completeStatus = 500;
    await expect(updateFirmaAction(form())).rejects.toMatchObject({ digest: expect.stringContaining(";/app/firma?error=") });
    expect(marker?.status).toBe("pending"); expect(user.name).toBe(""); expect(firma.name).toBe("Firma aus Checkout");
    expect(writes).toEqual([]); expect(mocks.revalidatePath).not.toHaveBeenCalled();
    await expectRedirect(loginAction(loginForm()), "/app/firma");
    completeStatus = 200;
    await expectRedirect(updateFirmaAction(form()), "/app"); expect(writes).toEqual(["setup-transaction"]);
  });

  it.each(["foreign-user", "wrong-membership", "reader", "non-owner"])("erlaubt die Einrichtung nicht mit %s", async mode => {
    if (mode === "foreign-user") marker!.eigentuemer = "other-owner";
    if (mode === "wrong-membership") membershipFirma = "other-firma";
    if (mode === "reader") membershipRole = "lesen";
    if (mode === "non-owner") user.role = "nutzer";
    await expect(requireFirmaEinrichtungSession()).rejects.toBeDefined();
    await expect(updateFirmaAction(form())).rejects.toBeDefined();
    expect(writes).toEqual([]); expect(marker?.status).toBe("pending");
  });

  it("lehnt eine fremde Tenant-Session ab und liest deren Einrichtung nicht", async () => {
    token = await createSessionToken({ userId: user.id, email: user.email, name: "Fremd", role: user.role, firmaId: firma.id },
      { ...context, tenantId: "t_foreignsetup", sessionSecret: "foreign-synthetic-session-".repeat(2) });
    expect(await getSession()).toBeNull();
    await expect(requireFirmaEinrichtungSession()).rejects.toBeDefined();
    expect(markerReads).toBe(0); expect(writes).toEqual([]);
    const response = await proxy(new NextRequest(`${context.appUrl}/app/firma`, { headers: requestHeaders() }));
    expect(response.headers.get("location")).toBe(`${context.appUrl}/login`);
  });

  it("hält die bestehende Tenant-Zugriffsprüfung auch vor Einrichtungsspeichern aufrecht", async () => {
    controlStatus = 403;
    await expect(updateFirmaAction(form())).rejects.toThrow("INSTANCE_UNAVAILABLE");
    expect(markerReads).toBe(0); expect(writes).toEqual([]);
  });

  it("behandelt einen nicht erreichbaren Marker nicht als eingerichtete Instanz", async () => {
    markerStatus = 503;
    await expect(requireSession()).rejects.toBeDefined(); expect(writes).toEqual([]);
  });

  it("erhält den Login alter Cloud-PocketBase-Instanzen ohne optionale Einrichtungssammlung", async () => {
    markerStatus = 404;
    expect(await getInitialSetup()).toBeNull();
    expect((await requireFirmaSession()).firmaId).toBe(firma.id);
    await expectRedirect(loginAction(loginForm()), "/app"); expect(writes).toEqual([]);
  });

  it.each(["missing", "complete"])("lässt bestehende bzw. bereits eingerichtete Cloud-Instanzen (%s) unverändert", async state => {
    if (state === "missing") { marker = null; user.name = "Synthetic Owner"; } else marker!.status = "complete";
    expect((await requireFirmaSession()).firmaId).toBe(firma.id);
    await expectRedirect(loginAction(loginForm()), "/app");
    await expectRedirect(updateFirmaAction(form()), "/app/firma?saved=1");
    expect(writes).toEqual(["firma-patch"]);
    if (state === "missing") expect(user.name).toBe("Synthetic Owner");
  });

  it("ignoriert den Cloud-Marker im Self-Hosting und erhält den vorhandenen Login und Firmenspeicherpfad", async () => {
    vi.stubEnv("INSTANCE_MODE", "self-hosted");
    vi.stubEnv("PB_URL", context.pocketbaseUrl); vi.stubEnv("APP_URL", context.appUrl);
    vi.stubEnv("PB_SUPERUSER_EMAIL", context.adminEmail); vi.stubEnv("PB_SUPERUSER_PASSWORD", context.adminPassword);
    vi.stubEnv("SESSION_SECRET", context.sessionSecret);
    token = await createSessionToken({ userId: user.id, email: user.email, name: "Selfhost Owner", role: user.role, firmaId: firma.id });
    expect(await getInitialSetup()).toBeNull(); expect((await requireFirmaSession()).firmaId).toBe(firma.id);
    await expectRedirect(loginAction(loginForm()), "/app");
    await expectRedirect(updateFirmaAction(form()), "/app/firma?saved=1");
    expect(markerReads).toBe(0); expect(writes).toEqual(["firma-patch"]); expect(marker?.status).toBe("pending");
  });
});

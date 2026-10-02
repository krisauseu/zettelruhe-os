import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => {
  vi.stubEnv("INSTANCE_MODE", "cloud");
  return { cookies: vi.fn(), headers: vi.fn(), revalidatePath: vi.fn(), setCookie: vi.fn() };
});
vi.mock("next/headers", () => ({ cookies: mocks.cookies, headers: mocks.headers }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

import { updateFirmaAction } from "./firma-actions";
import FirmaPage from "@/app/app/firma/page";
import { proxy } from "@/proxy";
import { createSessionToken, SESSION_COOKIE, verifySessionToken } from "@/lib/session-token";
import { DEFAULT_NUMMERNKREISE, type FirmaRecord } from "@/lib/pb";
import type { InstanceContext } from "@/lib/instance-context";

const context: InstanceContext = {
  tenantId: "t_syntheticfirma", pocketbaseUrl: "http://pb.synthetic.invalid",
  appUrl: "https://firma.synthetic.invalid", configVersion: 1, sessionVersion: 1,
  sessionSecret: "synthetic-session-secret-".repeat(2),
  adminEmail: "admin@synthetic.invalid", adminPassword: "synthetic-only", smtp: null,
};
const user = {
  userId: "user-1", email: "owner@synthetic.invalid", name: "Test",
  role: "eigentuemer", firmaId: "firma-1",
};
let firma: FirmaRecord;
let token: string;
let role: string;
let patchStatus: number;
let writes: number;

function requestHeaders() {
  return new Headers({ host: new URL(context.appUrl).host, origin: context.appUrl,
    "x-instance-ingress": "synthetic-ingress-".repeat(3), cookie: `${SESSION_COOKIE}=${token}` });
}
function form() {
  const data = new FormData();
  data.set("name", "Gespeicherte Firma");
  data.set("steuermodus", firma.steuermodus);
  data.set("nummernkreise_expected", JSON.stringify(firma.nummernkreise));
  for (const [key, value] of Object.entries(firma.nummernkreise)) {
    for (const [field, item] of Object.entries(value)) data.set(`nk_${key}_${field}`, String(item));
  }
  return data;
}

beforeEach(async () => {
  vi.clearAllMocks();
  vi.stubEnv("INSTANCE_MODE", "cloud");
  vi.stubEnv("INSTANCE_INGRESS_TOKEN", "synthetic-ingress-".repeat(3));
  vi.stubEnv("INSTANCE_CONTROL_URL", "http://control.synthetic.invalid");
  vi.stubEnv("INSTANCE_CONTROL_TOKEN", "synthetic-control-".repeat(3));
  firma = { id: user.firmaId, name: "Vorher", steuermodus: "kleinunternehmer",
    skr: "skr03", nummernkreise: structuredClone(DEFAULT_NUMMERNKREISE) };
  role = "eigentuemer"; patchStatus = 200; writes = 0;
  token = await createSessionToken(user, context);
  mocks.cookies.mockImplementation(async () => ({
    get: (name: string) => name === SESSION_COOKIE && token ? { value: token } : undefined,
    set: mocks.setCookie,
  }));
  mocks.headers.mockImplementation(async () => requestHeaders());
  // Only the HTTP persistence/control boundary is synthetic. Action, redirect,
  // token verification, session, membership, proxy and target page are real.
  vi.stubGlobal("fetch", vi.fn(async (input: string, init: RequestInit = {}) => {
    const url = new URL(input);
    if (url.origin === "http://control.synthetic.invalid") {
      expect(url.pathname).toBe("/v1/resolve");
      expect(url.searchParams.get("hostname")).toBe(new URL(context.appUrl).host);
      expect(new Headers(init.headers).get("Authorization")).toBe(`Bearer ${process.env.INSTANCE_CONTROL_TOKEN}`);
      return Response.json(context);
    }
    expect(url.origin).toBe(context.pocketbaseUrl);
    if (url.pathname.endsWith("/auth-with-password")) return Response.json({ token: "synthetic-admin" });
    expect(new Headers(init.headers).get("Authorization")).toBe("synthetic-admin");
    if (url.pathname === `/api/collections/users/records/${user.userId}`) return Response.json(user);
    if (url.pathname === "/api/collections/mitgliedschaften/records") {
      expect(url.searchParams.get("filter")).toContain(user.userId);
      return Response.json({ items: [{ id: "membership-1", user: user.userId, firma: firma.id, rolle: role }], totalItems: 1 });
    }
    if (url.pathname === `/api/collections/firmen/records/${firma.id}`) {
      if (init.method === "PATCH") {
        if (patchStatus !== 200) return Response.json({ message: "Schreiben abgewiesen." }, { status: patchStatus });
        firma = { ...firma, ...JSON.parse(String(init.body)) }; writes++;
      }
      return Response.json(firma);
    }
    throw new Error(`Unerwarteter Testrequest: ${url.pathname}`);
  }));
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

async function expectRedirect(data: FormData, path: string) {
  await expect(updateFirmaAction(data)).rejects.toMatchObject({
    message: "NEXT_REDIRECT", digest: expect.stringContaining(`;${path};`),
  });
}

describe("Firmendaten speichern und authentifizierte Zielseite (TP-034)", () => {
  it("speichert, leitet auf /app/firma?saved=1 und rendert mit derselben Cloud-Session die geänderte Firma", async () => {
    const originalToken = token;
    await expectRedirect(form(), "/app/firma?saved=1");
    expect(writes).toBe(1);
    expect(firma.name).toBe("Gespeicherte Firma");
    expect(mocks.revalidatePath.mock.calls).toEqual([["/app"], ["/app/firma"], ["/app/ust"], ["/app/zm"]]);
    const target = new URL("/app/firma?saved=1", context.appUrl);
    const response = await proxy(new NextRequest(target, { headers: requestHeaders() }));
    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
    const html = renderToStaticMarkup(await FirmaPage({ searchParams: Promise.resolve({ saved: "1" }) }));
    expect(html).toContain('value="Gespeicherte Firma"');
    expect(html).toContain("Firmendaten speichern");
    expect(html).not.toContain('"unauthorized"');
    expect(token).toBe(originalToken);
    expect(mocks.setCookie).not.toHaveBeenCalled();
    expect(await verifySessionToken(token, context)).toEqual(user);
    expect(await verifySessionToken(token, { ...context, tenantId: "t_otherfirma" })).toBeNull();
  });

  it.each([401, 403, 500])("behandelt einen echten PocketBase-Fehler %s ohne Erfolgsredirect", async status => {
    patchStatus = status;
    await expectRedirect(form(), `/app/firma?error=${encodeURIComponent(`PocketBase ${status}: Schreiben abgewiesen.`)}`);
    expect(writes).toBe(0);
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("weist fehlenden Firmennamen vor dem Schreiben ab", async () => {
    const data = form(); data.set("name", "");
    await expectRedirect(data, `/app/firma?error=${encodeURIComponent("Name der Firma ist erforderlich.")}`);
    expect(writes).toBe(0);
  });

  it("erhält den Rechte-Redirect für eine Lesemitgliedschaft", async () => {
    role = "lesen";
    await expect(updateFirmaAction(form())).rejects.toMatchObject({
      digest: expect.stringContaining(";/app?error="),
    });
    expect(writes).toBe(0);
  });

  it("verweigert Speichern ohne Session und schickt den Zielrequest zum Login", async () => {
    token = "";
    await expect(updateFirmaAction(form())).rejects.toThrow("Nicht angemeldet.");
    const response = await proxy(new NextRequest(`${context.appUrl}/app/firma?saved=1`, { headers: requestHeaders() }));
    expect(response.headers.get("location")).toBe(`${context.appUrl}/login`);
    expect(writes).toBe(0);
  });
});

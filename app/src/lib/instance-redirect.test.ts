import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
vi.hoisted(() => vi.stubEnv("INSTANCE_MODE", "cloud"));
import { proxy } from "@/proxy";
import { instanceRequestHeaders, requireIngress, type InstanceContext } from "./instance-context";
import { createSessionToken, SESSION_COOKIE } from "./session-token";
const a: InstanceContext = { tenantId: "t_synthetica", pocketbaseUrl: "http://pb-a.invalid",
  appUrl: "https://a.test", configVersion: 1, sessionVersion: 1, sessionSecret: "a".repeat(40),
  adminEmail: "a@synthetic.invalid", adminPassword: "synthetic-password", smtp: null };
const b = { ...a, tenantId: "t_syntheticb", appUrl: "https://b.test" };
const user = { userId: "same", email: "a@synthetic.invalid", name: "A", role: "eigentuemer", firmaId: "firma" };
let token: string;
function headers(host = "a.test") {
  return new Headers({ host, "x-instance-ingress": "i".repeat(40), cookie: `${SESSION_COOKIE}=${token}` });
}
beforeEach(async () => {
  vi.stubEnv("INSTANCE_MODE", "cloud"); vi.stubEnv("INSTANCE_INGRESS_TOKEN", "i".repeat(40));
  vi.stubEnv("INSTANCE_CONTROL_URL", "http://control.invalid"); vi.stubEnv("INSTANCE_CONTROL_TOKEN", "c".repeat(40));
  token = await createSessionToken(user, a);
  vi.stubGlobal("fetch", vi.fn(async (input: string) => {
    const host = new URL(input).searchParams.get("hostname");
    return host === "a.test" ? Response.json(a) : host === "b.test" ? Response.json(b) : new Response("", { status: 404 });
  }));
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
describe("canonical instance host on Next internal redirects", () => {
  it("preserves the resolved canonical host on repeated internal redirects", async () => {
    let h = headers();
    for (const host of ["a.test", "172.30.87.3:3000", "127.0.0.1:3000"]) {
      h.set("host", host);
      const response = await proxy(new NextRequest("http://127.0.0.1:3000/app/firma?saved=1", { headers: h }));
      expect(response.status).toBe(200);
      h = new Headers();
      for (const name of (response.headers.get("x-middleware-override-headers") ?? "").split(",")) {
        const value = response.headers.get(`x-middleware-request-${name}`);
        if (name && value !== null) h.set(name, value);
      }
      expect(requireIngress(h)).toBe("a.test");
      expect(h.get("x-instance-app-host")).toBe("a.test");
      expect(response.headers.has("x-instance-app-host-proof")).toBe(false);
      expect([...h.values()].join(" ")).not.toContain(a.sessionSecret);
      expect([...h.values()].join(" ")).not.toContain(a.adminPassword);
    }
    expect(vi.mocked(fetch).mock.calls.every(([url]) => new URL(String(url)).searchParams.get("hostname") === "a.test")).toBe(true);
  });
  it.each(["172.30.87.3:3000", "172.30.87.3", "[::1]:3000"])("cannot select a tenant with container host %s alone", async host => {
    expect((await proxy(new NextRequest("http://127.0.0.1:3000/app?hostname=a.test", { headers: headers(host) }))).status).toBe(503);
    expect(fetch).not.toHaveBeenCalled();
  });
  it.each(["b.test", "evil.test", "a.test, b.test", "a.test:443"])("rejects manipulated forwarded host %s", async host => {
    const h = headers(); h.set("x-forwarded-host", host);
    expect((await proxy(new NextRequest("https://a.test/app", { headers: h }))).status).toBe(503);
    expect(fetch).not.toHaveBeenCalled();
    const signed = instanceRequestHeaders(headers("172.30.87.3:3000"), a); signed.set("x-forwarded-host", host);
    expect(() => requireIngress(signed)).toThrow("INSTANCE_HOST_INVALID");
  });
  it("rejects unsigned, tampered, partial and foreign-host assertions", () => {
    const h = instanceRequestHeaders(headers("172.30.87.3:3000"), a);
    for (const [name, value] of [["x-instance-app-host", "b.test"], ["x-instance-app-host-proof", "0.bad"], ["host", "b.test"], ["host", "unknown.test"], ["host", "a.test:443"]]) {
      const changed = new Headers(h); changed.set(name, value);
      expect(() => requireIngress(changed)).toThrow("INSTANCE_HOST_INVALID");
    }
    for (const name of ["x-instance-app-host", "x-instance-app-host-proof"]) {
      const partial = new Headers(h); partial.delete(name);
      expect(() => requireIngress(partial)).toThrow("INSTANCE_HOST_INVALID");
    }
    h.delete("x-instance-ingress"); expect(() => requireIngress(h)).toThrow("INSTANCE_INGRESS_DENIED");
  });
  it("rejects expired, future-dated and key-rotated assertions", () => {
    vi.useFakeTimers(); const now = Date.now();
    const h = instanceRequestHeaders(headers("172.30.87.3:3000"), a);
    vi.setSystemTime(now - 1); expect(() => requireIngress(h)).toThrow("INSTANCE_HOST_INVALID");
    vi.setSystemTime(now + 300_001); expect(() => requireIngress(h)).toThrow("INSTANCE_HOST_INVALID");
    vi.setSystemTime(now); vi.stubEnv("INSTANCE_INGRESS_TOKEN", "r".repeat(40)); h.set("x-instance-ingress", "r".repeat(40));
    expect(() => requireIngress(h)).toThrow("INSTANCE_HOST_INVALID");
  });
  it("rejects an unknown public host despite a tenant query", async () => {
    expect((await proxy(new NextRequest("https://unknown.test/app?hostname=a.test", { headers: headers("unknown.test") }))).status).toBe(503);
  });
  it("keeps sessions bound to tenantId even with shared signing keys", async () => {
    const h = instanceRequestHeaders(headers("172.30.87.3:3000"), b);
    const response = await proxy(new NextRequest("http://127.0.0.1:3000/app", { headers: h }));
    expect(response.headers.get("location")).toBe("https://b.test/login");
  });
  it("preserves the self-hosted cookie gate and ignores cloud headers", async () => {
    vi.stubEnv("INSTANCE_MODE", "self-hosted"); vi.stubEnv("SESSION_SECRET", "s".repeat(40));
    vi.resetModules();
    const { proxy: localProxy } = await import("@/proxy");
    const { createSessionToken: createLocalToken, SESSION_COOKIE: localCookie } = await import("./session-token");
    expect(localCookie).toBe("zettelruhe_session");
    const localToken = await createLocalToken(user);
    const h = new Headers({ host: "localhost:3000", cookie: `${localCookie}=${localToken}`, "x-forwarded-host": "evil.test", "x-instance-app-host": "evil.test" });
    expect((await localProxy(new NextRequest("http://localhost:3000/app/firma?saved=1", { headers: h }))).status).toBe(200);
    h.delete("cookie");
    expect((await localProxy(new NextRequest("http://localhost:3000/app/firma?saved=1", { headers: h }))).headers.get("location")).toBe("http://localhost:3000/login");
    expect(fetch).not.toHaveBeenCalled();
  });
});

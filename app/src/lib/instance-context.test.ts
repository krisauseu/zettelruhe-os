import { afterEach, describe, expect, it, vi } from "vitest";
import { getInstanceContext, withInstance, validateInstance, requireIngress, assertPublicSetupAllowed, type InstanceContext } from "./instance-context";
import { createSessionToken, verifySessionToken } from "./session-token";
import { getAdminToken, getRecord } from "./pb";
import { getSmtpConfig } from "./smtp";
const a: InstanceContext = { tenantId: "t_synthetica", pocketbaseUrl: "http://a.test", appUrl: "https://a.test", configVersion: 1, sessionVersion: 1, sessionSecret: "a".repeat(40), adminEmail: "a@synthetic.invalid", adminPassword: "test-a", smtp: null };
const b: InstanceContext = { ...a, tenantId: "t_syntheticb", pocketbaseUrl: "http://b.test", appUrl: "https://b.test", adminPassword: "test-b" };
const user = { userId: "identicaluserid", email: "same@synthetic.invalid", name: "Test", role: "eigentuemer", firmaId: "identicalfirma" };
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
describe("instance binding", () => {
 it("rejects transferred, tampered, expired and revoked sessions even with shared signing keys", async () => {
  const token = await createSessionToken(user, a);
  expect(await verifySessionToken(token, a)).toEqual(user);
  expect(await verifySessionToken(token, b)).toBeNull();
  expect(await verifySessionToken(token.slice(0, -5) + "wrong", a)).toBeNull();
  expect(await verifySessionToken(token, { ...a, sessionVersion: 2 })).toBeNull();
  expect(await verifySessionToken(token, { ...a, sessionSecret: "rotated".repeat(8) })).toBeNull();
  vi.useFakeTimers(); vi.setSystemTime(Date.now() + 15 * 86400000);
  expect(await verifySessionToken(token, a)).toBeNull(); vi.useRealTimers();
 });
 it("isolates nested parallel PB credentials and restores the enclosing context", async () => {
  vi.stubEnv("INSTANCE_MODE", "cloud");
  vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
    await new Promise(r => setTimeout(r, Math.random() * 5));
    const host = new URL(url).hostname;
    if (url.endsWith("auth-with-password")) {
      expect(JSON.parse(init.body as string).password).toBe(host === "a.test" ? "test-a" : "test-b");
      return Response.json({ token: host });
    }
    expect(new Headers(init.headers).get("Authorization")).toBe(host);
    expect(init.redirect).toBe("error");
    return Response.json({ id: "same", host });
  }));
  await Promise.all(Array.from({ length: 40 }, (_, i) => withInstance(i % 2 ? a : b, async () => {
    const outer = await getInstanceContext();
    expect((await getRecord<{host:string}>("firmen", "same")).host).toBe(new URL(outer.pocketbaseUrl).hostname);
    await withInstance(outer.tenantId === a.tenantId ? b : a, async () => { await getAdminToken(); });
    expect(await getInstanceContext()).toBe(outer);
  })));
  await expect(getInstanceContext()).rejects.toThrow();
 });
 it("fails closed without ingress and prevents public cloud setup", async () => {
  vi.stubEnv("INSTANCE_MODE", "cloud"); vi.stubEnv("INSTANCE_INGRESS_TOKEN", "x".repeat(40));
  expect(() => requireIngress(new Headers({host:"a.test"}))).toThrow();
  expect(() => validateInstance({...a, pocketbaseUrl:"http://a.test/path"})).toThrow();
  await expect(assertPublicSetupAllowed()).rejects.toThrow("PUBLIC_SETUP_DISABLED");
 });
 it("does not inherit self-hosted SMTP in cloud and sees changed credentials", async () => {
  vi.stubEnv("INSTANCE_MODE", "cloud"); vi.stubEnv("SMTP_HOST", "forbidden.test");
  await withInstance(a, async () => expect(await getSmtpConfig()).toBeNull());
  const smtp = { host: "smtp.test", port: 587, user: "test", password: "first", from: "a@test.invalid", secure: false };
  await withInstance({...a, smtp}, async () => expect((await getSmtpConfig())?.password).toBe("first"));
  await withInstance({...a, configVersion: 2, smtp: {...smtp, password:"second"}}, async () => expect((await getSmtpConfig())?.password).toBe("second"));
 });
});

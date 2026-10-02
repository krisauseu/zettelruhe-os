/** Generic server-side deployment adapter. No customer register is bundled here. */
import { AsyncLocalStorage } from "node:async_hooks";
import { createHmac, timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";
import { cache } from "react";
import { validSmtpConfig, type SmtpConfig } from "./smtp";

export type InstanceContext = Readonly<{
  tenantId: string;
  pocketbaseUrl: string;
  appUrl: string;
  configVersion: number;
  sessionVersion: number;
  sessionSecret: string;
  adminEmail: string;
  adminPassword: string;
  smtp: Readonly<SmtpConfig> | null;
  systemSmtp?: Readonly<SmtpConfig> | null;
  fallbackSmtp?: Readonly<SmtpConfig> | null;
}>;
export const isCloud = () => process.env.INSTANCE_MODE === "cloud";
const jobs = new AsyncLocalStorage<InstanceContext>();
const requests = new WeakMap<object, Promise<InstanceContext>>();
const APP_HOST_HEADER = "x-instance-app-host";
const APP_HOST_PROOF_HEADER = "x-instance-app-host-proof";
const APP_HOST_LIFETIME_MS = 5 * 60 * 1000;

function publicHostname(host: string): boolean {
  return /^[a-z0-9.-]+$/.test(host) && host.length <= 253 && !isIP(host);
}

function internalTransport(host: string): boolean {
  try {
    const url = new URL(`http://${host}`);
    return url.host === host && isIP(url.hostname.replace(/^\[|\]$/g, "")) !== 0;
  } catch {
    return false;
  }
}

function hostProof(host: string, issued: string, key: string): string {
  return createHmac("sha256", key).update(`zettelruhe:app-host:v1\n${issued}\n${host}`).digest("hex");
}

/** Server-only request overrides. Next forwards these on internal action redirects.
 * The host comes from the resolved context, never from forwarded/client headers.
 * No context credentials or proof are sent as browser response headers.
 */
export function instanceRequestHeaders(h: Headers, context: InstanceContext): Headers {
  const key = process.env.INSTANCE_INGRESS_TOKEN ?? "";
  if (key.length < 32) throw new Error("INSTANCE_INGRESS_DENIED");
  const host = new URL(context.appUrl).hostname;
  if (!publicHostname(host)) throw new Error("INSTANCE_HOST_INVALID");
  const issued = String(Date.now());
  const result = new Headers(h);
  result.set(APP_HOST_HEADER, host);
  result.set(APP_HOST_PROOF_HEADER, `${issued}.${hostProof(host, issued, key)}`);
  result.set("x-forwarded-host", host);
  return result;
}

export function requireIngress(h: Pick<Headers, "get">): string {
  const expected = process.env.INSTANCE_INGRESS_TOKEN ?? "";
  const actual = h.get("x-instance-ingress") ?? "";
  if (expected.length < 32 || actual.length !== expected.length ||
      !timingSafeEqual(Buffer.from(actual), Buffer.from(expected))) throw new Error("INSTANCE_INGRESS_DENIED");
  const host = h.get("host") ?? "";
  const canonical = h.get(APP_HOST_HEADER);
  const proof = h.get(APP_HOST_PROOF_HEADER);
  let hostname = host;
  if (canonical !== null || proof !== null) {
    const match = /^(\d{13})\.([a-f0-9]{64})$/.exec(proof ?? "");
    if (!canonical || !publicHostname(canonical) || !match ||
        Number(match[1]) > Date.now() || Date.now() - Number(match[1]) > APP_HOST_LIFETIME_MS ||
        !timingSafeEqual(Buffer.from(match[2], "hex"), Buffer.from(hostProof(canonical, match[1], expected), "hex"))) {
      throw new Error("INSTANCE_HOST_INVALID");
    }
    // A public Host must still match exactly. A changed internal transport Host
    // cannot select an instance: only the server-authenticated canonical host can.
    if (host !== canonical && !internalTransport(host)) throw new Error("INSTANCE_HOST_INVALID");
    hostname = canonical;
  }
  if (!publicHostname(hostname)) throw new Error("INSTANCE_HOST_INVALID");
  const forwarded = h.get("x-forwarded-host");
  if (forwarded !== null && forwarded !== hostname) throw new Error("INSTANCE_HOST_INVALID");
  return hostname;
}

export function validateInstance(value: InstanceContext, hostname?: string): InstanceContext {
  const pb = new URL(value.pocketbaseUrl);
  const app = new URL(value.appUrl);
  if (!/^t_[a-z0-9]{8,32}$/.test(value.tenantId) ||
      !["http:", "https:"].includes(pb.protocol) || pb.origin !== value.pocketbaseUrl ||
      app.protocol !== "https:" || app.origin !== value.appUrl ||
      (hostname !== undefined && app.hostname !== hostname) ||
      !Number.isSafeInteger(value.configVersion) || value.configVersion < 1 ||
      !Number.isSafeInteger(value.sessionVersion) || value.sessionVersion < 1 ||
      typeof value.sessionSecret !== "string" || value.sessionSecret.length < 32 ||
      !value.adminEmail || !value.adminPassword ||
      (value.smtp != null && !validSmtpConfig(value.smtp)) ||
      (value.systemSmtp != null && !validSmtpConfig(value.systemSmtp)) ||
      (value.fallbackSmtp != null && !validSmtpConfig(value.fallbackSmtp))) throw new Error("INSTANCE_CONFIG_INVALID");
  return Object.freeze({ ...value, smtp: value.smtp ? Object.freeze({ ...value.smtp }) : null,
    systemSmtp: value.systemSmtp ? Object.freeze({ ...value.systemSmtp }) : null,
    fallbackSmtp: value.fallbackSmtp ? Object.freeze({ ...value.fallbackSmtp }) : null });
}

async function control(path: string): Promise<unknown> {
  const base = process.env.INSTANCE_CONTROL_URL;
  const token = process.env.INSTANCE_CONTROL_TOKEN;
  if (!base || !token || token.length < 32) throw new Error("INSTANCE_CONTROL_MISSING");
  const url = new URL(base);
  if (!["http:", "https:"].includes(url.protocol) || url.origin !== base) throw new Error("INSTANCE_CONTROL_INVALID");
  const response = await fetch(`${base}${path}`, { headers: { Authorization: `Bearer ${token}` },
    cache: "no-store", redirect: "error", signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw new Error("INSTANCE_UNAVAILABLE");
  return response.json();
}
export async function resolveInstance(hostname: string): Promise<InstanceContext> {
  return validateInstance(await control(`/v1/resolve?hostname=${encodeURIComponent(hostname)}`) as InstanceContext, hostname);
}
export async function jobInstanceHosts(): Promise<string[]> {
  const value = await control("/v1/instances");
  if (!Array.isArray(value) || !value.every(h => typeof h === "string" && /^[a-z0-9.-]+$/.test(h))) throw new Error("INSTANCE_CONFIG_INVALID");
  return value;
}
let selfConfig: InstanceContext | undefined;
export function selfHostedInstance(): InstanceContext {
  const config: InstanceContext = { tenantId: "self-hosted", pocketbaseUrl: (process.env.PB_URL ?? "").replace(/\/$/, ""),
    appUrl: (process.env.APP_URL || "http://localhost").replace(/\/$/, ""), configVersion: 1, sessionVersion: 1,
    sessionSecret: process.env.SESSION_SECRET ?? "", adminEmail: process.env.PB_SUPERUSER_EMAIL ?? "",
    adminPassword: process.env.PB_SUPERUSER_PASSWORD ?? "", smtp: null };
  if (!selfConfig || Object.keys(config).some(key => config[key as keyof InstanceContext] !== selfConfig![key as keyof InstanceContext])) selfConfig = Object.freeze(config);
  return selfConfig;
}
const requestInstance = cache(async (): Promise<InstanceContext> => {
  const { headers } = await import("next/headers");
  const h = await headers();
  let context = requests.get(h);
  if (!context) {
    context = resolveInstance(requireIngress(h));
    requests.set(h, context);
  }
  return context;
});
export async function getInstanceContext(): Promise<InstanceContext> {
  const job = jobs.getStore();
  if (job) return job;
  if (!isCloud()) return selfHostedInstance();
  return requestInstance();
}
/** Only trusted server code supplies contexts. Nested and parallel jobs keep separate stores. */
export function withInstance<T>(context: InstanceContext, work: () => T): T {
  return jobs.run(Object.freeze({ ...context, smtp: context.smtp ? Object.freeze({ ...context.smtp }) : null,
    systemSmtp: context.systemSmtp ? Object.freeze({ ...context.systemSmtp }) : null,
    fallbackSmtp: context.fallbackSmtp ? Object.freeze({ ...context.fallbackSmtp }) : null }), work);
}
export async function assertPublicSetupAllowed(): Promise<void> {
  if (isCloud()) throw new Error("PUBLIC_SETUP_DISABLED");
}
export async function assertMutationOrigin(): Promise<void> {
  if (!isCloud()) return;
  const { headers } = await import("next/headers");
  if ((await headers()).get("origin") !== (await getInstanceContext()).appUrl) throw new Error("ORIGIN_DENIED");
}

/** Generic server-side deployment adapter. No customer register is bundled here. */
import { AsyncLocalStorage } from "node:async_hooks";
import { timingSafeEqual } from "node:crypto";
import { cache } from "react";
import type { SmtpConfig } from "./smtp";

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
}>;
export const isCloud = () => process.env.INSTANCE_MODE === "cloud";
const jobs = new AsyncLocalStorage<InstanceContext>();
const requests = new WeakMap<object, Promise<InstanceContext>>();

export function requireIngress(h: Pick<Headers, "get">): string {
  const expected = process.env.INSTANCE_INGRESS_TOKEN ?? "";
  const actual = h.get("x-instance-ingress") ?? "";
  if (expected.length < 32 || actual.length !== expected.length ||
      !timingSafeEqual(Buffer.from(actual), Buffer.from(expected))) throw new Error("INSTANCE_INGRESS_DENIED");
  const host = h.get("host") ?? "";
  if (!/^[a-z0-9.-]+$/.test(host) || host.length > 253) throw new Error("INSTANCE_HOST_INVALID");
  return host;
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
      !value.adminEmail || !value.adminPassword) throw new Error("INSTANCE_CONFIG_INVALID");
  return Object.freeze({ ...value, smtp: value.smtp ? Object.freeze({ ...value.smtp }) : null });
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
  return jobs.run(Object.freeze({ ...context, smtp: context.smtp ? Object.freeze({ ...context.smtp }) : null }), work);
}
export async function assertPublicSetupAllowed(): Promise<void> {
  if (isCloud()) throw new Error("PUBLIC_SETUP_DISABLED");
}
export async function assertMutationOrigin(): Promise<void> {
  if (!isCloud()) return;
  const { headers } = await import("next/headers");
  if ((await headers()).get("origin") !== (await getInstanceContext()).appUrl) throw new Error("ORIGIN_DENIED");
}

"use server";

import { redirect } from "next/navigation";
import { getInstanceContext, isCloud, assertMutationOrigin } from "./instance-context";
import { requireInstanzEigentuemerSession } from "./session";
import { validSmtpConfig, type SmtpConfig } from "./smtp";

export type MailSettingsStatus = { configured: boolean; host?: string; port?: number;
  secure?: boolean; user?: string; from?: string; fromName?: string };

async function controlMail(method: "GET" | "PUT" | "DELETE", config?: SmtpConfig): Promise<MailSettingsStatus | null> {
  const context = await getInstanceContext();
  const base = process.env.INSTANCE_CONTROL_URL;
  const token = process.env.INSTANCE_CONTROL_TOKEN;
  if (!base || !token || token.length < 32) throw new Error("Mailverwaltung ist nicht verfügbar.");
  const hostname = new URL(context.appUrl).hostname;
  const response = await fetch(`${base}/v1/mail?hostname=${encodeURIComponent(hostname)}`, {
    method, headers: { Authorization: `Bearer ${token}`, ...(config ? { "Content-Type": "application/json" } : {}) },
    ...(config ? { body: JSON.stringify(config) } : {}),
    cache: "no-store", redirect: "error", signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error("Mailkonfiguration konnte nicht gespeichert oder geladen werden.");
  return method === "GET" ? await response.json() as MailSettingsStatus : null;
}

export async function getMailSettingsStatus(): Promise<MailSettingsStatus> {
  await requireInstanzEigentuemerSession();
  if (!isCloud()) return { configured: false };
  return (await controlMail("GET"))!;
}

function field(data: FormData, name: string): string {
  const value = data.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function passwordField(data: FormData): string {
  const value = data.get("password");
  return typeof value === "string" ? value : "";
}

export async function saveMailSettingsAction(data: FormData): Promise<void> {
  await requireInstanzEigentuemerSession();
  await assertMutationOrigin();
  if (!isCloud()) redirect("/app/firma");
  const config: SmtpConfig = {
    host: field(data, "host"), port: Number(field(data, "port")),
    secure: field(data, "secure") === "true", user: field(data, "user"),
    password: passwordField(data), from: field(data, "from"),
    fromName: field(data, "fromName"),
  };
  if (!validSmtpConfig(config) || !config.user || !config.password) {
    redirect("/app/mail-einstellungen?error=ungueltig");
  }
  try { await controlMail("PUT", config); }
  catch { redirect("/app/mail-einstellungen?error=speichern"); }
  redirect("/app/mail-einstellungen?saved=1");
}

export async function deleteMailSettingsAction(): Promise<void> {
  await requireInstanzEigentuemerSession();
  await assertMutationOrigin();
  if (!isCloud()) redirect("/app/firma");
  try { await controlMail("DELETE"); }
  catch { redirect("/app/mail-einstellungen?error=speichern"); }
  redirect("/app/mail-einstellungen?deleted=1");
}

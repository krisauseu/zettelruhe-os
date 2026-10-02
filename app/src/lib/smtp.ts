/** Instance-bound business mail and centrally owned system mail. */
import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import { resolve4 } from "node:dns/promises";
import { getFirmaById } from "./pb";
import { getInstanceContext, isCloud } from "./instance-context";

export type SmtpConfig = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  from: string;
  fromName?: string;
};

export const SMTP_NOT_CONFIGURED_ERROR = "Mailversand ist nicht konfiguriert.";
export const SMTP_DELIVERY_ERROR = "E-Mail-Versand fehlgeschlagen. Bitte die Mailkonfiguration prüfen.";
const SYSTEM_NOT_CONFIGURED_ERROR = "Zettelruhe-Systemmail ist nicht konfiguriert.";

function address(value: string): boolean {
  return /^[^\s@<>\r\n]+@[^\s@<>\r\n]+(?:\.[^\s@<>\r\n]+)?$/.test(value) && value.length <= 254;
}

export function validSmtpConfig(value: unknown): value is SmtpConfig {
  if (!value || typeof value !== "object") return false;
  const c = value as Partial<SmtpConfig>;
  return typeof c.host === "string" && c.host.length > 0 && c.host.length <= 253 &&
    !/[\s\r\n]/.test(c.host) && Number.isInteger(c.port) && c.port! > 0 && c.port! <= 65535 &&
    typeof c.secure === "boolean" && typeof c.user === "string" && c.user.length <= 254 &&
    typeof c.password === "string" && c.password.length <= 1024 &&
    typeof c.from === "string" && address(c.from) &&
    (c.fromName === undefined || (typeof c.fromName === "string" && c.fromName.length <= 200 &&
      !/[\r\n]/.test(c.fromName)));
}

/** Self-hosting keeps its existing single-instance ENV configuration. */
export async function getSmtpConfig(): Promise<SmtpConfig | null> {
  if (isCloud()) return (await getInstanceContext()).smtp;
  const host = (process.env.SMTP_HOST ?? "").trim();
  if (!host) return null;
  const port = Number(process.env.SMTP_PORT ?? "587");
  const user = (process.env.SMTP_USER ?? "").trim();
  const config = { host, port, user, password: process.env.SMTP_PASSWORD ?? "",
    from: (process.env.SMTP_FROM ?? "").trim() || user || "noreply@localhost",
    fromName: (process.env.SMTP_FROM_NAME ?? "").trim(),
    secure: process.env.SMTP_SECURE === undefined ? port === 465 : process.env.SMTP_SECURE === "true" };
  if (!validSmtpConfig(config)) throw new Error("SMTP-Konfiguration ist ungültig.");
  return config;
}

export async function getBusinessSmtpConfig(): Promise<SmtpConfig | null> {
  if (!isCloud()) return getSmtpConfig();
  const context = await getInstanceContext();
  return context.smtp ?? context.fallbackSmtp ?? null;
}

export async function isSmtpConfigured(): Promise<boolean> {
  return (await getBusinessSmtpConfig()) !== null;
}

export async function isSystemSmtpConfigured(): Promise<boolean> {
  return isCloud() ? (await getInstanceContext()).systemSmtp !== null : (await getSmtpConfig()) !== null;
}

export async function assertSmtpConfigured(): Promise<SmtpConfig> {
  const config = await getBusinessSmtpConfig();
  if (!config) throw new Error(SMTP_NOT_CONFIGURED_ERROR);
  return config;
}

/** One transporter per send, with no process-wide tenant or credential cache. */
export async function getMailTransporter(config?: SmtpConfig): Promise<Transporter> {
  const cfg = config ?? await assertSmtpConfigured();
  return nodemailer.createTransport({ host: cfg.host, port: cfg.port, secure: cfg.secure,
    requireTLS: isCloud() && !cfg.secure,
    auth: cfg.user || cfg.password ? { user: cfg.user, pass: cfg.password } : undefined });
}

function publicIpv4(address: string): boolean {
  const octets = address.split(".").map(Number);
  if (octets.length !== 4 || octets.some(n => !Number.isInteger(n) || n < 0 || n > 255)) return false;
  const [a, b, c] = octets;
  return !(a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) || (a === 192 && (b === 0 || b === 168)) ||
    (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
    (a === 203 && b === 0 && c === 113));
}

async function publicTenantTransport(config: SmtpConfig): Promise<Transporter> {
  // Pin the validated DNS answer; the SMTP socket must not resolve a different address.
  const addresses = await resolve4(config.host);
  if (!addresses.length || addresses.some(address => !publicIpv4(address))) {
    throw new Error("Der Kunden-SMTP-Host muss öffentlich erreichbar sein.");
  }
  return nodemailer.createTransport({ host: addresses[0], port: config.port, secure: config.secure,
    requireTLS: !config.secure, tls: { servername: config.host },
    auth: { user: config.user, pass: config.password } });
}

export type SendMailInput = { to: string; subject: string; text: string; html?: string;
  attachments?: Array<{ filename: string; content: Buffer; contentType?: string }> };
export type SendMailResult = { messageId: string; accepted: string[] };

async function deliver(config: SmtpConfig, input: SendMailInput, fromName: string, replyTo?: string,
  publicHost = false): Promise<SendMailResult> {
  const to = input.to?.trim();
  if (!to || !address(to)) throw new Error("Empfänger-E-Mail ist ungültig.");
  if (!input.subject?.trim()) throw new Error("Betreff fehlt.");
  try {
    const transport = publicHost ? await publicTenantTransport(config) : await getMailTransporter(config);
    const info = await transport.sendMail({ from: { name: fromName, address: config.from },
      ...(replyTo ? { replyTo } : {}), to, subject: input.subject.trim(), text: input.text,
      html: input.html, attachments: input.attachments?.map(a => ({ filename: a.filename,
        content: a.content, contentType: a.contentType ?? "application/pdf" })) });
    return { messageId: String(info.messageId ?? ""), accepted: (info.accepted ?? []).map(String) };
  } catch {
    // DNS, TLS and server replies can contain credentials or private SMTP details.
    // Actions expose this error to the UI; do not retain or log the original cause.
    throw new Error(SMTP_DELIVERY_ERROR);
  }
}

/** Invitations and future account mail never use a tenant's SMTP account. */
export async function sendSystemMail(input: SendMailInput): Promise<SendMailResult> {
  const config = isCloud() ? (await getInstanceContext()).systemSmtp : await getSmtpConfig();
  if (!config) throw new Error(SYSTEM_NOT_CONFIGURED_ERROR);
  return deliver(config, input, config.fromName || (isCloud() ? "Zettelruhe" : ""));
}

/** The fallback's Reply-To comes only from the firm loaded inside this instance. */
export async function sendBusinessMail(firmaId: string, input: SendMailInput): Promise<SendMailResult> {
  const config = await assertSmtpConfigured();
  if (!isCloud()) return deliver(config, input, config.fromName || "");
  const context = await getInstanceContext();
  if (context.smtp) return deliver(config, input, config.fromName || "", undefined, true);
  const firma = await getFirmaById(firmaId);
  if (!firma || !firma.email || !address(firma.email.trim())) {
    throw new Error("Für Zettelruhe-Versand braucht die aktive Firma eine gültige E-Mail-Adresse.");
  }
  const name = (firma.name || "Firma").replace(/[\r\n]/g, " ").slice(0, 180);
  return deliver(config, input, `${name} über Zettelruhe`, firma.email.trim());
}

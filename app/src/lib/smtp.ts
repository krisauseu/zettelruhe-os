/**
 * SMTP light (Nodemailer) — ENV aus Compose (ADR-0010).
 * Ohne SMTP_HOST darf die App laufen; Versand schlägt klar fehl.
 */

import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";

export type SmtpConfig = {
  host: string;
  port: number;
  user: string;
  password: string;
  from: string;
  secure: boolean;
};

export const SMTP_NOT_CONFIGURED_ERROR =
  "SMTP ist nicht konfiguriert. Bitte SMTP_HOST (und ggf. PORT/USER/PASSWORD/FROM) in der Umgebung setzen.";

/** Liest SMTP_* aus ENV. null wenn Host fehlt. */
export function getSmtpConfig(): SmtpConfig | null {
  const host = (process.env.SMTP_HOST ?? "").trim();
  if (!host) return null;

  const portRaw = (process.env.SMTP_PORT ?? "587").trim();
  const port = Number.parseInt(portRaw, 10) || 587;
  const user = (process.env.SMTP_USER ?? "").trim();
  const password = (process.env.SMTP_PASSWORD ?? "").trim();
  const from = (process.env.SMTP_FROM ?? "").trim() || user || "noreply@localhost";
  // 465 = implicit TLS, sonst STARTTLS am typischen 587
  const secure = port === 465;

  return { host, port, user, password, from, secure };
}

export function isSmtpConfigured(): boolean {
  return getSmtpConfig() !== null;
}

export function assertSmtpConfigured(): SmtpConfig {
  const cfg = getSmtpConfig();
  if (!cfg) {
    throw new Error(SMTP_NOT_CONFIGURED_ERROR);
  }
  return cfg;
}

let cachedTransporter: Transporter | null = null;
let cachedKey = "";

function transporterKey(cfg: SmtpConfig): string {
  return `${cfg.host}:${cfg.port}:${cfg.user}`;
}

export function getMailTransporter(cfg?: SmtpConfig): Transporter {
  const config = cfg ?? assertSmtpConfigured();
  const key = transporterKey(config);
  if (cachedTransporter && cachedKey === key) {
    return cachedTransporter;
  }
  cachedTransporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth:
      config.user || config.password
        ? { user: config.user, pass: config.password }
        : undefined,
  });
  cachedKey = key;
  return cachedTransporter;
}

/** Test-Hook: Cache leeren */
export function resetSmtpCache(): void {
  cachedTransporter = null;
  cachedKey = "";
}

export type SendMailInput = {
  to: string;
  subject: string;
  text: string;
  html?: string;
  attachments?: Array<{
    filename: string;
    content: Buffer;
    contentType?: string;
  }>;
};

export type SendMailResult = {
  messageId: string;
  accepted: string[];
};

/**
 * Sendet eine E-Mail. Wirft mit klarer Meldung wenn SMTP fehlt.
 */
export async function sendMail(input: SendMailInput): Promise<SendMailResult> {
  const cfg = assertSmtpConfigured();
  const to = (input.to ?? "").trim();
  if (!to) {
    throw new Error("Empfänger-E-Mail fehlt.");
  }
  if (!input.subject?.trim()) {
    throw new Error("Betreff fehlt.");
  }

  const transport = getMailTransporter(cfg);
  const info = await transport.sendMail({
    from: cfg.from,
    to,
    subject: input.subject.trim(),
    text: input.text,
    html: input.html,
    attachments: input.attachments?.map((a) => ({
      filename: a.filename,
      content: a.content,
      contentType: a.contentType ?? "application/pdf",
    })),
  });

  return {
    messageId: String(info.messageId ?? ""),
    accepted: (info.accepted ?? []).map(String),
  };
}

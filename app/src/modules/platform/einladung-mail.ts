/**
 * Optionaler Einladungsversand. SMTP nicht Pflicht (ADR-0025).
 * Kein Startpasswort in der Mail.
 */

import { getFirmaById } from "@/lib/pb";
import { MITGLIEDSCHAFT_ROLLE_LABELS } from "@/lib/labels";
import { isSmtpConfigured, sendMail } from "@/lib/smtp";
import type { MitgliedschaftRolle } from "./rechte";

export function baueEinladungMail(input: {
  empfaengerName: string;
  firmaName: string;
  rolleLabel: string;
  einladendeName: string;
  loginUrl: string;
}): { subject: string; text: string } {
  const name = input.empfaengerName.trim() || "Guten Tag";
  const firma = input.firmaName.trim() || "einer Firma";
  const rolle = input.rolleLabel.trim() || "einer Rolle";
  const von = input.einladendeName.trim() || "der Eigentümer:in";
  const login = input.loginUrl.trim();

  return {
    subject: `Zugang zu ${firma} in Zettelruhe`,
    text: [
      `Guten Tag ${name},`,
      "",
      `${von} hat Sie zu ${firma} in Zettelruhe eingeladen.`,
      `Ihre Rolle: ${rolle}.`,
      "",
      login
        ? `Anmeldung: ${login}`
        : "Anmeldung über die Anmeldeseite der Instanz.",
      "Das Startpasswort teilt Ihnen die einladende Person mit — es steht nicht in dieser Mail.",
      "",
      "Mit freundlichen Grüßen",
      "Zettelruhe",
    ].join("\n"),
  };
}

function loginUrl(): string {
  const base = (process.env.APP_URL ?? "").replace(/\/$/, "");
  return base ? `${base}/login` : "";
}

export async function sendeEinladungPerMail(input: {
  to: string;
  empfaengerName: string;
  firmaId: string;
  rolle: MitgliedschaftRolle;
  einladendeName: string;
}): Promise<{ to: string; messageId: string } | null> {
  if (!isSmtpConfigured()) {
    return null;
  }

  const firma = await getFirmaById(input.firmaId);
  const mail = baueEinladungMail({
    empfaengerName: input.empfaengerName,
    firmaName: firma?.name ?? "",
    rolleLabel: MITGLIEDSCHAFT_ROLLE_LABELS[input.rolle],
    einladendeName: input.einladendeName,
    loginUrl: loginUrl(),
  });

  const result = await sendMail({
    to: input.to,
    subject: mail.subject,
    text: mail.text,
  });
  return { to: input.to, messageId: result.messageId };
}

/**
 * E-Mail-Versand light: Angebot / Rechnung (PDF) / Zahlungserinnerung manuell.
 * SMTP aus Next (ADR-0010); kein Mahnlauf-Automatismus.
 */

import { getKontakt } from "@/modules/contacts";
import {
  getERechnungVersandDateiResponse,
  listERechnungVersandForRechnung,
} from "@/modules/einvoice";
import {
  getAngebot,
  getAngebotPdfResponse,
  getRechnung,
  getRechnungPdfResponse,
} from "@/modules/sales/repository";
import { formatMoneyDe } from "@/lib/money";
import { formatDateDe } from "@/lib/labels";
import { isSmtpConfigured, sendMail, SMTP_NOT_CONFIGURED_ERROR } from "@/lib/smtp";

export { isSmtpConfigured, SMTP_NOT_CONFIGURED_ERROR };

async function pdfBufferFromResponse(response: Response): Promise<Buffer> {
  const ab = await response.arrayBuffer();
  return Buffer.from(ab);
}

function requireEmail(email: string | undefined | null, label: string): string {
  const e = (email ?? "").trim();
  if (!e) {
    throw new Error(
      `${label}: Keine E-Mail-Adresse am Kontakt. Bitte im Kontakt hinterlegen.`,
    );
  }
  return e;
}

/**
 * Rechnung per E-Mail an Kund:in (PDF-Anhang).
 * Nur sinnvolll wenn PDF vorhanden (festgeschrieben).
 */
export async function sendeRechnungPerMail(
  firmaId: string,
  rechnungId: string,
  opts?: { to?: string },
): Promise<{ to: string; messageId: string }> {
  if (!isSmtpConfigured()) {
    throw new Error(SMTP_NOT_CONFIGURED_ERROR);
  }

  const rechnung = await getRechnung(firmaId, rechnungId);
  if (!rechnung) throw new Error("Rechnung nicht gefunden.");
  if (rechnung.status === "entwurf") {
    throw new Error(
      "Rechnungs-Entwurf kann nicht versendet werden. Bitte zuerst festschreiben.",
    );
  }
  if (!rechnung.pdf) {
    throw new Error("Kein PDF an der Rechnung.");
  }
  if (!rechnung.kunde) {
    throw new Error("Rechnung hat keine:n Kund:in.");
  }

  const kunde = await getKontakt(firmaId, rechnung.kunde);
  if (!kunde) throw new Error("Kund:in nicht gefunden.");
  const to = opts?.to?.trim() || requireEmail(kunde.email, "Kund:in");

  const { response, filename } = await getRechnungPdfResponse(
    firmaId,
    rechnungId,
  );
  const pdf = await pdfBufferFromResponse(response);

  const attachments: Array<{
    filename: string;
    content: Buffer;
    contentType?: string;
  }> = [
    {
      filename,
      content: pdf,
      contentType: "application/pdf",
    },
  ];

  const versand = await listERechnungVersandForRechnung(firmaId, rechnungId);
  for (const v of versand) {
    try {
      const file = await getERechnungVersandDateiResponse(firmaId, v.id);
      attachments.push({
        filename: file.filename,
        content: await pdfBufferFromResponse(file.response),
        contentType: "application/xml",
      });
    } catch {
      /* PDF bleibt der Pflichtanhang */
    }
  }

  const nummer = rechnung.rechnungsnummer || "Rechnung";
  const subject = `Rechnung ${nummer}`;
  const text = [
    `Guten Tag${kunde.name ? ` ${kunde.name}` : ""},`,
    "",
    `anbei erhalten Sie die Rechnung ${nummer} vom ${formatDateDe(rechnung.rechnungsdatum)}.`,
    rechnung.faellig_am
      ? `Fällig am: ${formatDateDe(rechnung.faellig_am)}.`
      : "",
    `Betrag: ${formatMoneyDe(rechnung.betrag_brutto, { currency: true })}.`,
    versand.length
      ? "Im Anhang außerdem die strukturierte E-Rechnung (XML)."
      : "",
    "",
    "Mit freundlichen Grüßen",
  ]
    .filter(Boolean)
    .join("\n");

  const result = await sendMail({
    to,
    subject,
    text,
    attachments,
  });

  return { to, messageId: result.messageId };
}

/**
 * Angebot per E-Mail an Kund:in (PDF-Anhang).
 * PDF nach Senden vorhanden.
 */
export async function sendeAngebotPerMail(
  firmaId: string,
  angebotId: string,
  opts?: { to?: string },
): Promise<{ to: string; messageId: string }> {
  if (!isSmtpConfigured()) {
    throw new Error(SMTP_NOT_CONFIGURED_ERROR);
  }

  const angebot = await getAngebot(firmaId, angebotId);
  if (!angebot) throw new Error("Angebot nicht gefunden.");
  if (angebot.status === "entwurf") {
    throw new Error(
      "Angebots-Entwurf kann nicht per Mail versendet werden. Bitte zuerst senden (Nummer + PDF).",
    );
  }
  if (!angebot.pdf) {
    throw new Error("Kein PDF am Angebot.");
  }
  if (!angebot.kunde) {
    throw new Error("Angebot hat keine:n Kund:in.");
  }

  const kunde = await getKontakt(firmaId, angebot.kunde);
  if (!kunde) throw new Error("Kund:in nicht gefunden.");
  const to = opts?.to?.trim() || requireEmail(kunde.email, "Kund:in");

  const { response, filename } = await getAngebotPdfResponse(
    firmaId,
    angebotId,
  );
  const pdf = await pdfBufferFromResponse(response);

  const nummer = angebot.angebotsnummer || "Angebot";
  const subject = `Angebot ${nummer}`;
  const text = [
    `Guten Tag${kunde.name ? ` ${kunde.name}` : ""},`,
    "",
    `anbei erhalten Sie das Angebot ${nummer} vom ${formatDateDe(angebot.angebotsdatum)}.`,
    angebot.gueltig_bis
      ? `Gültig bis: ${formatDateDe(angebot.gueltig_bis)}.`
      : "",
    `Betrag: ${formatMoneyDe(angebot.betrag_brutto, { currency: true })}.`,
    "",
    "Mit freundlichen Grüßen",
  ]
    .filter(Boolean)
    .join("\n");

  const result = await sendMail({
    to,
    subject,
    text,
    attachments: [
      {
        filename,
        content: pdf,
        contentType: "application/pdf",
      },
    ],
  });

  return { to, messageId: result.messageId };
}

/**
 * Manuelle Zahlungserinnerung light (kein Mahnlauf, kein Status „Gemahnt“).
 * PDF der Rechnung als Anhang, sofern vorhanden.
 */
export async function sendeZahlungserinnerungPerMail(
  firmaId: string,
  rechnungId: string,
  opts?: { to?: string },
): Promise<{ to: string; messageId: string }> {
  if (!isSmtpConfigured()) {
    throw new Error(SMTP_NOT_CONFIGURED_ERROR);
  }

  const rechnung = await getRechnung(firmaId, rechnungId);
  if (!rechnung) throw new Error("Rechnung nicht gefunden.");
  if (rechnung.status === "entwurf") {
    throw new Error("Für Entwürfe gibt es keine Zahlungserinnerung.");
  }
  if (rechnung.status === "bezahlt") {
    throw new Error("Rechnung ist bereits bezahlt.");
  }
  if (rechnung.status === "storniert") {
    throw new Error("Stornierte Rechnung — keine Zahlungserinnerung.");
  }
  if (!rechnung.kunde) {
    throw new Error("Rechnung hat keine:n Kund:in.");
  }

  const kunde = await getKontakt(firmaId, rechnung.kunde);
  if (!kunde) throw new Error("Kund:in nicht gefunden.");
  const to = opts?.to?.trim() || requireEmail(kunde.email, "Kund:in");

  const nummer = rechnung.rechnungsnummer || "Rechnung";
  const subject = `Zahlungserinnerung: Rechnung ${nummer}`;
  const text = [
    `Guten Tag${kunde.name ? ` ${kunde.name}` : ""},`,
    "",
    `hiermit erinnern wir freundlich an die offene Rechnung ${nummer} vom ${formatDateDe(rechnung.rechnungsdatum)}.`,
    rechnung.faellig_am
      ? `Fällig am: ${formatDateDe(rechnung.faellig_am)}.`
      : "",
    `Offener Betrag (Brutto): ${formatMoneyDe(rechnung.betrag_brutto, { currency: true })}.`,
    "",
    "Bitte überweisen Sie den Betrag unter Angabe der Rechnungsnummer.",
    "",
    "Mit freundlichen Grüßen",
  ]
    .filter(Boolean)
    .join("\n");

  const attachments: Array<{
    filename: string;
    content: Buffer;
    contentType?: string;
  }> = [];

  if (rechnung.pdf) {
    try {
      const { response, filename } = await getRechnungPdfResponse(
        firmaId,
        rechnungId,
      );
      const pdf = await pdfBufferFromResponse(response);
      attachments.push({
        filename,
        content: pdf,
        contentType: "application/pdf",
      });
    } catch {
      /* Erinnerung auch ohne PDF möglich */
    }
  }

  const result = await sendMail({
    to,
    subject,
    text,
    attachments: attachments.length ? attachments : undefined,
  });

  return { to, messageId: result.messageId };
}

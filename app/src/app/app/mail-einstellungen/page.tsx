import { redirect } from "next/navigation";
import { requireInstanzEigentuemerSession } from "@/lib/session";
import { isCloud } from "@/lib/instance-context";
import { getMailSettingsStatus, saveMailSettingsAction, deleteMailSettingsAction } from "@/lib/mail-settings";
import { PageHeader } from "@/components/ui/page-header";

export const dynamic = "force-dynamic";

export default async function MailEinstellungenPage({ searchParams }: {
  searchParams: Promise<{ saved?: string; deleted?: string; error?: string }>;
}) {
  await requireInstanzEigentuemerSession();
  if (!isCloud()) redirect("/app/firma");
  const [status, params] = await Promise.all([getMailSettingsStatus(), searchParams]);
  return <main className="mx-auto flex max-w-2xl flex-col gap-6">
    <PageHeader title="Mailversand" description="Eigener SMTP-Zugang für Geschäftsmails dieser Kundeninstanz." />
    <p>Ohne eigenen SMTP-Zugang versendet Zettelruhe Angebote, Rechnungen und Erinnerungen
      mit einem Zettelruhe-Absender. Antworten gehen an die E-Mail-Adresse der aktiven Firma.
      Einladungen verschickt immer der Zettelruhe-Systemmailer.</p>
    {params.error && <p role="alert">Die SMTP-Einstellungen konnten nicht gespeichert werden. Bitte alle Angaben prüfen.</p>}
    {params.saved && <p role="status">SMTP-Einstellungen gespeichert.</p>}
    {params.deleted && <p role="status">Zettelruhe-Versand ist wieder aktiv.</p>}
    <p>Eigener SMTP-Zugang: {status.configured ? `aktiv (${status.host}:${status.port}, ${status.from})` : "nicht eingerichtet"}</p>
    <form action={saveMailSettingsAction} className="grid gap-4">
      <label>Host <input className="w-full rounded border p-2" name="host" required maxLength={253} defaultValue={status.host ?? ""} /></label>
      <label>Port <input className="w-full rounded border p-2" name="port" type="number" min="1" max="65535" required defaultValue={status.port ?? 587} /></label>
      <label>Verbindung <select className="w-full rounded border p-2" name="secure" defaultValue={String(status.secure ?? false)}>
        <option value="false">STARTTLS</option><option value="true">Implizites TLS</option>
      </select></label>
      <label>Benutzername <input className="w-full rounded border p-2" name="user" required maxLength={254} defaultValue={status.user ?? ""} /></label>
      <label>Passwort <input className="w-full rounded border p-2" name="password" type="password" required autoComplete="new-password" /></label>
      <label>Absenderadresse <input className="w-full rounded border p-2" name="from" type="email" required maxLength={254} defaultValue={status.from ?? ""} /></label>
      <label>Absendername <input className="w-full rounded border p-2" name="fromName" maxLength={200} defaultValue={status.fromName ?? ""} /></label>
      <p>Beim Speichern bitte das vollständige Passwort erneut eingeben. Es wird hier nie angezeigt.</p>
      <button className="rounded border px-4 py-2" type="submit">SMTP-Zugang speichern</button>
    </form>
    {status.configured && <form action={deleteMailSettingsAction}>
      <button className="rounded border px-4 py-2" type="submit">Eigenen SMTP-Zugang entfernen</button>
    </form>}
  </main>;
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { requireFirmaSession } from "@/lib/session";
import { getFirmaById } from "@/lib/pb";
import { formatMoneyDe } from "@/lib/money";
import {
  ANGEBOT_STATUS_LABELS,
  STEUERMODUS_LABELS,
  STEUERSATZ_LABELS,
  formatDateDe,
  formatDateTimeDe,
} from "@/lib/labels";
import { listKontakte, getKontakt } from "@/modules/contacts";
import { listKatalog } from "@/modules/catalog";
import {
  ANGEBOT_STATUS_TRANSITIONS,
  deleteAngebotAction,
  getAngebotMitPositionen,
  sendenAngebotAction,
  setAngebotStatusAction,
  uebernehmenAlsRechnungAction,
  updateAngebotAction,
  type AngebotStatus,
} from "@/modules/sales";
import {
  isSmtpConfigured,
  sendeAngebotMailAction,
} from "@/modules/jobs";
import { AngebotForm } from "@/modules/sales/angebot-form";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;
type SearchParams = Promise<{
  error?: string;
  saved?: string;
  gesendet?: string;
  status?: string;
  mail?: string;
  mailTo?: string;
}>;

function statusBadgeVariant(
  status: AngebotStatus,
): "default" | "secondary" | "success" | "outline" | "muted" {
  switch (status) {
    case "angenommen":
    case "abgerechnet":
      return "success";
    case "abgelehnt":
      return "muted";
    case "gesendet":
      return "default";
    case "abgelaufen":
      return "outline";
    default:
      return "secondary";
  }
}

export default async function AngebotDetailPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const session = await requireFirmaSession();
  const { id } = await params;
  const sp = await searchParams;

  const angebot = await getAngebotMitPositionen(session.firmaId, id);
  if (!angebot) notFound();

  const firma = await getFirmaById(session.firmaId);
  const steuermodus =
    angebot.status === "entwurf"
      ? (firma?.steuermodus ?? angebot.steuermodus)
      : angebot.steuermodus;
  const showUst = angebot.steuermodus === "regelbesteuerung_ist";

  const [kundenResult, katalogResult] = await Promise.all([
    listKontakte(session.firmaId, { rolle: "kunde" }, 1, 200),
    listKatalog(session.firmaId, { nurAktiv: true }, 1, 200),
  ]);

  const kunden = kundenResult.items.map((k) => ({
    id: k.id,
    name: k.name,
  }));
  const katalog = katalogResult.items.map((p) => ({
    id: p.id,
    bezeichnung: p.bezeichnung,
    einheit: p.einheit,
    preis: p.preis,
    steuersatz: p.steuersatz || "",
  }));

  let kundeName: string | null = null;
  if (angebot.kunde) {
    const k = await getKontakt(session.firmaId, angebot.kunde);
    kundeName = k?.name ?? null;
  }

  const istEntwurf = angebot.status === "entwurf";
  const title =
    angebot.angebotsnummer ||
    (istEntwurf ? "Angebots-Entwurf" : "Angebot");
  const nextStatuses = ANGEBOT_STATUS_TRANSITIONS[angebot.status] ?? [];

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8">
      <div>
        <p className="text-sm text-muted-foreground">
          <Link
            href="/app/angebote"
            className="hover:text-foreground hover:underline"
          >
            ← Angebote
          </Link>
        </p>
        <PageHeader
          className="mt-2"
          title={
            <span className="inline-flex flex-wrap items-center gap-2">
              {title}
              <Badge variant={statusBadgeVariant(angebot.status)}>
                {ANGEBOT_STATUS_LABELS[angebot.status]}
              </Badge>
            </span>
          }
          description={
            angebot.gesendet_am
              ? `Gesendet am ${formatDateTimeDe(angebot.gesendet_am)}`
              : "Entwurf — editierbar bis zum Senden. Keine Angebotsnummer vor dem Senden."
          }
        />
        {sp.error ? (
          <p className="mt-2 text-sm text-destructive">{sp.error}</p>
        ) : null}
        {sp.saved ? (
          <p className="mt-2 text-sm text-green-700 dark:text-green-400">
            Gespeichert.
          </p>
        ) : null}
        {sp.gesendet ? (
          <p className="mt-2 text-sm text-green-700 dark:text-green-400">
            Angebot gesendet: Nummer vergeben, Original-PDF erzeugt. E-Mail
            ist optional — Druck und Postweg gehen über das PDF. Kein
            Buchungsjournal (erst bei Rechnung).
          </p>
        ) : null}
        {sp.status ? (
          <p className="mt-2 text-sm text-green-700 dark:text-green-400">
            Status aktualisiert.
          </p>
        ) : null}
        {sp.mail ? (
          <p className="mt-2 text-sm text-green-700 dark:text-green-400">
            Angebot per E-Mail gesendet
            {sp.mailTo ? ` an ${sp.mailTo}` : ""}.
          </p>
        ) : null}
      </div>

      {!istEntwurf ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Angebot</CardTitle>
              <CardDescription>
                Inhalt und PDF sind nach dem Senden unveränderbar. Statuswechsel
                und Übernahme in Rechnung bleiben möglich.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-4 sm:grid-cols-2">
                {angebot.angebotsnummer ? (
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Angebotsnummer
                    </dt>
                    <dd className="mt-1 font-mono text-sm">
                      {angebot.angebotsnummer}
                    </dd>
                  </div>
                ) : null}
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Angebotsdatum
                  </dt>
                  <dd className="mt-1 text-sm">
                    {formatDateDe(angebot.angebotsdatum)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Kund:in
                  </dt>
                  <dd className="mt-1 text-sm">{kundeName || "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Gültig bis
                  </dt>
                  <dd className="mt-1 text-sm">
                    {angebot.gueltig_bis
                      ? formatDateDe(angebot.gueltig_bis)
                      : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Steuer-Modus
                  </dt>
                  <dd className="mt-1 text-sm">
                    {STEUERMODUS_LABELS[angebot.steuermodus]}
                  </dd>
                </div>
                {showUst ? (
                  <>
                    <div>
                      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Netto
                      </dt>
                      <dd className="mt-1 font-mono text-sm tabular-nums">
                        {formatMoneyDe(angebot.betrag_netto, {
                          currency: true,
                        })}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        USt
                      </dt>
                      <dd className="mt-1 font-mono text-sm tabular-nums">
                        {formatMoneyDe(angebot.betrag_ust, {
                          currency: true,
                        })}
                      </dd>
                    </div>
                  </>
                ) : null}
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {showUst ? "Brutto" : "Gesamt"}
                  </dt>
                  <dd className="mt-1 font-mono text-sm font-medium tabular-nums">
                    {formatMoneyDe(angebot.betrag_brutto, {
                      currency: true,
                    })}
                  </dd>
                </div>
                {angebot.notiz ? (
                  <div className="sm:col-span-2">
                    <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Notiz
                    </dt>
                    <dd className="mt-1 text-sm whitespace-pre-wrap">
                      {angebot.notiz}
                    </dd>
                  </div>
                ) : null}
                <div className="sm:col-span-2">
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Original-PDF
                  </dt>
                  <dd className="mt-2">
                    {angebot.pdf ? (
                      <Link
                        href={`/app/angebote/${angebot.id}/pdf`}
                        target="_blank"
                        rel="noreferrer"
                        className={cn(buttonVariants({ size: "sm" }))}
                      >
                        PDF ansehen / drucken
                      </Link>
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </dd>
                </div>
                {angebot.rechnung ? (
                  <div className="sm:col-span-2">
                    <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Rechnung
                    </dt>
                    <dd className="mt-1 text-sm">
                      <Link
                        href={`/app/rechnungen/${angebot.rechnung}`}
                        className="text-primary underline-offset-4 hover:underline"
                      >
                        Verknüpfte Rechnung öffnen
                      </Link>
                    </dd>
                  </div>
                ) : null}
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Positionen</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Bezeichnung</TableHead>
                    <TableHead className="text-right">Menge</TableHead>
                    <TableHead>Einh.</TableHead>
                    <TableHead className="text-right">Einzel</TableHead>
                    {showUst ? (
                      <TableHead className="text-right">USt</TableHead>
                    ) : null}
                    <TableHead className="text-right">Summe</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {angebot.positionen.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="text-sm">{p.bezeichnung}</TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {p.menge}
                      </TableCell>
                      <TableCell className="text-sm">
                        {p.einheit || "—"}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {formatMoneyDe(p.einzelpreis)}
                      </TableCell>
                      {showUst ? (
                        <TableCell className="text-right text-xs">
                          {p.steuersatz
                            ? (STEUERSATZ_LABELS[p.steuersatz] ??
                              p.steuersatz)
                            : "—"}
                        </TableCell>
                      ) : null}
                      <TableCell className="text-right font-mono text-xs">
                        {formatMoneyDe(
                          showUst ? p.betrag_netto : p.betrag_brutto,
                          { currency: true },
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>E-Mail (optional)</CardTitle>
              <CardDescription>
                Zusätzlich zum PDF. Für Postweg reicht „PDF ansehen / drucken“.
                {isSmtpConfigured()
                  ? " Versand an die Kontakt-E-Mail."
                  : " SMTP ist nicht konfiguriert (SMTP_HOST) — kein Mailversand."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form action={sendeAngebotMailAction}>
                <input type="hidden" name="id" value={id} />
                <Button
                  type="submit"
                  variant="secondary"
                  size="sm"
                  disabled={!isSmtpConfigured() || !angebot.pdf}
                >
                  Angebot per E-Mail
                </Button>
              </form>
            </CardContent>
          </Card>

          {nextStatuses.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Status ändern</CardTitle>
                <CardDescription>
                  Manuelle Übergänge light (kein Kundenportal).
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {nextStatuses.map((ziel) => (
                  <form key={ziel} action={setAngebotStatusAction}>
                    <input type="hidden" name="id" value={id} />
                    <input type="hidden" name="status" value={ziel} />
                    <Button type="submit" variant="secondary" size="sm">
                      {ANGEBOT_STATUS_LABELS[ziel]}
                    </Button>
                  </form>
                ))}
              </CardContent>
            </Card>
          ) : null}

          {angebot.status === "angenommen" && !angebot.rechnung ? (
            <Card>
              <CardHeader>
                <CardTitle>Als Rechnung übernehmen</CardTitle>
                <CardDescription>
                  Erzeugt einen Rechnungs-Entwurf mit denselben Positionen und
                  verknüpft das Angebot (Status Abgerechnet).
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form action={uebernehmenAlsRechnungAction}>
                  <input type="hidden" name="id" value={id} />
                  <Button type="submit">Als Rechnung übernehmen</Button>
                </form>
              </CardContent>
            </Card>
          ) : null}
        </>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Entwurf bearbeiten</CardTitle>
              <CardDescription>
                Speichern aktualisiert den Entwurf. Die Vorschau zeigt den
                zuletzt gespeicherten Stand. Senden vergibt die Nummer und
                erzeugt das Original-PDF (ohne Buchungsjournal).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AngebotForm
                action={updateAngebotAction}
                steuermodus={steuermodus}
                kunden={kunden}
                katalog={katalog}
                error={sp.error ?? null}
                angebot={angebot}
                mode="edit"
              />
            </CardContent>
          </Card>

          <Card className="border-primary/25">
            <CardHeader>
              <CardTitle>Vorschau / Druck (Entwurf)</CardTitle>
              <CardDescription>
                On-the-fly mit Wasserzeichen „Entwurf“. Keine Angebotsnummer,
                kein Verbrauch des Nummernkreises. Zeigt den zuletzt
                gespeicherten Entwurf.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!angebot.kunde ? (
                <p className="text-sm text-destructive">
                  Bitte zuerst eine:n Kund:in speichern, dann Vorschau öffnen.
                </p>
              ) : (
                <Link
                  href={`/app/angebote/${angebot.id}/pdf/vorschau`}
                  target="_blank"
                  rel="noreferrer"
                  className={cn(buttonVariants({ variant: "outline" }))}
                >
                  PDF-Vorschau öffnen
                </Link>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Senden</CardTitle>
              <CardDescription>
                Fachliches Abschließen: vergibt die Angebotsnummer, erzeugt das
                Original-PDF (ohne Wasserzeichen) und sperrt Inhalt und
                Dokument. Danach Druck, Postweg oder optional E-Mail. Kein
                Eintrag ins Buchungsjournal. SMTP ist nicht nötig.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {!angebot.kunde ? (
                <p className="text-sm text-destructive">
                  Bitte zuerst eine:n Kund:in speichern, dann senden.
                </p>
              ) : null}
              <form action={sendenAngebotAction}>
                <input type="hidden" name="id" value={id} />
                <Button type="submit" disabled={!angebot.kunde}>
                  Angebot senden
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Entwurf löschen</CardTitle>
              <CardDescription>
                Nur möglich, solange das Angebot nicht gesendet ist.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form action={deleteAngebotAction}>
                <input type="hidden" name="id" value={id} />
                <Button type="submit" variant="danger" size="sm">
                  Entwurf löschen
                </Button>
              </form>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

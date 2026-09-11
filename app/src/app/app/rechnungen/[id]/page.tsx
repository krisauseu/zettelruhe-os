import { neueFinanzRecordId } from "@/lib/finanz-transaktion";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireFirmaSession } from "@/lib/session";
import { getFirmaById } from "@/lib/pb";
import { formatMoneyDe, money } from "@/lib/money";
import {
  RECHNUNG_STATUS_LABELS,
  STEUERMODUS_LABELS,
  STEUERSATZ_LABELS,
  ZAHLUNGSWEG_LABELS,
  formatDateDe,
  formatDateTimeDe,
} from "@/lib/labels";
import { listKontakte, getKontakt } from "@/modules/contacts";
import { listKatalog } from "@/modules/catalog";
import {
  createZahlungAction,
  deleteZahlungAction,
  getZahlungsstand,
  refreshRechnungZahlungsstatus,
  todayBerlin,
} from "@/modules/payments";
import { ZahlungForm } from "@/modules/payments/zahlung-form";
import {
  deleteRechnungAction,
  festschreibenRechnungAction,
  getRechnungMitPositionen,
  storniereRechnungAction,
  updateRechnungAction,
} from "@/modules/sales";
import { ConfirmForm } from "@/components/ui/confirm-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { listBankkonten } from "@/modules/banking";
import {
  ERechnungVersandCard,
  listERechnungVersandForRechnung,
  parseSendProfil,
} from "@/modules/einvoice";
import {
  isSmtpConfigured,
  sendeRechnungMailAction,
  sendeZahlungserinnerungAction,
} from "@/modules/jobs";
import { RechnungForm } from "@/modules/sales/rechnung-form";
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
  festgeschrieben?: string;
  zahlung?: string;
  zahlungGeloescht?: string;
  vorgang?: string;
  mail?: string;
  mailTo?: string;
  erinnerung?: string;
  storniert?: string;
  erechnung?: string;
  erechnungOk?: string;
  erechnungProfil?: string;
}>;

function statusBadgeVariant(
  status: string,
): "success" | "secondary" | "default" | "muted" | "outline" | "warning" | "danger" {
  switch (status) {
    case "bezahlt":
      return "success";
    case "teilbezahlt":
      return "default";
    case "ueberfaellig":
      return "warning";
    case "offen":
      return "default";
    case "storniert":
      return "danger";
    default:
      return "secondary";
  }
}

export default async function RechnungDetailPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const session = await requireFirmaSession();
  const { id } = await params;
  const sp = await searchParams;

  // Überfälligkeit light nachziehen (Status-Feld, kein Inhalts-Edit)
  await refreshRechnungZahlungsstatus(session.firmaId, id);

  const rechnung = await getRechnungMitPositionen(session.firmaId, id);
  if (!rechnung) notFound();

  const firma = await getFirmaById(session.firmaId);
  const steuermodus =
    rechnung.status === "entwurf"
      ? (firma?.steuermodus ?? rechnung.steuermodus)
      : rechnung.steuermodus;
  const showUst = rechnung.steuermodus === "regelbesteuerung_ist";

  const [kundenResult, katalogResult, zahlungsstand, bankkontenResult, versand] =
    await Promise.all([
      listKontakte(session.firmaId, { rolle: "kunde" }, 1, 200),
      listKatalog(session.firmaId, { nurAktiv: true }, 1, 200),
      rechnung.status !== "entwurf"
        ? getZahlungsstand(session.firmaId, id)
        : Promise.resolve(null),
      rechnung.status !== "entwurf"
        ? listBankkonten(session.firmaId, { aktiv: true }, 1, 50)
        : Promise.resolve({ items: [] }),
      rechnung.status !== "entwurf"
        ? listERechnungVersandForRechnung(session.firmaId, id)
        : Promise.resolve([]),
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
  if (rechnung.kunde) {
    const k = await getKontakt(session.firmaId, rechnung.kunde);
    kundeName = k?.name ?? null;
  }

  const istEntwurf = rechnung.status === "entwurf";
  const kannZahlung =
    !istEntwurf &&
    rechnung.status !== "bezahlt" &&
    rechnung.status !== "storniert" &&
    zahlungsstand != null &&
    money(zahlungsstand.offen).gt(0);
  const title =
    rechnung.rechnungsnummer ||
    (istEntwurf ? "Rechnungs-Entwurf" : "Rechnung");

  // Restbetrag als de-DE Vorschlag im Formular
  const restVorschlag = zahlungsstand
    ? formatMoneyDe(zahlungsstand.offen)
    : "";

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8">
      <div>
        <p className="text-sm text-muted-foreground">
          <Link
            href="/app/rechnungen"
            className="hover:text-foreground hover:underline"
          >
            ← Rechnungen
          </Link>
        </p>
        <PageHeader
          className="mt-2"
          title={
            <span className="inline-flex flex-wrap items-center gap-2">
              {title}
              <Badge variant={statusBadgeVariant(rechnung.status)}>
                {RECHNUNG_STATUS_LABELS[rechnung.status]}
              </Badge>
            </span>
          }
          description={
            rechnung.festgeschrieben_am
              ? `Festgeschrieben am ${formatDateTimeDe(rechnung.festgeschrieben_am)}`
              : "Entwurf — editierbar bis zur Festschreibung. Keine Rechnungsnummer vor der Festschreibung."
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
        {sp.festgeschrieben ? (
          <p className="mt-2 text-sm text-green-700 dark:text-green-400">
            Rechnung festgeschrieben: Nummer vergeben, PDF erzeugt,
            Buchungsjournal geschrieben.
          </p>
        ) : null}
        {sp.zahlung ? (
          <p className="mt-2 text-sm text-green-700 dark:text-green-400">
            Zahlung erfasst. Offener Betrag und Status aktualisiert.
          </p>
        ) : null}
        {sp.zahlungGeloescht ? (
          <p className="mt-2 text-sm text-green-700 dark:text-green-400">
            Zahlung gelöscht. Status neu abgeleitet.
          </p>
        ) : null}
        {sp.mail ? (
          <p className="mt-2 text-sm text-green-700 dark:text-green-400">
            Rechnung per E-Mail gesendet
            {sp.mailTo ? ` an ${sp.mailTo}` : ""}.
          </p>
        ) : null}
        {sp.erinnerung ? (
          <p className="mt-2 text-sm text-green-700 dark:text-green-400">
            Zahlungserinnerung gesendet
            {sp.mailTo ? ` an ${sp.mailTo}` : ""}.
          </p>
        ) : null}
        {sp.storniert ? (
          <p className="mt-2 text-sm text-success">
            Rechnung storniert. Gegenbuchung im Journal erzeugt.
          </p>
        ) : null}
        {sp.erechnung ? (
          <p className="mt-2 text-sm text-green-700 dark:text-green-400">
            E-Rechnung erzeugt und unveränderbar archiviert.
          </p>
        ) : null}
      </div>

      {!istEntwurf ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Rechnung</CardTitle>
              <CardDescription>
                Nur Lesen — festgeschriebene Rechnungen und PDFs sind
                unveränderbar. Zahlungen werden separat erfasst; Korrekturen
                am Dokument später über Gutschrift/Storno.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-4 sm:grid-cols-2">
                {rechnung.rechnungsnummer ? (
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Rechnungsnummer
                    </dt>
                    <dd className="mt-1 font-mono text-sm">
                      {rechnung.rechnungsnummer}
                    </dd>
                  </div>
                ) : null}
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Rechnungsdatum
                  </dt>
                  <dd className="mt-1 text-sm">
                    {formatDateDe(rechnung.rechnungsdatum)}
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
                    Fällig am
                  </dt>
                  <dd className="mt-1 text-sm">
                    {rechnung.faellig_am
                      ? formatDateDe(rechnung.faellig_am)
                      : "—"}
                  </dd>
                </div>
                {(rechnung.leistungszeitraum_von ||
                  rechnung.leistungszeitraum_bis) && (
                  <div className="sm:col-span-2">
                    <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Leistungszeitraum
                    </dt>
                    <dd className="mt-1 text-sm">
                      {formatDateDe(
                        rechnung.leistungszeitraum_von ||
                          rechnung.rechnungsdatum,
                      )}
                      {" – "}
                      {formatDateDe(
                        rechnung.leistungszeitraum_bis ||
                          rechnung.leistungszeitraum_von ||
                          rechnung.rechnungsdatum,
                      )}
                    </dd>
                  </div>
                )}
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Steuer-Modus
                  </dt>
                  <dd className="mt-1 text-sm">
                    {STEUERMODUS_LABELS[rechnung.steuermodus]}
                  </dd>
                </div>
                {showUst ? (
                  <>
                    <div>
                      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Netto
                      </dt>
                      <dd className="mt-1 font-mono text-sm tabular-nums">
                        {formatMoneyDe(rechnung.betrag_netto, {
                          currency: true,
                        })}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        USt
                      </dt>
                      <dd className="mt-1 font-mono text-sm tabular-nums">
                        {formatMoneyDe(rechnung.betrag_ust, {
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
                    {formatMoneyDe(rechnung.betrag_brutto, {
                      currency: true,
                    })}
                  </dd>
                </div>
                {rechnung.notiz ? (
                  <div className="sm:col-span-2">
                    <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Notiz
                    </dt>
                    <dd className="mt-1 text-sm whitespace-pre-wrap">
                      {rechnung.notiz}
                    </dd>
                  </div>
                ) : null}
                <div className="sm:col-span-2">
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Original-PDF
                  </dt>
                  <dd className="mt-2">
                    {rechnung.pdf ? (
                      <Link
                        href={`/app/rechnungen/${rechnung.id}/pdf`}
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
                {rechnung.journal_eintrag ? (
                  <div className="sm:col-span-2">
                    <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Buchungsjournal
                    </dt>
                    <dd className="mt-1 text-sm">
                      <Link
                        href={`/app/journal/${rechnung.journal_eintrag}`}
                        className="text-primary underline-offset-4 hover:underline"
                      >
                        Journal-Eintrag öffnen
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
                  {rechnung.positionen.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="text-sm">
                        {p.bezeichnung}
                        {p.description?.trim() ? (
                          <p className="whitespace-pre-wrap text-xs text-muted-foreground">{p.description}</p>
                        ) : null}
                      </TableCell>
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

          <ERechnungVersandCard
            rechnungId={id}
            versand={versand}
            bankkonten={bankkontenResult.items}
            defaultProfil={parseSendProfil(sp.erechnungProfil ?? "")}
            geprueft={Boolean(sp.erechnungOk)}
          />

          <Card>
            <CardHeader>
              <CardTitle>E-Mail (optional)</CardTitle>
              <CardDescription>
                Zusätzlich zum Original-PDF und ggf. erzeugter E-Rechnung. Für
                Postweg reicht „PDF ansehen / drucken“.
                {(await isSmtpConfigured())
                  ? " Versand an die Kontakt-E-Mail."
                  : " SMTP ist nicht konfiguriert (SMTP_HOST) — kein Mailversand."}{" "}
                Zahlungserinnerung manuell, kein Mahnlauf.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <form action={sendeRechnungMailAction}>
                <input type="hidden" name="id" value={id} />
                <Button
                  type="submit"
                  variant="secondary"
                  size="sm"
                  disabled={!(await isSmtpConfigured()) || !rechnung.pdf}
                >
                  Rechnung per E-Mail
                </Button>
              </form>
              {rechnung.status !== "bezahlt" &&
              rechnung.status !== "storniert" ? (
                <form action={sendeZahlungserinnerungAction}>
                  <input type="hidden" name="id" value={id} />
                  <Button
                    type="submit"
                    variant="secondary"
                    size="sm"
                    disabled={!(await isSmtpConfigured())}
                  >
                    Zahlungserinnerung
                  </Button>
                </form>
              ) : null}
            </CardContent>
          </Card>

          {zahlungsstand ? (
            <Card id="zahlung" className="scroll-mt-6">
              <CardHeader>
                <CardTitle>Zahlungen</CardTitle>
                <CardDescription>
                  Manuelle Zahlungen und Teilzahlungen. Offener Betrag =
                  Rechnungs-Brutto abzüglich erfasster Zahlungen. Jede Zahlung
                  erzeugt eine Zufluss-Buchung im Journal (Ist-Versteuerung /
                  EÜR). Löschen storniert diese Buchung.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <dl className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Rechnungs-Brutto
                    </dt>
                    <dd className="mt-1 font-mono text-sm tabular-nums">
                      {formatMoneyDe(zahlungsstand.brutto, {
                        currency: true,
                      })}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Bezahlt
                    </dt>
                    <dd className="mt-1 font-mono text-sm tabular-nums">
                      {formatMoneyDe(zahlungsstand.bezahlt, {
                        currency: true,
                      })}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Offen
                    </dt>
                    <dd className="mt-1 font-mono text-sm font-medium tabular-nums">
                      {formatMoneyDe(zahlungsstand.offen, {
                        currency: true,
                      })}
                    </dd>
                  </div>
                </dl>

                {zahlungsstand.zahlungen.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead>Datum</TableHead>
                        <TableHead>Weg</TableHead>
                        <TableHead>Notiz</TableHead>
                        <TableHead className="text-right">Betrag</TableHead>
                        <TableHead className="w-24" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {zahlungsstand.zahlungen.map((z) => (
                        <TableRow key={z.id}>
                          <TableCell className="whitespace-nowrap text-sm">
                            {formatDateDe(z.datum)}
                          </TableCell>
                          <TableCell className="text-sm">
                            {z.zahlungsweg
                              ? (ZAHLUNGSWEG_LABELS[z.zahlungsweg] ??
                                z.zahlungsweg)
                              : "—"}
                          </TableCell>
                          <TableCell className="max-w-[12rem] truncate text-sm text-muted-foreground">
                            {z.notiz || "—"}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs tabular-nums">
                            {formatMoneyDe(z.betrag, { currency: true })}
                          </TableCell>
                          <TableCell className="text-right">
                            <form action={deleteZahlungAction}>
                              <input type="hidden" name="id" value={z.id} />
                              <input
                                type="hidden"
                                name="rechnung"
                                value={id}
                              />
                              <Button
                                type="submit"
                                variant="ghost"
                                size="sm"
                                className="text-destructive"
                              >
                                Löschen
                              </Button>
                            </form>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Noch keine Zahlungen erfasst.
                  </p>
                )}

                {kannZahlung ? (
                  <div className="border-t border-border pt-4">
                    <h3 className="mb-3 text-sm font-medium">
                      Zahlung erfassen
                    </h3>
                    <ZahlungForm
                      action={createZahlungAction}
                      rechnungId={id}
                      vorgangId={sp.vorgang && /^[a-z0-9]{15}$/.test(sp.vorgang) ? sp.vorgang : neueFinanzRecordId()}
                      restBetragVorschlag={restVorschlag}
                      defaultDatum={todayBerlin()}
                      error={sp.error ?? null}
                    />
                  </div>
                ) : rechnung.status === "bezahlt" ? (
                  <p className="text-sm text-muted-foreground">
                    Rechnung vollständig bezahlt.
                  </p>
                ) : rechnung.status === "storniert" ? (
                  <p className="text-sm text-muted-foreground">
                    Stornierte Rechnungen nehmen keine Zahlungen an.
                  </p>
                ) : null}
              </CardContent>
            </Card>
          ) : null}

          {rechnung.status !== "storniert" ? (
            <Card>
              <CardHeader>
                <CardTitle>Storno</CardTitle>
                <CardDescription>
                  Erzeugt Gegenbuchungen zur Rechnungs- und zu den
                  Zahlungsbuchungen und setzt den Status auf storniert. Die
                  Originalrechnung und das PDF bleiben erhalten.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ConfirmForm
                  action={storniereRechnungAction}
                  title="Rechnung stornieren?"
                  message={`Rechnung ${rechnung.rechnungsnummer || ""} wird storniert. Es entstehen Gegenbuchungen zur Rechnungs- und zu den Zahlungsbuchungen; das Original bleibt unverändert.`}
                  confirmLabel="Jetzt stornieren"
                  className="flex flex-col gap-4"
                >
                  <input type="hidden" name="id" value={id} />
                  <div className="flex max-w-xs flex-col gap-1.5">
                    <Label htmlFor="buchungsdatum">Buchungsdatum Storno</Label>
                    <Input
                      id="buchungsdatum"
                      name="buchungsdatum"
                      type="date"
                      defaultValue={todayBerlin()}
                    />
                  </div>
                  <div>
                    <Button type="submit" variant="danger" size="sm">
                      Rechnung stornieren
                    </Button>
                  </div>
                </ConfirmForm>
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
                zuletzt gespeicherten Stand. Festschreiben vergibt die Nummer,
                erzeugt das Original-PDF und schreibt ins Buchungsjournal.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RechnungForm
                action={updateRechnungAction}
                steuermodus={steuermodus}
                kunden={kunden}
                katalog={katalog}
                error={sp.error ?? null}
                rechnung={rechnung}
                mode="edit"
              />
            </CardContent>
          </Card>

          <Card className="border-primary/25">
            <CardHeader>
              <CardTitle>Vorschau / Druck (Entwurf)</CardTitle>
              <CardDescription>
                On-the-fly mit Wasserzeichen „Entwurf“. Keine Rechnungsnummer,
                kein Journal, kein Verbrauch des Nummernkreises. Nach der
                Festschreibung gibt es nur noch das Original-PDF.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!rechnung.kunde ? (
                <p className="text-sm text-destructive">
                  Bitte zuerst eine:n Kund:in speichern, dann Vorschau öffnen.
                </p>
              ) : (
                <Link
                  href={`/app/rechnungen/${rechnung.id}/pdf/vorschau`}
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
              <CardTitle>Festschreiben</CardTitle>
              <CardDescription>
                Vergibt die Rechnungsnummer aus dem Nummernkreis, erzeugt das
                Original-PDF (ohne Wasserzeichen), schreibt eine Einnahme ins
                Buchungsjournal und sperrt danach Dokument und Metadaten
                (GoBD-Mindeststandard). Die E-Rechnung (XML) kommt danach auf
                der festgeschriebenen Rechnung — sie ersetzt das PDF nicht.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {!rechnung.kunde ? (
                <p className="text-sm text-destructive">
                  Bitte zuerst eine:n Kund:in speichern, dann festschreiben.
                </p>
              ) : null}
              <form action={festschreibenRechnungAction}>
                <input type="hidden" name="id" value={id} />
                <Button type="submit" disabled={!rechnung.kunde}>
                  Rechnung festschreiben
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Entwurf löschen</CardTitle>
              <CardDescription>
                Nur möglich, solange die Rechnung nicht festgeschrieben ist.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form action={deleteRechnungAction}>
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

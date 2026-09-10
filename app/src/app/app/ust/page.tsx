import Link from "next/link";
import { requireFirmaSession } from "@/lib/session";
import { formatMoneyDe } from "@/lib/money";
import { formatDateDe, STEUERMODUS_LABELS, STEUERSATZ_LABELS } from "@/lib/labels";
import {
  USTVA_FORMAT_ID,
  getUstvaSeite,
  zeitraumFromSearchParams,
} from "@/modules/reporting";
import { ZeitraumFilter } from "@/modules/reporting/zeitraum-filter";
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
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { cn } from "@/lib/utils";
import type { UstvaKennzahlZeile } from "@/modules/reporting";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  preset?: string;
  von?: string;
  bis?: string;
}>;

function satzLabel(s: string): string {
  if (s === "ohne") return "ohne Satz";
  return STEUERSATZ_LABELS[s] ?? s;
}

function qs(preset: string, von: string, bis: string): string {
  return new URLSearchParams({ preset, von, bis }).toString();
}

function eintragAnzeige(z: UstvaKennzahlZeile): string {
  if (z.eintrag == null) return "—";
  if (z.eintrag_einheit === "euro_ganz") {
    return formatMoneyDe(z.eintrag, { currency: true, decimals: 0 });
  }
  return formatMoneyDe(z.eintrag, { currency: true });
}

export default async function UstPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await requireFirmaSession();
  const sp = await searchParams;
  const preset = (sp.preset ?? "monat").trim() || "monat";
  const zeitraum = zeitraumFromSearchParams(sp);
  const { ust, ustva } = await getUstvaSeite(session.firmaId, zeitraum);
  const downloadQs = qs(preset, zeitraum.von, zeitraum.bis);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <PageHeader
        title="USt-Übersicht"
        description={
          <>
            Vorbereitung Mein Elster — Werte selbst eintragen oder XML lokal
            speichern, kein Versand · {formatDateDe(zeitraum.von)} –{" "}
            {formatDateDe(zeitraum.bis)}
          </>
        }
      />

      <Card variant="muted">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Zeitraum</CardTitle>
          <CardDescription>
            Steuer-Modus: {STEUERMODUS_LABELS[ust.steuermodus]}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ZeitraumFilter zeitraum={zeitraum} preset={preset} />
        </CardContent>
      </Card>

      {!ust.verfuegbar ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Kein USt-Arbeitsfall im gewählten Zeitraum
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <p>{ust.hinweis}</p>
            <p className="mt-3">
              Die EÜR steht weiterhin unter{" "}
              <a href="/app/eur" className="text-primary hover:underline">
                EÜR
              </a>{" "}
              zur Verfügung.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Umsatzsteuer</CardDescription>
                <CardTitle className="text-xl tabular-nums">
                  {formatMoneyDe(ust.summe_ust_einnahmen, { currency: true })}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Vorsteuer</CardDescription>
                <CardTitle className="text-xl tabular-nums">
                  {formatMoneyDe(ust.summe_vorsteuer, { currency: true })}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Zahllast light</CardDescription>
                <CardTitle className="text-xl tabular-nums">
                  {formatMoneyDe(ust.zahllast, { currency: true })}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">
                Normale USt minus Kz 66 plus RC-Schuld minus Kz 67
              </CardContent>
            </Card>
          </div>

          {ust.reverse_charge.vorhanden ? (
            <Card className="overflow-hidden">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Reverse Charge im Steuerzeitraum</CardTitle>
                <CardDescription>
                  Auswahl nach dem gespeicherten Steuerdatum, nicht nach Rechnungs- oder Zahlungsmonat. Die Beträge stammen aus den unveränderbaren Journal-Schnappschüssen.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Fall</TableHead>
                      <TableHead className="text-right">Grundlage</TableHead>
                      <TableHead className="text-right">Steuerschuld</TableHead>
                      <TableHead className="text-right">Abziehbare Vorsteuer</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell>EU-Dienstleistung · Kz 46/47</TableCell>
                      <TableCell className="text-right tabular-nums">{formatMoneyDe(ust.reverse_charge.grundlage_eu, { currency: true })}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatMoneyDe(ust.reverse_charge.schuld_eu, { currency: true })}</TableCell>
                      <TableCell className="text-right tabular-nums" rowSpan={2}>{formatMoneyDe(ust.reverse_charge.vorsteuer, { currency: true })} · Kz 67 gesamt</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Drittlandsdienstleistung · Kz 84/85</TableCell>
                      <TableCell className="text-right tabular-nums">{formatMoneyDe(ust.reverse_charge.grundlage_drittland, { currency: true })}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatMoneyDe(ust.reverse_charge.schuld_drittland, { currency: true })}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
                <p className="border-t p-4 text-xs text-muted-foreground">
                  {ust.steuermodus === "kleinunternehmer"
                    ? "§ 19 UStG schließt die RC-Steuerschuld nicht aus. Im unterstützten Kleinunternehmerfall bleibt Kz 67 null; Erklärung und Zahlung können erforderlich sein."
                    : "Kz 67 enthält nur die beim jeweiligen Beleg gespeicherte volle Abzugsberechtigung. Ausgeschlossener Abzug bleibt null."}
                </p>
              </CardContent>
            </Card>
          ) : null}

          <Card className="overflow-hidden">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Nach Steuersatz</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {ust.zeilen.length === 0 ? (
                <p className="p-6 text-sm text-muted-foreground">
                  Keine Journal-Buchungen mit USt im Zeitraum.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Steuersatz</TableHead>
                      <TableHead className="text-right">
                        Netto Einnahmen
                      </TableHead>
                      <TableHead className="text-right">USt</TableHead>
                      <TableHead className="text-right">
                        Netto Ausgaben
                      </TableHead>
                      <TableHead className="text-right">Vorsteuer</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ust.zeilen.map((z) => (
                      <TableRow key={z.steuersatz}>
                        <TableCell className="font-medium">
                          {satzLabel(z.steuersatz)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatMoneyDe(z.netto_einnahmen, { currency: true })}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatMoneyDe(z.ust_einnahmen, { currency: true })}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatMoneyDe(z.netto_ausgaben, { currency: true })}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatMoneyDe(z.vorsteuer, { currency: true })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <CardTitle className="text-base">
                    UStVA-Kennzahlen (Self-File)
                  </CardTitle>
                  <CardDescription className="mt-1">
                    {ustva.voranmeldung.label}
                    {ustva.voranmeldung.zeitraum_code
                      ? ` · Zeitraum-Code ${ustva.voranmeldung.zeitraum_code}`
                      : ""}
                    {" · "}
                    Format{" "}
                    <code className="text-xs">{USTVA_FORMAT_ID}</code>
                  </CardDescription>
                  {!ustva.xml_download_erlaubt ? (
                    <p className="mt-2 text-xs text-muted-foreground">
                      {ustva.xml_blockgrund}
                    </p>
                  ) : null}
                </div>
                {ustva.xml_download_erlaubt ? (
                  <Link
                    href={`/app/ust/elster-xml?${downloadQs}`}
                    className={cn(buttonVariants({ size: "sm" }))}
                  >
                    ELSTER-XML light herunterladen
                  </Link>
                ) : null}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Kz</TableHead>
                    <TableHead>Bezeichnung</TableHead>
                    <TableHead className="text-right">
                      Eintrag Mein Elster
                    </TableHead>
                    <TableHead className="text-right">Journal</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ustva.kennzahlen.map((z) => (
                    <TableRow key={z.kz}>
                      <TableCell className="font-medium tabular-nums">
                        {z.kz}
                      </TableCell>
                      <TableCell className="max-w-sm text-sm">
                        {z.bezeichnung}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {eintragAnzeige(z)}
                      </TableCell>
                      <TableCell className="text-right text-xs tabular-nums text-muted-foreground">
                        {z.journal_netto
                          ? `Netto ${formatMoneyDe(z.journal_netto, { currency: true })}`
                          : null}
                        {z.journal_netto && z.journal_ust ? <br /> : null}
                        {z.journal_ust
                          ? `${z.kz === "83" ? "Zahllast" : "USt"} ${formatMoneyDe(z.journal_ust, { currency: true })}`
                          : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="success">befüllt</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {ustva.nicht_gefuehrt.length > 0 ? (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Nicht geführt</CardTitle>
                <CardDescription>
                  Diese typischen UStVA-Felder kann das Journal nicht ehrlich
                  füllen — nichts erfunden, nicht in der XML.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1.5 text-sm text-muted-foreground">
                  {ustva.nicht_gefuehrt.map((n) => (
                    <li key={n.kz}>
                      <span className="font-medium text-foreground">
                        Kz {n.kz}
                      </span>
                      {" — "}
                      {n.bezeichnung}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : null}

          {!ustva.firma.steuernummer && ustva.xml_download_erlaubt ? (
            <p className="text-sm text-muted-foreground">
              Keine Steuernummer an der Firma — XML ohne{" "}
              <code className="text-xs">Steuernummer</code>. In Mein Elster
              nachtragen; die Elster-Steuernummer steht unter{" "}
              <a href="/app/firma" className="text-primary hover:underline">
                Firma
              </a>
              .
            </p>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Hinweis</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>{ustva.hinweis}</p>
              <p>{ust.hinweis}</p>
              <p>
                0-USt-Einnahmen an Kontakte im übrigen EU-Gebiet stehen als
                Kandidaten (ohne Art) in der{" "}
                <Link
                  href={`/app/zm?${downloadQs}`}
                  className="text-primary hover:underline"
                >
                  ZM-Übersicht
                </Link>
                — nicht als UStVA-Kz 41.
              </p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

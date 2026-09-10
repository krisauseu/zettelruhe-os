import Link from "next/link";
import { requireFirmaSession } from "@/lib/session";
import { formatMoneyDe } from "@/lib/money";
import {
  formatDateDe,
  QUELLE_TYP_LABELS,
  STEUERMODUS_LABELS,
} from "@/lib/labels";
import {
  ZM_FORMAT_ID,
  getZmUebersicht,
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
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { cn } from "@/lib/utils";
import type { ZmLandGruppe } from "@/modules/reporting/types";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  preset?: string;
  von?: string;
  bis?: string;
}>;

function qs(preset: string, von: string, bis: string): string {
  return new URLSearchParams({ preset, von, bis }).toString();
}

function landGruppeLabel(g: ZmLandGruppe): string {
  if (g === "eu_ohne_de") return "übriges EU-Gebiet";
  if (g === "de") return "Deutschland";
  if (g === "drittland") return "Drittland";
  return "unbekannt";
}

export default async function ZmPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await requireFirmaSession();
  const sp = await searchParams;
  const preset = (sp.preset ?? "monat").trim() || "monat";
  const zeitraum = zeitraumFromSearchParams(sp);
  const zm = await getZmUebersicht(session.firmaId, zeitraum);
  const downloadQs = qs(preset, zeitraum.von, zeitraum.bis);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <PageHeader
        title="Zusammenfassende Meldung"
        description={
          <>
            Vorbereitung Mein Elster — Werte selbst eintragen, kein Versand ·{" "}
            {formatDateDe(zeitraum.von)} – {formatDateDe(zeitraum.bis)}
          </>
        }
      />

      <Card variant="muted">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Zeitraum</CardTitle>
          <CardDescription>
            Steuer-Modus: {STEUERMODUS_LABELS[zm.steuermodus]}
            {zm.verfuegbar ? ` · ${zm.meldezeitraum.label}` : ""}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ZeitraumFilter zeitraum={zeitraum} preset={preset} />
        </CardContent>
      </Card>

      {!zm.verfuegbar ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Nicht relevant unter Kleinunternehmerregelung
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <p>{zm.hinweis}</p>
            <p className="mt-3">
              Die EÜR steht weiterhin unter{" "}
              <Link href="/app/eur" className="text-primary hover:underline">
                EÜR
              </Link>{" "}
              zur Verfügung.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Kandidaten (Journal-Netto)</CardDescription>
                <CardTitle className="text-xl tabular-nums">
                  {formatMoneyDe(zm.summe_kandidaten_netto, { currency: true })}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">
                Eintrag light {zm.summe_kandidaten_euro_ganz} € (volle Euro)
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Kontakte (Kandidaten)</CardDescription>
                <CardTitle className="text-xl tabular-nums">
                  {zm.kandidaten.length}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Andere 0-USt-Einnahmen</CardDescription>
                <CardTitle className="text-xl tabular-nums">
                  {formatMoneyDe(zm.summe_andere_netto, { currency: true })}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">
                DE, Drittland oder ohne EU-Land — nicht als ZM geraten
              </CardContent>
            </Card>
          </div>

          <Card className="overflow-hidden">
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <CardTitle className="text-base">
                    Kandidaten je Kontakt
                  </CardTitle>
                  <CardDescription className="mt-1">
                    0-USt-Einnahmen an Kontakte im übrigen EU-Gebiet · Art nicht
                    geführt · Format{" "}
                    <code className="text-xs">{ZM_FORMAT_ID}</code>
                  </CardDescription>
                </div>
                {zm.csv_download_erlaubt ? (
                  <Link
                    href={`/app/zm/csv?${downloadQs}`}
                    className={cn(buttonVariants({ size: "sm" }))}
                  >
                    CSV light herunterladen
                  </Link>
                ) : null}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {zm.kandidaten.length === 0 ? (
                <EmptyState
                  title="Keine ZM-Kandidaten im Zeitraum"
                  description="Es gibt keine 0-USt-Einnahmen an Kontakte mit Land im übrigen EU-Gebiet. Das ist keine Nullmeldung — nur: nichts, das wir ehrlich als Kandidat führen können."
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Kontakt</TableHead>
                      <TableHead>Land</TableHead>
                      <TableHead>USt-IdNr.</TableHead>
                      <TableHead>Art</TableHead>
                      <TableHead className="text-right">Journal</TableHead>
                      <TableHead className="text-right">
                        Eintrag Mein Elster
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {zm.kandidaten.map((k) => (
                      <TableRow key={k.kontakt_id}>
                        <TableCell className="font-medium">
                          <Link
                            href={`/app/kontakte/${k.kontakt_id}`}
                            className="text-primary hover:underline"
                          >
                            {k.kontakt_name}
                          </Link>
                          <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                            {k.anzahl_buchungen} Buchung
                            {k.anzahl_buchungen === 1 ? "" : "en"}
                          </span>
                        </TableCell>
                        <TableCell className="tabular-nums">{k.land}</TableCell>
                        <TableCell>
                          {k.ust_id_status === "pruefung_snapshot" ? (
                            <>
                              <span className="tabular-nums">
                                {k.ust_id || k.ust_id_notiz}
                              </span>
                              <Badge variant="secondary" className="ml-2">
                                {k.ust_id_pruefung_status} zum
                                Anfragezeitpunkt
                              </Badge>
                            </>
                          ) : k.ust_id_status === "stamm_ungeprueft" ? (
                            <>
                              <span className="tabular-nums">{k.ust_id}</span>
                              <Badge variant="warning" className="ml-2">
                                Stamm, ungeprüft
                              </Badge>
                            </>
                          ) : k.ust_id_status === "notiz_ungeprueft" ? (
                            <>
                              <span className="tabular-nums">
                                {k.ust_id_notiz}
                              </span>
                              <Badge variant="warning" className="ml-2">
                                Notiz, ungeprüft
                              </Badge>
                            </>
                          ) : (
                            <Badge variant="muted">nicht geführt</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="muted">nicht geführt</Badge>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatMoneyDe(k.journal_netto, { currency: true })}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatMoneyDe(k.eintrag_euro_ganz, {
                            currency: true,
                            decimals: 0,
                          })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {zm.kandidaten_zeilen.length > 0 ? (
            <Card className="overflow-hidden">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">
                  Kandidaten im Journal
                </CardTitle>
                <CardDescription>
                  Einzelne Buchungen hinter den Kontakt-Summen
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Datum</TableHead>
                      <TableHead>Text</TableHead>
                      <TableHead>Quelle</TableHead>
                      <TableHead className="text-right">Netto</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {zm.kandidaten_zeilen.map((z) => (
                      <TableRow key={z.journal_id}>
                        <TableCell className="tabular-nums">
                          {formatDateDe(z.buchungsdatum)}
                        </TableCell>
                        <TableCell className="max-w-sm">
                          <Link
                            href={`/app/journal/${z.journal_id}`}
                            className="text-primary hover:underline"
                          >
                            {z.buchungstext}
                          </Link>
                          {z.ist_storno ? (
                            <Badge variant="warning" className="ml-2">
                              Storno
                            </Badge>
                          ) : null}
                        </TableCell>
                        <TableCell>
                          {QUELLE_TYP_LABELS[z.quelle_typ] ?? z.quelle_typ}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatMoneyDe(z.journal_netto, { currency: true })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ) : null}

          {zm.andere_nullust.length > 0 ? (
            <Card className="overflow-hidden">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">
                  Andere 0-USt-Einnahmen
                </CardTitle>
                <CardDescription>
                  Nicht als ZM geraten (Inland, Drittland, fehlendes oder
                  unbekanntes Land). Kann Ausfuhr oder andere Steuerfreiheit
                  sein.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Datum</TableHead>
                      <TableHead>Kontakt</TableHead>
                      <TableHead>Land</TableHead>
                      <TableHead>Gruppe</TableHead>
                      <TableHead className="text-right">Netto</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {zm.andere_nullust.map((z) => (
                      <TableRow key={z.journal_id}>
                        <TableCell className="tabular-nums">
                          {formatDateDe(z.buchungsdatum)}
                        </TableCell>
                        <TableCell>
                          {z.kontakt_id ? (
                            <Link
                              href={`/app/kontakte/${z.kontakt_id}`}
                              className="text-primary hover:underline"
                            >
                              {z.kontakt_name}
                            </Link>
                          ) : (
                            z.kontakt_name
                          )}
                        </TableCell>
                        <TableCell className="tabular-nums">
                          {z.land || "—"}
                        </TableCell>
                        <TableCell>
                          {landGruppeLabel(z.land_gruppe)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatMoneyDe(z.journal_netto, { currency: true })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ) : null}

          {zm.nicht_gefuehrt.length > 0 ? (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Nicht geführt</CardTitle>
                <CardDescription>
                  Diese ZM-Angaben kann das Journal nicht ehrlich füllen —
                  nichts erfunden, nicht in der CSV als Tatsache.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1.5 text-sm text-muted-foreground">
                  {zm.nicht_gefuehrt.map((n) => (
                    <li key={n.feld}>
                      <span className="font-medium text-foreground">
                        {n.feld}
                      </span>
                      {" — "}
                      {n.bezeichnung}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Hinweis</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>{zm.hinweis}</p>
              <p>
                UStVA-Kennzahlen und ELSTER-XML light liegen bei der{" "}
                <Link
                  href={`/app/ust?${downloadQs}`}
                  className="text-primary hover:underline"
                >
                  USt-Übersicht
                </Link>
                . Land und USt-IdNr. am{" "}
                <Link href="/app/kontakte" className="text-primary hover:underline">
                  Kontakt
                </Link>{" "}
                ändern die Kandidaten (aktueller Stamm). BZSt-Prüfung am
                Kontakt, nicht hier.
              </p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

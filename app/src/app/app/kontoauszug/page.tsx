import Link from "next/link";
import { requireFirmaSession } from "@/lib/session";
import { formatMoneyDe } from "@/lib/money";
import {
  BANK_BEWEGUNG_STATUS_LABELS,
  BANK_RICHTUNG_LABELS,
  formatDateDe,
} from "@/lib/labels";
import {
  anzeigeVerwendungszweck,
  getBankBewegung,
  ignoreBewegungAction,
  listBankBewegungen,
  listBankkonten,
  listMatchVorschlaege,
  matchBewegungAction,
  reopenBewegungAction,
  type BankBewegungStatus,
  type BankBewegungRichtung,
} from "@/modules/banking";
import { listOffenePosten } from "@/modules/payments";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { PageHeader } from "@/components/ui/page-header";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  bankkonto?: string;
  status?: string;
  richtung?: string;
  q?: string;
  von?: string;
  bis?: string;
  page?: string;
  match?: string;
  error?: string;
  matched?: string;
  ignored?: string;
  reopened?: string;
}>;

export default async function KontoauszugPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await requireFirmaSession();
  const sp = await searchParams;

  const bankkonto = sp.bankkonto?.trim() ?? "";
  const status =
    sp.status === "offen" ||
    sp.status === "gematcht" ||
    sp.status === "ignoriert"
      ? (sp.status as BankBewegungStatus)
      : "";
  const richtung =
    sp.richtung === "eingang" || sp.richtung === "ausgang"
      ? (sp.richtung as BankBewegungRichtung)
      : "";
  const q = sp.q?.trim() ?? "";
  const von = sp.von?.trim() ?? "";
  const bis = sp.bis?.trim() ?? "";
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
  const matchId = sp.match?.trim() ?? "";

  const konten = await listBankkonten(session.firmaId, {}, 1, 100);
  const kontoMap = new Map(konten.items.map((k) => [k.id, k.name]));

  const result = await listBankBewegungen(
    session.firmaId,
    {
      bankkonto: bankkonto || undefined,
      status: status || undefined,
      richtung: richtung || undefined,
      q: q || undefined,
      von: von || undefined,
      bis: bis || undefined,
    },
    page,
    50,
  );

  const vorschlaege =
    matchId
      ? await listMatchVorschlaege(session.firmaId, matchId).catch(() => [])
      : [];

  const matchBewegung = matchId
    ? (result.items.find((b) => b.id === matchId) ??
      (await getBankBewegung(session.firmaId, matchId)))
    : null;

  const offenePosten =
    matchBewegung && matchBewegung.status === "offen"
      ? await listOffenePosten(session.firmaId, 1, 100)
      : null;

  const returnTo = buildReturnTo({
    bankkonto,
    status,
    richtung,
    q,
    von,
    bis,
    page,
    match: matchId || undefined,
  });

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <PageHeader
        title="Kontoauszug"
        description="Importierte Bankbewegungen zuordnen (Matching → Zahlung). Kein stiller Auto-Match — Vorschlag annehmen oder Rechnung wählen."
      >
        <Link
          href="/app/bankkonten"
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
        >
          Bankkonten
        </Link>
      </PageHeader>

      {sp.matched ? (
        <p className="text-sm text-success" role="status">
          Zuordnung gespeichert — Zahlung angelegt, Rechnungsstatus aktualisiert.
        </p>
      ) : null}
      {sp.ignored ? (
        <p className="text-sm text-success" role="status">
          Auszugszeile ignoriert.
        </p>
      ) : null}
      {sp.reopened ? (
        <p className="text-sm text-success" role="status">
          Auszugszeile wieder geöffnet.
        </p>
      ) : null}
      {sp.error ? (
        <p className="text-sm text-destructive" role="alert">
          {sp.error}
        </p>
      ) : null}

      <Card variant="muted">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filter</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="flex flex-wrap items-end gap-4" method="get">
            <div className="flex min-w-[10rem] flex-col gap-1.5">
              <Label htmlFor="bankkonto" className="text-xs text-muted-foreground">
                Bankkonto
              </Label>
              <select
                id="bankkonto"
                name="bankkonto"
                defaultValue={bankkonto}
                className="flex h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Alle</option>
                {konten.items.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex min-w-[8rem] flex-col gap-1.5">
              <Label htmlFor="status" className="text-xs text-muted-foreground">
                Status
              </Label>
              <select
                id="status"
                name="status"
                defaultValue={status}
                className="flex h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Alle</option>
                <option value="offen">Offen</option>
                <option value="gematcht">Gematcht</option>
                <option value="ignoriert">Ignoriert</option>
              </select>
            </div>
            <div className="flex min-w-[8rem] flex-col gap-1.5">
              <Label htmlFor="richtung" className="text-xs text-muted-foreground">
                Richtung
              </Label>
              <select
                id="richtung"
                name="richtung"
                defaultValue={richtung}
                className="flex h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Alle</option>
                <option value="eingang">Eingang</option>
                <option value="ausgang">Ausgang</option>
              </select>
            </div>
            <div className="flex min-w-[8rem] flex-col gap-1.5">
              <Label htmlFor="von" className="text-xs text-muted-foreground">
                Von
              </Label>
              <Input id="von" name="von" type="date" defaultValue={von} />
            </div>
            <div className="flex min-w-[8rem] flex-col gap-1.5">
              <Label htmlFor="bis" className="text-xs text-muted-foreground">
                Bis
              </Label>
              <Input id="bis" name="bis" type="date" defaultValue={bis} />
            </div>
            <div className="flex min-w-[10rem] flex-1 flex-col gap-1.5">
              <Label htmlFor="q" className="text-xs text-muted-foreground">
                Suche
              </Label>
              <Input
                id="q"
                name="q"
                defaultValue={q}
                placeholder="Verwendungszweck…"
              />
            </div>
            <Button type="submit" variant="secondary" size="sm">
              Filtern
            </Button>
          </form>
        </CardContent>
      </Card>

      {matchBewegung && matchBewegung.status === "offen" ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Zuordnung: {formatDateDe(matchBewegung.datum)} ·{" "}
              {formatMoneyDe(matchBewegung.betrag, { currency: true })}
            </CardTitle>
            <CardDescription>
              <span title={matchBewegung.verwendungszweck || undefined}>
                {anzeigeVerwendungszweck(matchBewegung) ||
                  "ohne Verwendungszweck"}
              </span>
              {matchBewegung.gegenkonto_name &&
              anzeigeVerwendungszweck(matchBewegung) !==
                matchBewegung.gegenkonto_name
                ? ` · ${matchBewegung.gegenkonto_name}`
                : ""}
              . Vorschläge basieren auf Betrag und Rechnungsnummer — bitte
              bestätigen (1-Klick).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {matchBewegung.richtung !== "eingang" ? (
              <p className="text-sm text-muted-foreground">
                Ausgänge können keiner Rechnung zugeordnet werden. Sie können
                die Zeile ignorieren.
              </p>
            ) : vorschlaege.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Keine automatischen Vorschläge. Rechnung manuell wählen
                (Rechnungs-ID aus der URL der Rechnung).
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Rechnung</TableHead>
                    <TableHead>Kund:in</TableHead>
                    <TableHead className="text-right">Offen</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Gründe</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vorschlaege.map((v) => (
                    <TableRow key={v.rechnungId}>
                      <TableCell>
                        <Link
                          href={`/app/rechnungen/${v.rechnungId}`}
                          className="font-medium hover:underline"
                        >
                          {v.rechnungsnummer || v.rechnungId.slice(0, 8)}
                        </Link>
                      </TableCell>
                      <TableCell>{v.kundeName || "—"}</TableCell>
                      <TableCell className="text-right font-mono tabular-nums">
                        {formatMoneyDe(v.offen, { currency: true })}
                      </TableCell>
                      <TableCell>{v.score}</TableCell>
                      <TableCell className="max-w-[12rem] text-xs text-muted-foreground">
                        {v.gruende.join(", ")}
                      </TableCell>
                      <TableCell>
                        <form action={matchBewegungAction}>
                          <input
                            type="hidden"
                            name="bewegung"
                            value={matchBewegung.id}
                          />
                          <input
                            type="hidden"
                            name="rechnung"
                            value={v.rechnungId}
                          />
                          <input
                            type="hidden"
                            name="bankkonto"
                            value={matchBewegung.bankkonto}
                          />
                          <input type="hidden" name="returnTo" value={returnTo} />
                          <Button type="submit" size="sm">
                            Zuordnen
                          </Button>
                        </form>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}

            {matchBewegung.richtung === "eingang" ? (
              <form
                action={matchBewegungAction}
                className="flex flex-wrap items-end gap-3 border-t border-border pt-4"
              >
                <input type="hidden" name="bewegung" value={matchBewegung.id} />
                <input
                  type="hidden"
                  name="bankkonto"
                  value={matchBewegung.bankkonto}
                />
                <input type="hidden" name="returnTo" value={returnTo} />
                <div className="flex min-w-[16rem] flex-1 flex-col gap-1.5">
                  <Label htmlFor="rechnung_manuell">
                    Rechnung manuell wählen
                  </Label>
                  <select
                    id="rechnung_manuell"
                    name="rechnung"
                    required
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                    defaultValue=""
                  >
                    <option value="" disabled>
                      Offene Rechnung…
                    </option>
                    {(offenePosten?.items ?? []).map((p) => (
                      <option key={p.rechnungId} value={p.rechnungId}>
                        {(p.rechnungsnummer || p.rechnungId.slice(0, 8)) +
                          ` · offen ${p.offen} · ` +
                          (p.kundeName || "ohne Kund:in")}
                      </option>
                    ))}
                  </select>
                  {(offenePosten?.items.length ?? 0) === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      Keine offenen Rechnungen vorhanden.
                    </p>
                  ) : null}
                </div>
                <Button type="submit" variant="secondary" size="sm">
                  Manuell zuordnen
                </Button>
              </form>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <form action={ignoreBewegungAction}>
                <input type="hidden" name="bewegung" value={matchBewegung.id} />
                <input type="hidden" name="returnTo" value={returnTo} />
                <Button type="submit" variant="outline" size="sm">
                  Ignorieren
                </Button>
              </form>
              <Link
                href={buildReturnTo({
                  bankkonto,
                  status,
                  richtung,
                  q,
                  von,
                  bis,
                  page,
                })}
                className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
              >
                Abbrechen
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            {result.totalItems === 0
              ? "Keine Auszugszeilen"
              : `${result.totalItems} Zeile${result.totalItems === 1 ? "" : "n"}`}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {result.items.length === 0 ? (
            <p className="px-6 pb-6 text-sm text-muted-foreground">
              Noch keine importierten Bewegungen. Unter{" "}
              <Link href="/app/bankkonten" className="underline">
                Bankkonten
              </Link>{" "}
              CSV oder MT940 importieren.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Datum</TableHead>
                  <TableHead>Konto</TableHead>
                  <TableHead>Richtung</TableHead>
                  <TableHead className="text-right">Betrag</TableHead>
                  <TableHead>Verwendungszweck</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.items.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell className="whitespace-nowrap">
                      {formatDateDe(b.datum)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {kontoMap.get(b.bankkonto) ?? "—"}
                    </TableCell>
                    <TableCell>
                      {BANK_RICHTUNG_LABELS[b.richtung] ?? b.richtung}
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums">
                      {b.richtung === "ausgang" ? "−" : ""}
                      {formatMoneyDe(b.betrag, { currency: true })}
                    </TableCell>
                    <TableCell
                      className="max-w-[22rem] text-sm"
                      title={b.verwendungszweck || undefined}
                    >
                      <span className="line-clamp-2 break-words">
                        {anzeigeVerwendungszweck(b) || "—"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          b.status === "gematcht"
                            ? "default"
                            : b.status === "offen"
                              ? "secondary"
                              : "outline"
                        }
                      >
                        {BANK_BEWEGUNG_STATUS_LABELS[b.status] ?? b.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {b.status === "offen" ? (
                        <Link
                          href={buildReturnTo({
                            bankkonto,
                            status,
                            richtung,
                            q,
                            von,
                            bis,
                            page,
                            match: b.id,
                          })}
                          className={cn(
                            buttonVariants({ variant: "outline", size: "sm" }),
                          )}
                        >
                          Zuordnen
                        </Link>
                      ) : null}
                      {b.status === "ignoriert" ? (
                        <form action={reopenBewegungAction} className="inline">
                          <input type="hidden" name="bewegung" value={b.id} />
                          <input type="hidden" name="returnTo" value={returnTo} />
                          <Button type="submit" variant="ghost" size="sm">
                            Öffnen
                          </Button>
                        </form>
                      ) : null}
                      {b.status === "gematcht" && b.rechnung ? (
                        <Link
                          href={`/app/rechnungen/${b.rechnung}`}
                          className={cn(
                            buttonVariants({ variant: "ghost", size: "sm" }),
                          )}
                        >
                          Rechnung
                        </Link>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {result.totalPages > 1 ? (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Seite {result.page} / {result.totalPages}
          </span>
          <div className="flex gap-2">
            {result.page > 1 ? (
              <Link
                href={buildReturnTo({
                  bankkonto,
                  status,
                  richtung,
                  q,
                  von,
                  bis,
                  page: result.page - 1,
                })}
                className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
              >
                Zurück
              </Link>
            ) : null}
            {result.page < result.totalPages ? (
              <Link
                href={buildReturnTo({
                  bankkonto,
                  status,
                  richtung,
                  q,
                  von,
                  bis,
                  page: result.page + 1,
                })}
                className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
              >
                Weiter
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function buildReturnTo(opts: {
  bankkonto?: string;
  status?: string;
  richtung?: string;
  q?: string;
  von?: string;
  bis?: string;
  page?: number;
  match?: string;
}): string {
  const p = new URLSearchParams();
  if (opts.bankkonto) p.set("bankkonto", opts.bankkonto);
  if (opts.status) p.set("status", opts.status);
  if (opts.richtung) p.set("richtung", opts.richtung);
  if (opts.q) p.set("q", opts.q);
  if (opts.von) p.set("von", opts.von);
  if (opts.bis) p.set("bis", opts.bis);
  if (opts.page && opts.page > 1) p.set("page", String(opts.page));
  if (opts.match) p.set("match", opts.match);
  const qs = p.toString();
  return qs ? `/app/kontoauszug?${qs}` : "/app/kontoauszug";
}

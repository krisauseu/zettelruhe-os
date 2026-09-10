import { assertOrdinaryEInvoiceImport } from "@/modules/einvoice/import-grenzen";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireFirmaSession } from "@/lib/session";
import { formatMoneyDe } from "@/lib/money";
import {
  E_RECHNUNG_EMPFANG_STATUS_LABELS,
  E_RECHNUNG_FORMAT_LABELS,
  E_RECHNUNG_PARSE_STATUS_LABELS,
  STEUERSATZ_LABELS,
  formatDateDe,
  formatDateTimeDe,
} from "@/lib/labels";
import { listKontakte } from "@/modules/contacts";
import {
  archiveERechnungAction,
  createBelegFromERechnungAction,
  getERechnungEmpfang,
  getLinkedBeleg,
  suggestLieferantForEmpfang,
} from "@/modules/einvoice";
import { Button, buttonVariants } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;
type SearchParams = Promise<{ error?: string; saved?: string }>;

export default async function ERechnungDetailPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const session = await requireFirmaSession();
  const { id } = await params;
  const sp = await searchParams;

  const empfang = await getERechnungEmpfang(session.firmaId, id);
  if (!empfang) notFound();

  const beleg = await getLinkedBeleg(session.firmaId, empfang);
  const vorschlag = await suggestLieferantForEmpfang(session.firmaId, id);
  const lieferantenResult = await listKontakte(
    session.firmaId,
    { rolle: "lieferant" },
    1,
    200,
  );
  const lieferanten = lieferantenResult.items;
  const dto = empfang.geparst;
  let importError = "";
  if (dto) try { assertOrdinaryEInvoiceImport(dto); } catch (e) { importError = e instanceof Error ? e.message : "Import prüfen."; }
  const canCreateBeleg =
    empfang.parse_status === "ok" &&
    !empfang.beleg &&
    empfang.status !== "beleg_erstellt";

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <p className="text-sm text-muted-foreground">
          <Link
            href="/app/e-rechnungen"
            className="hover:text-foreground hover:underline"
          >
            ← E-Rechnungen
          </Link>
        </p>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              {empfang.rechnungsnummer
                ? `E-Rechnung ${empfang.rechnungsnummer}`
                : "E-Rechnung Empfang"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Empfangen {formatDateTimeDe(empfang.empfangen_am)}
              {empfang.original_dateiname
                ? ` · ${empfang.original_dateiname}`
                : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge
              variant={empfang.status === "neu" ? "default" : "secondary"}
            >
              {E_RECHNUNG_EMPFANG_STATUS_LABELS[empfang.status]}
            </Badge>
            <Badge
              variant="secondary"
              className={
                empfang.parse_status === "fehler" ? "text-destructive" : undefined
              }
            >
              {E_RECHNUNG_PARSE_STATUS_LABELS[empfang.parse_status]}
            </Badge>
          </div>
        </div>
      </div>

      {sp.error ? (
        <p
          className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          role="alert"
        >
          {sp.error}
        </p>
      ) : null}
      {sp.saved ? (
        <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-foreground">
          Gespeichert.
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Original</CardTitle>
          <CardDescription>
            Revisionssicher archiviert — wird nicht überschrieben (ADR-0012).
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3 text-sm">
          <span className="text-muted-foreground">
            Format: {E_RECHNUNG_FORMAT_LABELS[empfang.format]}
          </span>
          {empfang.original_datei ? (
            <Link
              href={`/app/e-rechnungen/${id}/datei`}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              Original herunterladen
            </Link>
          ) : null}
        </CardContent>
      </Card>

      {empfang.parse_status === "fehler" ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base text-destructive">
              Parse-Fehler
            </CardTitle>
            <CardDescription>
              Das Original ist trotzdem archiviert. XML hochladen oder Beleg
              manuell anlegen.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-foreground">{empfang.parse_fehler}</p>
            <Link
              href="/app/belege/neu"
              className={cn(
                buttonVariants({ variant: "secondary", size: "sm" }),
                "mt-4 inline-flex",
              )}
            >
              Beleg manuell anlegen
            </Link>
          </CardContent>
        </Card>
      ) : null}

      {dto ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Geparste Felder</CardTitle>
            <CardDescription>
              Vorschau vor dem Anlegen des Beleg-Entwurfs. Felder liegen
              separat vom Original.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <dl className="grid gap-3 sm:grid-cols-2">
              <div>
                <dt className="text-xs text-muted-foreground">
                  Rechnungsnummer
                </dt>
                <dd className="font-mono">{dto.rechnungsnummer || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">
                  Rechnungsdatum
                </dt>
                <dd>{formatDateDe(dto.rechnungsdatum)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Lieferant:in</dt>
                <dd>{dto.lieferant.name || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">USt-IdNr.</dt>
                <dd>{dto.lieferant.ust_id || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Netto</dt>
                <dd className="tabular-nums">
                  {formatMoneyDe(dto.betrag_netto, { currency: true })}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">USt</dt>
                <dd className="tabular-nums">
                  {formatMoneyDe(dto.betrag_ust, { currency: true })}
                  {dto.steuersatz
                    ? ` (${STEUERSATZ_LABELS[dto.steuersatz] ?? dto.steuersatz})`
                    : ""}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Brutto</dt>
                <dd className="tabular-nums font-medium">
                  {formatMoneyDe(dto.betrag_brutto, { currency: true })}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Währung</dt>
                <dd>{dto.waehrung || "Unbekannt"}</dd>
              </div>
            </dl>

            {dto.positionen && dto.positionen.length > 0 ? (
              <div>
                <p className="mb-2 text-xs font-medium text-muted-foreground">
                  Positionen (Auszug)
                </p>
                <ul className="list-inside list-disc space-y-1 text-muted-foreground">
                  {dto.positionen.slice(0, 8).map((p, i) => (
                    <li key={i}>
                      {p.text}
                      {p.netto
                        ? ` — ${formatMoneyDe(p.netto, { currency: true })}`
                        : ""}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {beleg ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Verknüpfter Beleg</CardTitle>
            <CardDescription>
              Entwurf prüfen und bei Bedarf festschreiben (Buchungsjournal).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link
              href={`/app/belege/${beleg.id}`}
              className={cn(buttonVariants({ size: "sm" }))}
            >
              Zum Beleg
              {beleg.belegnummer ? ` ${beleg.belegnummer}` : " (Entwurf)"}
            </Link>
          </CardContent>
        </Card>
      ) : null}

      {importError && <div className="space-y-2 rounded-md border p-3 text-sm"><p>{importError}</p><Link className="underline" href="/app/belege/neu">Beleg manuell prüfen und erfassen</Link></div>}
      {canCreateBeleg ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Beleg-Entwurf anlegen</CardTitle>
            <CardDescription>
              Vorbefüllt aus der E-Rechnung. Unter Kleinunternehmerregelung
              ohne Vorsteuer-Ausweis. Festschreibung erst am Beleg.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              action={createBelegFromERechnungAction}
              className="flex flex-col gap-4"
            >
              <input type="hidden" name="id" value={id} />
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="lieferant">Lieferant:in (optional)</Label>
                <select
                  id="lieferant"
                  name="lieferant"
                  defaultValue={vorschlag?.id ?? ""}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
                >
                  <option value="">
                    {dto?.lieferant.name
                      ? `— Freitext: ${dto.lieferant.name} —`
                      : "— optional —"}
                  </option>
                  {lieferanten.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                      {vorschlag?.id === l.id ? " (Vorschlag)" : ""}
                    </option>
                  ))}
                </select>
                {vorschlag ? (
                  <p className="text-xs text-muted-foreground">
                    Vorschlag per Name/USt-IdNr. (Stamm, sonst Notiz):{" "}
                    {vorschlag.name}
                  </p>
                ) : null}
                {dto?.lieferant.ust_id ? (
                  <p className="text-xs text-muted-foreground">
                    USt-IdNr. der E-Rechnung ({dto.lieferant.ust_id}) wird in
                    die Beleg-Bezeichnung geschrieben, nicht still auf den Kontakt.
                  </p>
                ) : null}
              </div>
              <p className="text-xs text-muted-foreground">Vor Übernahme werden Währung und Steuerhinweise erneut am Original geprüft. Ein Lieferantenmatch entscheidet keine Steuerbehandlung.</p>
              <Button type="submit" disabled={!!importError}>Beleg-Entwurf anlegen</Button>
            </form>
          </CardContent>
        </Card>
      ) : null}

      {empfang.status !== "archiviert" ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Archivieren</CardTitle>
            <CardDescription>
              Markiert den Empfang als erledigt. Originaldatei bleibt erhalten.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={archiveERechnungAction}>
              <input type="hidden" name="id" value={id} />
              <Button type="submit" variant="secondary" size="sm">
                Als archiviert markieren
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : null}

      {empfang.notiz ? (
        <p className="text-sm text-muted-foreground">
          Notiz: {empfang.notiz}
        </p>
      ) : null}
    </div>
  );
}

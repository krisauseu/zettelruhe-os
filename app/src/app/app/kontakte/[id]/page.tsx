import Link from "next/link";
import { notFound } from "next/navigation";
import { requireFirmaSession } from "@/lib/session";
import {
  createAnsprechpartnerAction,
  deleteAnsprechpartnerAction,
  deleteKontaktAction,
  getKontakt,
  listAnsprechpartner,
  updateKontaktAction,
} from "@/modules/contacts";
import { KontaktForm } from "@/modules/contacts/kontakt-form";
import {
  SCHNAPPSCHUSS_NICHT_LESBAR,
  getAktuellePruefung,
  kannBzstAbfrage,
  pruefeKontaktUstIdAction,
} from "@/modules/ustid";
import { getFirmaById } from "@/lib/pb";
import {
  KontaktPruefungForm,
  PruefungAnzeige,
} from "@/modules/ustid/pruefung-anzeige";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;
type SearchParams = Promise<{
  error?: string;
  saved?: string;
  success?: string;
}>;

export default async function KontaktDetailPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const session = await requireFirmaSession();

  const { id } = await params;
  const sp = await searchParams;
  const kontakt = await getKontakt(session.firmaId, id);
  if (!kontakt) notFound();

  const ansprechpartner = await listAnsprechpartner(session.firmaId, id);
  const firma = await getFirmaById(session.firmaId);
  const gate = kannBzstAbfrage(firma?.ust_id, kontakt.ust_id);
  let aktuelle = null;
  let schnappschussHinweis: string | null = null;
  if (kontakt.ust_id) {
    try {
      aktuelle = await getAktuellePruefung(
        session.firmaId,
        "kontakt",
        kontakt.id,
        kontakt.ust_id,
      );
    } catch {
      schnappschussHinweis = SCHNAPPSCHUSS_NICHT_LESBAR;
    }
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div>
        <p className="text-sm text-muted-foreground">
          <Link
            href="/app/kontakte"
            className="hover:text-foreground hover:underline"
          >
            ← Kontakte
          </Link>
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
          {kontakt.name}
        </h1>
        {kontakt.kontaktnummer ? (
          <p className="mt-1 font-mono text-sm tabular-nums text-muted-foreground">
            {kontakt.kontaktnummer}
          </p>
        ) : null}
        {sp.saved ? (
          <p className="mt-1 text-sm text-success">Gespeichert.</p>
        ) : null}
        {sp.success ? (
          <p className="mt-1 text-sm text-success">{sp.success}</p>
        ) : null}
        {sp.error ? (
          <p className="mt-1 text-sm text-destructive" role="alert">
            {sp.error}
          </p>
        ) : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Stammdaten</CardTitle>
          <CardDescription>Bearbeiten und speichern.</CardDescription>
        </CardHeader>
        <CardContent>
          <KontaktForm
            action={updateKontaktAction}
            kontakt={kontakt}
            submitLabel="Speichern"
            error={sp.error ?? null}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>USt-IdNr. beim BZSt prüfen</CardTitle>
          <CardDescription>
            Bestätigt die gespeicherte fremde Nummer gegenüber der eigenen
            DE-USt-IdNr. der aktiven Firma. Nur Anfragezeitpunkt, kein
            Dauer-Stempel, festgeschriebene Belege bleiben unverändert.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {kontakt.ust_id ? (
            <p className="text-sm">
              Gespeichert:{" "}
              <span className="font-mono tabular-nums">{kontakt.ust_id}</span>
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Keine USt-IdNr. gespeichert. Oben eintragen, speichern, dann
              prüfen.
            </p>
          )}
          {schnappschussHinweis ? (
            <p className="text-sm text-muted-foreground" role="status">
              {schnappschussHinweis}
            </p>
          ) : aktuelle ? (
            <PruefungAnzeige
              pruefung={aktuelle}
              title="Letzter Schnappschuss zu dieser Nummer"
            />
          ) : kontakt.ust_id ? (
            <p className="text-sm text-muted-foreground">
              Noch kein BZSt-Schnappschuss zu dieser gespeicherten Nummer.
            </p>
          ) : null}
          {gate.ok ? (
            <KontaktPruefungForm
              action={pruefeKontaktUstIdAction}
              kontaktId={id}
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              {gate.grund}{" "}
              {gate.grund.includes("Firma") ||
              gate.grund.includes("eigene USt-IdNr.") ? (
                <Link
                  href="/app/firma"
                  className="text-primary hover:underline"
                >
                  Zur Firma
                </Link>
              ) : null}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ansprechpartner</CardTitle>
          <CardDescription>Optional, light v1.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {ansprechpartner.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Noch keine Ansprechpartner.
            </p>
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-border">
              {ansprechpartner.map((a) => (
                <li
                  key={a.id}
                  className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
                >
                  <div>
                    <p className="font-medium text-foreground">{a.name}</p>
                    <p className="text-muted-foreground">
                      {[a.position, a.email, a.telefon]
                        .filter(Boolean)
                        .join(" · ") || "—"}
                    </p>
                  </div>
                  <form action={deleteAnsprechpartnerAction}>
                    <input type="hidden" name="kontaktId" value={id} />
                    <input type="hidden" name="id" value={a.id} />
                    <Button type="submit" variant="ghost" size="sm">
                      Entfernen
                    </Button>
                  </form>
                </li>
              ))}
            </ul>
          )}

          <form
            action={createAnsprechpartnerAction}
            className="grid gap-3 rounded-lg border border-dashed border-border bg-muted/30 p-4 sm:grid-cols-2"
          >
            <input type="hidden" name="kontaktId" value={id} />
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor="ap-name">Name</Label>
              <Input id="ap-name" name="name" required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ap-position">Position</Label>
              <Input id="ap-position" name="position" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ap-email">E-Mail</Label>
              <Input id="ap-email" name="email" type="email" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ap-telefon">Telefon</Label>
              <Input id="ap-telefon" name="telefon" type="tel" />
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" variant="secondary" size="sm">
                Ansprechpartner hinzufügen
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-destructive">Kontakt löschen</CardTitle>
          <CardDescription>
            Entfernt den Kontakt und zugehörige Ansprechpartner.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={deleteKontaktAction}>
            <input type="hidden" name="id" value={id} />
            <Button type="submit" variant="danger" size="sm">
              Endgültig löschen
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

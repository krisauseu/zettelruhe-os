import Link from "next/link";
import { redirect } from "next/navigation";
import { requireFirmaSession } from "@/lib/session";
import { MITGLIEDSCHAFT_ROLLE_LABELS } from "@/lib/labels";
import { isSmtpConfigured } from "@/lib/smtp";
import { listMitgliederDerFirma } from "@/modules/platform/mitgliedschaft";
import {
  aendereRolleAction,
  einladenNutzerAction,
  entferneMitgliedschaftAction,
  setzePasswortAction,
} from "@/modules/platform/nutzer-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
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
import { ConfirmForm } from "@/components/ui/confirm-form";
import { PageHeader } from "@/components/ui/page-header";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  error?: string;
  created?: string;
  saved?: string;
  deleted?: string;
}>;

export default async function NutzerPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await requireFirmaSession();
  if (!session.kannVerwalten) {
    redirect("/app");
  }

  const sp = await searchParams;
  const mitglieder = await listMitgliederDerFirma(session.firmaId);
  const smtpOk = isSmtpConfigured();

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <PageHeader
        title="Nutzer:innen"
        description="Einladen und grobe Rechte für die aktive Firma. Zugang mit E-Mail und Startpasswort — ohne SMTP-Pflicht."
      />

      {sp.error ? (
        <p
          className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          role="alert"
        >
          {sp.error}
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Einladen</CardTitle>
          <CardDescription>
            Neue Person anlegen oder bestehende E-Mail dieser Firma zuordnen.
            Bei bestehendem Konto bleibt das Passwort unverändert.
            {smtpOk
              ? " Ist SMTP eingerichtet, erhält die Person eine E-Mail — ohne das Startpasswort."
              : " SMTP ist nicht eingerichtet; es geht keine Einladungs-Mail raus."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={einladenNutzerAction} className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" required maxLength={200} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">E-Mail</Label>
              <Input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="off"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">Startpasswort</Label>
              <Input
                id="password"
                name="password"
                type="password"
                minLength={8}
                autoComplete="new-password"
              />
              <p className="text-xs text-muted-foreground">
                Pflicht für neue Konten, mindestens 8 Zeichen. Bei bestehender
                E-Mail leer lassen.
              </p>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="rolle">Rolle</Label>
              <Select id="rolle" name="rolle" defaultValue="bearbeiten">
                <option value="eigentuemer">
                  {MITGLIEDSCHAFT_ROLLE_LABELS.eigentuemer}
                </option>
                <option value="bearbeiten">
                  {MITGLIEDSCHAFT_ROLLE_LABELS.bearbeiten}
                </option>
                <option value="lesen">
                  {MITGLIEDSCHAFT_ROLLE_LABELS.lesen}
                </option>
              </Select>
              <p className="text-xs text-muted-foreground">
                Eigentümer:in verwaltet Firma und Nutzer:innen. Bearbeiten
                schreibt den Alltag. Lesen sieht alles, ändert nichts.
              </p>
            </div>
            <div className="sm:col-span-2">
              <Button type="submit">Einladen</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Mitglieder dieser Firma</CardTitle>
          <CardDescription>
            Die letzte Eigentümer:in kann nicht entfernt oder herabgestuft
            werden.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>E-Mail</TableHead>
                <TableHead>Rolle</TableHead>
                <TableHead className="text-right">Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mitglieder.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="font-medium">
                    {m.name}
                    {m.userId === session.userId ? (
                      <span className="ml-2 text-xs text-muted-foreground">
                        (Sie)
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell>{m.email}</TableCell>
                  <TableCell>
                    <form action={aendereRolleAction} className="flex items-center gap-2">
                      <input type="hidden" name="id" value={m.id} />
                      <Select
                        name="rolle"
                        defaultValue={m.rolle}
                        aria-label={`Rolle von ${m.name}`}
                      >
                        <option value="eigentuemer">
                          {MITGLIEDSCHAFT_ROLLE_LABELS.eigentuemer}
                        </option>
                        <option value="bearbeiten">
                          {MITGLIEDSCHAFT_ROLLE_LABELS.bearbeiten}
                        </option>
                        <option value="lesen">
                          {MITGLIEDSCHAFT_ROLLE_LABELS.lesen}
                        </option>
                      </Select>
                      <Button type="submit" size="sm" variant="secondary">
                        Speichern
                      </Button>
                    </form>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex flex-col items-end gap-2">
                      {m.userId !== session.userId ? (
                        <form
                          action={setzePasswortAction}
                          className="flex flex-wrap items-end justify-end gap-2"
                        >
                          <input type="hidden" name="userId" value={m.userId} />
                          <Input
                            name="password"
                            type="password"
                            placeholder="Neues Passwort"
                            minLength={8}
                            required
                            className="h-8 w-40"
                            autoComplete="new-password"
                          />
                          <Input
                            name="passwordConfirm"
                            type="password"
                            placeholder="Wiederholen"
                            minLength={8}
                            required
                            className="h-8 w-40"
                            autoComplete="new-password"
                          />
                          <Button type="submit" size="sm" variant="outline">
                            Passwort setzen
                          </Button>
                        </form>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          Eigenes Passwort unter{" "}
                          <Link
                            href="/app/passwort"
                            className="underline-offset-4 hover:underline"
                          >
                            Passwort ändern
                          </Link>
                          .
                        </p>
                      )}
                      <ConfirmForm
                        action={entferneMitgliedschaftAction}
                        title="Mitgliedschaft entfernen?"
                        message={`${m.name} verliert den Zugang zu dieser Firma. Das Login bleibt bestehen, falls die Person in einer anderen Firma Mitglied ist.`}
                        confirmLabel="Entfernen"
                      >
                        <input type="hidden" name="id" value={m.id} />
                        <Button type="submit" size="sm" variant="danger">
                          Entfernen
                        </Button>
                      </ConfirmForm>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

import { requireSession } from "@/lib/session";
import { aendereEigenesPasswortAction } from "@/modules/platform/passwort-actions";
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
import { PageHeader } from "@/components/ui/page-header";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  error?: string;
  saved?: string;
}>;

export default async function PasswortPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await requireSession();
  const sp = await searchParams;

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6">
      <PageHeader
        title="Passwort ändern"
        description="Nur Ihr eigenes Login. Altes Passwort, neues Passwort und Bestätigung. Mindestens 8 Zeichen. Sie bleiben danach angemeldet."
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
          <CardTitle className="text-base">Eigenes Passwort</CardTitle>
          <CardDescription>
            {session.email} — unabhängig von Rolle und Firma.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            action={aendereEigenesPasswortAction}
            className="flex flex-col gap-4"
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="oldPassword">Altes Passwort</Label>
              <Input
                id="oldPassword"
                name="oldPassword"
                type="password"
                required
                autoComplete="current-password"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">Neues Passwort</Label>
              <Input
                id="password"
                name="password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="passwordConfirm">Neues Passwort bestätigen</Label>
              <Input
                id="passwordConfirm"
                name="passwordConfirm"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>
            <div>
              <Button type="submit">Passwort ändern</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

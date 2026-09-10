import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { isSetupRequired } from "@/lib/pb";
import { AppShell } from "@/components/app-shell";
import { nachziehenZahlungsjournaleEinmal } from "@/modules/payments";
import {
  listFirmenFuerNutzer,
  resolveMitgliedschaftFuerSession,
} from "@/modules/platform/mitgliedschaft";
import {
  hatRecht,
  istInstanzEigentuemer,
} from "@/modules/platform/rechte";
import { EmptyState } from "@/components/ui/empty-state";

export const dynamic = "force-dynamic";

export default async function ProtectedAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (await isSetupRequired()) {
    redirect("/setup");
  }

  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const firmen = await listFirmenFuerNutzer(session.userId).catch(() => []);
  const mitgliedschaft = await resolveMitgliedschaftFuerSession(
    session.userId,
    session.firmaId,
  );
  const firmaId = mitgliedschaft?.firmaId ?? null;
  if (firmaId) {
    await nachziehenZahlungsjournaleEinmal(firmaId);
  }

  const mitgliedschaftRolle = mitgliedschaft?.rolle ?? null;

  if (!firmaId || !mitgliedschaftRolle) {
    return (
      <AppShell
        session={{ ...session, firmaId: null }}
        firmen={[]}
        kannFirmaAnlegen={istInstanzEigentuemer(session.role)}
        kannVerwalten={false}
        kannSchreiben={false}
        mitgliedschaftRolle={null}
      >
        <EmptyState
          title="Kein Zugang zu einer Firma"
          description="Für dieses Login liegt keine Mitgliedschaft vor. Bitte die Eigentümer:in um eine Einladung."
        />
      </AppShell>
    );
  }

  return (
    <AppShell
      session={{ ...session, firmaId }}
      firmen={firmen}
      kannFirmaAnlegen={istInstanzEigentuemer(session.role)}
      kannVerwalten={hatRecht(mitgliedschaftRolle, "verwalten")}
      kannSchreiben={hatRecht(mitgliedschaftRolle, "schreiben")}
      mitgliedschaftRolle={mitgliedschaftRolle}
    >
      {children}
    </AppShell>
  );
}

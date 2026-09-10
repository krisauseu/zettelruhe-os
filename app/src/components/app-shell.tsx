import Link from "next/link";
import { Suspense } from "react";
import { KeyRound, LogOut } from "lucide-react";
import type { SessionPayload } from "@/lib/session";
import { logoutAction } from "@/modules/platform/auth-actions";
import { FirmaSwitcher } from "@/modules/platform/firma-switcher";
import { Button, buttonVariants } from "@/components/ui/button";
import { AppNav, type NavItem } from "@/components/app-nav";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { BrandMark } from "@/components/brand-mark";
import { FlashToast } from "@/components/ui/flash-toast";
import { MITGLIEDSCHAFT_ROLLE_LABELS } from "@/lib/labels";
import { cn } from "@/lib/utils";
import type { MitgliedschaftRolle } from "@/modules/platform/rechte";

/** Serializable nav config (icon keys, not React components). Gruppen kollabierbar. */
function buildNav(kannVerwalten: boolean): NavItem[] {
  const stammdaten: NavItem[] = [
    { type: "group", label: "Stammdaten" },
    { href: "/app/kontakte", label: "Kontakte", icon: "kontakte" },
    { href: "/app/katalog", label: "Katalog", icon: "katalog" },
    { href: "/app/projekte", label: "Projekte", icon: "projekte" },
    { href: "/app/firma", label: "Firma", icon: "firma" },
    { href: "/app/kategorien", label: "Kategorien", icon: "kategorien" },
  ];
  if (kannVerwalten) {
    stammdaten.push({
      href: "/app/nutzer",
      label: "Nutzer:innen",
      icon: "nutzer",
    });
  }
  return [
    { href: "/app", label: "Übersicht", icon: "dashboard" },
    { href: "/app/suche", label: "Suche", icon: "suche" },
    ...stammdaten,
    { type: "group", label: "Zeit & Fahrten" },
    { href: "/app/zeiten", label: "Zeiten", icon: "zeiten" },
    { href: "/app/fahrten", label: "Fahrten", icon: "fahrten" },
    { type: "group", label: "Verkauf" },
    { href: "/app/angebote", label: "Angebote", icon: "angebote" },
    { href: "/app/rechnungen", label: "Rechnungen", icon: "rechnungen" },
    {
      href: "/app/wiederkehrende-rechnungen",
      label: "Wiederkehrend",
      icon: "wiederkehrend",
    },
    { href: "/app/zahlungen", label: "Zahlungen", icon: "zahlungen" },
    { type: "group", label: "Belege & Kasse" },
    { href: "/app/belege", label: "Belege", icon: "belege" },
    { href: "/app/e-rechnungen", label: "E-Rechnungen", icon: "e-rechnungen" },
    { href: "/app/kassenbuch", label: "Kassenbuch", icon: "kassenbuch" },
    { href: "/app/bankkonten", label: "Bankkonten", icon: "bankkonten" },
    { href: "/app/kontoauszug", label: "Kontoauszug", icon: "kontoauszug" },
    { href: "/app/journal", label: "Buchungsjournal", icon: "journal" },
    { type: "group", label: "Auswertungen" },
    { href: "/app/auswertungen", label: "Auswertungen", icon: "auswertungen" },
    { href: "/app/eur", label: "EÜR", icon: "eur" },
    { href: "/app/ust", label: "USt-Übersicht", icon: "ust" },
    { href: "/app/zm", label: "ZM-Übersicht", icon: "zm" },
    { href: "/app/export", label: "Export", icon: "export" },
  ];
}

export function AppShell({
  session,
  firmen,
  children,
  kannFirmaAnlegen,
  kannVerwalten,
  kannSchreiben,
  mitgliedschaftRolle,
}: {
  session: SessionPayload;
  firmen: { id: string; name: string }[];
  children: React.ReactNode;
  kannFirmaAnlegen: boolean;
  kannVerwalten: boolean;
  kannSchreiben: boolean;
  mitgliedschaftRolle: MitgliedschaftRolle | null;
}) {
  return (
    <AppSidebar
      header={
        <>
          <div
            className="absolute inset-x-0 top-0 h-0.5 bg-sidebar-primary"
            aria-hidden
          />
          <Link href="/app" className="inline-flex rounded-sm">
            <BrandMark className="text-sidebar-foreground" />
          </Link>
          <p className="mt-2 truncate text-xs text-sidebar-muted">
            {session.name}
            {mitgliedschaftRolle
              ? ` · ${MITGLIEDSCHAFT_ROLLE_LABELS[mitgliedschaftRolle]}`
              : ""}
          </p>
          <FirmaSwitcher
            firmen={firmen}
            activeFirmaId={session.firmaId}
            kannFirmaAnlegen={kannFirmaAnlegen}
          />
        </>
      }
      nav={<AppNav items={buildNav(kannVerwalten)} />}
      footer={
        <>
          <ThemeToggle />
          <Link
            href="/app/passwort"
            className={cn(
              buttonVariants({ variant: "ghost", size: "sm" }),
              "w-full justify-start text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
            )}
          >
            <KeyRound className="h-4 w-4" aria-hidden />
            Passwort ändern
          </Link>
          <form action={logoutAction}>
            <Button
              type="submit"
              variant="ghost"
              size="sm"
              className="w-full justify-start text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            >
              <LogOut className="h-4 w-4" aria-hidden />
              Abmelden
            </Button>
          </form>
        </>
      }
    >
      <Suspense fallback={null}>
        <FlashToast />
      </Suspense>
      {!kannSchreiben && mitgliedschaftRolle === "lesen" ? (
        <div
          className="border-b border-warning/30 bg-warning/10 px-6 py-2 text-sm text-foreground md:px-8"
          role="status"
        >
          Lesezugriff auf diese Firma — Änderungen sind nicht erlaubt.
        </div>
      ) : null}
      <div className="mx-auto min-h-full p-6 md:p-9">{children}</div>
    </AppSidebar>
  );
}

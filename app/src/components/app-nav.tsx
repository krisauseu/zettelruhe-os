"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import {
  Banknote,
  BarChart3,
  BookOpen,
  Building2,
  Calculator,
  Tags,
  Car,
  ChevronRight,
  ClipboardList,
  Clock,
  Contact,
  Download,
  FileCode2,
  FileSpreadsheet,
  FileText,
  FolderKanban,
  Landmark,
  LayoutDashboard,
  Package,
  Percent,
  Receipt,
  RefreshCw,
  ScrollText,
  Search,
  Star,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DEFAULT_NAV_PREFS,
  NAV_STORAGE_EVENT,
  NAV_STORAGE_KEY,
  findActiveSectionId,
  groupNavItems,
  groupedSectionIds,
  isFavorite,
  isLinkActive,
  itemsToRender,
  parseNavPrefs,
  prefsEqual,
  serializeNavPrefs,
  setAllCollapsed,
  setFavoritesOnly,
  shouldRenderSection,
  toggleCollapsed,
  toggleFavorite,
  withAutoOpen,
  type NavPrefs,
} from "@/components/app-nav-state";

/** Icon keys only — never pass component functions from Server Components. */
export type NavIconKey =
  | "dashboard"
  | "suche"
  | "kontakte"
  | "katalog"
  | "projekte"
  | "zeiten"
  | "fahrten"
  | "angebote"
  | "rechnungen"
  | "wiederkehrend"
  | "zahlungen"
  | "belege"
  | "e-rechnungen"
  | "kassenbuch"
  | "bankkonten"
  | "kontoauszug"
  | "journal"
  | "auswertungen"
  | "eur"
  | "ust"
  | "zm"
  | "export"
  | "firma"
  | "kategorien"
  | "nutzer";

export type NavLinkItem = {
  type?: "link";
  href: string;
  label: string;
  icon: NavIconKey;
};

export type NavGroupItem = {
  type: "group";
  label: string;
};

export type NavItem = NavLinkItem | NavGroupItem;

const ICONS: Record<NavIconKey, LucideIcon> = {
  dashboard: LayoutDashboard,
  suche: Search,
  kontakte: Contact,
  katalog: Package,
  projekte: FolderKanban,
  zeiten: Clock,
  fahrten: Car,
  angebote: ClipboardList,
  rechnungen: FileText,
  wiederkehrend: RefreshCw,
  zahlungen: Banknote,
  belege: Receipt,
  "e-rechnungen": FileCode2,
  kassenbuch: Wallet,
  bankkonten: Landmark,
  kontoauszug: ScrollText,
  journal: BookOpen,
  auswertungen: BarChart3,
  eur: Calculator,
  ust: Percent,
  zm: FileSpreadsheet,
  export: Download,
  firma: Building2,
  kategorien: Tags,
  nutzer: Users,
};

let cachedRaw: string | null | undefined;
let cachedPrefs: NavPrefs = DEFAULT_NAV_PREFS;

function readPrefs(): NavPrefs {
  if (typeof window === "undefined") return DEFAULT_NAV_PREFS;
  const raw = window.localStorage.getItem(NAV_STORAGE_KEY);
  if (raw === cachedRaw) return cachedPrefs;
  cachedRaw = raw;
  cachedPrefs = parseNavPrefs(raw);
  return cachedPrefs;
}

function writePrefs(next: NavPrefs) {
  const raw = serializeNavPrefs(next);
  window.localStorage.setItem(NAV_STORAGE_KEY, raw);
  cachedRaw = raw;
  cachedPrefs = next;
  window.dispatchEvent(new Event(NAV_STORAGE_EVENT));
}

function subscribe(onChange: () => void) {
  const handler = () => onChange();
  window.addEventListener("storage", handler);
  window.addEventListener(NAV_STORAGE_EVENT, handler);
  return () => {
    window.removeEventListener("storage", handler);
    window.removeEventListener(NAV_STORAGE_EVENT, handler);
  };
}

export function AppNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  const sections = useMemo(() => groupNavItems(items), [items]);
  const sectionIds = useMemo(() => groupedSectionIds(sections), [sections]);
  const prefs = useSyncExternalStore(subscribe, readPrefs, () => DEFAULT_NAV_PREFS);
  const activeSectionId = findActiveSectionId(sections, pathname);
  const viewPrefs = withAutoOpen(prefs, activeSectionId);

  useEffect(() => {
    if (!prefsEqual(viewPrefs, prefs)) writePrefs(viewPrefs);
  }, [prefs, viewPrefs]);

  const update = useCallback((next: NavPrefs) => {
    if (!prefsEqual(next, prefs)) writePrefs(next);
  }, [prefs]);

  return (
    <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-3">
      <div className="mb-0.5 flex flex-col gap-0.5 px-3 pb-1 text-[10px] leading-4">
        <div className="flex flex-wrap items-center gap-x-1.5">
          <button
            type="button"
            className="cursor-pointer text-sidebar-muted hover:text-sidebar-foreground"
            onClick={() => update(setAllCollapsed(prefs, sectionIds, false))}
          >
            Alle öffnen
          </button>
          <span className="text-sidebar-muted/40" aria-hidden>
            |
          </span>
          <button
            type="button"
            className="cursor-pointer text-sidebar-muted hover:text-sidebar-foreground"
            onClick={() => update(setAllCollapsed(prefs, sectionIds, true))}
          >
            Alle schließen
          </button>
        </div>
        <button
          type="button"
          aria-pressed={viewPrefs.favoritesOnly}
          className={cn(
            "w-fit cursor-pointer hover:text-sidebar-foreground",
            viewPrefs.favoritesOnly
              ? "font-semibold text-sidebar-primary"
              : "text-sidebar-muted",
          )}
          onClick={() =>
            update(setFavoritesOnly(prefs, !viewPrefs.favoritesOnly))
          }
        >
          Nur Favoriten
        </button>
      </div>

      {viewPrefs.favoritesOnly && viewPrefs.favorites.length === 0 ? (
        <p className="px-3 pb-1 text-[10px] leading-4 text-sidebar-muted">
          Keine Favoriten. Stern an einem Eintrag setzen.
        </p>
      ) : null}

      {sections.map((section) => {
        if (!shouldRenderSection(section, viewPrefs, pathname)) return null;
        const collapsed = Boolean(
          section.id && viewPrefs.collapsed.includes(section.id),
        );
        const visible = itemsToRender(section, viewPrefs, pathname);
        const headingId = section.id ? `nav-heading-${section.id}` : undefined;
        const panelId = section.id ? `nav-section-${section.id}` : undefined;

        return (
          <div key={section.id || "top"} className="flex flex-col gap-0.5">
            {section.label ? (
              <button
                type="button"
                id={headingId}
                aria-expanded={!collapsed}
                aria-controls={panelId}
                className="flex w-full cursor-pointer items-center gap-1 px-3 pb-1 pt-3.5 text-left text-[10px] font-semibold uppercase tracking-wider text-sidebar-muted hover:text-sidebar-foreground"
                onClick={() => update(toggleCollapsed(prefs, section.id))}
              >
                <ChevronRight
                  className={cn(
                    "h-3 w-3 shrink-0 transition-transform",
                    !collapsed && "rotate-90",
                  )}
                  aria-hidden
                />
                {section.label}
              </button>
            ) : null}

            <div id={panelId} role={section.label ? "group" : undefined}>
              {visible.map((item) => (
                <NavLinkRow
                  key={item.href}
                  item={item}
                  pathname={pathname}
                  favorite={isFavorite(viewPrefs, item.href)}
                  onToggleFavorite={() =>
                    update(toggleFavorite(prefs, item.href))
                  }
                />
              ))}
            </div>
          </div>
        );
      })}
    </nav>
  );
}

function NavLinkRow({
  item,
  pathname,
  favorite,
  onToggleFavorite,
}: {
  item: NavLinkItem;
  pathname: string;
  favorite: boolean;
  onToggleFavorite: () => void;
}) {
  const Icon = ICONS[item.icon];
  const active = isLinkActive(pathname, item.href);

  return (
    <div
      className={cn(
        "group relative flex items-center rounded-lg",
        active
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "text-sidebar-foreground/80 hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground",
      )}
    >
      {active ? (
        <span
          className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-sidebar-primary"
          aria-hidden
        />
      ) : null}
      <Link
        href={item.href}
        className="flex min-w-0 flex-1 items-center gap-2.5 px-3 py-2 text-[13px] font-medium"
        aria-current={active ? "page" : undefined}
      >
        <Icon
          className={cn(
            "h-4 w-4 shrink-0",
            active ? "text-sidebar-primary" : "opacity-70",
          )}
          aria-hidden
        />
        <span className="truncate">{item.label}</span>
      </Link>
      <button
        type="button"
        aria-label={
          favorite
            ? `${item.label} aus Favoriten entfernen`
            : `${item.label} als Favorit markieren`
        }
        aria-pressed={favorite}
        onClick={onToggleFavorite}
        className={cn(
          "mr-0.5 shrink-0 rounded-md p-1 text-sidebar-muted hover:text-sidebar-foreground",
          favorite
            ? "text-sidebar-primary opacity-100"
            : "opacity-70 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100",
        )}
      >
        <Star
          className={cn("h-3.5 w-3.5", favorite && "fill-current")}
          aria-hidden
        />
      </button>
    </div>
  );
}

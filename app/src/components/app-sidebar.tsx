"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Menu, X } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  DESKTOP_MEDIA_QUERY,
  FOCUSABLE_SELECTOR,
  SIDEBAR_ID,
  isOffCanvasActive,
  isSidebarInert,
  isSidebarNavLinkClick,
  nextFocusIndex,
  nextOffCanvasOpen,
  type OffCanvasAction,
} from "@/components/app-sidebar-state";

function subscribeDesktop(onChange: () => void) {
  const media = window.matchMedia(DESKTOP_MEDIA_QUERY);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

function readDesktop() {
  return window.matchMedia(DESKTOP_MEDIA_QUERY).matches;
}

function listFocusable(root: HTMLElement): HTMLElement[] {
  return Array.from(
    root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
  ).filter((el) => el.tabIndex !== -1 && !el.closest("[inert]"));
}

/**
 * Feste Tinte-Sidebar auf Desktop; Off-Canvas unter md.
 * Nav-Inhalt kommt unverändert als Slot (Gruppen, Favoriten, localStorage).
 */
export function AppSidebar({
  header,
  nav,
  footer,
  children,
}: {
  header: React.ReactNode;
  nav: React.ReactNode;
  footer: React.ReactNode;
  children: React.ReactNode;
}) {
  const isDesktop = useSyncExternalStore(subscribeDesktop, readDesktop, () => true);
  const [open, setOpen] = useState(false);
  const frameRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const wasActive = useRef(false);

  const dispatch = useCallback(
    (action: OffCanvasAction) => {
      setOpen((current) => nextOffCanvasOpen(current, isDesktop, action));
    },
    [isDesktop],
  );

  const reconciled = nextOffCanvasOpen(open, isDesktop, {
    type: "viewport",
    isDesktop,
  });
  if (reconciled !== open) {
    setOpen(reconciled);
  }

  const active = isOffCanvasActive(isDesktop, reconciled);
  const inert = isSidebarInert(isDesktop, reconciled);

  useEffect(() => {
    if (!active) {
      if (wasActive.current) {
        wasActive.current = false;
        triggerRef.current?.focus();
      }
      return;
    }
    wasActive.current = true;
    triggerRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        dispatch({ type: "escape" });
        return;
      }
      if (event.key !== "Tab") return;
      const root = frameRef.current;
      if (!root) return;
      const items = listFocusable(root);
      if (items.length === 0) {
        event.preventDefault();
        triggerRef.current?.focus();
        return;
      }
      const current = document.activeElement;
      const currentIndex =
        current instanceof HTMLElement ? items.indexOf(current) : -1;
      const next = nextFocusIndex(items.length, currentIndex, event.shiftKey);
      if (next < 0) return;
      event.preventDefault();
      items[next]?.focus();
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [active, dispatch]);

  return (
    <div ref={frameRef} className="flex min-h-full flex-1 bg-background">
      <noscript>
        <style>{`#${SIDEBAR_ID}{transform:none!important;position:static!important;inset:auto!important}#app-mobile-bar,#app-sidebar-overlay{display:none!important}#app-main{padding-top:0!important}`}</style>
      </noscript>

      <header
        id="app-mobile-bar"
        className="fixed inset-x-0 top-0 z-50 flex h-14 items-center gap-3 border-b border-border bg-background px-3 md:hidden"
      >
        <Button
          ref={triggerRef}
          type="button"
          variant="ghost"
          size="icon"
          className="size-11 shrink-0"
          aria-expanded={active}
          aria-controls={SIDEBAR_ID}
          aria-label={active ? "Menü schließen" : "Menü öffnen"}
          onClick={() => dispatch({ type: "toggle" })}
        >
          {active ? <X aria-hidden /> : <Menu aria-hidden />}
        </Button>
        <BrandMark className="min-w-0" />
      </header>

      {active ? (
        <div
          id="app-sidebar-overlay"
          role="presentation"
          className="fixed inset-x-0 bottom-0 top-14 z-40 bg-foreground/30 backdrop-blur-[2px] md:hidden"
          onClick={() => dispatch({ type: "overlay" })}
        />
      ) : null}

      <aside
        ref={sidebarRef}
        id={SIDEBAR_ID}
        tabIndex={-1}
        aria-label="Hauptnavigation"
        aria-hidden={inert || undefined}
        aria-modal={active || undefined}
        role={active ? "dialog" : undefined}
        inert={inert || undefined}
        data-open={active ? "true" : "false"}
        onClick={(event) => {
          if (isSidebarNavLinkClick(event.target, sidebarRef.current)) {
            dispatch({ type: "nav-link" });
          }
        }}
        className={cn(
          "flex w-60 shrink-0 flex-col overflow-hidden bg-sidebar text-sidebar-foreground",
          "fixed inset-y-0 left-0 z-50 outline-none max-md:top-14",
          "transition-transform duration-200 ease-out motion-reduce:transition-none",
          "md:static md:z-auto md:translate-x-0",
          active
            ? "translate-x-0 shadow-toast"
            : "-translate-x-full max-md:pointer-events-none md:translate-x-0",
        )}
      >
        <div className="relative shrink-0 border-b border-sidebar-border px-4 py-5">
          {header}
        </div>
        <div className="flex min-h-0 flex-1 flex-col">{nav}</div>
        <div className="mt-auto shrink-0 space-y-0.5 border-t border-sidebar-border p-3">
          {footer}
        </div>
      </aside>

      <main
        id="app-main"
        className="min-w-0 flex-1 overflow-auto pt-14 md:pt-0"
        inert={active || undefined}
      >
        {children}
      </main>
    </div>
  );
}

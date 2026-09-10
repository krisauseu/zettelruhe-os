"use client";

import Link from "next/link";
import { Select } from "@/components/ui/select";

export function FirmaSwitcher({
  firmen,
  activeFirmaId,
  kannFirmaAnlegen,
}: {
  firmen: { id: string; name: string }[];
  activeFirmaId: string | null;
  kannFirmaAnlegen: boolean;
}) {
  const active =
    firmen.find((f) => f.id === activeFirmaId) ?? firmen[0] ?? null;

  if (!active) {
    return null;
  }

  if (firmen.length === 1) {
    return (
      <div className="mt-2 space-y-1">
        <p className="truncate text-xs text-sidebar-muted" title={active.name}>
          {active.name}
        </p>
        {kannFirmaAnlegen ? (
          <Link
            href="/app/firma/neu"
            className="block text-[11px] text-sidebar-muted underline-offset-2 hover:text-sidebar-foreground hover:underline"
          >
            Weitere Firma anlegen
          </Link>
        ) : null}
      </div>
    );
  }

  return (
    <form action="/app/firma/wechseln" method="post" className="mt-2 space-y-1">
      <label htmlFor="firma-switcher" className="sr-only">
        Aktive Firma
      </label>
      <Select
        id="firma-switcher"
        name="firmaId"
        key={active.id}
        defaultValue={active.id}
        className="h-8 border-sidebar-border bg-black/25 px-2 pr-7 text-xs text-sidebar-foreground shadow-none"
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
      >
        {firmen.map((f) => (
          <option key={f.id} value={f.id}>
            {f.name}
          </option>
        ))}
      </Select>
      <noscript>
        <button
          type="submit"
          className="text-[11px] text-sidebar-muted underline"
        >
          Wechseln
        </button>
      </noscript>
      {kannFirmaAnlegen ? (
        <Link
          href="/app/firma/neu"
          className="block text-[11px] text-sidebar-muted underline-offset-2 hover:text-sidebar-foreground hover:underline"
        >
          Weitere Firma anlegen
        </Link>
      ) : null}
    </form>
  );
}

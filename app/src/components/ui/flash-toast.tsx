"use client";

import { useEffect, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CircleAlert, CircleCheck } from "lucide-react";
import { cn } from "@/lib/utils";

const FLASH_KEYS = [
  "saved",
  "created",
  "festgeschrieben",
  "gesendet",
  "storniert",
  "deleted",
  "status",
  "fromAngebot",
  "zahlung",
  "zahlungGeloescht",
  "mail",
  "erinnerung",
  "success",
  "firma",
] as const;

const FLASH_MESSAGES: Record<(typeof FLASH_KEYS)[number], string> = {
  saved: "Gespeichert.",
  created: "Angelegt.",
  festgeschrieben: "Festgeschrieben.",
  gesendet: "Gesendet.",
  storniert: "Storno ausgeführt.",
  deleted: "Gelöscht.",
  status: "Status aktualisiert.",
  fromAngebot: "Rechnung aus Angebot übernommen.",
  zahlung: "Zahlung erfasst.",
  zahlungGeloescht: "Zahlung gelöscht.",
  mail: "E-Mail gesendet.",
  erinnerung: "Zahlungserinnerung gesendet.",
  success: "Erfolgreich.",
  firma: "Firma gewechselt.",
};

function resolveFlash(params: URLSearchParams): {
  text: string;
  tone: "ok" | "error";
} | null {
  const error = params.get("error");
  if (error) {
    return { text: error, tone: "error" };
  }
  const success = params.get("success");
  if (success) {
    return { text: success, tone: "ok" };
  }
  for (const key of FLASH_KEYS) {
    if (key === "success") continue;
    if (params.has(key)) {
      return { text: FLASH_MESSAGES[key], tone: "ok" };
    }
  }
  return null;
}

export function FlashToast() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const toast = useMemo(() => resolveFlash(params), [params]);

  function dismiss() {
    const next = new URLSearchParams(params.toString());
    next.delete("success");
    next.delete("error");
    for (const key of FLASH_KEYS) {
      next.delete(key);
    }
    next.delete("mailTo");
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(dismiss, 4500);
    return () => window.clearTimeout(t);
    // dismiss closes over current params; toast identity is enough
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast]);

  if (!toast) return null;

  const Icon = toast.tone === "error" ? CircleAlert : CircleCheck;

  return (
    <div
      role="status"
      className={cn(
        "pointer-events-auto fixed bottom-4 right-4 z-50 max-w-sm rounded-xl border bg-card px-4 py-3 text-sm text-foreground shadow-toast",
        toast.tone === "error"
          ? "border-destructive/30"
          : "border-success/25",
      )}
    >
      <div className="flex items-start gap-3">
        <Icon
          className={cn(
            "mt-0.5 h-4 w-4 shrink-0",
            toast.tone === "error" ? "text-destructive" : "text-success",
          )}
          aria-hidden
        />
        <p className="flex-1 leading-snug">{toast.text}</p>
        <button
          type="button"
          onClick={dismiss}
          className="shrink-0 text-xs text-muted-foreground hover:text-foreground"
          aria-label="Hinweis schließen"
        >
          Schließen
        </button>
      </div>
    </div>
  );
}

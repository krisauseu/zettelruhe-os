"use client";

import {
  useEffect,
  useRef,
  useState,
  useTransition,
  type ChangeEvent,
} from "react";
import { Search, X } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { clearBelegDateiAction } from "./actions";
import { belegDateiZeilen } from "./beleg-datei-zeilen";
import {
  compressBelegImage,
  isPdfBelegDatei,
  isRasterBelegBild,
} from "./compress-beleg-image";
import { BELEG_DATEI_MAX_ANZAHL } from "./types";

const ACCEPT =
  "application/pdf,image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,.pdf,.jpg,.jpeg,.png,.webp,.gif,.heic,.heif";

type Props = {
  mode: "create" | "edit";
  belegId?: string;
  /** Gespeicherte Dateinamen, eine Zeile je Datei */
  currentNames?: string[];
};

type PendingDatei = { name: string; url: string };

function formatDateiGroesse(bytes: number): string {
  if (bytes < 1024) return `${bytes} Byte`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  const mb = bytes / (1024 * 1024);
  return `${mb.toLocaleString("de-DE", { maximumFractionDigits: 1 })} MB`;
}

function setSubmitBusy(form: HTMLFormElement | null, busy: boolean): void {
  if (!form) return;
  for (const el of form.querySelectorAll<HTMLButtonElement>(
    "button[type=submit], button:not([type]), input[type=submit]",
  )) {
    el.disabled = busy;
  }
}

function writeInputFiles(input: HTMLInputElement, files: File[]): void {
  const dt = new DataTransfer();
  for (const file of files) dt.items.add(file);
  input.files = dt.files;
}

export function BelegDateiInput({ mode, belegId, currentNames }: Props) {
  const genRef = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const urlsRef = useRef<string[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingDatei[]>([]);
  const [isRemoving, startTransition] = useTransition();
  const [removingName, setRemovingName] = useState<string | null>(null);

  function replacePending(files: File[]): void {
    for (const u of urlsRef.current) URL.revokeObjectURL(u);
    const next = files.map((f) => ({
      name: f.name,
      url: URL.createObjectURL(f),
    }));
    urlsRef.current = next.map((p) => p.url);
    setPending(next);
  }

  useEffect(() => {
    return () => {
      for (const u of urlsRef.current) URL.revokeObjectURL(u);
    };
  }, []);

  function removePendingAt(index: number): void {
    genRef.current += 1;
    const input = inputRef.current;
    const files = Array.from(input?.files ?? []);
    files.splice(index, 1);
    if (input) writeInputFiles(input, files);
    replacePending(files);
    setStatus(null);
    setSubmitBusy(input?.closest("form") ?? null, false);
  }

  function removeSaved(name: string): void {
    if (!belegId) return;
    const fd = new FormData();
    fd.set("id", belegId);
    fd.set("name", name);
    setRemovingName(name);
    startTransition(() => {
      void clearBelegDateiAction(fd);
    });
  }

  async function onChange(e: ChangeEvent<HTMLInputElement>): Promise<void> {
    const input = e.target;
    const picked = Array.from(input.files ?? []);
    const gen = ++genRef.current;
    const form = input.closest("form");
    const savedCount = (currentNames ?? []).filter((n) => n.trim()).length;

    if (picked.length === 0) {
      replacePending([]);
      setStatus(null);
      setSubmitBusy(form, false);
      return;
    }

    const room = Math.max(0, BELEG_DATEI_MAX_ANZAHL - savedCount);
    let files = picked;
    let truncated = false;
    if (files.length > room) {
      files = files.slice(0, room);
      truncated = true;
      writeInputFiles(input, files);
    }

    if (files.length === 0) {
      replacePending([]);
      setStatus(`Höchstens ${BELEG_DATEI_MAX_ANZAHL} Dateien je Beleg.`);
      setSubmitBusy(form, false);
      return;
    }

    replacePending(files);

    const toCompress = files.filter(
      (f) => !isPdfBelegDatei(f) && isRasterBelegBild(f),
    );
    if (toCompress.length === 0) {
      setStatus(
        truncated
          ? `Höchstens ${BELEG_DATEI_MAX_ANZAHL} Dateien je Beleg.`
          : null,
      );
      setSubmitBusy(form, false);
      return;
    }

    setStatus("Fotos werden verkleinert…");
    setSubmitBusy(form, true);
    try {
      const next: File[] = [];
      for (const file of files) {
        if (isPdfBelegDatei(file) || !isRasterBelegBild(file)) {
          next.push(file);
          continue;
        }
        try {
          next.push(await compressBelegImage(file));
        } catch {
          next.push(file);
        }
        if (gen !== genRef.current) return;
      }
      if (gen !== genRef.current) return;
      writeInputFiles(input, next);
      replacePending(next);
      const total = next.reduce((sum, f) => sum + f.size, 0);
      const ready = `Bereit (${next.length === 1 ? "ca. " + formatDateiGroesse(next[0].size) : `${next.length} Dateien, ca. ${formatDateiGroesse(total)}`})`;
      setStatus(
        truncated
          ? `${ready} Höchstens ${BELEG_DATEI_MAX_ANZAHL} Dateien je Beleg.`
          : ready,
      );
    } catch {
      if (gen !== genRef.current) return;
      setStatus("Verkleinerung fehlgeschlagen, Original wird verwendet.");
    } finally {
      if (gen === genRef.current) {
        setSubmitBusy(form, false);
      }
    }
  }

  const saved = (currentNames ?? []).map((n) => n.trim()).filter(Boolean);
  const zeilen = belegDateiZeilen({
    savedNames: saved,
    pending: pending.map((p) => ({ name: p.name, previewUrl: p.url })),
    belegId,
  });

  const iconClass =
    "size-8 shrink-0 text-muted-foreground hover:text-foreground";

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="datei">
        Dateien{" "}
        {mode === "edit" && saved.length > 0
          ? "(weitere hinzufügen)"
          : "(PDF/Bild)"}
      </Label>
      <Input
        ref={inputRef}
        id="datei"
        name="datei"
        type="file"
        multiple
        accept={ACCEPT}
        onChange={onChange}
        className="cursor-pointer file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-secondary-foreground"
      />
      {status ? (
        <p className="text-xs text-muted-foreground">{status}</p>
      ) : null}
      {zeilen.length > 0 ? (
        <ul className="flex flex-col gap-1">
          {zeilen.map((z) => (
              <li key={z.key} className="flex min-w-0 items-center gap-0.5">
                <span
                  className="min-w-0 flex-1 truncate text-xs text-muted-foreground"
                  title={z.name}
                >
                  {z.name}
                </span>
                {z.anzeigenHref ? (
                  <a
                    href={z.anzeigenHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(
                      buttonVariants({ variant: "ghost", size: "icon" }),
                      iconClass,
                    )}
                    aria-label={`${z.name} anzeigen`}
                    title="Anzeigen"
                  >
                    <Search aria-hidden />
                  </a>
                ) : null}
                {z.kind === "pending" || belegId ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className={iconClass}
                    aria-label={`${z.name} entfernen`}
                    title="Entfernen"
                    disabled={
                      z.kind === "saved" &&
                      isRemoving &&
                      removingName === z.name
                    }
                    onClick={() => {
                      if (z.kind === "pending") {
                        removePendingAt(z.pendingIndex ?? 0);
                      } else {
                        removeSaved(z.name);
                      }
                    }}
                  >
                    <X aria-hidden />
                  </Button>
                ) : null}
              </li>
          ))}
        </ul>
      ) : null}
      <p className="text-xs text-muted-foreground">
        Mehrere Fotos möglich, etwa Vorder- und Rückseite (bis{" "}
        {BELEG_DATEI_MAX_ANZAHL} Dateien). Fotos werden vor dem Speichern
        verkleinert. PDF bleibt unverändert.
      </p>
    </div>
  );
}

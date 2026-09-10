"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";

type Props = {
  action: (formData: FormData) => Promise<void>;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  className?: string;
  children: React.ReactNode;
};

/**
 * Formular, das vor dem Submit ein Bestätigungs-Modal zeigt.
 * Nach Bestätigung wird dasselbe Formular (inkl. Felder) abgeschickt.
 */
export function ConfirmForm({
  action,
  title,
  message,
  confirmLabel = "Bestätigen",
  cancelLabel = "Abbrechen",
  className,
  children,
}: Props) {
  const formRef = useRef<HTMLFormElement>(null);
  const confirmed = useRef(false);
  const [open, setOpen] = useState(false);

  return (
    <>
      <form
        ref={formRef}
        action={action}
        className={className}
        onSubmit={(e) => {
          if (confirmed.current) {
            confirmed.current = false;
            return;
          }
          e.preventDefault();
          setOpen(true);
        }}
      >
        {children}
      </form>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/30 p-4 backdrop-blur-[2px]"
          role="presentation"
          onClick={() => setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
            className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-toast"
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              id="confirm-title"
              className="text-base font-semibold text-foreground"
            >
              {title}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">{message}</p>
            <div className="mt-5 flex justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setOpen(false)}
              >
                {cancelLabel}
              </Button>
              <Button
                type="button"
                variant="danger"
                size="sm"
                onClick={() => {
                  confirmed.current = true;
                  setOpen(false);
                  formRef.current?.requestSubmit();
                }}
              >
                {confirmLabel}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

import Link from "next/link";
import { E_RECHNUNG_PROFIL_LABELS, formatDateTimeDe } from "@/lib/labels";
import type { Bankkonto } from "@/modules/banking/types";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { EInvoiceSendProfil, ERechnungVersand } from "./outbound-types";
import {
  erzeugeERechnungVersandAction,
  pruefeERechnungVersandAction,
} from "./send-actions";

export function ERechnungVersandCard({
  rechnungId,
  versand,
  bankkonten,
  defaultProfil,
  geprueft,
}: {
  rechnungId: string;
  versand: ERechnungVersand[];
  bankkonten: Bankkonto[];
  defaultProfil?: EInvoiceSendProfil | "";
  geprueft?: boolean;
}) {
  const mitIban = bankkonten.filter((k) => k.iban);
  const defaultBank = mitIban.length === 1 ? mitIban[0].id : "";
  const vorhandene = new Set(versand.map((v) => v.profil));

  return (
    <Card>
      <CardHeader>
        <CardTitle>E-Rechnung</CardTitle>
        <CardDescription>
          Strukturiertes XML nach EN 16931 aus dieser festgeschriebenen
          Rechnung. Das Original-PDF bleibt unverändert. Kein
          ZUGFeRD-Hybrid-PDF, kein Zertifizierungs-Claim.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {versand.length > 0 ? (
          <ul className="space-y-2 text-sm">
            {versand.map((v) => (
              <li
                key={v.id}
                className="flex flex-wrap items-center justify-between gap-2"
              >
                <span>
                  {E_RECHNUNG_PROFIL_LABELS[v.profil]}
                  {v.erzeugt_am ? (
                    <span className="text-muted-foreground">
                      {" "}
                      · {formatDateTimeDe(v.erzeugt_am)}
                    </span>
                  ) : null}
                </span>
                <Link
                  href={`/app/rechnungen/${rechnungId}/e-rechnung/${v.id}`}
                  className={cn(buttonVariants({ size: "sm", variant: "outline" }))}
                >
                  XML herunterladen
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            Noch keine E-Rechnung erzeugt.
          </p>
        )}

        {mitIban.length === 0 ? (
          <p className="text-sm text-destructive">
            Für die E-Rechnung braucht die Firma ein{" "}
            <Link
              href="/app/bankkonten/neu"
              className="underline underline-offset-4"
            >
              Bankkonto mit IBAN
            </Link>
            .
          </p>
        ) : (
          <form className="flex flex-col gap-4">
            <input type="hidden" name="id" value={rechnungId} />
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="profil">Profil</Label>
                <Select
                  id="profil"
                  name="profil"
                  defaultValue={defaultProfil || "xrechnung_ubl"}
                >
                  <option value="xrechnung_ubl">
                    {E_RECHNUNG_PROFIL_LABELS.xrechnung_ubl}
                  </option>
                  <option value="zugferd_cii">
                    {E_RECHNUNG_PROFIL_LABELS.zugferd_cii}
                  </option>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="bankkonto">Bankkonto (IBAN)</Label>
                <Select
                  id="bankkonto"
                  name="bankkonto"
                  defaultValue={defaultBank}
                  required
                >
                  {mitIban.length > 1 ? (
                    <option value="">Bitte wählen</option>
                  ) : null}
                  {mitIban.map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.name} · {k.iban}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
            {geprueft ? (
              <p className="text-sm text-green-700 dark:text-green-400">
                Prüfung ohne Beanstandung — Erzeugen legt das XML unveränderbar
                ab.
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button
                type="submit"
                formAction={pruefeERechnungVersandAction}
                variant="secondary"
                size="sm"
              >
                Prüfen
              </Button>
              <Button
                type="submit"
                formAction={erzeugeERechnungVersandAction}
                size="sm"
                disabled={vorhandene.size === 2}
              >
                E-Rechnung erzeugen
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              XRechnung braucht Leitweg-ID/Käuferreferenz und E-Mail an Firma
              und Kontakt. ZUGFeRD-CII ist dasselbe fachliche XML-Profil ohne
              diese Extra-Pflichten. Ein Profil nur einmal — kein
              Überschreiben.
            </p>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

import { formatMoneyDe, subMoney } from "@/lib/money";
import type { RcSnapshot } from "./reverse-charge";
export const RC_KU_HINWEIS = "Auch als Kleinunternehmer schulden Sie zusätzliche Steuer nach § 13b. Für den hier unterstützten Fall besteht kein Vorsteuerabzug. Die Erklärung muss gegebenenfalls separat erfolgen.";
export function RcDetails({ rc }: { rc: RcSnapshot }) {
  const items = [
    ["Rechnungsbetrag", formatMoneyDe(rc.grundlage, { currency: true })],
    ["Deutsche Umsatzsteuer", formatMoneyDe(rc.schuld, { currency: true })],
    ["Abziehbare Vorsteuer", formatMoneyDe(rc.vorsteuer, { currency: true })],
    ["Auswirkung Zahllast", formatMoneyDe(subMoney(rc.schuld, rc.vorsteuer), { currency: true })],
  ];
  return <section className="space-y-3 rounded-md border p-3 text-sm" aria-label="Berechnete RC-Steuerdetails">
    <p className="font-medium">Reverse Charge</p>
    <dl className="grid gap-3 sm:grid-cols-2">{items.map(([label, value]) => <div key={label}><dt className="text-muted-foreground">{label}</dt><dd>{value}</dd></div>)}</dl>
    <p className="text-muted-foreground">Steuerzeitraum: {rc.steuerdatum.slice(5, 7)}.{rc.steuerdatum.slice(0, 4)}</p>
  </section>;
}

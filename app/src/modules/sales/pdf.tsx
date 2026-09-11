/**
 * Rechnungs- und Angebots-PDF mit @react-pdf/renderer (ADR-0014).
 * DIN-5008-Form-B-Adressfeld, Akzent-Tabelle, Fuß-Spalten; GiroCode nur auf Rechnungen.
 * Entwurf: Wasserzeichen, keine Nummer. Original: persistiert, ohne Wasserzeichen.
 * Nur serverseitig aufrufen.
 */

import React from "react";
import {
  Document,
  Image as PdfImage,
  Page,
  Text,
  View,
  StyleSheet,
  pdf,
} from "@react-pdf/renderer";
import { formatMoneyDe } from "@/lib/money";
import type { FirmaRecord, Steuermodus } from "@/lib/pb";
import type { Kontakt } from "@/modules/contacts/types";
import { buildGirocodePayload } from "./girocode";
import { renderGirocodeDataUri } from "./girocode-qr";
import {
  KLEINUNTERNEHMER_HINWEIS,
  ustStaffelAusPositionen,
  type UstStaffelZeile,
} from "./invariants";
import {
  DEFAULT_DOKUMENT_AKZENTFARBE,
  PDF_ADRESSFELD_HEIGHT,
  PDF_ADRESSFELD_LEFT,
  PDF_ADRESSFELD_TOP,
  PDF_ADRESSFELD_WIDTH,
  PDF_FUSSTEXT_MARGIN_TOP,
  PDF_KOPF_RESERVE_HEIGHT,
  PDF_PAGE_PADDING_BOTTOM,
  PDF_PAGE_PADDING_LEFT,
  PDF_PAGE_PADDING_RIGHT,
  PDF_PAGE_PADDING_TOP,
  PDF_WASSERZEICHEN_ENTWURF,
  defaultDokumentPdfLayout,
  dokumentTitel,
  firmaAbsenderzeile,
  footerStammdatenSpalten,
  footerTextZeilen,
  formatLeistungszeitraum,
  formatPdfDateDe,
  kontrastTextAuf,
  pdfLogoBoxFromDataUri,
  zahlungshinweisRechnung,
  type DokumentPdfLayout,
} from "./pdf-layout";
import type {
  Angebot,
  Angebotsposition,
  Rechnung,
  Rechnungsposition,
} from "./types";

const POSITION_FONT_SIZE = 9;

const styles = StyleSheet.create({
  page: {
    paddingTop: PDF_PAGE_PADDING_TOP,
    paddingLeft: PDF_PAGE_PADDING_LEFT,
    paddingRight: PDF_PAGE_PADDING_RIGHT,
    paddingBottom: PDF_PAGE_PADDING_BOTTOM,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: "#111",
  },
  watermark: {
    position: "absolute",
    top: 300,
    left: 40,
    right: 40,
    textAlign: "center",
    fontSize: 64,
    fontFamily: "Helvetica-Bold",
    color: "#D0D0D0",
    letterSpacing: 6,
    transform: "rotate(-28deg)",
  },
  adressfeld: {
    position: "absolute",
    top: PDF_ADRESSFELD_TOP,
    left: PDF_ADRESSFELD_LEFT,
    width: PDF_ADRESSFELD_WIDTH,
    height: PDF_ADRESSFELD_HEIGHT,
  },
  kopfReserve: {
    minHeight: PDF_KOPF_RESERVE_HEIGHT,
    alignItems: "flex-end",
    marginBottom: 22,
  },
  empfaengerCol: {
    width: "100%",
  },
  firmaCol: {
    width: "40%",
    alignItems: "flex-end",
  },
  absenderzeile: {
    fontSize: 7.5,
    color: "#555",
    marginBottom: 3,
  },
  absenderlinie: {
    borderBottomWidth: 1,
    marginBottom: 8,
    width: "92%",
  },
  logo: {
    objectFit: "contain",
    marginBottom: 6,
    alignSelf: "flex-end",
  },
  firmaName: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    marginBottom: 4,
    textAlign: "right",
  },
  firmaZeile: {
    fontSize: 8.5,
    color: "#444",
    lineHeight: 1.35,
    textAlign: "right",
  },
  empfaengerName: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    marginBottom: 2,
  },
  empfaengerZeile: {
    fontSize: 10,
    lineHeight: 1.35,
  },
  title: {
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    marginBottom: 10,
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 14,
    gap: 8,
  },
  metaItem: {
    marginRight: 18,
    fontSize: 9,
    color: "#333",
  },
  metaLabel: {
    color: "#555",
  },
  kopftext: {
    marginBottom: 14,
    fontSize: 9.5,
    color: "#222",
    lineHeight: 1.45,
  },
  table: {
    marginTop: 4,
    marginBottom: 12,
  },
  tableHeader: {
    flexDirection: "row",
    paddingVertical: 6,
    paddingHorizontal: 6,
    fontFamily: "Helvetica-Bold",
    fontSize: 8,
  },
  positionDescription: {
    fontSize: POSITION_FONT_SIZE - 2,
    color: "#52525B",
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 6,
    paddingHorizontal: 6,
    fontSize: POSITION_FONT_SIZE,
    alignItems: "flex-start",
  },
  totals: {
    marginTop: 4,
    alignItems: "flex-end",
  },
  totalRow: {
    flexDirection: "row",
    width: 280,
    justifyContent: "space-between",
    marginBottom: 3,
    fontSize: 9,
  },
  staffelRow: {
    flexDirection: "row",
    width: 280,
    justifyContent: "space-between",
    marginBottom: 2,
    fontSize: 8.5,
    color: "#333",
  },
  totalBold: {
    fontFamily: "Helvetica-Bold",
    marginTop: 4,
    borderTopWidth: 1.5,
    paddingTop: 5,
    fontSize: 10,
  },
  zahlblock: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginTop: 18,
    gap: 14,
  },
  girocode: {
    width: 78,
    height: 78,
  },
  zahltext: {
    flex: 1,
    fontSize: 9,
    lineHeight: 1.45,
    color: "#222",
  },
  hinweis: {
    marginTop: 16,
    fontSize: 8.5,
    color: "#333",
    fontStyle: "italic",
    lineHeight: 1.4,
  },
  notiz: {
    marginTop: 14,
    fontSize: 9,
    lineHeight: 1.4,
  },
  notizLabel: {
    fontFamily: "Helvetica-Bold",
    marginBottom: 2,
  },
  fusstextBlock: {
    marginTop: PDF_FUSSTEXT_MARGIN_TOP,
  },
  footerTextZeile: {
    fontFamily: "Helvetica",
    fontSize: 9,
    color: "#333",
    lineHeight: 1.2,
    marginBottom: 1,
  },
  footer: {
    position: "absolute",
    bottom: 22,
    left: PDF_PAGE_PADDING_LEFT,
    right: PDF_PAGE_PADDING_RIGHT,
  },
  footerCols: {
    flexDirection: "row",
    gap: 14,
  },
  footerCol: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
  },
  footerColZeile: {
    fontFamily: "Helvetica",
    fontSize: 7,
    color: "#666",
    lineHeight: 1.2,
    marginBottom: 1,
  },
});

type PdfPosition = {
  id?: string;
  sortierung: number;
  bezeichnung: string;
  description?: string;
  menge: string;
  einheit: string;
  einzelpreis: string;
  steuersatz: string;
  betrag_netto: string;
  betrag_ust: string;
  betrag_brutto: string;
};

function resolveLayout(layout?: DokumentPdfLayout): DokumentPdfLayout {
  return layout ?? defaultDokumentPdfLayout();
}

function addressLines(opts: {
  name: string;
  strasse?: string;
  plz?: string;
  ort?: string;
  land?: string;
}): string[] {
  const lines = [opts.name];
  if (opts.strasse) lines.push(opts.strasse);
  const city = [opts.plz, opts.ort].filter(Boolean).join(" ");
  if (city) lines.push(city);
  if (opts.land && opts.land !== "DE") lines.push(opts.land);
  return lines;
}

function colWidths(showUst: boolean) {
  return showUst
    ? {
        pos: "5%",
        bez: "27%",
        menge: "8%",
        einheit: "11%",
        preis: "14%",
        ust: "7%",
        ustBetrag: "13%",
        summe: "15%",
      }
    : {
        pos: "7%",
        bez: "36%",
        menge: "11%",
        einheit: "14%",
        preis: "16%",
        ust: "0%",
        ustBetrag: "0%",
        summe: "16%",
      };
}

function FirmaBlock({
  firma,
  layout,
  accent,
}: {
  firma: FirmaRecord;
  layout: DokumentPdfLayout;
  accent: string;
}) {
  if (!layout.headerDrucken) return null;
  const extra = [
    firma.steuernummer ? `Steuernr.: ${firma.steuernummer}` : "",
    firma.ust_id ? `USt-IdNr.: ${firma.ust_id}` : "",
  ].filter(Boolean);
  return (
    <View style={styles.firmaCol}>
      {layout.logoDataUri ? (
        <PdfImage
          src={layout.logoDataUri}
          style={[styles.logo, pdfLogoBoxFromDataUri(layout.logoDataUri)]}
        />
      ) : null}
      <Text style={[styles.firmaName, { color: accent }]}>{firma.name}</Text>
      {firma.strasse ? (
        <Text style={styles.firmaZeile}>{firma.strasse}</Text>
      ) : null}
      {firma.plz || firma.ort ? (
        <Text style={styles.firmaZeile}>
          {[firma.plz, firma.ort].filter(Boolean).join(" ")}
        </Text>
      ) : null}
      {extra.map((l) => (
        <Text key={l} style={styles.firmaZeile}>
          {l}
        </Text>
      ))}
    </View>
  );
}

function EmpfaengerBlock({
  firma,
  kunde,
  layout,
  accent,
}: {
  firma: FirmaRecord;
  kunde: Kontakt;
  layout: DokumentPdfLayout;
  accent: string;
}) {
  const kundeLines = addressLines({
    name: kunde.name,
    strasse: kunde.strasse,
    plz: kunde.plz,
    ort: kunde.ort,
    land: kunde.land,
  });
  const absender = firmaAbsenderzeile({
    name: firma.name,
    strasse: firma.strasse,
    plz: firma.plz,
    ort: firma.ort,
  });
  return (
    <View style={styles.empfaengerCol}>
      {layout.headerDrucken && absender ? (
        <>
          <Text style={styles.absenderzeile}>{absender}</Text>
          <View style={[styles.absenderlinie, { borderBottomColor: accent }]} />
        </>
      ) : null}
      {kundeLines.map((l, i) => (
        <Text
          key={`${i}-${l}`}
          style={i === 0 ? styles.empfaengerName : styles.empfaengerZeile}
        >
          {l}
        </Text>
      ))}
    </View>
  );
}

function DokumentFusstext({ layout }: { layout: DokumentPdfLayout }) {
  if (!layout.fussDrucken) return null;
  const zeilen = footerTextZeilen(layout.fusstext);
  if (zeilen.length === 0) return null;
  return (
    <View style={styles.fusstextBlock} wrap={false}>
      {zeilen.map((z, i) => (
        <Text key={`fuss-${i}`} style={styles.footerTextZeile}>
          {z}
        </Text>
      ))}
    </View>
  );
}

function DokumentFussStammdaten({
  firma,
  layout,
}: {
  firma: FirmaRecord;
  layout: DokumentPdfLayout;
}) {
  if (!layout.fussDrucken) return null;
  const spalten = footerStammdatenSpalten({
    firma: {
      name: firma.name,
      telefon: firma.telefon,
      email: firma.email,
      webseite: firma.webseite,
      steuernummer: firma.steuernummer,
      ust_id: firma.ust_id,
    },
    bank: layout.bank,
  });
  if (spalten.length === 0) return null;
  return (
    <View style={styles.footer} fixed>
      <View style={styles.footerCols}>
        {spalten.map((s, i) => (
          <View key={`col-${i}`} style={styles.footerCol}>
            {s.zeilen.map((z, j) => (
              <Text key={`col-${i}-${j}`} style={styles.footerColZeile}>
                {z}
              </Text>
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}

function Positionstabelle({
  positionen,
  showUst,
  accent,
}: {
  positionen: PdfPosition[];
  showUst: boolean;
  accent: string;
}) {
  const w = colWidths(showUst);
  const headColor = kontrastTextAuf(accent);
  const sorted = [...positionen].sort((a, b) => a.sortierung - b.sortierung);
  return (
    <View style={styles.table}>
      <View
        style={[
          styles.tableHeader,
          { backgroundColor: accent, color: headColor },
        ]}
      >
        <Text style={{ width: w.pos }}>Pos</Text>
        <Text style={{ width: w.bez }}>Beschreibung</Text>
        <Text style={{ width: w.menge, textAlign: "right" }}>Menge</Text>
        <Text style={{ width: w.einheit, paddingLeft: 6 }}>Einheit</Text>
        <Text style={{ width: w.preis, textAlign: "right" }}>
          {showUst ? "Einzelpreis (Netto)" : "Einzelpreis"}
        </Text>
        {showUst ? (
          <Text style={{ width: w.ust, textAlign: "right" }}>MwSt.</Text>
        ) : null}
        {showUst ? (
          <Text style={{ width: w.ustBetrag, textAlign: "right" }}>USt.</Text>
        ) : null}
        <Text style={{ width: w.summe, textAlign: "right" }}>
          {showUst ? "Gesamt (Netto)" : "Gesamt"}
        </Text>
      </View>
      {sorted.map((p, i) => {
        const menge = (p.menge ?? "").replace(".", ",");
        const einheit = (p.einheit ?? "").trim();
        return (
          <View
            key={p.id || `${p.sortierung}-${p.bezeichnung}`}
            wrap={Boolean(p.description?.trim())}
            style={[
              styles.tableRow,
              i % 2 === 0 ? { backgroundColor: "#F4F4F5" } : {},
            ]}
          >
            <Text style={{ position: "absolute", left: 6, top: 6, width: w.pos }}>{String(i + 1)}</Text>
            <View style={{ width: w.bez, marginLeft: w.pos }}>
              <Text>{p.bezeichnung}</Text>
              {p.description?.trim() ? (
                <Text style={styles.positionDescription}>{p.description}</Text>
              ) : null}
            </View>
            <Text style={{ width: w.menge, textAlign: "right" }}>
              {menge || "—"}
            </Text>
            <Text style={{ width: w.einheit, paddingLeft: 6 }}>
              {einheit || "—"}
            </Text>
            <Text style={{ width: w.preis, textAlign: "right" }}>
              {formatMoneyDe(p.einzelpreis, { currency: true })}
            </Text>
            {showUst ? (
              <Text style={{ width: w.ust, textAlign: "right" }}>
                {p.steuersatz ? `${p.steuersatz} %` : "—"}
              </Text>
            ) : null}
            {showUst ? (
              <Text style={{ width: w.ustBetrag, textAlign: "right" }}>
                {formatMoneyDe(p.betrag_ust || "0", { currency: true })}
              </Text>
            ) : null}
            <Text style={{ width: w.summe, textAlign: "right" }}>
              {formatMoneyDe(showUst ? p.betrag_netto : p.betrag_brutto, {
                currency: true,
              })}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function ustStaffelLabel(z: UstStaffelZeile): string {
  const basis = formatMoneyDe(z.betrag_netto, { currency: true });
  if (z.steuersatz) {
    return `USt. ${z.steuersatz} % auf ${basis}`;
  }
  return `USt. auf ${basis}`;
}

function Summenblock({
  showUst,
  staffel,
  betragNetto,
  betragBrutto,
  accent,
}: {
  showUst: boolean;
  staffel: UstStaffelZeile[];
  betragNetto: string;
  betragBrutto: string;
  accent: string;
}) {
  if (!showUst) {
    return (
      <View style={styles.totals} wrap={false}>
        <View
          style={[
            styles.totalRow,
            styles.totalBold,
            { borderTopColor: accent, color: accent },
          ]}
        >
          <Text>Gesamt</Text>
          <Text>{formatMoneyDe(betragBrutto, { currency: true })}</Text>
        </View>
      </View>
    );
  }
  return (
    <View style={styles.totals} wrap={false}>
      <View style={styles.totalRow}>
        <Text>Gesamt Netto</Text>
        <Text>{formatMoneyDe(betragNetto, { currency: true })}</Text>
      </View>
      {staffel.map((z) => (
        <View
          key={z.steuersatz || "ohne"}
          style={styles.staffelRow}
        >
          <Text>{ustStaffelLabel(z)}</Text>
          <Text>{formatMoneyDe(z.betrag_ust, { currency: true })}</Text>
        </View>
      ))}
      <View
        style={[
          styles.totalRow,
          styles.totalBold,
          { borderTopColor: accent, color: accent },
        ]}
      >
        <Text>Gesamt Brutto</Text>
        <Text>{formatMoneyDe(betragBrutto, { currency: true })}</Text>
      </View>
    </View>
  );
}

type MetaItem = { label: string; value: string };

function DokumentSeite({
  firma,
  kunde,
  layout,
  entwurf,
  titel,
  meta,
  positionen,
  showUst,
  staffel,
  betragNetto,
  betragBrutto,
  kleinunternehmer,
  notiz,
  zahlungstext,
  girocodeDataUri,
}: {
  firma: FirmaRecord;
  kunde: Kontakt;
  layout: DokumentPdfLayout;
  entwurf: boolean;
  titel: string;
  meta: MetaItem[];
  positionen: PdfPosition[];
  showUst: boolean;
  staffel: UstStaffelZeile[];
  betragNetto: string;
  betragBrutto: string;
  kleinunternehmer: boolean;
  notiz?: string;
  zahlungstext?: string;
  girocodeDataUri?: string;
}) {
  const accent = layout.akzentfarbe || DEFAULT_DOKUMENT_AKZENTFARBE;
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {entwurf ? (
          <Text style={styles.watermark}>{PDF_WASSERZEICHEN_ENTWURF}</Text>
        ) : null}

        <View style={styles.adressfeld} wrap={false}>
          <EmpfaengerBlock
            firma={firma}
            kunde={kunde}
            layout={layout}
            accent={accent}
          />
        </View>

        <View style={styles.kopfReserve}>
          <FirmaBlock firma={firma} layout={layout} accent={accent} />
        </View>

        <Text style={[styles.title, { color: accent }]}>{titel}</Text>

        {meta.length > 0 ? (
          <View style={styles.metaRow}>
            {meta.map((m) => (
              <Text key={m.label} style={styles.metaItem}>
                <Text style={styles.metaLabel}>{m.label}: </Text>
                {m.value}
              </Text>
            ))}
          </View>
        ) : null}

        {layout.kopftext ? (
          <Text style={styles.kopftext}>{layout.kopftext}</Text>
        ) : null}

        <Positionstabelle
          positionen={positionen}
          showUst={showUst}
          accent={accent}
        />

        <Summenblock
          showUst={showUst}
          staffel={staffel}
          betragNetto={betragNetto}
          betragBrutto={betragBrutto}
          accent={accent}
        />

        {zahlungstext ? (
          <View style={styles.zahlblock} wrap={false}>
            {girocodeDataUri ? (
              <PdfImage src={girocodeDataUri} style={styles.girocode} />
            ) : null}
            <Text style={styles.zahltext}>{zahlungstext}</Text>
          </View>
        ) : null}

        {kleinunternehmer ? (
          <Text style={styles.hinweis}>{KLEINUNTERNEHMER_HINWEIS}</Text>
        ) : null}

        {notiz ? (
          <View style={styles.notiz}>
            <Text style={styles.notizLabel}>Hinweis</Text>
            <Text>{notiz}</Text>
          </View>
        ) : null}

        <DokumentFusstext layout={layout} />
        <DokumentFussStammdaten firma={firma} layout={layout} />
      </Page>
    </Document>
  );
}

export type RechnungPdfData = {
  rechnung: Rechnung;
  positionen: Rechnungsposition[];
  firma: FirmaRecord;
  kunde: Kontakt;
  /** Bereits vergebene Nummer (bei Festschreibung); leer im Entwurf */
  rechnungsnummer?: string;
  entwurf?: boolean;
  layout?: DokumentPdfLayout;
};

function rechnungMeta(rechnung: Rechnung): MetaItem[] {
  const items: MetaItem[] = [];
  const datum = formatPdfDateDe(rechnung.rechnungsdatum);
  if (datum) items.push({ label: "Datum", value: datum });
  const faellig = formatPdfDateDe(rechnung.faellig_am);
  if (faellig) items.push({ label: "Zahlbar bis", value: faellig });
  const leistung = formatLeistungszeitraum(
    rechnung.leistungszeitraum_von,
    rechnung.leistungszeitraum_bis,
  );
  if (leistung) {
    const von = formatPdfDateDe(rechnung.leistungszeitraum_von);
    const bis = formatPdfDateDe(rechnung.leistungszeitraum_bis);
    const label =
      von && bis && von !== bis ? "Leistungszeitraum" : "Leistungsdatum";
    items.push({ label, value: leistung });
  }
  return items;
}

export async function renderRechnungPdf(
  data: RechnungPdfData,
): Promise<Buffer> {
  const layout = resolveLayout(data.layout);
  const entwurf = Boolean(data.entwurf);
  const nummer = data.rechnungsnummer || data.rechnung.rechnungsnummer;
  const showUst = data.rechnung.steuermodus === "regelbesteuerung_ist";
  const staffel = showUst ? ustStaffelAusPositionen(data.positionen) : [];

  let girocodeDataUri: string | undefined;
  let zahlungstext: string | undefined;
  if (layout.zahlblock) {
    zahlungstext = zahlungshinweisRechnung({
      betrag: data.rechnung.betrag_brutto,
      faelligAm: data.rechnung.faellig_am,
      entwurf,
      hatBank: Boolean(layout.bank?.iban),
    });
    if (layout.bank?.iban) {
      const payload = buildGirocodePayload({
        empfaenger: data.firma.name,
        iban: layout.bank.iban,
        bic: layout.bank.bic,
        betrag: data.rechnung.betrag_brutto,
        verwendungszweck: entwurf
          ? "Rechnung (Entwurf)"
          : (nummer || "").trim() || "Rechnung",
      });
      if (payload) {
        girocodeDataUri = await renderGirocodeDataUri(payload);
      }
    }
  }

  const instance = pdf(
    <DokumentSeite
      firma={data.firma}
      kunde={data.kunde}
      layout={layout}
      entwurf={entwurf}
      titel={dokumentTitel({ art: "rechnung", entwurf, nummer })}
      meta={rechnungMeta(data.rechnung)}
      positionen={data.positionen}
      showUst={showUst}
      staffel={staffel}
      betragNetto={data.rechnung.betrag_netto}
      betragBrutto={data.rechnung.betrag_brutto}
      kleinunternehmer={data.rechnung.steuermodus === "kleinunternehmer"}
      notiz={data.rechnung.notiz}
      zahlungstext={zahlungstext}
      girocodeDataUri={girocodeDataUri}
    />,
  );
  const blob = await instance.toBlob();
  const ab = await blob.arrayBuffer();
  return Buffer.from(ab);
}

export function steuermodusLabel(m: Steuermodus): string {
  return m === "kleinunternehmer"
    ? "Kleinunternehmerregelung (§ 19 UStG)"
    : "Regelbesteuerung";
}

export type AngebotPdfData = {
  angebot: Angebot;
  positionen: Angebotsposition[];
  firma: FirmaRecord;
  kunde: Kontakt;
  angebotsnummer?: string;
  entwurf?: boolean;
  layout?: DokumentPdfLayout;
};

function angebotMeta(angebot: Angebot): MetaItem[] {
  const items: MetaItem[] = [];
  const datum = formatPdfDateDe(angebot.angebotsdatum);
  if (datum) items.push({ label: "Datum", value: datum });
  const bis = formatPdfDateDe(angebot.gueltig_bis);
  if (bis) items.push({ label: "Gültig bis", value: bis });
  return items;
}

export async function renderAngebotPdf(data: AngebotPdfData): Promise<Buffer> {
  const layout = resolveLayout(data.layout);
  const entwurf = Boolean(data.entwurf);
  const nummer = data.angebotsnummer || data.angebot.angebotsnummer;
  const showUst = data.angebot.steuermodus === "regelbesteuerung_ist";
  const staffel = showUst ? ustStaffelAusPositionen(data.positionen) : [];

  const instance = pdf(
    <DokumentSeite
      firma={data.firma}
      kunde={data.kunde}
      layout={layout}
      entwurf={entwurf}
      titel={dokumentTitel({ art: "angebot", entwurf, nummer })}
      meta={angebotMeta(data.angebot)}
      positionen={data.positionen}
      showUst={showUst}
      staffel={staffel}
      betragNetto={data.angebot.betrag_netto}
      betragBrutto={data.angebot.betrag_brutto}
      kleinunternehmer={data.angebot.steuermodus === "kleinunternehmer"}
      notiz={data.angebot.notiz}
    />,
  );
  const blob = await instance.toBlob();
  const ab = await blob.arrayBuffer();
  return Buffer.from(ab);
}

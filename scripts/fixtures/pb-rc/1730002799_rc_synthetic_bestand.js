// Test-only migration before RC schema addition. Never copied into production migrations.
migrate(app => {
  if (app.findRecordsByFilter('firmen', 'id != ""', '', 1, 0).length) throw new Error('RC fixture refuses a nonempty database');
  const firma = new Record(app.findCollectionByNameOrId('firmen'));
  firma.id = 'rcmigration0001';
  firma.load({ name: 'RC migration synthetic', steuermodus: 'regelbesteuerung_ist', skr: 'skr03', nummernkreise: { beleg: { prefix: 'B-', next: 1, digits: 4 } } });
  app.save(firma);
  for (const rate of ['19', '7', '0']) {
    const id = 'rclegacy' + rate.padStart(2, '0') + '00001';
    const journal = 'rclegacy' + rate.padStart(2, '0') + '00002';
    const tax = rate + '.00';
    const gross = String(100 + Number(rate)) + '.00';
    app.db().newQuery('INSERT INTO belege (id, firma, belegdatum, buchungsdatum, richtung, betrag_netto, betrag_ust, betrag_brutto, steuersatz, status, belegnummer, journal_eintrag, festgeschrieben_am, notiz) VALUES ({:id}, {:firma}, "2026-01-02", "2026-01-02", "ausgabe", "100.00", {:tax}, {:gross}, {:rate}, "festgeschrieben", {:number}, {:journal}, "2026-01-02T12:00:00.000Z", "Synthetic legacy")').bind({ id, firma: firma.id, tax, gross, rate, number: 'B-ALT-' + rate, journal }).execute();
    app.db().newQuery('INSERT INTO buchungsjournal (id, firma, laufende_nr, quelle_typ, quelle_id, buchungsdatum, belegdatum, buchungstext, richtung, betrag_netto, betrag_ust, betrag_brutto, steuersatz, festgeschrieben_am) VALUES ({:journal}, {:firma}, {:nr}, "beleg", {:id}, "2026-01-02", "2026-01-02", {:text}, "ausgabe", "100.00", {:tax}, {:gross}, {:rate}, "2026-01-02T12:00:00.000Z")').bind({ journal, firma: firma.id, nr: Number(rate) + 1, id, tax, gross, rate, text: 'Beleg B-ALT-' + rate + ' — Synthetic legacy' }).execute();
  }
}, () => {});

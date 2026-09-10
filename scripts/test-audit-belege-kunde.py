"""Regressionen der lesenden TP-021-Prüfung, ausschließlich synthetisches SQLite."""

import importlib.util
from pathlib import Path
import sqlite3
import tarfile
import tempfile
import unittest

spec = importlib.util.spec_from_file_location("audit", Path(__file__).with_name("audit-belege-kunde.py"))
audit = importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit)


def seed(db, kunde_field=True, kunde="", supplier="k1", journal_contact="k1", applied=False):
    kunde_sql = ",kunde TEXT" if kunde_field else ""
    db.executescript("""
        CREATE TABLE belege (id TEXT,firma TEXT,richtung TEXT,status TEXT,lieferant TEXT,
          journal_eintrag TEXT,betrag_netto TEXT,betrag_ust TEXT,betrag_brutto TEXT,
          steuersatz TEXT,konto TEXT,belegdatum TEXT,buchungsdatum TEXT""" + kunde_sql + """);
        CREATE TABLE buchungsjournal (id TEXT,firma TEXT,quelle_typ TEXT,quelle_id TEXT,
          kontakt TEXT,richtung TEXT,betrag_netto TEXT,betrag_ust TEXT,betrag_brutto TEXT,
          steuersatz TEXT,konto TEXT,belegdatum TEXT,buchungsdatum TEXT);
        CREATE TABLE kontakte (id TEXT,firma TEXT,ist_kunde INTEGER);
        CREATE TABLE _migrations (file TEXT,applied INTEGER);
    """)
    values = ["b1", "f1", "einnahme", "festgeschrieben", supplier, "j1", "100.00", "19.00",
              "119.00", "19", "8400", "2026-08-01", "2026-08-01"]
    if kunde_field:
        values.append(kunde)
    db.execute("INSERT INTO belege VALUES (" + ",".join("?" for _ in values) + ")", values)
    db.execute("INSERT INTO buchungsjournal VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
               ["j1", "f1", "beleg", "b1", journal_contact, "einnahme", "100.00", "19.00",
                "119.00", "19", "8400", "2026-08-01", "2026-08-01"])
    db.execute("INSERT INTO kontakte VALUES ('k1','f1',1)")
    if applied:
        db.execute("INSERT INTO _migrations VALUES (?,1)", (audit.MIGRATION,))
    db.commit()


class AuditTest(unittest.TestCase):
    def test_vor_migration_ohne_kundenfeld(self):
        with sqlite3.connect(":memory:") as db:
            seed(db, kunde_field=False)
            result = audit.analyse(db)
            self.assertFalse(result["migration_angewendet"])
            self.assertEqual(result["selektiert"], 1)
            self.assertEqual(result["selektiert_festgeschrieben"], 1)
            self.assertEqual(result["selektiert_mit_journal"], 1)
            self.assertEqual(result["auffaellige_belege"], 0)
            self.assertEqual(result["fallliste"][0]["migrationswirkung"], "verschieben")
            with self.assertRaises(sqlite3.OperationalError):
                db.execute("DELETE FROM belege")

    def test_nach_kontaktverlust_ist_keine_erneute_selektion_noetig(self):
        with sqlite3.connect(":memory:") as db:
            seed(db, supplier="", applied=True)
            result = audit.analyse(db)
            self.assertEqual(result["selektiert"], 0)
            self.assertEqual(result["auffaellige_belege"], 1)
            self.assertEqual(result["fallliste"][0]["auffaelligkeiten"], ["journalkontakt_abweichend"])
            self.assertIsNone(result["historisch_veraenderte_anzahl"])

    def test_verschobener_kontakt_bleibt_konsistent(self):
        with sqlite3.connect(":memory:") as db:
            seed(db, kunde="k1", supplier="", applied=True)
            result = audit.analyse(db)
            self.assertEqual(result["selektiert"], 0)
            self.assertEqual(result["auffaellige_belege"], 0)

    def test_fehlender_rueckverweis_und_betragsabweichung(self):
        with sqlite3.connect(":memory:") as db:
            seed(db, kunde="k1", supplier="")
            db.execute("UPDATE buchungsjournal SET quelle_id='andererbeleg',betrag_brutto='120.00'")
            result = audit.analyse(db)
            self.assertIn("betrag_brutto_abweichend", result["fallliste"][0]["auffaelligkeiten"])
            self.assertEqual(len(result["rueckverweis_auffaelligkeiten"]), 1)

    def test_archiv_und_datenbank_bleiben_bytegleich(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            with sqlite3.connect(root / "data.db") as db:
                seed(db, kunde="k1", supplier="", applied=True)
            archive = root / "backup.tar.gz"
            with tarfile.open(archive, "w:gz") as tar:
                tar.add(root / "data.db", arcname="./data.db")
            before = audit.sha256(archive)
            result = audit.audit_archive(archive)
            self.assertEqual(before, audit.sha256(archive))
            self.assertEqual(result["dateien_vorher"], result["dateien_nachher"])
            self.assertEqual(result["vorhandene_records_veraendert"], 0)


if __name__ == "__main__":
    unittest.main()

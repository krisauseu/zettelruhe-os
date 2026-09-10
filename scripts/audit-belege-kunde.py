#!/usr/bin/env python3
"""TP-021: Nur ein offline erstelltes PB-Tar-Backup lesen, niemals eine Live-DB.

python3 scripts/audit-belege-kunde.py backups/pb_data-....tar.gz
Exit 0: keine Kandidaten/Auffälligkeiten; 2: Prüfung vor Update erforderlich.
Auch Exit 0 beweist ohne Vorher-Backup keine historische Änderungsmenge.
Es werden nur Datenbankdateien in ein privates temporäres Verzeichnis kopiert.
"""

import argparse
import hashlib
import json
from pathlib import Path, PurePosixPath
import sqlite3
import tarfile
import tempfile


MIGRATION = "1730002600_belege_kunde.js"


def sha256(path):
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def analyse(db):
    db.row_factory = sqlite3.Row
    db.execute("PRAGMA query_only=ON")
    integrity = db.execute("PRAGMA integrity_check").fetchone()[0]
    if integrity != "ok":
        raise ValueError("SQLite integrity_check fehlgeschlagen")
    columns = {r["name"] for r in db.execute("PRAGMA table_info(belege)")}
    # Vor 1730002600 ist das Feld nicht vorhanden und effektiv leer.
    kunde = "kunde" if "kunde" in columns else "'' AS kunde"
    belege = [dict(r) for r in db.execute(
        "SELECT id,firma,richtung,status,lieferant," + kunde + ",journal_eintrag,"
        "betrag_netto,betrag_ust,betrag_brutto,steuersatz,konto,belegdatum,buchungsdatum "
        "FROM belege ORDER BY id"
    )]
    journal = {r["id"]: dict(r) for r in db.execute("SELECT * FROM buchungsjournal")}
    kontakte = {r["id"]: dict(r) for r in db.execute("SELECT id,firma,ist_kunde FROM kontakte")}
    applied = db.execute("SELECT applied FROM _migrations WHERE file=?", (MIGRATION,)).fetchone()
    rows = []
    candidates = []
    for b in belege:
        candidate = b["richtung"] == "einnahme" and bool(b["lieferant"]) and not b["kunde"]
        contact = b["kunde"] if "kunde" in columns and b["richtung"] == "einnahme" else b["lieferant"]
        j = journal.get(b["journal_eintrag"])
        issues = []
        if b["journal_eintrag"] and j is None:
            issues.append("journal_verweis_fehlt")
        if b["status"] == "festgeschrieben" and not b["journal_eintrag"]:
            issues.append("festgeschrieben_ohne_journal")
        if b["status"] == "entwurf" and b["journal_eintrag"]:
            issues.append("entwurf_mit_journal")
        if j:
            if (j["firma"], j["quelle_typ"], j["quelle_id"]) != (b["firma"], "beleg", b["id"]):
                issues.append("journal_quelle_abweichend")
            if contact != j["kontakt"]:
                issues.append("journalkontakt_abweichend")
            for field in ("richtung", "betrag_netto", "betrag_ust", "betrag_brutto",
                          "steuersatz", "konto", "belegdatum", "buchungsdatum"):
                if b[field] != j[field]:
                    issues.append(field + "_abweichend")
        for field in ("lieferant", "kunde"):
            if b[field] and b[field] not in kontakte:
                issues.append(field + "_kontakt_fehlt")
            elif b[field] and kontakte[b[field]]["firma"] != b["firma"]:
                issues.append(field + "_firma_abweichend")
        row = {"id": b["id"], "richtung": b["richtung"], "status": b["status"],
               "lieferant_gesetzt": bool(b["lieferant"]), "kunde_gesetzt": bool(b["kunde"]),
               "journal_id": b["journal_eintrag"], "auffaelligkeiten": issues}
        if candidate:
            k = kontakte.get(b["lieferant"])
            row["migrationswirkung"] = "verschieben" if k and k["ist_kunde"] else "leeren"
            candidates.append(row)
        rows.append(row)
    by_id = {b["id"]: b for b in belege}
    reverse_issues = []
    for j in journal.values():
        if j["quelle_typ"] != "beleg":
            continue
        b = by_id.get(j["quelle_id"])
        if not b or b["firma"] != j["firma"] or b["journal_eintrag"] != j["id"]:
            reverse_issues.append({"journal_id": j["id"], "beleg_id": j["quelle_id"]})
    return {
        "integrity_check": integrity,
        "migration_angewendet": bool(applied),
        "historisch_veraenderte_anzahl": None,
        "historische_grenze": "Kein kausaler Vorher/Nachher-Nachweis aus einem einzelnen Snapshot.",
        "belege": len(belege), "journal": len(journal),
        "einnahmen": sum(b["richtung"] == "einnahme" for b in belege),
        "festgeschrieben": sum(b["status"] == "festgeschrieben" for b in belege),
        "mit_journal": sum(bool(b["journal_eintrag"]) for b in belege),
        "selektiert": len(candidates),
        "selektiert_festgeschrieben": sum(b["status"] == "festgeschrieben" for b in candidates),
        "selektiert_mit_journal": sum(bool(b["journal_id"]) for b in candidates),
        "auffaellige_belege": sum(bool(b["auffaelligkeiten"]) for b in rows),
        "rueckverweis_auffaelligkeiten": reverse_issues,
        "fallliste": rows,
    }


def audit_archive(archive):
    archive_hash = sha256(archive)
    with tempfile.TemporaryDirectory(prefix="zettelruhe-tp021-") as temp:
        root = Path(temp)
        with tarfile.open(archive, "r:*") as tar:
            members = [m for m in tar.getmembers() if PurePosixPath(m.name).name == "data.db"]
            if len(members) != 1 or not members[0].isfile():
                raise ValueError("Backup muss genau eine reguläre data.db enthalten")
            parent = PurePosixPath(members[0].name).parent
            for m in tar.getmembers():
                p = PurePosixPath(m.name)
                if p.parent != parent or p.name not in ("data.db", "data.db-wal", "data.db-shm"):
                    continue
                if not m.isfile():
                    raise ValueError("Datenbankdatei ist nicht regulär")
                with (root / p.name).open("xb") as out, tar.extractfile(m) as source:
                    for chunk in iter(lambda: source.read(1024 * 1024), b""):
                        out.write(chunk)
                (root / p.name).chmod(0o400)
        before = {p.name: sha256(p) for p in root.iterdir()}
        # Manifest vor dem ersten SQLite-Zugriff; kein PocketBase-Start.
        (root / "manifest.json").write_text(json.dumps(before, sort_keys=True))
        db = sqlite3.connect((root / "data.db").as_uri() + "?mode=ro", uri=True)
        try:
            result = analyse(db)
        finally:
            db.close()
        after = {name: sha256(root / name) for name in before}
        if before != after or sha256(archive) != archive_hash:
            raise ValueError("Hashabweichung während der Prüfung")
        result.update({"backup": archive.name, "archive_sha256": archive_hash,
                       "dateien_vorher": before, "dateien_nachher": after,
                       "vorhandene_records_veraendert": 0})
        return result


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("backup", type=Path)
    args = parser.parse_args()
    result = audit_archive(args.backup)
    print(json.dumps(result, indent=2, ensure_ascii=False))
    raise SystemExit(2 if result["selektiert"] or result["auffaellige_belege"]
                     or result["rueckverweis_auffaelligkeiten"] else 0)

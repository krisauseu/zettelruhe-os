# Finanz-Schreibzugriffe über Next, atomare Persistenz in PocketBase

Öffentliche Finanz-Schreibzugriffe laufen ausschließlich über Next.js Server
Actions, Route Handler und Domain-Services. Next authentifiziert und autorisiert
den Vorgang, validiert Eingaben und übernimmt fachliche Vorbereitung sowie
PDF-Erzeugung. PocketBase-API-Regeln sperren direkte Client-Schreibzugriffe.

Für Festschreibungen und ihre gemeinsam geschützten Zustände verwendet Next eine
interne, eng definierte PocketBase-Transaktionsoperation. Diese prüft den aktuellen
Firmen-, Berechtigungs- und Quellzustand, vergibt Nummern und speichert Journal
und Quelle in einer gemeinsamen Datenbanktransaktion. Konkurrierende Mutationen
derselben geschützten Zustände verwenden dieselbe Persistenzgrenze. PocketBase
enthält nur die dafür erforderliche Prüf- und Persistenzlogik. PDF-Rendering und
externe Kommunikation erfolgen außerhalb der Transaktion. Wiederholte Vorgänge
erkennen einen bereits committed Abschluss.

Die zugesagte Atomarität betrifft PocketBases `data.db`. PocketBase-Dateifelder
bleiben der bestehende Speicherweg. Datenbank und Dateisystem bilden keine
gemeinsame ACID-Transaktion; mögliche physische Restdateien nach einem zusätzlichen
Bereinigungsfehler sind getrennt zu behandeln.

Begründung: Mehrere Next-zu-PocketBase-Requests erfüllen die von ADR-0004
verlangte Atomarität nicht. Eine einzelne serverseitige Transaktion ist für
Nummernkreis, Journal und Quellabschluss erforderlich. ADR-0012 bleibt für
unveränderbare Originale und PocketBase-Dateispeicherung gültig.

# PDF-Erzeugung mit @react-pdf/renderer

Angebots-, Rechnungs- und Zahlungserinnerungs-PDFs werden mit **`@react-pdf/renderer`** erzeugt — nicht über HTML/Chromium (Playwright/Puppeteer) und nicht primär über low-level `pdf-lib`. GiroCode wird als QR-Grafik mit **`qrcode`** (EPC069-12, PNG-Daten-URI) eingebettet. Begründung: schlankes Docker-Image ohne Browser-Runtime; ausreichend für das Dokumenten-Layout ohne CSS-Profi; Chromium-Pipeline bleibt Ausweichoption, falls CSS-Layout später zwingend wird.

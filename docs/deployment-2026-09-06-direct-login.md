# Acces administrativ prin link personal — 6 septembrie 2026

Release instalat: `/var/www/pcp/.releases/source/direct-login-20260906T200845Z`.

Frontend activ: `.releases/client/20260906T200918Z-1303919`, în interiorul release-ului. API-ul și cei doi workeri PCS rulează din acest director. Migrarea `042_admin_direct_login_links.sql` a fost aplicată.

La solicitarea titularului, operatorul poate emite un link personal care deschide direct administrarea, fără formular cu parolă și cod TOTP. Linkul funcționează numai pentru un cont administrativ existent și deja activat. Este valabil 30 de minute, poate fi folosit o singură dată și pornește sesiunea nominală obișnuită, de maximum opt ore.

Metoda este o alternativă de autentificare autorizată de operator. Auditul o identifică explicit ca `operator_link`, cu operatorul și motivul emiterii, fără a pretinde verificarea unui cod TOTP. Emiterea se face numai din consola serverului; nu există emitere publică pe baza emailului. Parolele și cheile MFA existente sunt păstrate.

Hashul linkului este singura formă stocată în bază. Consumul și crearea sesiunii sunt tranzacționale. Reemiterea, expirarea, schimbarea datelor de autentificare, resetarea MFA și revocarea tuturor sesiunilor împiedică utilizarea linkului vechi. Fragmentul URL este eliminat înainte de randare și telemetrie; browserul nu stochează linkul.

## Verificări

- 30 de teste server au trecut, acoperind ambele adaptoare HTTP, accesul direct, refresh-ul, deconectarea, concurența, expirarea, invalidarea, auditul și regresiile autentificării existente.
- 22 de teste client au trecut, inclusiv consumul unic sub React StrictMode și absența parolei sau a codului din fluxul direct.
- Cele trei teste complete în browser au trecut: accesul direct, autentificarea nominală obișnuită și reînnoirea sesiunii. Testul accesului direct a trecut și cu artefactele exacte instalate, pe o bază izolată de test.
- Compilările, lintul, verificarea schemei, preflight-ul și testul sintetic al paginii publice au trecut. Readiness răspunde cu HTTP 200. Un link aleatoriu este refuzat cu HTTP 403, fără cookie de sesiune, iar răspunsul are `Cache-Control: private, no-store`.
- Bundle-ul și pagina de acces direct servite prin HTTPS corespund release-ului instalat. Testele nu folosesc contul sau linkul titularului real.

Backupul bazei, configurația și căile release-ului anterior sunt în `/root/pcs-deploy-backups/20260906-direct-login`. Migrarea adaugă un tabel separat, compatibil cu revenirea la versiunea anterioară. Înaintea unei reveniri se revocă linkurile neconsumate și sesiunile emise prin metoda directă, dacă scopul revenirii este dezactivarea acestei metode.

Comanda pentru emitere și comportamentul sesiunii sunt descrise în [admin-security.md](admin-security.md). Linkurile private nu se includ în documentație sau în repository.

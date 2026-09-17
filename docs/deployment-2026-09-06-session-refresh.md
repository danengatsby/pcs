# Reînnoirea sesiunii administrative — 6 septembrie 2026

Release instalat: `/var/www/pcp/.releases/source/session-refresh-20260906T151203Z`.

Frontend activ: `.releases/client/20260906T171904Z-1176002`, în interiorul release-ului. API-ul și cei doi workeri PCS rulează din acest release. Nu au fost necesare migrații noi sau modificări ale parolelor, profilurilor ori cheilor MFA.

## Cauză și corecție

Activarea titularului a reușit la 14:42 UTC, iar cererile administrative au fost autorizate. După expirarea tokenului de acces de 15 minute, pagina continua să îl folosească: cererile primeau HTTP 401 și afișau „Token lipsa sau invalid.”, deși sesiunea MFA de opt ore era încă valabilă. Browserul reînnoia sesiunea numai la reîncărcarea paginii.

Cererile autentificate refuzate cu HTTP 401 solicită acum reînnoirea sesiunii și sunt reluate o singură dată. Clienții HTTP și OpenAPI, precum și exportul CSV, folosesc aceeași procedură. Cererile simultane împart o singură rotație a tokenului de refresh; un răspuns 401 întârziat reutilizează tokenul deja reînnoit. Corpul și antetele cererilor sunt păstrate la reluare.

Refuzurile de permisiuni nu declanșează reînnoirea. O sesiune MFA expirată sau revocată elimină sesiunea locală și trimite utilizatorul la autentificare. Un răspuns de refresh întârziat nu poate restaura o sesiune după deconectare și nu poate relua o operație în alt cont. Tokenul de acces rămâne exclusiv în memoria browserului.

## Verificări

- 238 de teste client au trecut, inclusiv concurența, reluarea cererilor, refuzul permisiunilor, răspunsurile întârziate și indisponibilitatea temporară a reînnoirii.
- Cele trei teste complete în browser au trecut: activarea inițială, autentificarea nominală și reînnoirea sesiunii. Testul pentru reînnoire folosește un token semnat expirat pentru un cont exclusiv de test și verifică revenirea la autentificare după expirarea sesiunii MFA.
- Compilarea clientului, lintul și verificările de deploy au trecut. Testul sintetic al paginii publice și readiness au trecut.
- Contul nominal real are MFA activ și o sesiune încă valabilă după lansare. Nu a fost efectuată autentificarea în numele titularului.

Utilizatorii cu pagina veche deschisă trebuie să o reîncarce pentru a primi corecția. O sesiune de refresh valabilă este restaurată la încărcare; dacă sesiunea a expirat complet, se folosesc parola personală și codul MFA existent. Nu este necesară repetarea activării inițiale.

Căile release-ului anterior sunt păstrate în `/root/pcs-deploy-backups/20260906-session-refresh/previous-release.json`. Procedura de operare este descrisă în [admin-security.md](admin-security.md).

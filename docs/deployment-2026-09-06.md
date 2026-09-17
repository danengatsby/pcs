# Lansare — 6 septembrie 2026

Actualizare ulterioară: activarea prin fișiere a fost înlocuită pentru titularul inițial cu un link personal și un formular pe site. Vezi [lansarea activării simplificate](deployment-2026-09-06-activation.md) pentru starea curentă.

Release instalat: `/var/www/pcp/.releases/source/security-workspaces-20260906T090521Z`.

Frontend activ: `.releases/client/20260906T091008Z-818420`, în interiorul release-ului. API-ul, workerul de email și workerul de audit rulează din acest release; celelalte aplicații PM2 nu au fost modificate.

## Modificări activate

- Migrațiile 039 și 040 sunt aplicate în producție: infrastructura MFA, profilurile de acces și registrele de trezorerie / grup parlamentar.
- `AUTH_MFA_ENCRYPTION_KEY` este configurată. Cheia are o copie privată în `/root/pcs-secrets/auth-mfa-encryption-key`, cu acces `0600`.
- `AUTH_PUBLIC_ADMIN_EMAIL` este eliminată. Accesul comun `admin/admin` este refuzat cu HTTP 401, iar sesiunile administrative semnate fără MFA sunt refuzate cu `AUTH_MFA_SESSION_REQUIRED`.
- Datele demonstrative sunt interzise în producție; verificarea inventarului a trecut. Registrele noi pornesc goale.
- Procedura de deploy verifică explicit căile PM2 pentru a detecta păstrarea accidentală a vechiului backend.

## Înrolarea administratorului inițial

Titularul nominal a fost indicat explicit de utilizator după lansare. Contul său a fost creat separat, cu rolul `PRESEDINTE` și profilul „Conducere și organizare” (`leadership`), cu acoperire națională. Parola aleatorie și înrolarea TOTP sunt pregătite într-un fișier privat din `/root/pcs-mfa/`, cu acces `0600`, pentru preluare prin SSH. Secretele nu sunt incluse în documentație și nu au fost trimise prin email.

Titularul trebuie să importe secretul în aplicația personală de autentificare. Prima autentificare cu un cod valid activează MFA; verificările operatorului nu au consumat coduri TOTP și nu au creat sesiuni în numele titularului.

Pentru import este pregătită și o pagină HTML privată în același director, cu acces `0600`, care conține codul QR al înrolării existente, parola ascunsă inițial și instrucțiunile de conectare. Fișierul se descarcă prin SSH și se deschide local în browser; nu este publicat pe site. Pagina nu folosește scripturi sau resurse externe. După salvarea parolei, importul MFA și prima autentificare reușită, titularul elimină copiile de transfer HTML și JSON de pe server și de pe calculator.

Contul generic `admin@pcpens.online` are parola invalidată, înrolarea MFA eliminată și sesiunile revocate. Identitatea sa istorică este păstrată pentru audit, împreună cu rolul administrativ care impune verificarea MFA inclusiv pentru tokenurile vechi. Crearea contului nominal, pregătirea MFA și retragerea accesului comun sunt consemnate în audit ca operații ale operatorului serverului, cu rol `SYSTEM`.

Atribuțiile de trezorerie și grup parlamentar se acordă explicit conturilor desemnate, prin procedura din [admin-security.md](admin-security.md).

## Verificări

- 88 de teste de integrare și 224 de teste client au trecut.
- Testele din browser pentru trezorerie și grup parlamentar au trecut, împreună cu verificările autentificării MFA și ale spațiului administrativ.
- 13 teste pentru securitate, registre și smoke au trecut pe artefactul compilat al release-ului.
- Health readiness, prezența noilor rute API și refuzul accesului comun au fost verificate local și la `https://pcpens.online`.
- Testul sintetic al paginii publice a trecut pe domeniul HTTPS după lansare.
- Procedura de creare nominală și retragere a contului comun a trecut verificările pe o bază separată de test, inclusiv autentificarea TOTP, revocarea sesiunilor, auditul și protecția contra suprascrierii credențialelor.
- Pentru contul nominal real, parola și criptarea MFA au fost verificate fără afișarea secretelor; autentificarea publică fără cod este refuzată cu `AUTH_MFA_REQUIRED` (HTTP 403). Accesul cu un token vechi al contului generic este refuzat cu `AUTH_MFA_SESSION_REQUIRED` (HTTP 401).
- Codul QR din pagina privată a fost randat și decodat în browser, exclusiv în memorie, și corespunde înrolării existente. Au fost verificate cheia pentru import manual, parola afișată la cerere, afișarea pe telefon și absența cererilor externe. Aceste verificări nu activează MFA.

Backupul bazei și configurația anterioară sunt în `/root/pcs-deploy-backups/20260906T084356Z`; arhiva bazei a fost verificată cu `pg_restore --list`. Fișierul `previous-release.json` consemnează căile proceselor anterioare. Backupul și cheia MFA nu se copiază în directoare publice.

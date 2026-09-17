# Activarea administrativă pe site — 6 septembrie 2026

Actualizare ulterioară: [corecția reînnoirii sesiunii administrative](deployment-2026-09-06-session-refresh.md) este instalată peste acest release. Contul nominal a fost activat de titular; nu trebuie reînrolat.

Release activ: `/var/www/pcp/.releases/source/admin-activation-20260906T143518Z`.

Frontend activ: `.releases/client/20260906T143626Z-1056862`, în interiorul release-ului. API-ul și cei doi workeri PCS rulează din același release. Migrarea 041 a fost aplicată. Site-ul public și verificarea readiness răspund normal.

Titularul primește un link personal la `/auth/activate`: își alege parola, scanează codul QR și confirmă un cod TOTP. După confirmare intră direct în administrare. Nu trebuie să folosească SSH sau să descarce fișiere. Linkul expiră după 24 de ore și nu mai poate fi folosit după activare; un cont cu MFA deja activ nu poate fi resetat prin acest flux. Emiterea și reemiterea sunt rezervate operatorului serverului.

Invitația inițială a fost pregătită pentru titularul desemnat în conversație. Înrolarea sa anterioară, încă neactivată, a fost înlocuită. Copiile private HTML și JSON care conțineau parola inițială și vechea cheie au fost eliminate după verificarea noului flux. Identitatea, profilul de conducere și istoricul contului sunt păstrate. Contul generic rămâne blocat. Nu au fost trimise emailuri.

Pagina reală a fost verificată în browser prin deschiderea invitației, fără alegerea unei parole și fără folosirea unui cod TOTP în numele titularului. QR-ul a fost decodat exclusiv în memorie și corespunde înrolării curente. Invitația a rămas neconsumată, MFA neactivat și nu au fost create sesiuni pentru titular în timpul verificării.

Verificări efectuate:

- 26 de teste pentru activare, securitate administrativă și contractul OpenAPI au trecut; includ ambele adaptoare HTTP, concurență, expirare, reemitere, revocare, blocarea codurilor incorecte și rollback la eșecul livrării.
- 9 teste existente pentru autentificare și revocarea sesiunilor au trecut.
- 6 teste client pentru activare și păstrarea privată a capabilității au trecut, împreună cu cele 9 teste ale paginii de autentificare.
- Testul complet în browser a verificat alegerea parolei, primul cod TOTP, intrarea în administrare, afișarea pe telefon și refuzul unui link deja folosit. Autentificarea administrativă obișnuită a trecut și ea testul din browser.
- Cele 5 teste de activare au trecut și pe artefactul compilat al release-ului instalat, folosind exclusiv baza de test.
- Compilarea, lintul server/client, sincronizarea schemei, verificările de deploy și testul sintetic al paginii publice au trecut.

Backup înainte de lansare: `/root/pcs-deploy-backups/20260906T143602Z-activation`. Arhiva bazei a fost verificată cu `pg_restore --list`; configurația și căile release-ului anterior sunt păstrate privat în același director. Invitațiile și secretele nu sunt incluse în documentație. Procedura de operare este descrisă în [admin-security.md](admin-security.md).

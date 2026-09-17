# Acces direct automat — 7 septembrie 2026

Publicat pe `https://pcpens.online` la 18:02 UTC. Linkul personal către `/auth/signin#...` deschide automat administrarea. Sesiunea activă este restaurată și în file noi. După o eroare temporară la restaurare, butonul de acces direct poate reîncerca sesiunea browserului.

Numai valoarea CSRF este partajată prin localStorage; tokenul de acces rămâne în memorie. Reînnoirile sunt serializate între file prin Web Locks, iar deconectarea curăță celelalte file. Accesul anonim rămâne refuzat. Nu se modifică parola, MFA, rolul sau limita de opt ore a sesiunii administrative.

- Frontend: `.releases/client/admin-direct-auto-20260907T175924Z`.
- Sursă frontend: `.releases/source/admin-direct-auto-20260907T175924Z`.
- Backend: `.releases/source/members-visible-20260906T203708Z`, păstrat; procesele PCS pentru email și audit nu au fost repornite.
- Versiune frontend precedentă: `.releases/client/manifest-extended-20260907T160426Z`.
- Stare și verificări: `artifacts/admin-direct-auto-deployment.json`.
- Configurația PM2 a fost salvată. Backup privat: `/root/pcs-deploy-backups/admin-direct-auto-20260907T175924Z`.

Verificări: 35 de teste unitare, lint pentru fișierele schimbate, compilare de producție și trei teste complete în browser cu baza separată `pcs_admin_security_test`. Scenariile includ consumarea automată și unică a linkului, două file noi simultane, reîncărcarea paginii, deconectarea tuturor filelor, reînnoirea accesului expirat, expirarea absolută a sesiunii și autentificarea obișnuită cu MFA. Migrarea lipsă pentru linkuri a fost aplicată numai bazei de test.

Pe site au fost verificate sănătatea API, pagina de autentificare, lipsa erorilor JavaScript, refuzul accesului administrativ anonim și corespondența fișierelor publicate cu versiunea compilată. Manifestul DOCX/PDF a rămas identic, iar titlul principal actualizat este vizibil. Fișierele JS mai vechi sunt păstrate pentru filele deja deschise.

Revenire: setează `CLIENT_DIST_PATH` la versiunea frontend precedentă și repornește numai `pcs-server` cu `--update-env`, din directorul backend indicat mai sus; verifică sănătatea aplicației și salvează configurația PM2. Linkurile personale se emit separat prin consola backend și se păstrează exclusiv în fișiere private, în afara proiectului.

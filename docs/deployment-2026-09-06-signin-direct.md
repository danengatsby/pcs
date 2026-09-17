# Buton de acces direct pe autentificare — 6 septembrie 2026

Release instalat: `/var/www/pcp/.releases/source/signin-direct-20260906T202541Z`.

Frontend activ: `.releases/client/20260906T202548Z-1318815`, în interiorul release-ului. API-ul și cei doi workeri PCS rulează din acest director. Nu au fost necesare migrații sau schimbări de configurație.

Pagina `/auth/signin` afișează **Intră direct ca administrator** deasupra formularului obișnuit. Linkurile personale noi deschid această pagină și pregătesc accesul pentru apăsarea butonului, fără parolă sau cod. Pentru un vizitator care deschide pagina fără link personal, butonul permite lipirea linkului primit; pagina nu distribuie date de acces pentru un cont comun.

Tokenul din fragment este capturat numai în memorie și eliminat din adresă înainte de randare și telemetrie. Nu este afișat în formular, în HTML sau în stocarea browserului. Linkurile introduse manual trebuie să aparțină aceleiași origini și uneia dintre rutele acceptate. Ruta existentă `/auth/direct` păstrează accesul automat pentru linkurile emise anterior.

Au trecut 16 teste client, 4 teste server și cele două teste complete în browser pentru autentificarea obișnuită și butonul de acces direct. Testul accesului direct a trecut și cu artefactele finale instalate, pe baza izolată de test. Verificarea include un al doilea browser fără sesiune, care nu primește linkul sau accesul primului utilizator.

Compilările, lintul, preflight-ul și testul sintetic public au trecut. Readiness răspunde cu HTTP 200; JavaScript-ul și CSS-ul servite prin HTTPS corespund release-ului. Pe un ecran de 390 px formularul nu depășește lățimea disponibilă, inclusiv după deschiderea câmpului pentru link.

Configurația și căile release-ului anterior sunt în `/root/pcs-deploy-backups/20260906-signin-direct`. Emiterea linkurilor personale rămâne documentată în [admin-security.md](admin-security.md); tokenurile reale nu se păstrează în repository sau în paginile publice.

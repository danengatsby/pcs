# Baza cu membri fictivi

La 6 septembrie 2026 a fost creată și populată baza PostgreSQL dedicată `pcs_members_demo`, cu schema aplicației până la migrarea 041. Baza a pornit goală; nu au fost copiate date personale din producție.

Conține 60 de membri activi fictivi, fiecare cu un cont, un număr de membru și un eveniment de înscriere. Membrii sunt repartizați în 7 organizații: organizația națională, filialele Cluj, Iași și Timiș și organizațiile locale Cluj-Napoca, Iași și Timișoara. Setul include 7 responsabili cu mandate organizaționale și 24 de voluntari fictivi.

Înregistrările sunt marcate `is_demo=true`, numele poartă sufixul `(Demo)`, iar adresele folosesc domeniul rezervat `admin-demo.example.test`. Parolele generate nu sunt cunoscute sau distribuite. Setul nu oferă acces administrativ comun.

[Lista celor 60 de membri, în format CSV](../artifacts/demo/membri-fictivi.csv) folosește UTF-8 cu BOM și separatorul punct și virgulă.

## Operare pe server

Instanța de lucru se află în directorul privat `/root/pcs-demo`, cu configurația în `/root/pcs-demo/server/.env` (permisiuni `0600`). Folosește un utilizator PostgreSQL dedicat, chei proprii, `NODE_ENV=development`, `ADMIN_DEMO_DATA_ALLOWED=true` și `EMAIL_NOTIFICATIONS_ENABLED=false`. Nu are configurate SMTP sau Redis.

Comenzile de mai jos încarcă automat configurația demo; nu necesită modificarea fișierului `.env` al aplicației reale:

```bash
node /root/pcs-demo/run.mjs migrate
node /root/pcs-demo/run.mjs seed
node /root/pcs-demo/run.mjs verify
```

Generatorul este `server/src/lib/adminDemoData.ts`, executat prin copia compilată a release-ului `session-refresh-20260906T151203Z`. Rerularea lui păstrează identificatorii și nu creează duplicate. Comanda `verify` verifică datele și registrul administrativ, rerulează generatorul pentru verificarea idempotentei și regenerează CSV-ul; deci nu este exclusiv o operație de citire.

Sunt verificate legăturile membru–organizație, evenimentele de înscriere, identificatorii unici, marcajele demo și absența emailurilor în coada de expediere. Nu au fost trimise emailuri.

## Acces din aplicație

Site-ul de producție oferă opțiunea **Membri fictivi** în **Administrare → Membri**. Link direct: `/admin/members?dataset=demo`. Accesul folosește sesiunea administrativă nominală și permisiunea `membership.read` existente. Deschiderea paginii fără o alegere explicită verifică registrul real și afișează automat membrii fictivi dacă întregul registru real din aria autorizată este gol și baza demo este configurată. Un rezultat gol al căutării nu declanșează schimbarea. Alegerea explicită **Membri reali** este păstrată în URL (`dataset=real`), inclusiv la reîncărcare; când este gol, registrul oferă și butonul **Vezi membrii fictivi**.

Schimbarea registrului resetează filtrele și deciziile deschise. În demonstrație, statisticile sunt într-o secțiune extensibilă, inițial închisă, pentru ca lista nominală să fie accesibilă înaintea celor șapte carduri statistice.

API-ul primește `dataset=demo` la `/api/admin/members/dashboard` și consultă baza separată prin `ADMIN_DEMO_DATABASE_URL`. Conexiunea folosește rolul PostgreSQL `pcs_members_demo_reader`, cu permisiuni numai de citire pe tabelele necesare și fără acces la parole. `ADMIN_DEMO_DATA_ALLOWED=false` rămâne obligatoriu în producție; membrii fictivi nu sunt importați în baza reală și nu afectează statisticile, comunicările sau alte registre.

Răspunsurile demo includ `dataset: "demo"`, identificatori de membru cu prefixul `demo:` și nicio acțiune disponibilă. Acest prefix este refuzat de endpointul deciziilor pe membri reali. Înregistrările pot fi căutate, filtrate, paginate și consultate, fără modificare. Dacă baza demo este indisponibilă, API-ul răspunde cu un mesaj dedicat și nu înlocuiește rezultatele cu membri reali.

Pentru dezactivarea afișării se golește `ADMIN_DEMO_DATABASE_URL` și se repornește API-ul. Nu este necesară ștergerea datelor demo sau pornirea unui al doilea site. Generatorul și configurația privată din `/root/pcs-demo` rămân disponibile pentru operarea bazei fictive.

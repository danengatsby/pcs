# Agenda de intervenții a conducerii

`/admin/dashboard` începe cu lista de cazuri, înaintea indicatorilor. Lista are filtrare pe șase categorii, prioritizare și paginare (20 de cazuri/pagină). Numerele sunt calculate înaintea paginării. Linkurile deschid dosarul CRM, organizația, acțiunea/raportul sau evidența termenului exact.

| Categorie | Regula |
| --- | --- |
| Cereri necontactate | Mai mult de 48h de la creare, fără contact înregistrat și fără status contactat/activ; include cererile deja validate administrativ |
| Filiale fără responsabil | Organizații nenaționale active/în formare, fără niciun mandat activ și valabil în ziua curentă |
| Obiective întârziate | Obiective planificate/în progres/în risc cu data-limită anterioară zilei curente, în organizații active/în formare |
| Evenimente fără coordonator | Evenimente draft/deschise fără coordonator; cele trecute, dar încă deschise, rămân de clarificat |
| Rapoarte nevalidate | Participanți cu status `reported`, fără validare ulterioară raportării; sunt incluse și acțiunile deja închise |
| Decizii/documente | Termene explicite `expires_on` în următoarele 30 de zile calendaristice UTC, inclusiv cele deja depășite |

Prioritate urgentă: cereri mai vechi de 7 zile, evenimente care încep în cel mult 48h și termene expirate. Celelalte întârzieri și filiale fără responsabil sunt prioritare. Rapoartele depuse de cel mult 48h și expirările viitoare intră la planificare. În fiecare nivel se ordonează după termen, apoi după identificator stabil.

## Evidența termenelor

Migrarea `038_governance_expiration_dates.sql` adaugă câmpuri nullable pentru documentele din biblioteca internă, deciziile de mandat, deciziile Congresului și deciziile arbitrale. Termenele nu sunt deduse din vechimea actului sau durata mandatului. Actele fără dată sunt numărate separat ca neacoperite de evaluarea expirării, nu prezentate drept valide nelimitat. Fișierele care nu sunt înregistrate în aceste registre nu intră automat în această evidență.

Din „Evidența termenelor”, președintele poate înregistra/actualiza data după verificarea documentului sursă. Este metadată operațională: nu prelungește efectul juridic, nu schimbă documentul, decizia sau publicarea. Modificările cer `executive.targets`, verifică termenul anterior (409 la conflict) și sunt auditate. Data goală elimină termenul operațional și revine la „neînregistrat”.

## Acces și actualizare

Endpoint-urile de citire necesită `executive.read`, iar fiecare categorie respectă capabilitatea registrului sursă și teritoriul mandatului. Documentele interne, neavând organizație asociată, sunt urmărite numai la nivel național. Răspunsurile sunt `private, no-store`; identitățile, rapoartele și termenele nu sunt expuse public.

Intervențiile se recalculează la revenirea în pagină/fereastră, la 30s și după modificarea termenelor. Rezolvarea se face în registrul sursă; nu există „ignoră alerta”. Un eșec de încărcare este afișat explicit și nu devine o listă cu zero probleme.

Migrarea trebuie aplicată înaintea serverului nou. Verificările locale utilizează exclusiv `pcs_publication_test` și build-uri temporare prin `CLIENT_DIST_PATH`; modificarea nu aplică automat migrarea sau un deploy în producție.

## Verificare

Testul de integrare `executiveInterventions.integration.test.ts` acoperă pragul exact de 48h, mandatele viitoare/expirate, termenele calendaristice, toate cele patru registre de expirare, paginarea, filtrarea teritorială, revocarea accesului și conflictele la salvare, prin Express și Fastify.

Testul browser `executive-interventions.fullstack.spec.ts` verifică toate cele șase categorii înaintea statisticilor, navigarea și focalizarea înregistrării exacte, validarea unui raport, atribuirea coordonatorului și actualizarea unui termen, urmate de dispariția alertelor rezolvate. Include capturi desktop/mobil și verificarea lipsei depășirii orizontale. Datele sintetice sunt create și curățate exclusiv în baza de test.

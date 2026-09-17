# Membri fictivi pe site — 6 septembrie 2026

Release instalat: `/var/www/pcp/.releases/source/demo-members-20260906T180357Z`.

Frontend activ: `.releases/client/20260906T180528Z-1212407`, în interiorul release-ului. API-ul și cei doi workeri PCS rulează din acest director.

În **Administrare → Membri → Membri fictivi**, cei 60 de membri fictivi și cele 7 organizații pot fi consultați direct pe site-ul existent. Link: `https://pcpens.online/admin/members?dataset=demo`. Filtrarea, căutarea, istoricul și paginarea folosesc baza dedicată `pcs_members_demo`. Cei 24 de voluntari din acea bază nu sunt publicați în registrul real de voluntari.

Conexiunea `ADMIN_DEMO_DATABASE_URL` folosește rolul `pcs_members_demo_reader`, cu drepturi de citire numai pe tabelele și coloanele necesare și fără acces la parole. Autentificarea nominală, MFA și permisiunea `members.read` sunt păstrate. Înregistrările demo nu permit decizii administrative; identificatorii cu prefix `demo:` sunt refuzați de endpointul operațiilor pe membri reali.

Nu au fost necesare migrații noi. `ADMIN_DEMO_DATA_ALLOWED=false` rămâne activ în producție, iar baza reală nu conține înregistrări demo. Nu au fost schimbate parolele, profilurile sau cheile MFA și nu au fost trimise comunicări.

## Verificări

- 18 teste server au trecut: contractul API, configurația conexiunii demo, accesul autentificat, izolarea bazelor, căutarea, filtrarea, paginarea, refuzul deciziilor demo și fluxul deciziilor pe membri reali.
- 9 teste client au trecut, inclusiv resetarea unei decizii la schimbarea registrului și prevenirea afișării temporare a membrilor reali în vizualizarea demo.
- Testul complet în browser a trecut și cu artefactele exacte instalate, pe două baze de test separate. Verifică autentificarea, schimbarea registrului, căutarea, paginarea și reîncărcarea paginii demo.
- Compilările, lintul, preflight-ul și testul sintetic al paginii publice au trecut. Endpointul readiness răspunde cu HTTP 200, iar endpointul demo fără autentificare răspunde cu HTTP 401.
- Codul instalat a citit 60 de membri și 7 organizații prin rolul de citire configurat. Bundle-ul servit prin HTTPS corespunde release-ului instalat. Nu a fost efectuată autentificarea în numele unui titular real.

Configurația anterioară și căile proceselor sunt păstrate în `/root/pcs-deploy-backups/20260906-demo-members`. Pentru dezactivarea afișării se golește `ADMIN_DEMO_DATABASE_URL` și se repornește API-ul. [Operarea bazei și generatorului](demo-members.md) rămâne separată de administrarea membrilor reali.

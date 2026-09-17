# Administrare publică — 7 septembrie 2026

Publicată la 18:21 UTC pe `https://pcpens.online`, la cererea explicită a proprietarului de a permite oricui intrarea fără parolă, cod sau link personal.

Butonul **Intră direct ca administrator** de pe `/auth/signin` deschide direct `/admin` prin `POST /api/auth/admin-public-login`. Contul comun este **Administrator public PCS**, cu identitatea tehnică `administrator-public@pcs.invalid` și permisiunile obișnuite ale rolului `PRESEDINTE`. Orice vizitator poate obține aceste permisiuni, inclusiv drepturile de modificare aferente. Acțiunile sunt atribuite contului comun; nu identifică persoana care le execută.

`AUTH_PUBLIC_ADMIN_ENABLED=true` este configurat pe API și în mediul serverului. Conturile personale păstrează autentificarea proprie, inclusiv MFA. Formularul public nu mai cere un link personal. Contul comun este creat automat, fără email și fără distribuirea unei parole. Browsere diferite au sesiuni separate; reîncărcarea, filele noi și deconectarea funcționează cu mecanismul de sesiune existent.

- Sursă API și frontend: `.releases/source/admin-public-20260907T181646Z`.
- Frontend publicat: `.releases/client/admin-public-20260907T181646Z`.
- Sursă API precedentă și sursa păstrată pentru workeri: `.releases/source/members-visible-20260906T203708Z`.
- Frontend precedent: `.releases/client/admin-direct-auto-20260907T175924Z`.
- Detalii și verificări: `artifacts/admin-public-deployment.json`.
- Configurații de pornire și revenire, cu mediul privat: `/root/pcs-deploy-backups/admin-public-20260907T181646Z`.

Au trecut 19 teste frontend, 20 de teste backend și contract API, lint, compilarea de producție și patru teste complete în browser pe baza separată de test. Scenariile verifică intrarea simultană a vizitatorilor, reînnoirea și deconectarea independentă, oprirea accesului public la dezactivarea configurării și păstrarea autentificării conturilor personale. Migrațiile bazei de producție nu au fost modificate. Manifestul DOCX/PDF și schimbările vizuale publicate anterior sunt păstrate.

Pe site au fost verificate intrarea de la prima apăsare din două browsere fără sesiune, contul comun afișat, reîncărcarea și deconectarea. Configurația PM2 este salvată. Workerii PCS de email și audit au rămas în funcțiune fără restart.

Pentru oprirea accesului public, setează `AUTH_PUBLIC_ADMIN_ENABLED=false` în mediul API și repornește `pcs-server` cu mediul actualizat. Sesiunile contului comun sunt refuzate inclusiv la refresh. Pentru revenirea completă, folosește configurația privată `rollback.config.cjs` după oprirea noului `pcs-server`; aceasta reface sursa API și frontend precedente. Actualizează și mediul de lucru pentru a păstra configurarea aleasă la următoarele publicări.

# Acces administrativ

Butonul **Intră direct ca administrator** deschide contul comun **Administrator public PCS**, fără parolă sau link, când serverul are `AUTH_PUBLIC_ADMIN_ENABLED=true`. Această configurare permite oricărui vizitator accesul administrativ și modificările acordate contului comun. A fost solicitată explicit de proprietarul site-ului pe 7 septembrie 2026.

Contul comun are identitatea tehnică `administrator-public@pcs.invalid`, creată la prima intrare, cu o parolă aleatorie care nu este distribuită. Nu se folosește identitatea unui administrator personal. Evenimentele de intrare sunt auditate ca `auth.admin_public_signin`, cu `authenticationMethod: public` și `sharedAccount: true`; nu reprezintă o verificare a identității sau a MFA. Fiecare browser primește propria sesiune, iar deconectarea unuia nu revocă sesiunile celorlalți vizitatori. Contul are permisiunile obișnuite ale rolului `PRESEDINTE`, cu acoperire națională.

Valoarea implicită a `AUTH_PUBLIC_ADMIN_ENABLED` este `false`. Dezactivarea ei și repornirea API-ului opresc imediat accesul și reînnoirea sesiunilor contului comun. Endpointul este `POST /api/auth/admin-public-login`; nu cere identitate sau alte date de acces. Cookie-urile de refresh, protecția CSRF, tokenurile individuale de sesiune, deconectarea și limitarea cererilor rămân active. Tokenul de acces administrativ expiră în cel mult 15 minute și poate fi reînnoit potrivit politicii de refresh. Limita MFA de opt ore se aplică sesiunilor nominale, nu contului public.

Autentificarea administrativă personală prin formular verifică în continuare parola și un cod TOTP din aplicația titularului. Butonul „Autentificare ca admin” folosește exclusiv datele introduse. Titularul poate primi și un link personal de acces direct emis de operator, descris mai jos. Vechea variabilă `AUTH_PUBLIC_ADMIN_EMAIL` nu este citită; nu există parole în variabilele frontend.

Formularul cere MFA pentru `CONSILIER`, `SECRETAR`, `VICEPRESEDINTE` și `PRESEDINTE`, în toate mediile. Linkul direct este o metodă alternativă autorizată de operator pentru un cont deja activat, fără verificarea unui cod TOTP la utilizare. Conturile obișnuite păstrează autentificarea cu parolă. Parola singură nu permite înrolarea ori resetarea MFA prin API.

## Acces direct prin link personal

La cererea titularului, operatorul poate emite un link care deschide direct `/admin`, fără completarea parolei sau a codului TOTP. Migrarea `042_admin_direct_login_links.sql` este necesară. Linkul poate fi emis numai din consola serverului, pentru un cont administrativ existent, cu MFA deja activat; nu există un endpoint public de emitere pe baza emailului.

```bash
NODE_ENV=production node server/dist/scripts/adminSecurity.js direct-link \
  --email titular@example.org --operator operator@example.org \
  --reason 'Acces direct personal solicitat de titular' \
  --output /root/pcs-mfa/acces-direct-titular.json
```

Comanda scrie linkul într-un fișier nou privat, cu permisiuni `0600`, în afara directorului aplicației. Nu îl afișează în loguri și nu trimite email. Operatorul transmite titularului linkul prin conversația privată autorizată. Posesia linkului permite accesul în contul respectiv: este o alternativă de autentificare, nu o verificare MFA. Linkul are 256 de biți aleatorii, este valabil 30 de minute și poate fi folosit o singură dată; reemiterea invalidează linkul precedent.

Linkurile nominale deschid `/auth/signin#...` și intră automat în administrare, fără apăsarea unui buton, parolă sau cod. La accesarea obișnuită a paginii, sesiunea administrativă activă din browser este restaurată inclusiv într-o filă nouă. Formularul de lipire a unui link personal a fost eliminat; butonul direct deschide contul comun public. Pagina nu conține linkuri personale sau tokenuri ale altor persoane. Linkurile existente către `/auth/direct#...` păstrează deschiderea automată a administrării nominale.

Linkul este consumat printr-o cerere POST și pornește sesiunea nominală de maximum opt ore. Fragmentul este eliminat înainte de randare și telemetrie, nu intră în logurile HTTP sau în stocarea browserului, iar răspunsul are `Cache-Control: private, no-store`. În bază se păstrează numai hashul linkului. Consumul și crearea sesiunii administrative sunt tranzacționale; două cereri concurente nu pot crea două sesiuni din același link.

Auditul consemnează separat emiterea, operatorul, motivul și folosirea linkului, cu `authenticationMethod: operator_link`. Nu înregistrează în mod fals o verificare TOTP. Parola și cheia MFA existente sunt păstrate. Schimbarea parolei, rolului sau profilului, resetarea MFA și revocarea tuturor sesiunilor invalidează și linkul nefolosit. După consum, sesiunea folosește aceleași permisiuni, limită de opt ore, rotație și deconectare ca celelalte sesiuni administrative. Comanda de curățare a tokenurilor elimină linkurile expirate.

## Activare simplă pentru titular

Titularul primește un link personal: își alege parola, scanează codul QR cu aplicația de autentificare și introduce primul cod de șase cifre. Butonul „Activează și intră în cont” configurează accesul și deschide direct spațiul administrativ. Nu trebuie să folosească SSH sau să descarce fișiere de înrolare.

Operatorul serverului emite linkul după confirmarea identității, pentru un cont administrativ existent care nu are încă MFA activ. Migrarea `041_admin_activation_invitations.sql` trebuie aplicată, iar `PUBLIC_BASE_URL` trebuie să fie originea HTTPS a site-ului în producție.

```bash
NODE_ENV=production node server/dist/scripts/adminSecurity.js invite \
  --email titular@example.org --operator operator@example.org \
  --reason 'Activare inițială pentru titularul nominal verificat' \
  --output /root/pcs-mfa/invitatie-titular.json
```

Numai operatorul folosește fișierul privat pentru a prelua linkul și a-l transmite titularului prin canalul verificat. Comanda nu trimite emailuri. Linkul este valabil 24 de ore și este consumat la activarea reușită. Reemiterea lui invalidează linkul anterior și eventualele chei pregătite în fișierele de transfer. Comanda refuză conturile cu MFA deja activ; recuperarea lor rămâne o procedură separată.

Invitația conține o capabilitate aleatorie de 256 de biți, stocată numai ca hash în bază. Fragmentul linkului este eliminat din adresa browserului înainte de randare și telemetrie; nu este păstrat în stocarea browserului. API-ul primește capabilitatea în corpul cererii, cu redacție în loguri, iar răspunsurile de înrolare nu pot fi memorate în cache. Deschiderea linkului nu activează MFA și nu creează o sesiune. Activarea verifică parola aleasă și primul cod TOTP, consumă invitația într-o tranzacție și auditează operația nominală. Codurile incorecte folosesc blocarea MFA comună contului; există și o limită de cereri pe IP. Expirarea, resetarea MFA, schimbarea profilului și consumarea invitației împiedică reutilizarea ei.

## Pregătirea release-ului

1. Configurează în `server/.env` o cheie nouă `AUTH_MFA_ENCRYPTION_KEY`, generată cu `openssl rand -hex 32`. Este obligatorie în producție și pentru înrolarea locală. Păstreaz-o într-un backup securizat separat de baza de date; schimbarea ei fără reînrolare face secretele existente inutilizabile. Nu o pune în variabile `VITE_*`.
2. Aplică migrarea `039_individual_admin_security.sql` înainte de serverul nou. Aceasta adaugă tabele, fără să modifice parole, identități sau roluri existente.
3. Înrolează fiecare administrator nominal folosind artefactul serverului nou. Confirmă identitatea titularului și modul de transmitere a secretului înaintea înrolării. Pregătește cel puțin contul responsabil de administrare înainte de restart.
4. Menține `ADMIN_DEMO_DATA_ALLOWED=false` în producție. Dacă există date demo, inventariază-le și mută demonstrațiile în instanța separată; curățarea existentă este o operație explicită. Deploy-ul verifică inventarul și se oprește, fără să șteargă automat date.
5. Repornește cu noul release și verifică autentificarea nominală, MFA, aria autorizată și deconectarea. Toate sesiunile administrative anterioare release-ului sunt refuzate, inclusiv refresh-ul lor. Nu este necesară identificarea separată a sesiunilor emise prin vechiul buton comun.

Exemplele următoare se execută din rădăcina aplicației după compilare. Adresele sunt exemple și trebuie înlocuite cu titularul și operatorul real. Comenzile nu creează și nu promovează conturi.

```bash
mkdir -m 700 /root/pcs-mfa
NODE_ENV=production node server/dist/scripts/adminSecurity.js enroll-mfa \
  --email titular@example.org --operator operator@example.org \
  --reason 'Înrolare nominală verificată pentru accesul administrativ' \
  --output /root/pcs-mfa/titular.json
```

Fișierul nou este creat exclusiv, cu permisiuni `0600`, în afara aplicației; un fișier existent nu este suprascris. Conține cheia Base32 și URI-ul `otpauth://` pentru import într-o aplicație de autentificare. Secretul nu este afișat în consolă sau în audit; API-ul îl transmite numai la prezentarea unei invitații inițiale valide. Transmite-l titularului prin canalul verificat, confirmă adăugarea în aplicația sa și șterge copia de transfer. La primul cod valid, înrolarea devine activă. Înrolarea existentă nu poate fi suprascrisă implicit.

## Recuperarea accesului

Operatorul serverului verifică identitatea titularului și documentează motivul; resetarea nu este disponibilă doar pe baza parolei ori a unui email introdus în formular.

```bash
NODE_ENV=production node server/dist/scripts/adminSecurity.js reset-mfa \
  --email titular@example.org --operator operator@example.org \
  --reason 'Identitate verificată, dispozitiv de autentificare înlocuit'
```

Resetarea elimină cheia și toate sesiunile administrative asociate. Reia `enroll-mfa` cu un fișier nou. Contul rămâne blocat pentru acces administrativ până la înrolare și verificarea unui cod nou; nu există cod universal de recuperare. Operatorul indicat în audit este identitatea declarată de persoana care execută operația prin accesul la server; aceste comenzi trebuie accesibile numai operatorilor autorizați ai serverului.

## Atribuții

Profilul administrativ explicit înlocuiește permisiunile deduse din funcția politică; nu le cumulează. Mandatul teritorial și valabilitatea sa sunt verificate la fiecare acces. Un profil nu creează un mandat și nu extinde aria sa.

| Profil | Acces |
| --- | --- |
| `leadership` | Organizare, membri, operațiuni, congres, indicatori și comunicare; fără arbitraj confidențial |
| `secretariat` | Evidențe membri/voluntari, organizare, congres și operațiuni; fără soluționare arbitrală |
| `communications` | Comunicare și conținut; fără acces nominal la registrele membrilor, voluntarilor sau arbitrajului |
| `treasury` | Registru de încasări și cheltuieli, confirmare, anulare motivată și istoric |
| `parliamentary` | Inițiative, responsabili nominali, termene, schimbări de etapă și istoric |
| `arbitration` | Registru arbitral și operațiunile sale; fără registrele generale de recrutare și membri |

Modulele de trezorerie (`/admin/treasury`) și grup parlamentar (`/admin/parliamentary`) sunt registre interne, disponibile după migrarea `040_treasury_parliamentary_workspaces.sql`. Profilurile includ `finance.read`/`finance.manage`, respectiv `parliamentary.read`/`parliamentary.manage`, și necesită un mandat național activ. Funcțiile politice nu primesc implicit aceste permisiuni. Vezi [operarea registrelor](admin-specialized-workspaces.md).

Profilul de comunicare are intrare separată la `/admin/communications`, fără să necesite acces la participanții din mobilizare. Auditul general exclude conținutul registrelor specializate și al arbitrajului când lipsesc permisiunile aferente; titularii consultă istoricul în registrul propriu.

Selectoarele pentru congres și arbitraj folosesc `/api/admin/organization-options`: numai identificatorul și numele organizațiilor active sau în formare din aria autorizată, fără contacte și fără componența conducerii. Accesul la selector nu acordă acces la registrul complet al organizațiilor.

În absența unui profil explicit se păstrează accesul operațional aferent funcției, cu eliminarea accesului implicit la arbitraj pentru toate cele patru funcții. Un responsabil de arbitraj trebuie desemnat explicit. Capabilitățile `finance.read`, `parliamentary.read`, publicarea de conținut și expedierea comunicărilor necesită acoperire națională.

```bash
NODE_ENV=production node server/dist/scripts/adminSecurity.js set-profile \
  --email titular@example.org --profile arbitration \
  --operator operator@example.org --reason 'Desemnare nominală pentru comisia de arbitraj'
```

Schimbarea este tranzacțională, auditează profilul precedent, profilul nou, operatorul și motivul și revocă sesiunile existente. Autentificarea următoare păstrează cheia MFA a titularului.

## Sesiuni și verificare

- TOTP: 6 cifre, perioadă 30 secunde, toleranță de un interval; fiecare cod poate fi folosit o singură dată, inclusiv între cereri concurente.
- Cinci coduri invalide blochează verificarea MFA timp de 15 minute. Contorul este comun contului, indiferent de aliasul de autentificare. Rate limiting-ul existent pentru parolă rămâne activ.
- Secretele TOTP sunt criptate AES-256-GCM cu autentificare legată de identificatorul contului. Auditul înregistrează evenimente, fără coduri sau secrete.
- Access token-ul administrativ expiră în maximum 15 minute. Sesiunea MFA are o durată absolută de 8 ore, care nu se prelungește prin refresh.
- Browserul reînnoiește sesiunea când o cerere autentificată primește HTTP 401 și reia cererea o singură dată. Cererile simultane folosesc aceeași rotație, inclusiv între clienții HTTP și OpenAPI. Dacă sesiunea MFA nu mai este valabilă, utilizatorul revine la autentificare; nu se repetă activarea inițială.
- Numai valoarea CSRF asociată cookie-ului de refresh este păstrată în `localStorage`, comun filelor; vechea valoare din `sessionStorage` este migrată. Tokenul de acces rămâne în memorie, iar cookie-ul de refresh este HttpOnly. Web Locks serializează reînnoirile între file în browserele care oferă acest API. Deconectarea golește și sesiunile din memoria celorlalte file. O eroare temporară de rețea nu șterge valoarea CSRF, pentru a permite reîncercarea.
- Refresh-ul SQL și Redis trebuie să corespundă unei sesiuni MFA valide. Promovarea unui utilizator nu transformă o sesiune obișnuită într-una administrativă. Resetarea, deconectarea și revocarea tuturor sesiunilor închid și atestarea MFA.
- `cleanupAuthTokens.js` curăță și sesiunile administrative, invitațiile de activare și linkurile directe expirate.

Testele acoperă ambele adaptoare HTTP, vectori RFC 6238, criptarea, refuzul accesului comun, cereri concurente, blocarea/reutilizarea codurilor, sesiuni vechi, refresh, resetare, atribuții și teritoriu. Folosesc exclusiv o bază explicită de test.

## Demonstrații separate

Instanța demo folosește `NODE_ENV=development`, o bază dedicată cu segmentul `demo` în nume, `ADMIN_DEMO_DATA_ALLOWED=true` și `EMAIL_NOTIFICATIONS_ENABLED=false`. Folosește chei proprii, conturi nominale și MFA și rulează pe alt port/origine decât aplicația reală. Nu copia date personale din producție în demonstrație.

Generatorul `seedAdminDemo.js` este refuzat în producție chiar dacă este activat flagul. În test este acceptată numai baza explicită cu segmentul `test`/`testing`. Aceste verificări nu creează și nu publică automat o instanță demo.

Registrul administrativ de pe site poate afișa separat membrii fictivi folosind `ADMIN_DEMO_DATABASE_URL`, o conexiune numai de citire la baza demo. Opțiunea nu permite însămânțarea bazei reale, nu creează sesiuni pentru conturile fictive și nu acordă drepturi de modificare. Vezi [afișarea membrilor fictivi](demo-members.md).

# Spațiul administrativ

Punctul unic de intrare este `/admin`, inclusiv pentru butonul „Autentificare ca admin”. Rutele anterioare rămân valide, dar sunt acum copii ai aceluiași shell, cu navigare adaptată pe mobil.

## Organizarea informațiilor

Meniul și pagina de intrare folosesc aceleași patru domenii: **Sinteză**, **Oameni**, **Organizare** și **Guvernanță**. Domeniile fără registre autorizate nu sunt afișate. „Prezentare generală” revine la `/admin`, iar paginile interioare indică poziția curentă în administrare.

Pagina de intrare separă activitățile în așteptare de accesul la registre. Lista „Necesită atenție” include numai contoare pozitive, ordonate descrescător după volum; aceasta nu reprezintă o clasificare după urgență. Registrele fără sarcini rămân accesibile în domeniul lor. Contoarele incomplete sau indisponibile sunt semnalate explicit.

Zona de lucru are o lățime proprie, de maximum 1520px, iar grilele se adaptează și la spațiul rămas lângă meniu. Indicatorii sunt compacți; filtrele membrilor sunt lângă evidența nominală, cronologia aderării este extensibilă, iar filtrele suplimentare ale voluntarilor se deschid automat dacă sunt active. Formularele pentru mandate, obiective, planificare și comunicare se deschid la cerere, păstrând valorile introduse la închidere și redeschidere. Congresul și arbitrajul afișează separat starea, datele și termenele.

## Acces

Meniul și protecția accesului direct folosesc capabilitățile efective din `GET /api/admin/access`, nu liste de funcții copiate în router. Fiecare API păstrează autorizarea pe server. Un mandat absent, expirat ori suspendat blochează încărcarea shell-ului; o eroare de autorizare nu afișează registre din cache. Verificarea se reia la revenirea în fereastră, după salvări și la 30 de secunde.

| Rută | Capabilitate | Sarcini numărate |
| --- | --- | --- |
| `/admin/dashboard` | `executive.read` | Sinteză, fără un contor duplicat |
| `/admin/volunteers` | `recruitment.read` | Dosare noi sau cu revenire/memento depășit, exceptând dosarele active |
| `/admin/members` | `membership.read` | Cereri cu status `application` |
| `/admin/organizations` | `organization.read` | Obiective nefinalizate întârziate sau în risc |
| `/admin/mobilization` | `mobilization.read` | Participanți în așteptare, rapoarte de verificat ori sarcini întârziate la acțiuni deschise |
| `/admin/congresses` | `congress.read` | Congrese în pregătire, deschise sau închise și încă nevalidate |
| `/admin/arbitration` | `arbitration.read` | Dosare depuse, în procedură sau contestate |

`GET /api/admin/tasks` numără direct în baza de date, fără limitele de paginare ale registrelor și fără să livreze persoane sau dosare individuale. Include numai zonele autorizate și teritoriul efectiv. Răspunsul este `private, no-store`. Contoarele se actualizează după mutații, la revenirea în fereastră și la 30 de secunde; există și actualizare manuală. Erorile sunt afișate ca indisponibilitate, niciodată convertite în zero.

„Sarcini restante” include lucrări în așteptare, nu exclusiv termene depășite. O persoană poate necesita activități distincte în CRM și în registrul membrilor; totalul reprezintă activități, nu persoane unice.

## Paginile noi

- Congres: registru, filtrare pe proceduri nefinalizate, creare în pregătire și tranziții confirmate explicit. Serverul verifică starea și cvorumul; validarea avertizează că rezultatele devin publice.
- Arbitraj: registru confidențial, filtrare pe dosare nesoluționate, termene de răspuns și înregistrarea unei sesizări. Administratorii locali trebuie să selecteze o organizație autorizată.
- Formularele necesită capabilitatea `.manage`; consultarea nu afișează controale de scriere. Gestionarea detaliată a delegaților, candidaturilor, votului, probelor și deciziilor arbitrale rămâne de conectat în UI; endpoint-urile existente nu au fost eliminate.

## Verificare și livrare

- Teste frontend: `npm run test --workspace client`.
- Teste integrare: `adminTasks.integration.test.ts` verifică ambii adaptori, izolarea teritorială, revocarea mandatului, numărarea a peste 50 de proceduri și absența datelor personale.
- Browser: `client/tests/e2e/admin-shell.fullstack.spec.ts` folosește API-ul real și baza explicită de test; creează un congres și un dosar, verifică actualizarea contoarelor și accesul pe desktop/mobil.
- Build-urile pentru test se fac într-un director temporar transmis prin `CLIENT_DIST_PATH`, niciodată direct în directorul frontend servit în producție.
- Nu există o migrare nouă pentru shell. Release-ul trebuie să includă și să aplice migrările existente ale modulelor Congres și arbitraj, precum și lista de așteptare, înaintea pornirii serverului nou. Această schimbare nu reprezintă un deploy.

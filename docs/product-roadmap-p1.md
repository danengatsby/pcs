# Roadmap produs P1

Acest document ordoneaza dezvoltarea produsului pe fundatia existenta. Fiecare faza trebuie livrata cu migrare SQL, OpenAPI, test de integrare si flux UI.

## Faza 1: Operare membri

Scop: o sursa operationala unica pentru starea membrilor si performanta teritoriala.

- Introduce o masina de stari explicita pentru `supporter -> application -> verified -> approved -> active -> suspended|terminated`.
- Centralizeaza tranzitiile intr-un serviciu cu matrice de tranzitii permise, actor/capability, motiv si `effectiveAt`.
- Respinge tranzitiile ilegale si pastreaza evenimente imutabile.
- Extinde dashboard-ul cu membri noi, conversie voluntar-la-membru, activitate pe judete, obiective si restante.
- Adauga snapshot-uri agregate pe interval pentru comparatii intre perioade.

Criterii: fiecare tranzitie este autorizata si auditata; indicatorii pot fi filtrati dupa judet, organizatie si interval; valorile dashboard-ului sunt reproduse de teste DB.

## Faza 2: Comunicare controlata

Scop: comunicari repetabile, consimtite si raportabile.

- Template-uri versionate cu variabile validate si previzualizare.
- Programare cu timezone explicit, status `draft|scheduled|sending|sent|cancelled|failed`.
- Unsubscribe global si pe categorie, verificat inainte de materializarea audientei.
- Raportare pe dispatch, destinatar, bounce/failure si consimtamant.
- Idempotency key pentru fiecare dispatch si reconciliere pentru livrari ambigue.

Criterii: niciun destinatar fara consimtamant; un dispatch nu poate fi expediat de doua ori; preview-ul si raportul folosesc aceeasi audienta materializata.

## Faza 3: Date si documente

Scop: cautare si import controlat, cu trasabilitate.

- Full-text search PostgreSQL pentru membri, voluntari si organizatii, cu index GIN/trigram si paginare cursor.
- Import CSV in staging: upload, detectie coloane, preview erori, confirmare, commit atomic si rollback.
- Export CSV cu scope teritorial, audit si protectie formula injection.
- Documente membri cu tip, versiune, hash, expirare, status si audit al accesului.
- Job de notificare pentru documente care expira si politica de retentie.

Criterii: importul nu modifica datele inainte de confirmare; rollback-ul este atomic; fiecare document si acces are hash/audit; cautarea ramane sub p95 stabilit la volum de productie.

## Faza 4: Finance si elections

Scop: transformarea modulelor existente in produse administrabile.

- Finance: roluri de publicare, perioade contabile, categorii, atasamente, workflow `draft|review|published`, export si audit.
- Elections: calendar, circumscriptii, candidaturi, documente, statusuri si deadline alerts.
- Endpoint-urile publice raman read-only si expun numai inregistrari publicate.
- Endpoint-uri admin cu capability, scope teritorial si audit.

Criterii: orice inregistrare publicata are autor, timestamp si audit; datele nepublicate nu apar in endpoint-urile publice; deadline-urile genereaza alerte verificabile.

## Ordinea tehnica

1. State machine si dashboard operational.
2. Consimtamant, template-uri si dispatch scheduling.
3. Search si import/export staging.
4. Documente versionate si expirare.
5. Finance/elections admin workflows.
6. UI completa si teste Playwright pentru fluxurile critice.

## Contracte obligatorii pentru fiecare faza

- migrare SQL forward-only si actualizare Prisma;
- endpoint-uri OpenAPI si client generat;
- capability si scope teritorial;
- audit pentru mutatii administrative;
- teste unitare, integrare si smoke;
- metrici pentru latenta, erori si joburi esuate;
- criteriu de rollback si date demo separate de date reale.

# Roadmap securitate și conformitate P1

## Starea actuală

- Uploadurile media trec prin validare MIME și scanare ClamAV în producție.
- Readiness verifică disponibilitatea ClamAV prin `clamd`.
- Autentificarea, scope-ul teritorial, auditul și rate limiting-ul există deja.
- Retenția, exportul GDPR și ștergerea/rectificarea datelor nu sunt încă un workflow complet.

## Faza 1: Upload security în CI/staging

- Adaugă fixture EICAR care nu este publicată în artefactele frontend.
- Testează uploadul EICAR în staging și verifică `NEWS_MEDIA_INFECTED`.
- Rulează testele numai când `CLAMAV_TEST_URL` sau un serviciu ClamAV local este disponibil.
- Adaugă teste pentru:
  - extensie permisă cu MIME real falsificat;
  - fișier peste limita configurată;
  - nume/path cu traversal și separatori;
  - daemon indisponibil;
  - timeout de scanare;
  - cleanup al fișierului temporar după orice verdict.
- Gate-ul de release trebuie să blocheze deploy-ul dacă scanarea EICAR nu poate fi demonstrată în staging.

## Faza 2: Audit complet

- Audit pentru toate mutațiile administrative și citirile de date sensibile.
- Câmpuri minime: actor, capability, scope, acțiune, resursă, rezultat, request ID, timestamp și motiv.
- Nu se persistă parole, token-uri, document contents sau date sensibile inutile.
- Adaugă export audit append-only și retenție configurabilă.
- Testează că accesul refuzat și exporturile sunt auditate, nu doar operațiile reușite.

## Faza 3: Retenție și anonimizare

- Definește clase de retenție: conturi, voluntari, membri, consimțăminte, documente, audit și outbox.
- Job periodic idempotent care anonimizează sau șterge doar datele eligibile.
- Păstrează integritatea referențială prin anonimizare înainte de ștergere.
- Exclude datele cu hold legal și înregistrează motivul excluderii.
- Dashboard/metrici pentru candidate, procesate, eșuate și amânate.

## Faza 4: Drepturi GDPR

- Endpoint autentificat pentru exportul datelor proprii, cu job asincron pentru volume mari.
- Manifest de export versionat, checksum și audit al descărcării.
- Workflow de rectificare cu validare, aprobare unde este necesar și audit.
- Workflow de ștergere cu confirmare, perioadă de retenție și anulare controlată.
- Drepturile administratorilor sunt limitate prin capability și scope teritorial.

## Faza 5: Rate limiting distribuit

- În deployment cu mai multe instanțe, `RATE_LIMIT_STORE=redis` devine obligatoriu.
- Numărul de instanțe se declară prin `APP_INSTANCE_COUNT`; aplicația refuză pornirea dacă este mai mare decât 1 fără Redis.
- Startup fail-closed dacă Redis este obligatoriu dar `REDIS_URL` lipsește sau conexiunea nu poate fi validată.
- PostgreSQL rămâne fallback doar pentru development/test sau deployment single-instance declarat explicit.
- Testează limitele prin două procese concurente și verifică headerele comune.
- Monitorizează erorile Redis, fallback-urile și cheile de rate limit.

## Contracte de release

- `npm run verify` trebuie să includă testele de contract și politica de configurație.
- Staging rulează ClamAV real, PostgreSQL și Redis reale.
- Deploy-ul verifică EICAR, readiness, rate limiting Redis și un smoke GDPR non-destructiv.
- Orice modificare de retenție sau GDPR are migrare forward-only, procedură de rollback și audit.
- Datele demo nu pot fi folosite ca dovadă de conformitate pentru date reale.

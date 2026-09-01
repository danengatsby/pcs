# services/

Regulă de arhitectură (Bulletproof / feature-first):

- `src/features/<feature>/api/*` = apeluri API / logică de integrare **specifică feature-ului**.
  - exemplu: `features/news/api/getNews.ts`, `features/news/api/getNewsById.ts`

- `src/services/*` = logică **shared / cross-feature** (reutilizată de mai multe features),
  de ex:
  - `authService` (login / refresh / current user) folosit de mai multe features
  - `userService` / `billingService` etc.

- `src/lib/*` = infrastructură shared (client HTTP, config, logger).
  - exemplu: `lib/http.ts`

Recomandare:
- dacă un modul din `services/` începe să depindă de un feature, mută-l în feature.
- features NU importă cod din alte features (regula anti-coupling).

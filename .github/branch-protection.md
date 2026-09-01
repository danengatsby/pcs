# Branch Protection

Pentru a bloca merge-urile pana cand CI este verde, configureaza regula de branch protection / ruleset pentru branch-ul principal cu:

- `Require a pull request before merging`
- `Require status checks to pass before merging`
- `Require branches to be up to date before merging`
- `Do not allow bypassing the above settings`

Selecteaza ca required checks exact numele job-urilor din workflow-ul `CI`:

- `Lint + Build + Server Tests`
- `Browser E2E (Playwright)`
- `Browser E2E Fullstack`

Motivatie:

- numele job-urilor sunt stabile si apar explicit in `.github/workflows/ci.yml`
- event-ul `merge_group` este activ, deci regula functioneaza si cu merge queue
- `concurrency` anuleaza run-urile vechi pentru acelasi ref si reduce rezultate invechite

Observatie:

- protectia efectiva de branch se configureaza in GitHub repository settings sau printr-un ruleset la nivel de organizatie; fisierul acesta documenteaza configuratia exacta necesara pentru acest repo

# PCS API Routing

Acest proiect mentine paritatea Express/Fastify printr-o singura sursa de adevar pentru endpoint-urile API.

## Sursa de adevar

- Toate rutele API sunt declarate exclusiv in `server/src/appCore/apiRouteRegistry.ts`.
- Adapterul Express doar aplica registry-ul comun in `server/src/appCore/routes.ts`.
- Adapterul Fastify doar aplica acelasi registry in `server/src/fastify/registerRoutes.ts`.

Consecinta: nu se mai adauga `express.Router()` noi pentru endpoint-uri API.

## Ce intra in registry

- toate endpoint-urile `/api/**`
- middleware-urile atasate endpoint-ului
- guard-urile auth/role
- alias-urile care trebuie sa ramana identice intre adaptoare
- rutele conditionale, de exemplu `/api/metrics`

## Ce NU intra in registry

- fisiere statice `/uploads`
- fisierele frontend din `CLIENT_DIST_PATH` (sau `client/dist` local) si fallback-ul SPA; `/assets/*` are ruta statica dedicata si nu ajunge niciodata la fallback
- hook-urile/adaptoarele specifice Express sau Fastify

Acestea raman in adapterele HTTP, nu in registry.

## Regula pentru endpoint-uri noi

1. Implementezi handler-ul in modulul de domeniu.
2. Adaugi ruta o singura data in `server/src/appCore/apiRouteRegistry.ts`.
3. Daca ruta are risc de drift intre adaptoare, adaugi sau extinzi testele din:
   - `server/src/tests/integration/app.integration.test.ts`
   - `server/src/tests/integration/fastifyParity.integration.test.ts`

## Regula pentru refactor

- Daca un fisier mai contine doar agregare `Router()` fara a fi montat de registry, acel fisier este cod mort si trebuie eliminat.
- Nu pastra fisiere `*.routes.ts` doar pentru re-exporturi sau compatibilitate interna; importa direct handler-ele sau utilitarele reale.

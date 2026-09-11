# TreeFamily MVP — RC2

## Reason for RC2

Firebase CLI 15.18.0 rechazó la configuración Hosting de RC1 porque `../frontend/dist` escapaba del project directory del config. La misma restricción había impedido usar `../functions` para el primer deploy de Functions.

La recuperación procedural mediante `--cwd` no fue posible porque Firebase CLI 15.18.0 no ofrece esa opción. RC2 consolida la configuración productiva en un project root común sin alterar funcionalidad del producto.

## Scope

La única corrección funcional de release es `packages/firebase.json`. No hay cambios en frontend, Functions, Rules, tests, dependencias ni datos.

## Production Firebase config

- Config canónico de release: `packages/firebase.json`.
- Project root efectivo: `packages/`.
- Functions: `functions` → `packages/functions`.
- Firestore Rules: `firebase/firestore.rules` → `packages/firebase/firestore.rules`.
- Hosting: `frontend/dist` → `packages/frontend/dist`.

Todas las rutas permanecen dentro del project root. Functions conserva `codebase: default`, `disallowLegacyRuntimeConfig`, sus ignores y los hooks locales de lint/build.

La configuración DEV permanece separada en `packages/firebase/firebase.dev.json` y no debe usarse para releases productivos.

## RC1

`v0.1.0-rc.1` permanece inmutable y continúa apuntando a `1518861714e9b1cec0aa50fb8220b54e74aace74`.

RC2 es una corrección BLOCKER autorizada bajo code freeze; no mueve ni reutiliza RC1.

## QA repeated for RC2

| Gate | Resultado |
|---|---|
| Frontend tests | 11/11 archivos; 210/210 PASS |
| Frontend lint | PASS |
| Frontend production build | PASS; 732 módulos |
| Bundle audit | 0 fake key; 0 endpoints Emulator; 0 sourcemaps |
| Local production smoke | HTTP 200; root/login visibles; 0 pageerror; 0 console.error |
| Hosting config dry-run | PASS; sin outside-project error |
| Firestore Rules config dry-run | PASS; `firebase/firestore.rules` compiló correctamente |

El dry-run Hosting creó internamente una versión remota en estado `CREATED`, pero no publicó ningún release ni activó una versión live.

## Backend state

- Firestore Rules productivas: ya desplegadas.
- Firestore: `(default)`, Standard, `nam5`.
- Functions productivas: 12 desplegadas, v2, Node.js 24, `us-central1`.
- Functions DEV/legacy ausentes: `claimTreeOwnership`, `addPerson`, `addRelationship`.
- Source backend modificado por RC2: no.

## Hosting state

**PENDING REAL DEPLOY.**

El site `tree-gen-chenzoap-2026` existe. El dry-run validó el nuevo config, pero RC2 todavía no ha publicado Hosting y no declara el frontend LIVE.

## Custom domain

`treefamily.arsalix.com`: PENDING.

No se modificaron DNS ni Firebase Authentication Authorized domains durante esta corrección.

## Code freeze

RC2 contiene únicamente la corrección BLOCKER del config productivo y documentación asociada. Después de crear el tag RC2, el candidato vuelve a quedar congelado; solo otra corrección BLOCKER/CRITICAL podrá justificar un candidato posterior.

## Known warnings

- Bundle frontend minificado de aproximadamente 801.68 kB.
- Deprecación `module.register()` del tooling.
- Warning histórico de Auth Emulator durante unit tests.
- El dry-run de Firebase Hosting puede crear una versión remota no liberada en estado `CREATED`.

## Blockers

0.

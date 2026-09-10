# P09 — Release / Security

## Objetivo

Verificar antes del primer release que Rules y Functions impiden acceso cruzado, que la configuración DEV está separada de producción y que ninguna Function DEV o legacy forma parte de la superficie productiva.

## Baseline

Commit baseline: `fc7f472277faa67ea0662ef79c20680c894bd661`.

Proyecto Firebase: `tree-gen-chenzoap-2026`.

## Ownership model

El campo canónico es `ownerId`. El documento `trees/{treeId}` es la autoridad de ownership: las Functions consultan `tree.ownerId` y las Rules subordinan la lectura del árbol y sus subcolecciones a ese valor. El cliente no puede crear, actualizar, eliminar ni reasignar directamente el owner en producción.

## Firestore Rules

El ruleset candidato es `packages/firebase/firestore.rules`. Fue probado con `@firebase/rules-unit-testing` y un Firestore Emulator efímero sin importar ni exportar el seed.

| Recurso | Owner | Other user | Unauthenticated |
|---|---|---|---|
| Tree read | ALLOWED | DENIED | DENIED |
| Persons get/list | ALLOWED | DENIED | DENIED |
| Relationships get/list | ALLOWED | DENIED | DENIED |

Resultado: 7/7 PASS. Tree, person y relationship create/update/delete fueron denegados incluso al owner. Una colección top-level desconocida también fue denegada por defecto.

## Functions

El entrypoint productivo exporta exactamente 12 Functions:

- `createTreeWithRootPerson`
- `getMyTreeSummary`
- `getTreeData`
- `updatePerson`
- `deletePerson`
- `deleteRelationship`
- `reassignParentRelationship`
- `updatePartnerRelationshipStatus`
- `createUnion`
- `addPartnerToPerson`
- `addChildToUnion`
- `addParentToPerson`

El Emulator exporta además `claimTreeOwnership`, para un total de 13. Producción excluye `claimTreeOwnership`; `addPerson` y `addRelationship` no son exports públicos.

## Functions security tests

Suite Functions: 367/367 PASS. Lint y build: PASS.

| Function | Evidencia negativa o de aislamiento | Resultado |
|---|---|---|
| `createTreeWithRootPerson` | unauthenticated; cero writes | PASS |
| `getMyTreeSummary` | query limitada a `ownerId` del caller | PASS |
| `getTreeData` | cross-owner denegado antes de leer subcolecciones | PASS |
| `createUnion` | cross-owner denegado antes de writes | PASS |
| `addPartnerToPerson` | cross-owner denegado antes de writes | PASS |
| `addChildToUnion` | cross-owner denegado antes de writes | PASS |
| `addParentToPerson` | cross-owner denegado antes de writes | PASS |
| `claimTreeOwnership` | fuera del Emulator: `failed-precondition` | PASS |

La cobertura FULL existente también valida auth/ownership para `updatePerson`, `deletePerson`, `deleteRelationship`, `reassignParentRelationship` y `updatePartnerRelationshipStatus`.

## Frontend production config

DEV y producción están separados. DEV usa la configuración local conocida y conecta Auth, Firestore y Functions Emulator solamente cuando `import.meta.env.DEV` es verdadero. Producción requiere seis variables `VITE_FIREBASE_*`, falla en runtime si falta alguna y rechaza cualquier `projectId` distinto de `tree-gen-chenzoap-2026`.

El runtime productivo negativo confirmó el fail-fast; el runtime positivo alcanzó el render inicial sin errores. El bundle productivo no contiene `fake-api-key-for-emulator` ni endpoints localhost de Auth, Firestore o Functions. Frontend: 210/210 unit tests PASS; lint y build PASS.

## Secrets

No existen private keys, service accounts, credenciales privadas ni archivos `.env` reales tracked. `packages/frontend/.env.example` contiene solo nombres y placeholders vacíos. `packages/frontend/.env.production.local` es local, está ignorado y no debe versionarse. La configuración pública del Firebase Web SDK no sustituye credenciales privadas ni debe contener una service account.

## Firebase remote inventory

- Web App: `TreeFamily Web` (`1:72998121513:web:d7601a0590ef5943c56c38`).
- Apps totales: 1 WEB.
- Remote Functions: 0.
- Functions DEV/legacy remotas: 0; `claimTreeOwnership`, `addPerson` y `addRelationship` están ausentes.

Las 12 Functions productivas se desplegarán únicamente durante un release controlado. Su ausencia previa al primer deploy no es un fallo de P09.

## Auth production

**PRE-DEPLOY MANUAL CHECK REQUIRED.** Firebase CLI 15.18.0 no ofrece en este repositorio una consulta inequívocamente read-only de proveedores Auth sin exportar usuarios.

Antes del release, verificar en Firebase Console:

- Authentication → Sign-in method → Email/Password habilitado.
- Authentication → Settings → Authorized domains contiene solamente los dominios previstos para la aplicación.

## Remote Firestore/rules

La consulta read-only `firestore:databases:list` informó que todavía no existe una base Firestore remota. Por ello no hay rules remotas desplegadas que verificar. Antes del primer deploy debe crearse/configurarse `(default)` en la ubicación prevista (`nam5`) y, durante el release, desplegar y verificar `packages/firebase/firestore.rules`.

El ruleset candidato ya tiene evidencia dinámica local 7/7 PASS: owner permitido; cross-owner y unauthenticated denegados; escrituras directas y colecciones desconocidas denegadas.

## Safe deploy contract

- Project ID obligatorio: `tree-gen-chenzoap-2026`.
- Config canónico conjunto: `packages/firebase/firebase.json`.
- Source de Functions respecto de ese config: `../functions` (`packages/functions`).
- Rules productivas: `packages/firebase/firestore.rules`.
- No usar `packages/firebase/firebase.dev.json` en producción; referencia exclusivamente `firestore.dev.rules` y el wrapper del Emulator.
- Ejecutar el futuro deploy desde la raíz con project y config explícitos, limitando el alcance a `functions,firestore:rules`.
- Tras el deploy, el inventario debe contener exactamente las 12 Functions productivas.
- `claimTreeOwnership`, `addPerson` y `addRelationship` deben seguir ausentes.

Existe una ambigüedad de configuración: `packages/firebase.json` contiene solo Functions y usa `functions` como source, mientras el config conjunto está en `packages/firebase/firebase.json`. El release no debe depender de detección implícita ni del script `deploy` de `packages/functions`; debe pasar explícitamente el config canónico y el project ID.

## Known warnings

- Bundle minificado de aproximadamente 801 kB, superior al warning de 500 kB de Vite.
- Deprecación `module.register()` del tooling actual.
- Auth Email/Password y authorized domains requieren verificación manual pre-deploy.
- La base Firestore remota y el ruleset remoto quedan pendientes del primer release.
- El procedimiento de deploy debe usar config/project explícitos por la coexistencia de configuraciones Firebase.

## Blockers

0 blockers abiertos para el cierre local/source de P09. Los checks remotos pendientes son precondiciones del primer release y no autorizan un deploy en esta etapa.

## P09 conclusion

P09 — PASS

Rules y Functions niegan acceso cruzado, la configuración y los secretos están separados, y las Functions DEV/legacy no están publicadas ni forman parte del entrypoint productivo.

PASS de P09 no equivale a producción desplegada. El deployment se realizará y verificará durante las etapas de release posteriores.

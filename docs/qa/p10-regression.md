# P10 — Regresión integral

## Baseline

Commit: `0ee04d7ed6e43807a9bdc403b4dcc086fdc988ee`.

## Scope

P10 verifica la regresión integral del repositorio y la integridad de datos; no añade funcionalidad ni modifica código productivo.

## Functions

- Tests: 1 archivo, 367/367 PASS; baseline formal mínimo: 214.
- Lint: PASS.
- Build TypeScript: PASS.
- Superficie productiva: 12 Functions.
- Superficie Emulator: 13 Functions, incluyendo `claimTreeOwnership`.
- Producción excluye `claimTreeOwnership`, `addPerson` y `addRelationship`.

## Frontend

- Tests: 11 archivos, 210/210 PASS; baseline formal mínimo: 110.
- Lint: PASS.
- Build productivo: PASS; 732 módulos transformados.
- Bundle principal: 801.68 kB; gzip 247.29 kB.
- Bundle sanity: 0 coincidencias para `fake-api-key-for-emulator` y para los endpoints localhost de Auth, Firestore y Functions.

## Firestore Rules

- Resultado: 7/7 PASS.
- Rules probadas: `packages/firebase/firestore.rules`.
- Firestore Emulator efímero: puerto 8085, cerrado automáticamente.
- No se importó ni exportó `.firebase-seed`.

## E2E

- Specs: 5.
- Tests: 16/16 PASS.
- Worker: 1.
- Retries: 0.
- Duración: 31.1 s.

## Integrity validator

### Pre-E2E

- Exit code: 1.
- Resultado: N/A — protected seed contains zero trees.
- El validator buscó su `TREE_ID` histórico por defecto, inexistente en el seed protegido. No se crearon datos artificiales para satisfacer su precondición.

### Post-E2E

- Exit code: 0.
- Dataset: el único tree generado por E2E.
- Personas: 3.
- Relaciones: 3.
- Relaciones huérfanas: 0.
- Warnings: 0.
- Errores críticos: 0.
- Resultado: PASS.

## E2E residual data

- Trees: 1.
- Auth users: 16 totales; baseline importado 14; delta E2E +2.
- Usuarios `stage8.*` residuales: 0.
- Clasificación: KNOWN TEST DEBT. El onboarding histórico deja un tree y dos usuarios; mantenimiento Stage 8 conserva su contrato de cleanup.

## Seed integrity

- SHA-256 inicial y final: `02eb183bc1d3836fd311356920fd9ce3859921644d6523adc3ccfcd00f2bb7a4`.
- Archivos: 7.
- Tamaño: 19262 bytes.
- `SHA256SUMS`: válido.
- Manifest inicial/final: 0 diferencias.
- Export de la sesión: `.firebase-sessions/session-20260910-012513`.
- Export complete: sí; export failed: no.

## Regression matrix

| Gate | Baseline | Actual | Estado |
|---|---:|---:|---|
| Functions tests | >=214 | 367/367 | PASS |
| Functions lint | PASS | PASS | PASS |
| Functions build | PASS | PASS | PASS |
| Frontend tests | >=110 | 210/210 | PASS |
| Frontend lint | PASS | PASS | PASS |
| Frontend build | PASS | 732 módulos | PASS |
| Rules tests | 7/7 | 7/7 | PASS |
| E2E full | 16/16 | 16/16 | PASS |
| Validator pre-E2E | seed sin trees | exit 1, sin dataset aplicable | N/A |
| Validator post-E2E | datos válidos | exit 0, 0 warnings/errors | PASS |
| Seed hash | hash protegido | idéntico | PASS |
| Git cleanliness pre-report | limpio | limpio | PASS |

## Warnings

- Warning histórico de Auth Emulator durante unit tests frontend.
- Bundle minificado superior a 500 kB.
- Deprecación `module.register()` del tooling.
- `firebase-functions` reportada como desactualizada por Emulator.
- Runtime Functions solicitado Node 24 frente al host local Node 26.
- El onboarding E2E deja un tree y dos usuarios en la sesión efímera.

## Blockers

0.

## Conclusion

P10 — PASS

Functions, frontend, Rules y E2E no retroceden respecto al baseline formal. El validator confirma la integridad del dataset generado por E2E y el seed protegido permanece idéntico.

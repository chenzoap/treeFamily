# TreeFamily MVP — RC1

## Candidate

- Tag propuesto: `v0.1.0-rc.1`.
- Base funcional validada: `527feaa158c78ceb9f6fc2962bf26af65ab2d0cc`.
- Fecha de preparación: 2026-09-10.

El commit RC1 es el commit objetivo del tag anotado `v0.1.0-rc.1`. Una vez publicado, se puede resolver con `git rev-list -n 1 v0.1.0-rc.1`; su hash no se anticipa en este documento.

## Scope

El alcance funcional del MVP queda congelado para RC1. Incluye autenticación y perfil inicial, creación y visualización del árbol, relaciones y uniones familiares, y mantenimiento seguro de personas y relaciones.

Durante el freeze:

- No se aceptan funcionalidades nuevas.
- No se aceptan refactors opcionales.
- No se aceptan mejoras visuales opcionales.
- Solo se aceptan correcciones BLOCKER/CRITICAL necesarias para aprobar el candidato.

Si aparece una corrección bloqueante después del tag, `v0.1.0-rc.1` no se mueve: la corrección se realiza en un nuevo commit, se repiten los gates afectados y se crea un nuevo candidato, por ejemplo `v0.1.0-rc.2`.

## Quality evidence

| Gate | Resultado |
|---|---|
| Functions tests | 367/367 PASS |
| Functions lint | PASS |
| Functions build | PASS |
| Frontend tests | 210/210 PASS |
| Frontend lint | PASS |
| Frontend build | PASS |
| Firestore Rules productivas | 7/7 PASS |
| E2E Chromium | 16/16 PASS; 1 worker; 0 retries |
| Validator post-E2E | PASS; 0 warnings; 0 errores críticos |

Seed protegido:

- SHA-256: `02eb183bc1d3836fd311356920fd9ce3859921644d6523adc3ccfcd00f2bb7a4`.
- Archivos: 7.
- Tamaño: 19262 bytes.

Evidencia canónica:

- [`docs/qa/p09-release-security.md`](../qa/p09-release-security.md)
- [`docs/qa/p10-regression.md`](../qa/p10-regression.md)

## Functions surface

- Production exports: 12.
- Emulator exports: 13.
- Producción excluye `claimTreeOwnership`, `addPerson` y `addRelationship`.

## Firebase production status

RC1 no equivale a deployment productivo.

- Firebase project: `tree-gen-chenzoap-2026`.
- Web App: `TreeFamily Web`.
- Functions remotas antes del primer deploy: 0.
- Firestore remoto: todavía no creado/configurado para release.
- Rules remotas: todavía no desplegadas.

## Pre-deploy checks

Estos puntos no bloquean la creación de RC1, pero condicionan el go-live:

- Verificar manualmente que Auth Email/Password esté habilitado.
- Revisar los Authorized domains de Authentication.
- Crear/configurar Firestore `(default)` en la ubicación definida para el release.
- Desplegar `packages/firebase/firestore.rules`.
- Desplegar exactamente las 12 Functions productivas.
- Verificar el inventario remoto después del deploy.
- Confirmar que `claimTreeOwnership`, `addPerson` y `addRelationship` permanezcan ausentes.

## Deploy contract

- Project: `tree-gen-chenzoap-2026`.
- Config productiva canónica: `packages/firebase/firebase.json`.
- Rules productivas: `packages/firebase/firestore.rules`.
- Functions source: `packages/functions`.
- Config DEV prohibida en producción: `packages/firebase/firebase.dev.json`.

No se ejecutó ningún deploy durante la preparación de RC1.

## Identifiable artifacts

### Source candidate

- Commit Git definitivo de RC1: objetivo del tag anotado `v0.1.0-rc.1`.
- Tag: `v0.1.0-rc.1`.

### Frontend build

- Workspace: `packages/frontend`.
- Output reconstruible: `packages/frontend/dist`.

### Functions build

- Workspace: `packages/functions`.
- Output reconstruible: `packages/functions/lib`.

### QA evidence

- `docs/qa/p09-release-security.md`.
- `docs/qa/p10-regression.md`.

### Release documentation

- `CHANGELOG.md`.
- `docs/releases/mvp-rc1.md`.

Los outputs `dist` y `lib` no se versionan. El commit y el tag permiten reconstruirlos desde el lockfile.

## Reproduction commands

Desde la raíz del repositorio:

```sh
npm ci
npm run build -w packages/functions
npm run build -w packages/frontend
```

El build frontend productivo requiere las variables `VITE_FIREBASE_*` documentadas en `packages/frontend/.env.example`; sus valores reales no forman parte del repositorio.

## Known warnings

- Bundle frontend minificado de aproximadamente 801 kB.
- Deprecación `module.register()` del tooling.
- `firebase-functions` reportada como desactualizada por Emulator.
- Runtime Functions solicitado Node 24 frente al host local Node 26.
- Deuda conocida: onboarding E2E deja un tree y dos usuarios en la sesión efímera.

## Blockers

0.

## Code freeze

- Fecha: 2026-09-10.
- Estado: **ACTIVE UPON RC1 TAG**.

Hasta crear el tag, la preparación documental está en curso. Después del tag solo se aceptarán correcciones bloqueantes conforme a la política de nuevos candidatos descrita arriba.

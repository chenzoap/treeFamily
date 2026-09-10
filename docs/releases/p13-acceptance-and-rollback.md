# P13 — Aceptación y rollback

## RC1

- Tag: `v0.1.0-rc.1`.
- Commit: `1518861714e9b1cec0aa50fb8220b54e74aace74`.
- Code freeze: ACTIVE desde la publicación del tag el 2026-09-10.

El tag local y su referencia remota anotada resuelven al mismo commit. El candidato no se movió ni se recreó durante esta aceptación.

## Acceptance matrix

| Flujo | Evidencia | Resultado |
|---|---|---|
| Auth y onboarding | E2E P10: rutas Auth y onboarding dentro de 16/16 PASS | EVIDENCE_FROM_P10 |
| Creación de perfil | E2E onboarding y Functions 367/367 PASS | EVIDENCE_FROM_P10 |
| Carga y visualización del árbol | E2E, frontend 210/210 y stress P06 | EVIDENCE_FROM_P10 |
| Relaciones padre/madre/hijo | Functions y E2E de creación de árbol/relaciones | EVIDENCE_FROM_P10 |
| Parejas y uniones | Functions y E2E de mantenimiento | EVIDENCE_FROM_P10 |
| Edición de persona | E2E Stage 8 | EVIDENCE_FROM_P10 |
| Eliminación segura de persona | E2E Stage 8 | EVIDENCE_FROM_P10 |
| Eliminación de relaciones | E2E Stage 8 para filiación y pareja | EVIDENCE_FROM_P10 |
| Reasignación parental | E2E Stage 8 | EVIDENCE_FROM_P10 |
| Actualización de estado de pareja | E2E Stage 8 | EVIDENCE_FROM_P10 |
| Layout y render del árbol | Frontend unit, P06 Chromium y E2E P10 | EVIDENCE_FROM_P10 |
| Ownership y acceso cross-owner | Rules 7/7 y Functions security 367/367 PASS | EVIDENCE_FROM_P10 |
| Configuración DEV/producción | P09: fail-fast, bundle y smoke DEV | PASS |

## QA evidence

- [`docs/qa/p09-release-security.md`](../qa/p09-release-security.md): seguridad, ownership y separación DEV/producción.
- [`docs/qa/p10-regression.md`](../qa/p10-regression.md): regresión integral, validator e integridad del seed.
- Functions: 367/367 PASS; lint y build PASS.
- Frontend: 210/210 PASS; lint y build PASS.
- Firestore Rules productivas: 7/7 PASS.
- E2E Chromium: 16/16 PASS, 1 worker y 0 retries.
- Validator post-E2E: PASS, sin warnings ni errores críticos.

## Backup rehearsal

El wrapper `npm run firebase:start:dev` creó antes del arranque:

- Snapshot: `.firebase-backups/seed-before-start-20260910-121801`.
- Archivos: 7.
- Tamaño: 19262 bytes.
- SHA-256 crítico: `02eb183bc1d3836fd311356920fd9ce3859921644d6523adc3ccfcd00f2bb7a4`.
- `SHA256SUMS`: todos los archivos verificados.

El snapshot fue equivalente al seed protegido. El wrapper importó `.firebase-seed` y configuró el export de cierre exclusivamente hacia `.firebase-sessions/session-20260910-121801`.

## Rollback rehearsal

El ensayo se realizó íntegramente contra Emulators locales:

1. Se copió el snapshot original a un directorio temporal bajo `/tmp`.
2. El dataset inicial confirmó `trees = 0`.
3. Se creó únicamente en Firestore Emulator el marcador `trees/p13-rollback-marker`; el estado modificado confirmó `trees = 1` y marcador presente.
4. Se solicitó un único Ctrl+C al wrapper. El shutdown fue limpio y la sesión modificada se exportó con `Export complete` a `.firebase-sessions/session-20260910-121801`.
5. La sesión exportada se reimportó sin `export-on-exit` y confirmó `trees = 1` y marcador presente.
6. Se cerró ese Emulator y se importó, también sin `export-on-exit`, la copia original desde `/tmp`.
7. El estado restaurado confirmó `trees = 0` y marcador ausente.

La copia restaurada mantuvo 7 archivos, 19262 bytes, el SHA-256 protegido y un `SHA256SUMS` válido. El validator terminó con exit code 1 porque el snapshot original contiene cero trees y su `TREE_ID` histórico no existe; conforme al contrato ya auditado, el resultado es N/A por dataset vacío, no un fallo de integridad.

Resultado del ensayo: PASS. `ROLLBACK STATE == ORIGINAL SNAPSHOT` y `.firebase-seed` permaneció intacto.

## Source rollback

Para volver al código aceptado se debe construir o desplegar desde el tag inmutable `v0.1.0-rc.1`, cuyo target es `1518861714e9b1cec0aa50fb8220b54e74aace74`. No es necesario mover el tag ni alterar la historia.

## Data rollback constraints

Un rollback de código no revierte automáticamente datos de Firestore. Antes de cualquier operación productiva destructiva debe existir un snapshot/export remoto verificable y un procedimiento de restauración específico para producción.

El wrapper y el ensayo descritos aquí protegen el entorno Emulator local; no constituyen por sí mismos una política de backup productivo ni autorizan reutilizar `.firebase-seed` como destino de restore.

## Known limitations

### Product limitations

- El bundle frontend minificado es de aproximadamente 801 kB.
- La selección de nodos fuera del viewport no realiza auto-centrado; árboles grandes requieren pan/zoom.

### Test-environment limitations

- El onboarding E2E deja un tree y dos usuarios en la sesión efímera; Stage 8 no deja residuos propios.

### Pre-go-live conditions

- Producción todavía no está desplegada.
- Auth y Firestore requieren configuración/verificación antes del go-live.

## Tooling warnings

- Deprecación `module.register()` del tooling.
- `firebase-functions` reportada como desactualizada por Emulator.
- Runtime Functions solicitado Node 24 frente al host local Node 26.

Estos warnings no bloquearon los gates de P09, P10 ni el ensayo local de rollback.

## Production go-live conditions

| Criterio | Estado | Evidencia o acción pendiente | Bloquea go-live |
|---|---|---|---|
| RC1 tag íntegro | PASS | Tag local/remoto resuelve al commit RC1 | No |
| Regresión P10 | PASS | `docs/qa/p10-regression.md` | No |
| Seguridad P09 | PASS | `docs/qa/p09-release-security.md` | No |
| Integridad del seed | PASS | SHA y manifest sin diferencias | No |
| Ensayo de rollback local | PASS | Estado modificado y snapshot original reimportados | No |
| Limitaciones conocidas | DOCUMENTED | Este documento y notas RC1 | No |
| Auth Email/Password | MANUAL GO-LIVE CHECK | Confirmar ENABLED en Firebase Console | Sí |
| Authorized domains | MANUAL GO-LIVE CHECK | Limitar a dominios requeridos | Sí |
| Firestore `(default)` | PLANNED | Crear/configurar en ubicación `nam5` | Sí |
| Rules productivas | PENDING | Desplegar `packages/firebase/firestore.rules` | Sí |
| Functions productivas | PENDING | Desplegar exactamente 12 exports | Sí |
| Inventario post-deploy | PENDING | Verificar 12 productivas y ausencia de DEV/legacy | Sí |

Proyecto previsto: `tree-gen-chenzoap-2026`. Web App: `TreeFamily Web`. Antes del release controlado hay 0 Functions remotas; Firestore y Rules remotas siguen pendientes. Deben permanecer ausentes `claimTreeOwnership`, `addPerson` y `addRelationship`.

Las notas completas del candidato están en [`CHANGELOG.md`](../../CHANGELOG.md) y [`docs/releases/mvp-rc1.md`](mvp-rc1.md).

## Go/no-go

- RC1 ACCEPTANCE: **PASS**.
- PRODUCTION GO-LIVE: **CONDITIONAL GO**.

RC1 está aceptado para deployment controlado, pero no está LIVE. El go-live queda condicionado exclusivamente a completar y verificar Auth, Authorized domains, Firestore, Rules, las 12 Functions productivas y el inventario remoto posterior.

## Blockers

0.

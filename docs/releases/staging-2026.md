# TreeFamily Staging — resultado de validación

Fecha: 2026-09-19. Estado: **QA funcional PASS; listo para revisión**. Cambios preparados en la rama independiente de staging. No quedan bloqueos de infraestructura o del recorrido comprobado; pendientes operativos y límites de QA al final.

## Identidad y revisión

- Rama: `staging/firebase-independent`.
- Base revisada: `58b116cff1ec03a86ac70913c06ca6f1e2d52021`; correcciones versionadas en esta rama.
- Proyecto: **TreeFamily Staging**, `treefamily-staging-2026`, número `233536230940`.
- Web App: `1:233536230940:web:67daba2383d8240f69f1d9`.
- URL real: https://treefamily-staging-2026.web.app
- Última versión Hosting: `01400a9c9f25c572`, incluye el arreglo del borrador.
- Producción preservada: `tree-gen-chenzoap-2026` / `treefamily.arsalix.com`, sin escrituras ni despliegues.
- `packages/firebase.json` y `packages/.firebaserc` iguales a origen.
- Los 13 archivos originales de `audit-evidence/` conservan sus SHA-256. Sin importaciones de seed ni datos productivos.

No había AGENTS.md en el repositorio ni directorios superiores. Se consultaron README, estado del producto, P09, RC2 y P14; los documentos recientes prevalecieron sobre los datos históricos de P09.

## Inventario remoto verificado

| Recurso | Estado |
|---|---|
| Facturación | `billingEnabled=true`, confirmado por API |
| Authentication | Email/Password habilitado; contraseña requerida |
| Dominios Auth | Solo `treefamily-staging-2026.firebaseapp.com` y `treefamily-staging-2026.web.app` |
| Firestore | `(default)`, Standard, modo nativo, `nam5` |
| Reglas e índices | Canónicos, desplegados previamente; rules remotas comparadas con archivo canónico |
| Hosting | `frontend/dist-staging`, fallback SPA; canal conservado |
| Functions | Exactamente 12, todas ACTIVE, v2, Node.js 24, `us-central1` |
| Artifact Registry | Retención de un día en `us-central1`, `dryRun=false` |

Las doce Functions corresponden al entrypoint de release:

```text
createTreeWithRootPerson
getMyTreeSummary
getTreeData
updatePerson
deletePerson
deleteRelationship
reassignParentRelationship
updatePartnerRelationshipStatus
createUnion
addPartnerToPerson
addChildToUnion
addParentToPerson
```

`claimTreeOwnership`, `addPerson` y `addRelationship` están ausentes del inventario de staging. No se eliminó ninguna función productiva. Sin Analytics ni Firebase Storage para uso de la aplicación; Functions sí crea infraestructura interna de fuentes y artefactos administrada por Google.

El primer despliegue creó las Functions, pero terminó con aviso por falta de limpieza; se aplicó y verificó la retención. La primera creación de árbol recibió un 401 de IAM de Cloud Run antes de entrar al callable. Se declaró `invoker: public` únicamente para staging y se redesplegaron las doce. La autenticación/ownership siguen siendo obligatorias dentro del callable: la prueba sin token devuelve `UNAUTHENTICATED`. Durante la continuación final no se redesplegaron Functions ni Firestore; solo Hosting necesitó publicar el arreglo del borrador.

## Causa exacta del fallo del borrador

Era un defecto del producto, no una selección accidental de la misma persona. La instrumentación temporal dentro del navegador confirmó:

1. Persona activa/editada: Alma Ficticia. Destino: Bruno Revisado. IDs distintos.
2. Formulario modificado y «Guardar cambios» habilitado.
3. `EditPersonForm` llamó a `onDirtyChange(true)` en `t=1481,8 ms` de esa ejecución.
4. En `t=1485,5 ms`, el manejador del selector aún leía `editingPersonDirty=false` del render anterior: React no había confirmado la actualización del estado del padre.
5. El manejador cerró el formulario y cambió de persona sin alertdialog.

Esperar al botón habilitado no bastaba: reflejaba el estado del hijo, no la actualización del padre. Una primera prueba aislada pasó; la secuencia guardar una persona → editar otra → cambiar de persona volvió a demostrar el defecto.

**Corrección mínima:** `Stage4Panel` conserva el último aviso dirty en una referencia síncrona y mantiene el estado React para el render. Un callback estable actualiza ambos y el guard consulta la referencia. Cancelar, guardar y descartar restablecen ambos por el mismo callback. `EditPersonForm` no necesitó modificaciones.

La regresión en `scripts/qa-staging.mjs --case draft` entrega una notificación dirty y un evento de selección en el mismo turno de JavaScript, antes del commit de React, y exige el alertdialog. Además prueba el recorrido real: guardar edición, editar Alma, intentar seleccionar Bruno, seguir editando conservando texto/selección y descartar explícitamente. Ambos pasan. Los logs temporales fueron retirados; su evidencia se conserva localmente.

## QA remota y datos ficticios

Se conservaron dos cuentas exclusivamente QA en staging: **QA-A** (diagnóstico) y **QA-B** (validación final), cada una con un árbol ficticio de cinco personas. No se publican emails, UIDs, IDs de documentos, contraseñas ni tokens. Los nombres son inventados; no se usaron datos reales ni copias desde producción.

Alta, perfil y construcción se verificaron con QA-B antes de detectar la carrera. Tras corregirla se repitió primero solo el caso fallido y su regresión; después hubo una pasada final exitosa con ese mismo árbol, sin recrear cuentas ni duplicar familiares.

| Comprobación | Resultado |
|---|---|
| Crear cuenta ficticia por UI | PASS |
| Crear perfil y árbol privado por callable | PASS |
| Raíz visible, tarjeta y texto dentro del SVG | PASS |
| Agregar padre, madre, conectar padres, pareja e hijo con roles explícitos | PASS |
| Editar persona y persistir cambios | PASS |
| Borrador: seguir editando / descartar y cambiar | PASS |
| Regresión antes del commit de React | PASS |
| Diálogo de eliminación: Enter, foco en Cancelar, Shift+Tab/Tab contenidos, Escape y retorno del foco | PASS, sin eliminar datos |
| Logout/login recupera el mismo árbol y edición | PASS; borrador descartado ausente |
| Móvil: edición y protección del borrador | PASS |
| Móvil: Panel → Árbol → Panel y retorno al árbol | PASS |
| Solicitudes a proyectos ajenos, producción o emuladores | 0 |
| Errores JavaScript de página | 0 |

No se usó el ancho de `main` como prueba del árbol. Se verificaron cinco elementos `[data-person-id]`, nombres, dimensiones y posición dentro del SVG, y 12 paths de conexiones. Las capturas se guardaron y revisaron.

| Viewport | SVG observado | Personas | Paths |
|---|---|---:|---:|
| Escritorio 1440×900 | 300×741 | 5 | 12 |
| Móvil 390×844 | 300×619 | 5 | 12 |
| Móvil 375×844 | 300×619 | 5 | 12 |
| Móvil 320×844 | 260×575 | 5 | 12 |

Los SDK de Auth, Firestore y Functions se verificaron antes de escribir datos; el JS servido se comparó por SHA-256 con el build local. El token Auth tenía audiencia `treefamily-staging-2026` y emisor de ese proyecto, sin exportarlo. Firestore usó `(default)` / `firestore.googleapis.com`; Functions, `us-central1`; sin emuladores. La pasada final observó 6 solicitudes Auth, 7 Firestore y 8 Functions, restringidas a staging por un guard de red. Las referencias diagnósticas de SDK se añadieron solo en el navegador de prueba, no a los bytes publicados.

Evidencias locales ignoradas en `.staging-qa-results/`:

- `onboarding-before-draft-fix.json`: alta, creación, familiares y edición que pasaron antes del fallo.
- `draft-race-before-fix.json`: notificación dirty y guard desactualizado que demuestran la causa.
- `draft-results.json`: caso focalizado y regresión PASS tras el arreglo.
- `final-results.json`: pasada final PASS.
- Capturas de raíz, familia, persistencia, viewports móviles y retorno al árbol.

## Controles de gasto y pendientes

El usuario confirmó Blaze mediante prueba gratuita y crédito visible de **US$300**. La API confirmó facturación habilitada; no se consultó saldo monetario ni consumo acumulado. No se afirma gasto cero ni saldo restante. No se actualizó la cuenta a modalidad pagada ni se cambió su vínculo de facturación.

Controles **aplicados y verificados** exclusivamente en staging:

- `minInstances=0`, `maxInstances=1` por función.
- 256 MiB, CPU `0.1666` (`gcf_gen1`), concurrencia 1, timeout 60 s.
- Retención de artefactos de 86.400 s en `gcf-artifacts`, `us-central1`, política DELETE activa.
- Opciones condicionadas al ID staging y desactivadas en emuladores. Prueba de que no se aplican al ID productivo.
- Sin pruebas de carga ni instancias mínimas mantenidas para QA.

**Pendiente operativo:** crear o comprobar un presupuesto de US$50 del ciclo, filtrado solo por proyecto `233536230940`, con alertas a US$10/25/40 y previsión al 100%. No se creó presupuesto ni automatización de corte. Las alertas **no constituyen un límite duro de cobro**; los límites de instancia tampoco (pueden sumar 12 instancias). Detener pruebas al umbral de US$40 deja margen, pero no garantiza el máximo por la latencia de medición. Revisar consumo y vencimiento del crédito antes de nuevas sesiones.

Referencias: [recursos de Functions](https://firebase.google.com/docs/functions/manage-functions), [presupuestos y alertas](https://docs.cloud.google.com/billing/docs/how-to/budgets).

Límites de QA: Chromium de escritorio y emulación móvil con entrada táctil, no dispositivos físicos ni Safari. El layout existente mantiene un SVG de 300 px en escritorio y texto pequeño al encajar toda la familia; observación visual para revisión, sin ampliar el arreglo a un rediseño. Se inventariaron las doce Functions; las operaciones destructivas y de reasignación no se ejercitaron remotamente en esta pasada, aunque tienen pruebas locales.

## Verificación local, aislamiento y procesos

- Frontend: 230/230 pruebas, incluidos 20 casos de configuración; lint y builds PASS.
- CI compila producción sin configuración desplegable: Vite valida anticipadamente solo el modo staging, mientras `firebaseConfig.ts` mantiene la validación estricta al inicializar producción.
- Functions: 367/367 pruebas; lint y build PASS.
- Aislamiento de workflow, wrapper, entrypoint y límites por proyecto: 8/8 PASS. Sus subprocesos Node necesitaron salir del sandbox para obtener resultados.
- Builds negativos con projectId cruzado rechazados antes de generar bundle.
- `git diff --check`: PASS. Variables locales, credenciales QA y builds staging ignorados por Git.
- Emuladores conservados; producción rechaza IDs ajenos y staging valida ID, dominio Auth, número y App ID reales.
- Accesos remotos con project/config explícitos. Staging usa `packages/firebase.staging.json` desde la raíz, backend equivalente al canónico y Hosting separado.
- No quedan procesos locales de QA, Chromium/Playwright, wrappers Firebase ni Vite iniciados por la tarea. No se apagaron servicios ajenos.
- Avisos conocidos: bundle superior a 500 kB y deprecación del tooling Node.

## Archivos modificados o añadidos

```text
.gitignore
packages/firebase.staging.json
packages/frontend/package.json
packages/frontend/vite.config.ts
packages/frontend/src/lib/firebase.ts
packages/frontend/src/lib/firebaseConfig.ts
packages/frontend/src/lib/firebaseConfig.test.ts
packages/frontend/src/components/Stage4Panel.tsx
packages/functions/src/functionsEntry.ts
packages/functions/src/stagingOptions.ts
scripts/firebase-staging.mjs
scripts/staging-isolation.test.mjs
scripts/verify-staging-browser.mjs
scripts/qa-staging.mjs
docs/releases/staging-2026.md
```

Locales ignorados: `.env.staging.local` del frontend, `.staging-qa.local`, `.staging-qa-final.local`, `dist-staging/` y `.staging-qa-results/`. `audit-evidence/` ya existía sin seguimiento y no forma parte de los cambios nuevos.

Para repetir únicamente la regresión:

```sh
node scripts/qa-staging.mjs --project treefamily-staging-2026 --config packages/firebase.staging.json --case draft
```

La pasada final se reproduce con `--case final` y la cuenta QA-B conservada. No usar el runner E2E predeterminado contra staging: arranca Vite DEV y presupone emuladores. No hace falta redesplegar servicios para revisar este resultado.

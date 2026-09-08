# P06 — Layout y performance

## Objetivo

Validar el layout y el render del MVP con árboles deterministas de 25, 50 y 100 personas.

La Definition of Done exige medir render y tiempo de respuesta, medir colisiones, verificar la selección y clasificar los hallazgos por severidad. P06 no exige perfección visual, pero sí ausencia de blockers.

## Baseline

- Branch: `main`
- Baseline previo a P06: `3553b1bf90c8679a10eb7471312d338c2144d028`
- SHA-256 del seed protegido: `02eb183bc1d3836fd311356920fd9ce3859921644d6523adc3ccfcd00f2bb7a4`
- Seed: 7 archivos, 19262 bytes

## Datasets

| Personas | Relaciones | Uniones | couple | coParents | singleParent |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 25 | 37 | 9 | 7 | 1 | 1 |
| 50 | 75 | 19 | 13 | 2 | 4 |
| 100 | 153 | 34 | 21 | 6 | 7 |

Los fixtures son deterministas e incluyen varias generaciones, parejas, familias single-parent, coParents, hermanos, ramas laterales y uniones sucesivas. No dependen de Firebase ni generan datos persistentes.

## Layout puro

| Personas | Collisions | Overlaps físicos | Detached | Mediana | Resultado |
| ---: | ---: | ---: | ---: | ---: | --- |
| 25 | 0 | 0 | 0 | 0.179 ms | PASS |
| 50 | 0 | 0 | 0 | 0.153 ms | PASS |
| 100 | 0 | 0 | 0 | 0.235 ms | PASS |

La geometría fue determinista en ejecuciones independientes. Todas las coordenadas y bounds fueron finitos y ninguna persona se perdió durante el layout.

## Bounds

| Personas | Width | Height |
| ---: | ---: | ---: |
| 25 | 2443 px | 1236 px |
| 50 | 6233 px | 1466 px |
| 100 | 12683 px | 1696 px |

El crecimiento horizontal es significativo, pero el árbol permanece navegable mediante zoom y pan.

## Direct render Chromium

| Personas | DOM | Uniones | Overlaps | Mediana render | Zoom | Resultado |
| ---: | ---: | ---: | ---: | ---: | --- | --- |
| 25 | 25/25 | 9 | 0 | 2.70 ms | N/A | PASS |
| 50 | 50/50 | 19 | 0 | 4.65 ms | N/A | PASS |
| 100 | 100/100 | 34 | 0 | 8.65 ms | PASS | PASS |

- `pageerror`: 0
- `console.error`: 0
- Warnings geométricos: 0

## TreeView real

Se validó el pipeline real:

`React TreeView` → Zustand → `buildUnionsWithDiagnostics` → `buildFamilyLayout` → debounce de 120 ms → `renderFullTree` → D3/SVG.

| Personas | Mediana de selección | Resultado |
| ---: | ---: | --- |
| 25 | 131.60 ms | PASS |
| 50 | 131.60 ms | PASS |
| 100 | 141.55 ms | PASS |

- Debounce/coalescing: PASS
- Renders intermedios incorrectos: 0
- Integridad después de rerender: PASS
- Overlaps después de rerender: 0
- Selección visual: PASS
- Zoom después de rerender para 100 personas: PASS

## Regresión general

- Frontend unit tests: 210/210 PASS
- Frontend lint: PASS
- Frontend build: PASS
- Full E2E: 16/16 PASS

Specs E2E cubiertos:

- Auth routes
- MVP onboarding
- P06 direct render
- P06 TreeView
- Stage 8 maintenance

## Validator

Comando evaluado:

```text
node scripts/validate-tree-data.mjs
```

Resultado para P06: **N/A — SEED CONTRACT**.

El validator obtiene el identificador desde `process.env.TREE_ID` y usa como default histórico `gib7tREAAsXDQX4Qh3Oh`. Ese árbol no forma parte del seed protegido actual: una consulta read-only al Emulator confirmó `trees = 0`. Por tanto, no existe un `TREE_ID` válido sobre el cual aplicar el validator en el baseline limpio.

No se crearon datos artificiales, no se modificó el seed y esta precondición ausente no representa un fallo de integridad ni un FAIL final de P06.

## Firebase safe dev

El gate relevante utilizó exclusivamente:

```text
npm run firebase:start:dev
```

- Import: `.firebase-seed`
- Session del gate: `.firebase-sessions/session-20260908-104209`
- Shutdown solicitado con exactamente un Ctrl+C
- Un shutdown efectivo
- Un export
- `Export complete`
- Sin SIGHUP
- Sin `Export failed`

La sesión posterior `.firebase-sessions/session-20260908-114318` se generó únicamente durante el triage read-only, se conserva como histórico temporal y no fue promovida.

## Seed

- SHA-256 inicial, durante Emulator y final: `02eb183bc1d3836fd311356920fd9ce3859921644d6523adc3ccfcd00f2bb7a4`
- Archivos: 7
- Bytes: 19262
- Manifest diff: 0 diferencias

Conclusión: `.firebase-seed` permaneció intacto.

## Revisión visual

| Dataset | Resultado |
| --- | --- |
| 25 personas | PASS |
| 50 personas | PASS con framing amplio |
| 100 personas | PASS con framing amplio |

Observaciones no bloqueantes:

1. Los árboles de 50 y 100 personas son significativamente más anchos que el viewport y requieren pan/zoom.
2. En el viewport inicial pueden aparecer conectores largos cuyos extremos quedan fuera de pantalla.
3. Seleccionar una persona fuera del viewport no produce auto-centrado automático.
4. `p06-treeview-100.png` y `p06-treeview-100-selected.png` resultaron visualmente y pixel-wise iguales porque el target seleccionado no estaba necesariamente dentro del viewport.

Esto no invalida la selección: los tests DOM verificaron exactamente un `data-selected="true"` para cada target solicitado.

Clasificación: **WARNING / UX futura**. No BLOCKER. Los screenshots no se agregaron al repositorio.

## Warnings no bloqueantes

- Chunk minificado de Vite de aproximadamente 801 kB, superior a 500 kB.
- `firebase-functions`/tooling desactualizado.
- Runtime Node solicitado 24 frente a host 26.
- Deprecation warning de `module.register()`.
- Mensaje histórico del Auth Emulator en unit tests.
- Selección fuera del viewport sin auto-centering.
- Framing inicial amplio en árboles grandes.

Estos warnings no son errores P06.

## Blockers

0 blockers abiertos.

## Veredicto

**P06 — PASS**

La evidencia demuestra que el MVP soporta árboles deterministas de hasta 100 personas sin pérdida de nodos, detached, collisions, overlaps físicos o degradación de respuesta bloqueante.

No se requiere optimización del algoritmo de layout/render antes de continuar con el MVP.

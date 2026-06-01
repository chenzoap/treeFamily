# 00 - Estructura actual detectada

Este documento describe la estructura actual del proyecto al cierre funcional de Etapa 4.

---

## Estructura general detectada

```txt
treeFamily/
  package.json
  package-lock.json
  README.md
  playwright.config.ts

  packages/
    frontend/
      package.json
      src/
        App.tsx
        main.tsx
        index.css

        lib/
          firebase.ts

        store/
          useTreeStore.ts

        types/
          family.ts

        graph/
          union.ts
          layout.ts

        visualization/
          renderTree.ts

        pages/
          CreateMe.tsx
          CreateMe_bck.tsx
          TreeView.tsx
          TreeViewPage.tsx
          AddParents.tsx

        components/
          Stage4Panel.tsx
          AddRelationshipForm.tsx

    functions/
      package.json
      src/
        index.ts

      lib/
        index.js
        index.js.map

      Requerimientos_minimos.txt

    firebase/
      firebase.json
      firebase.dev.json
      firestore.rules
      firestore.dev.rules
      firestore.indexes.json

  scripts/
    seed-firestore.mjs
    validate-tree-data.mjs

  tests/
    example.spec.ts

  .firebase-seed/
```

---

## Lectura técnica

El proyecto ya tiene estructura de monorepo con:

- Frontend en `packages/frontend`.
- Cloud Functions en `packages/functions`.
- Configuración Firebase.
- Scripts de seed/validación.
- Tests base con Playwright.
- Tipos frontend.
- Store Zustand.
- Visualización separada parcialmente en `graph/` y `visualization/`.

---

## Estado de carpetas principales

| Carpeta | Estado | Decisión |
|---|---|---|
| `packages/frontend/src/pages` | Funcional, pero mezcla páginas actuales y legacy. | Ordenar gradualmente. |
| `packages/frontend/src/components` | Funcional, pero necesita separación por dominio. | Crear subcarpetas. |
| `packages/frontend/src/graph` | Bien separada. | Mantener. |
| `packages/frontend/src/visualization` | Bien separada. | Mantener. |
| `packages/frontend/src/store` | Bien. | Mantener. |
| `packages/frontend/src/types` | Útil, pero podría moverse a shared en futuro. | Mantener por ahora. |
| `packages/functions/src/index.ts` | Funcional, pero concentrado. | Refactor posterior. |
| `scripts/` | Útil para desarrollo. | Mantener. |
| `tests/` | Base inicial. | Expandir en Etapa 6. |

---

## Observaciones PM/PO

El proyecto no necesita una reestructuración radical antes de Etapa 5.

La prioridad debe ser:

1. Mantener lo que funciona.
2. Aislar legacy.
3. Mejorar flujo real.
4. Evitar refactors grandes antes de cerrar onboarding.
5. Documentar decisiones y deuda técnica.

---

## Recomendación inmediata

No mover todo todavía.

Primero:

```txt
1. Documentar estado actual.
2. Crear flujo MVP v1.
3. Ajustar navegación y onboarding.
4. Convertir Stage4Panel en panel real.
5. Después ordenar carpetas.
```

---

## Riesgo de reestructurar demasiado pronto

Reestructurar antes de cerrar Etapa 5 puede provocar:

- Imports rotos.
- Tiempo perdido.
- Nuevos bugs.
- Pérdida de foco.
- Retraso en el flujo real de usuario.

Por eso, la estructura debe evolucionar de forma incremental.

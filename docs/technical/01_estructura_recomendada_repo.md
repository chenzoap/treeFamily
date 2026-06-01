# 01 - Estructura recomendada del repositorio

Este documento propone una estructura recomendada para el proyecto Tree Family.

La recomendación no implica mover todo inmediatamente.  
Debe aplicarse de forma gradual, priorizando primero el flujo de Etapa 5.

---

## Estructura recomendada general

```txt
treeFamily/
  README.md
  package.json
  package-lock.json
  playwright.config.ts

  docs/
    product/
      00_estado_actual_proyecto.md
      01_decisiones_producto_confirmadas.md
      02_mvp_alcance_vigente.md
      03_plan_etapa_5.md
      04_deuda_tecnica_actual.md

    technical/
      00_estructura_actual_detectada.md
      01_estructura_recomendada_repo.md
      02_mapa_archivos_actuales.md
      03_funciones_backend_actuales.md

    qa/
      checklist_etapa_5.md
      pruebas_manual_mvp.md

  packages/
    frontend/
    functions/
    shared/

  firebase/
    firebase.json
    firebase.dev.json
    firestore.rules
    firestore.dev.rules
    firestore.indexes.json
    storage.rules

  scripts/
    seed-firestore.mjs
    validate-tree-data.mjs

  emulator-data/

  tests/
```

---

## Frontend recomendado a futuro

```txt
packages/frontend/src/
  app/
    App.tsx
    routes.tsx

  features/
    auth/
      pages/
        LoginPage.tsx
        SignupPage.tsx
      components/
        AuthForm.tsx
      services/
        authService.ts

    onboarding/
      pages/
        CreateProfilePage.tsx
      components/
        CreateProfileForm.tsx
        FirstTreeGuide.tsx

    tree/
      pages/
        TreeViewPage.tsx
      components/
        TreeCanvas.tsx
        TreeToolbar.tsx
        TreeSidePanel.tsx
        EmptyTreeState.tsx
        SelectedPersonCard.tsx
      graph/
        union.ts
        layout.ts
      visualization/
        renderTree.ts
      services/
        treeService.ts
      types/
        family.ts

    family-member/
      components/
        AddFatherForm.tsx
        AddMotherForm.tsx
        AddPartnerForm.tsx
        AddChildForm.tsx
        PersonBasicForm.tsx
      schemas/
        personSchemas.ts

  shared/
    components/
      Button.tsx
      Input.tsx
      Select.tsx
      Notice.tsx
      Modal.tsx
    lib/
      firebase.ts
    utils/
      dates.ts
      strings.ts

  store/
    useTreeStore.ts

  main.tsx
  index.css
```

---

## Frontend recomendado para transición inmediata

Para no romper el proyecto, usar primero una estructura más cercana a la actual:

```txt
packages/frontend/src/
  pages/
    CreateMe.tsx
    TreeViewPage.tsx
    TreeView.tsx

    legacy/
      AddParents.tsx
      CreateMe_bck.tsx

  components/
    tree/
      TreeSidePanel.tsx
      EmptyTreeState.tsx
      SelectedPersonCard.tsx

    family/
      AddFatherForm.tsx
      AddMotherForm.tsx
      AddPartnerForm.tsx
      AddChildForm.tsx
      PersonBasicForm.tsx

    legacy/
      AddRelationshipForm.tsx

  graph/
    union.ts
    layout.ts

  visualization/
    renderTree.ts

  lib/
    firebase.ts

  store/
    useTreeStore.ts

  types/
    family.ts
```

---

## Backend recomendado a futuro

Actualmente Cloud Functions están en:

```txt
packages/functions/src/index.ts
```

A futuro, separar por dominio:

```txt
packages/functions/src/
  index.ts

  shared/
    auth.ts
    errors.ts
    dates.ts
    validation.ts

  tree/
    createTreeWithRootPerson.ts
    getTreeData.ts

  relationships/
    createUnion.ts
    addChildToUnion.ts
    addParentToPerson.ts

  dev/
    claimTreeOwnership.ts

  legacy/
    addPerson.ts
    addRelationship.ts

  types/
    family.ts
```

---

## Paquete shared recomendado

Crear cuando el proyecto empiece a tener duplicación de tipos.

```txt
packages/shared/
  package.json
  src/
    types/
      family.ts
      tree.ts
      relationships.ts

    schemas/
      personSchema.ts
      treeSchema.ts

    utils/
      dates.ts
```

### Propósito

- Compartir tipos entre frontend y backend.
- Evitar inconsistencias.
- Centralizar schemas.
- Facilitar validaciones.

### Recomendación

No bloquear Etapa 5 por esto.  
Crear `shared` en Etapa 6 o cuando haya necesidad clara.

---

## Carpeta docs

La documentación debe vivir dentro del repositorio.

```txt
docs/
  product/
  technical/
  qa/
```

### `docs/product`

Contiene:

- Visión.
- Decisiones.
- MVP.
- Roadmap.
- Flujos.
- Historias de usuario.
- Reglas de producto.

### `docs/technical`

Contiene:

- Arquitectura.
- Estructura de carpetas.
- Modelo de datos.
- Mapa de archivos.
- Cloud Functions.
- Seguridad.

### `docs/qa`

Contiene:

- Checklists.
- Pruebas manuales.
- Criterios de cierre.
- Casos borde.

---

## Regla de transición

No hacer refactor masivo.

Orden recomendado:

1. Crear documentos.
2. Crear flujo MVP v1.
3. Ajustar código mínimo de Etapa 5.
4. Aislar legacy.
5. Crear tests.
6. Refactorizar carpetas si el flujo ya está estable.

---

## Recomendación final

Para Etapa 5, usar estructura incremental.

No mover todo ahora.  
Mover solo lo necesario para:

- Evitar legacy en flujo principal.
- Hacer más claro el panel del árbol.
- Separar componentes nuevos.
- Mantener compatibilidad con imports actuales.

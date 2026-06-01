# 02 - Mapa de archivos actuales

Este documento describe el propósito de los archivos principales detectados y la decisión recomendada para cada uno.

---

## Frontend

## `packages/frontend/src/App.tsx`

### Propósito

Define rutas y estructura principal de la aplicación.

### Estado

Funcional, pero debe revisar que solo incluya rutas vigentes.

### Recomendación

- Mantener.
- Evitar rutas legacy como flujo principal.
- Garantizar ruta principal `/tree`.
- Si existe `/add-parents`, moverla o retirarla del flujo principal.

### Prioridad

Alta para Etapa 5.

---

## `packages/frontend/src/pages/CreateMe.tsx`

### Propósito

Pantalla de creación inicial de perfil/persona raíz.

### Estado

Funcional para desarrollo, pero necesita evolucionar a onboarding real.

### Problemas detectados

- Puede contener flujo DEV.
- Puede usar navegación antigua.
- Debe alinearse con decisión de fecha de nacimiento obligatoria solo para usuario raíz.

### Recomendación

- Convertir en `CreateProfilePage` o mantener nombre temporalmente.
- Después de crear árbol, navegar a `/tree`.
- Aislar login DEV.
- Mantener formulario simple.

### Prioridad

Alta.

---

## `packages/frontend/src/pages/CreateMe_bck.tsx`

### Propósito

Backup o versión anterior de `CreateMe`.

### Estado

Legacy.

### Recomendación

Mover a:

```txt
packages/frontend/src/pages/legacy/CreateMe_bck.tsx
```

o eliminar si ya no aporta valor.

### Prioridad

Media.

---

## `packages/frontend/src/pages/AddParents.tsx`

### Propósito

Pantalla antigua para agregar padres.

### Estado

Legacy.

### Recomendación

- No usar como flujo principal.
- Mover a `pages/legacy/`.
- La acción de agregar padre/madre debe vivir en el panel del árbol.

### Prioridad

Media-Alta.

---

## `packages/frontend/src/pages/TreeViewPage.tsx`

### Propósito

Pantalla principal del árbol.

### Estado

Debe mantenerse como base.

### Recomendación

- Debe ser destino principal después de crear perfil.
- Debe cargar datos reales del árbol.
- Debe mostrar estado de árbol con solo root.
- Debe integrar panel UX real.

### Prioridad

Alta.

---

## `packages/frontend/src/pages/TreeView.tsx`

### Propósito

Componente de visualización del árbol.

### Estado

Funcional.

### Recomendación

- Mantener.
- Ajustar solo si es necesario para soportar árbol con una sola persona.
- No rehacer visualización en Etapa 5.

### Prioridad

Media-Alta.

---

## `packages/frontend/src/components/Stage4Panel.tsx`

### Propósito

Panel funcional de operaciones familiares de Etapa 4.

### Estado

Funcional, pero con lenguaje y estructura técnica.

### Recomendación

Evolucionar gradualmente hacia:

```txt
components/tree/TreeSidePanel.tsx
```

Debe ofrecer:

- Agregar padre.
- Agregar madre.
- Agregar pareja.
- Agregar hijo/a.
- Ver persona seleccionada.
- Editar persona.
- Quitar relación.

### Prioridad

Alta.

---

## `packages/frontend/src/components/AddRelationshipForm.tsx`

### Propósito

Formulario antiguo para agregar relaciones.

### Estado

Legacy o potencialmente obsoleto.

### Riesgo

Puede escribir directo a Firestore, lo cual no debe ser el camino principal si las reglas y validaciones están centralizadas en Cloud Functions.

### Recomendación

Mover a:

```txt
packages/frontend/src/components/legacy/AddRelationshipForm.tsx
```

o eliminar si no se usa.

### Prioridad

Alta si está importado; media si no se usa.

---

## `packages/frontend/src/store/useTreeStore.ts`

### Propósito

Estado global del árbol.

### Estado

Importante y vigente.

### Recomendación

Mantener.

Debe manejar claramente:

- `treeId`
- `rootPersonId`
- `selectedPersonId`
- `persons`
- `unions`
- relaciones necesarias
- estados de carga/error

### Prioridad

Alta.

---

## `packages/frontend/src/types/family.ts`

### Propósito

Tipos del modelo familiar en frontend.

### Estado

Vigente.

### Recomendación

- Mantener.
- Revisar compatibilidad con backend.
- Eventualmente mover/copiar a `packages/shared`.

### Prioridad

Media.

---

## `packages/frontend/src/graph/union.ts`

### Propósito

Lógica para trabajar con uniones.

### Estado

Core técnico.

### Recomendación

Mantener.  
No refactorizar salvo necesidad clara.

### Prioridad

Alta.

---

## `packages/frontend/src/graph/layout.ts`

### Propósito

Construcción de estructura para visualización de ancestros y descendientes.

### Estado

Core técnico.

### Recomendación

Mantener.  
Ajustar solo si falla con casos de árbol simple o múltiples uniones.

### Prioridad

Alta.

---

## `packages/frontend/src/visualization/renderTree.ts`

### Propósito

Render visual del árbol.

### Estado

Funcional.

### Recomendación

- Mantener.
- No rediseñar en Etapa 5.
- Ajustar solo soporte para estados mínimos.

### Prioridad

Media-Alta.

---

## `packages/frontend/src/lib/firebase.ts`

### Propósito

Configuración de Firebase en frontend.

### Estado

Vigente.

### Recomendación

Mantener.  
Verificar separación entre emulador y producción.

### Prioridad

Alta.

---

# Backend

## `packages/functions/src/index.ts`

### Propósito

Contiene Cloud Functions principales.

### Estado

Funcional, pero concentrado.

### Recomendación

Mantener durante Etapa 5.  
Refactorizar después en módulos por dominio.

### Prioridad

Alta funcional, media para refactor.

---

# Firebase

## `packages/firebase/firestore.rules`

### Propósito

Reglas de seguridad de Firestore.

### Estado

Core para privacidad.

### Recomendación

Validar que:

- Solo owner pueda leer árbol.
- Solo owner pueda modificar árbol.
- No haya acceso cruzado.
- Escritura directa no autorizada esté bloqueada si se usa Cloud Functions.

### Prioridad

Alta.

---

## `packages/firebase/firestore.dev.rules`

### Propósito

Reglas para entorno de desarrollo.

### Estado

Útil para emulador.

### Recomendación

Mantener separadas de producción.

### Prioridad

Media.

---

# Scripts

## `scripts/seed-firestore.mjs`

### Propósito

Crear datos de prueba.

### Estado

Útil para desarrollo.

### Recomendación

Mantener.

### Prioridad

Media.

---

## `scripts/validate-tree-data.mjs`

### Propósito

Validar estructura de datos del árbol.

### Estado

Útil para control técnico.

### Recomendación

Mantener y ampliar en Etapa 6.

### Prioridad

Media.

---

# Tests

## `tests/example.spec.ts`

### Propósito

Test base de Playwright.

### Estado

Inicial.

### Recomendación

Reemplazar o ampliar con pruebas reales de MVP.

### Prioridad

Etapa 6.

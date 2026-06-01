# 00 - Estado actual del proyecto

## Proyecto

**Nombre:** Tree Family / Árbol Genealógico  
**Estado actual:** Post Etapa 4  
**Siguiente etapa recomendada:** Etapa 5 - Flujo real de usuario nuevo + árbol mínimo sugerido

---

## Resumen ejecutivo

El proyecto no debe empezar desde cero.

Actualmente existe una base técnica funcional que permite crear personas, crear un árbol, manejar relaciones familiares básicas, crear uniones de pareja, agregar hijos a una unión, agregar padres/madres y visualizar el árbol usando la estructura existente del frontend.

El foco actual ya no debe ser probar si la lógica técnica funciona. Esa parte está suficientemente avanzada para continuar. El foco debe cambiar a convertir lo construido en una experiencia real de producto para un usuario nuevo.

---

## Estado por etapas

| Etapa                                             | Estado                    | Lectura PM/PO                                                     |
| ------------------------------------------------- | -------------------------:| ----------------------------------------------------------------- |
| Etapa 0 - Preparación y entorno                   | Completada                | Base local, monorepo, Firebase y herramientas listas.             |
| Etapa 1 - Backend mínimo + seguridad base         | Completada                | Firebase Auth, Firestore, Cloud Functions y reglas base existen.  |
| Etapa 2 - Flujo inicial y modelo base             | Completada                | Existe flujo inicial con CreateMe, TreeViewPage y store.          |
| Etapa 3 - Motor de uniones + render D3            | Completada                | Hay soporte de uniones, ancestros, descendientes y layout visual. |
| Etapa 4 - Operaciones familiares completas        | Completada funcionalmente | Stage4Panel permite crear pareja, hijo, padre y madre.            |
| Etapa 5 - Flujo real usuario nuevo + árbol mínimo | Pendiente                 | Siguiente foco del producto.                                      |
| Etapa 6 - Tests y CI local                        | Pendiente                 | Debe venir después de estabilizar Etapa 5.                        |
| Etapa 7 - UX, render y performance                | Pendiente                 | No priorizar todavía salvo mejoras mínimas necesarias.            |

---

## Qué ya existe y debe conservarse

### Frontend

| Archivo / módulo              | Decisión                                                     |
| ----------------------------- | ------------------------------------------------------------ |
| `TreeViewPage.tsx`            | Mantener como base de la pantalla principal del árbol.       |
| `TreeView.tsx`                | Mantener como pieza de visualización.                        |
| `Stage4Panel.tsx`             | Mantener funcionalmente, pero evolucionarlo a panel UX real. |
| `useTreeStore.ts`             | Mantener como estado central del árbol.                      |
| `graph/union.ts`              | Mantener. Es parte importante del motor genealógico.         |
| `graph/layout.ts`             | Mantener. Construye ancestros y descendientes.               |
| `visualization/renderTree.ts` | Mantener. Renderiza la visualización actual.                 |
| `types/family.ts`             | Mantener, pero puede necesitar ajustes graduales.            |

### Backend

| Función                    | Decisión                                                                  |
| -------------------------- | ------------------------------------------------------------------------- |
| `createTreeWithRootPerson` | Mantener como base para crear árbol + persona raíz.                       |
| `getTreeData`              | Mantener. Ya cumple función central de lectura segura.                    |
| `createUnion`              | Mantener. Es core para parejas/uniones.                                   |
| `addChildToUnion`          | Mantener. Es core para hijos dentro de una unión.                         |
| `addParentToPerson`        | Mantener. Es core para agregar padre/madre.                               |
| `claimTreeOwnership`       | Mantener solo para desarrollo. No debe usarse como flujo real de usuario. |
| `addPerson`                | Considerar legacy. No usar en UI principal.                               |
| `addRelationship`          | Considerar legacy. No usar en UI principal.                               |

---

## Problema principal actual

El sistema tiene capacidad técnica para crear personas y relaciones, pero todavía no tiene un onboarding real de producto.

El flujo que falta es:

```txt
usuario nuevo
→ registro/login
→ crear perfil personal
→ crear árbol privado
→ llegar al árbol
→ ver guía para agregar familiares
→ agregar padre/madre/pareja/hijo
→ visualizar árbol claro
```

---

## Decisión PM/PO

La Etapa 5 no debe tratarse como una etapa para rehacer arquitectura o rediseñar todo el árbol visual.

La Etapa 5 debe tratarse como:

> Convertir la base funcional de Etapa 4 en una experiencia real de usuario nuevo.

---

## Qué no se debe hacer ahora

No hacer en esta etapa:

- No rehacer D3 desde cero.
- No cambiar todo el modelo de datos.
- No implementar fotos.
- No implementar invitaciones.
- No implementar colaboración.
- No implementar privacidad avanzada.
- No pulir demasiado la estética.
- No crear app móvil nativa.
- No implementar exportación PDF.
- No eliminar `Stage4Panel` sin antes reemplazarlo por un panel real.
- No implementar una experiencia social o pública.

---

## Siguiente entregable recomendado

El siguiente documento a construir después de esta base es:

```txt
Documento de flujo MVP v1
```

Debe cubrir:

1. Registro/login.
2. Crear perfil personal.
3. Crear árbol privado.
4. Estado de árbol con solo usuario.
5. Agregar padre/madre.
6. Agregar pareja.
7. Agregar hijo/a.
8. Manejo simple de segunda pareja e hijos de distintas relaciones.
9. Estados de error.
10. Criterios de aceptación.

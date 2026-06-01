# 03 - Funciones backend actuales

Este documento describe las Cloud Functions relevantes del proyecto y su rol dentro del MVP.

---

## Principio backend del MVP

Las operaciones importantes del árbol deben pasar por Cloud Functions cuando:

- Requieren validación de ownership.
- Modifican varias colecciones/documentos.
- Crean relaciones familiares.
- Pueden romper integridad del árbol.
- Deben evitar escrituras directas inseguras desde frontend.

---

## Funciones vigentes principales

## `createTreeWithRootPerson`

### Propósito

Crear un árbol privado y la persona raíz asociada al usuario.

### Uso en MVP

Función central para el onboarding real.

### Reglas de producto asociadas

- El usuario raíz representa a la persona registrada.
- La fecha de nacimiento del usuario raíz es obligatoria.
- El árbol debe quedar asociado al `ownerUid`.
- El árbol debe ser privado por defecto.

### Recomendación

Mantener y usar como base de Etapa 5.

### Consideración

No convertirla en creación obligatoria de dos familiares.  
El árbol mínimo debe ser una guía, no un bloqueo.

---

## `getTreeData`

### Propósito

Obtener los datos del árbol para renderizarlo.

### Uso en MVP

Función central para `TreeViewPage`.

### Reglas de producto asociadas

- Solo el owner puede leer su árbol.
- Debe devolver personas y relaciones necesarias.
- Debe permitir árbol con solo persona raíz.

### Recomendación

Mantener.

### Casos que debe soportar

- Árbol con solo root.
- Árbol con padre/madre.
- Árbol con pareja.
- Árbol con hijos.
- Árbol con múltiples uniones simples.

---

## `createUnion`

### Propósito

Crear una unión entre dos personas.

### Uso en MVP

Se usa al agregar pareja.

### Reglas de producto asociadas

- La unión representa una relación familiar relevante.
- No implica necesariamente matrimonio.
- No debe exigir estado civil en MVP.
- Debe permitir más de una unión para una persona.

### Recomendación

Mantener.

### UX relacionada

El usuario ve:

```txt
Agregar pareja
```

No debe ver:

```txt
Crear unionId
```

---

## `addChildToUnion`

### Propósito

Agregar un hijo/a asociado a una unión existente.

### Uso en MVP

Se usa cuando una persona tiene pareja/unión y se quiere agregar un hijo.

### Reglas de producto asociadas

- Si existe una sola unión, puede asociarse a esa unión.
- Si existen varias uniones, el usuario debe elegir con qué pareja conectar al hijo.
- Fecha de nacimiento del hijo es opcional.
- Lugar de nacimiento del hijo es opcional.

### Recomendación

Mantener.

---

## `addParentToPerson`

### Propósito

Agregar padre o madre a una persona existente.

### Uso en MVP

Se usa en acciones rápidas:

- Agregar padre.
- Agregar madre.

### Reglas de producto asociadas

- El padre/madre se crea como persona del mismo árbol.
- Se conecta como relación ascendente.
- Fecha de nacimiento del familiar es opcional.
- Lugar de nacimiento del familiar es opcional.

### Recomendación

Mantener.

---

## `claimTreeOwnership`

### Propósito

Herramienta para desarrollo que permite reclamar ownership de un árbol.

### Uso en MVP

No debe formar parte del flujo real de usuario.

### Recomendación

- Mantener solo en entorno DEV.
- Ocultar en UI real.
- No mostrar a usuarios finales.
- Evaluar mover a módulo `dev/`.

### Riesgo

Alto si queda disponible en producción sin restricciones.

---

## Funciones legacy o secundarias

## `addPerson`

### Propósito

Agregar una persona de forma genérica.

### Estado

Legacy o secundaria.

### Riesgo

Puede duplicar lógica de acciones familiares específicas.

### Recomendación

No usar en la UI principal del MVP.  
Usar acciones específicas:

- Agregar padre.
- Agregar madre.
- Agregar pareja.
- Agregar hijo/a.

---

## `addRelationship`

### Propósito

Agregar una relación genérica.

### Estado

Legacy o secundaria.

### Riesgo

Puede exponer al frontend conceptos técnicos y provocar relaciones incorrectas.

### Recomendación

No usar como flujo principal.  
Mantener solo si se requiere internamente o para transición.

---

## Función que NO se recomienda implementar como obligatoria

## `createMinimalTree`

### Contexto

El plan mencionaba la idea de crear un árbol mínimo.

### Decisión vigente

No se recomienda crear un árbol mínimo obligatorio con usuario + dos familiares durante onboarding.

### Razón

La decisión de producto actual es:

```txt
El usuario puede empezar solo.
La app lo guía a completar dos familiares.
```

### Alternativa recomendada

Usar:

```txt
createTreeWithRootPerson
```

y después mostrar guía visual para completar familiares.

### Si se crea en futuro

Podría existir como helper, pero no debe forzar el flujo.

---

## Reglas generales para Cloud Functions

Toda función que modifique el árbol debe validar:

1. Usuario autenticado.
2. Existencia del árbol.
3. Ownership del árbol.
4. Existencia de personas referenciadas.
5. Que las personas pertenezcan al mismo árbol.
6. Que no se creen relaciones duplicadas innecesarias.
7. Que los datos mínimos sean válidos.
8. Que no se sobrescriban datos importantes accidentalmente.

---

## Validaciones de datos recomendadas

### Persona raíz

- `firstName`: requerido.
- `lastName`: requerido.
- `birthDate`: requerido.
- `birthPlace`: opcional.

### Familiar

- `firstName`: requerido.
- `lastName`: requerido o recomendado.
- `birthDate`: opcional.
- `birthPlace`: opcional.

---

## Errores esperados

Las funciones deben responder con errores claros para:

| Caso | Error recomendado |
|---|---|
| Usuario no autenticado | `unauthenticated` |
| Árbol no existe | `not-found` |
| Usuario no es owner | `permission-denied` |
| Datos inválidos | `invalid-argument` |
| Persona no pertenece al árbol | `failed-precondition` o `permission-denied` |
| Relación duplicada | `already-exists` o respuesta idempotente |

---

## Recomendación de refactor futuro

Después de Etapa 5, dividir `index.ts`:

```txt
packages/functions/src/
  index.ts
  shared/
    auth.ts
    errors.ts
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
```

No hacer este refactor antes de cerrar el flujo real de usuario, salvo que el archivo actual ya sea difícil de mantener.

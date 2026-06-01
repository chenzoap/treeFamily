# 04 - Deuda técnica actual

Este documento lista deuda técnica detectada al cierre funcional de Etapa 4 y antes de iniciar Etapa 5.

La deuda técnica no significa que el proyecto esté mal. Significa que hay elementos válidos para desarrollo/demo que deben ordenarse antes de convertirlo en producto real.

---

## 1. Flujo DEV mezclado con flujo real

### Descripción

`CreateMe.tsx` contiene lógica útil para desarrollo, incluyendo acceso anónimo o bloque DEV.

### Riesgo

- El usuario real puede ver o pasar por experiencias que no corresponden.
- Puede confundir el estado real de autenticación.
- Puede generar dependencia de datos demo.

### Recomendación

- Aislar herramientas DEV.
- Usar condiciones por entorno.
- No mostrar controles DEV en producción.
- Preparar flujo real con login/sign up.

### Prioridad

Alta para Etapa 5.

---

## 2. Navegación legacy hacia `/add-parents`

### Descripción

El flujo antiguo podía navegar a `/add-parents`, pero esa pantalla ya no representa el flujo principal.

### Riesgo

- El usuario pasa por una pantalla obsoleta.
- Se duplica lógica de agregar padres.
- El producto se fragmenta.

### Recomendación

- Después de crear árbol, navegar directamente a `/tree`.
- Mantener `AddParents.tsx` solo como legacy temporal.
- El panel principal debe manejar agregar padres/madres.

### Prioridad

Alta para Etapa 5.

---

## 3. `Stage4Panel` todavía se siente técnico

### Descripción

El panel actual funciona, pero está orientado a pruebas de Etapa 4.

### Riesgo

- Lenguaje técnico visible.
- Experiencia poco emocional.
- El usuario no técnico puede confundirse.

### Recomendación

Transformarlo gradualmente en:

```txt
TreeSidePanel
```

Con acciones:

- Agregar padre.
- Agregar madre.
- Agregar pareja.
- Agregar hijo/a.
- Editar persona.
- Quitar relación.

### Prioridad

Alta para Etapa 5.

---

## 4. Validaciones de familiares demasiado estrictas

### Descripción

Algunos formularios bloquean la creación de familiares si no existe fecha de nacimiento o lugar de nacimiento.

### Riesgo

- El usuario puede no conocer esa información.
- Se frena la creación del árbol.
- Contradice la decisión de producto: fecha opcional para familiares.

### Recomendación

- Requerir nombre.
- Requerir o recomendar apellido.
- Hacer opcionales fecha y lugar de nacimiento para familiares.
- Mantener fecha obligatoria solo para persona raíz.

### Prioridad

Alta para Etapa 5.

---

## 5. Archivos legacy no aislados

### Descripción

Existen archivos como:

- `AddParents.tsx`
- `CreateMe_bck.tsx`
- `AddRelationshipForm.tsx`

que pueden ser útiles como referencia, pero no deben estar en flujo principal.

### Riesgo

- Confusión al desarrollar.
- Duplicación de lógica.
- Posible uso accidental de código obsoleto.

### Recomendación

Mover a carpetas `legacy/` o eliminar cuando ya no aporten valor.

Ejemplo:

```txt
packages/frontend/src/pages/legacy/AddParents.tsx
packages/frontend/src/pages/legacy/CreateMe_bck.tsx
packages/frontend/src/components/legacy/AddRelationshipForm.tsx
```

### Prioridad

Media-Alta.

---

## 6. Escrituras directas a Firestore desde componentes legacy

### Descripción

`AddRelationshipForm.tsx` usa escritura directa a Firestore.

### Riesgo

- Puede fallar con reglas de seguridad.
- Evita validaciones centralizadas.
- Duplica lógica que debe estar en Cloud Functions.

### Recomendación

- No usar en UI principal.
- Mover a legacy o eliminar.
- Mantener Cloud Functions como vía principal para mutaciones.

### Prioridad

Alta si el archivo sigue importado; media si no se usa.

---

## 7. Backend concentrado en `index.ts`

### Descripción

Las Cloud Functions están concentradas en un solo archivo.

### Riesgo

- Archivo difícil de mantener.
- Mayor probabilidad de errores al crecer.
- Dificulta pruebas unitarias.

### Recomendación

No refactorizar antes de cerrar Etapa 5 si puede retrasar.

Después, separar en:

```txt
shared/
tree/
relationships/
dev/
legacy/
types/
```

### Prioridad

Media para Etapa 6.

---

## 8. Tipos duplicados o no compartidos

### Descripción

Puede existir diferencia entre tipos del frontend y backend.

### Riesgo

- Inconsistencias.
- Bugs silenciosos.
- Dificultad para cambiar modelo.

### Recomendación

Crear o fortalecer:

```txt
packages/shared/
```

Para tipos comunes:

- `Person`
- `Tree`
- `Union`
- `ParentChildLink`
- enums o tipos de relación.

### Prioridad

Media.

---

## 9. Falta de documento de flujo MVP v1

### Descripción

Ya hay decisiones de producto, pero falta documentar flujos paso a paso.

### Riesgo

- Implementar pantallas sin criterio claro.
- Mezclar onboarding, árbol y formularios.
- Duplicar trabajo.

### Recomendación

Crear el documento antes de tocar más código.

### Prioridad

Alta.

---

## 10. Falta de tests específicos de flujo real

### Descripción

Existen bases para testing, pero falta cubrir el flujo real de Etapa 5.

### Riesgo

- Cambios futuros rompen onboarding.
- Funciones familiares se rompen sin detección.
- Seguridad no verificada automáticamente.

### Recomendación

Después de Etapa 5, crear pruebas para:

- Crear usuario.
- Crear perfil.
- Crear árbol.
- Agregar padre/madre.
- Agregar pareja.
- Agregar hijo.
- Validar reglas owner.

### Prioridad

Alta para Etapa 6.

---

## Priorización general

| Deuda | Prioridad | Resolver en |
|---|---:|---|
| Flujo DEV mezclado | Alta | Etapa 5 |
| Navegación legacy | Alta | Etapa 5 |
| Stage4Panel técnico | Alta | Etapa 5 |
| Validaciones estrictas | Alta | Etapa 5 |
| Escrituras directas legacy | Alta/Media | Etapa 5 |
| Archivos legacy sin aislar | Media-Alta | Etapa 5 |
| Falta documento flujo MVP | Alta | Antes de código |
| Backend en index.ts | Media | Etapa 6 |
| Tipos no compartidos | Media | Etapa 6 |
| Tests flujo real | Alta | Etapa 6 |

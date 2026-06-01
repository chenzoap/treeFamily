# 03 - Plan Etapa 5: Flujo real usuario nuevo + árbol mínimo sugerido

## Objetivo de la etapa

Convertir la base funcional construida hasta Etapa 4 en una experiencia real para un usuario nuevo.

La Etapa 5 no busca rehacer la arquitectura ni rediseñar todo el árbol visual.  
Busca cerrar el flujo de producto:

```txt
usuario nuevo
→ registro/login
→ crear perfil
→ crear árbol privado
→ ver árbol
→ agregar familiares directos
```

---

## Principio de la etapa

> La complejidad técnica debe quedarse detrás de la interfaz. El usuario debe pensar en familiares, no en nodos, IDs o relaciones internas.

---

## Subetapas recomendadas

## Etapa 5.1 - Separar flujo real de flujo DEV

### Objetivo

Eliminar o aislar elementos de desarrollo que no deben aparecer en la experiencia real.

### Tareas

- Quitar o aislar bloque de Login DEV en `CreateMe.tsx`.
- No navegar más a `/add-parents`.
- Después de crear árbol, navegar a `/tree`.
- Mantener `claimTreeOwnership` solo en entorno DEV.
- Marcar `AddParents.tsx` como legacy.
- Marcar `AddRelationshipForm.tsx` como legacy o retirarlo del flujo principal.
- Evitar mostrar `treeId`, `rootPersonId`, `unionId` u otros IDs al usuario.

### Definition of Done

- Un usuario nuevo crea su árbol y llega a `/tree` sin pasar por pantallas legacy.
- No hay lenguaje técnico visible en el flujo principal.
- Funciones DEV no aparecen en producción.

---

## Etapa 5.2 - Flujo real de usuario nuevo

### Objetivo

Transformar `CreateMe` en una experiencia de onboarding real.

### Flujo esperado

```txt
Usuario abre app
→ si no está autenticado, ve login/sign up
→ crea cuenta o inicia sesión
→ si no tiene árbol, ve Crear mi perfil
→ completa perfil personal
→ se crea tree + root person
→ llega a /tree
→ ve su nodo raíz y guía para agregar familiares
```

### Reglas

- La persona raíz representa al usuario registrado.
- La fecha de nacimiento es obligatoria solo para el usuario raíz.
- El árbol se crea privado por defecto.
- El árbol tiene un único owner en MVP.

### Definition of Done

- Usuario nuevo termina con árbol privado y persona raíz.
- Usuario existente con árbol no repite creación de perfil.
- Usuario sin árbol es enviado al flujo de creación de perfil.

---

## Etapa 5.3 - Estado inicial del árbol

### Objetivo

Permitir que el árbol se muestre aunque solo exista la persona raíz.

### Estados esperados

| Estado | Comportamiento |
|---|---|
| Usuario no autenticado | Mostrar login/sign up. |
| Usuario autenticado sin árbol | Mostrar crear perfil. |
| Usuario con árbol y solo root | Mostrar nodo raíz + guía. |
| Usuario con root + 1 familiar | Mostrar progreso incompleto. |
| Usuario con root + 2 familiares | Mostrar árbol mínimo sugerido completado. |

### Texto sugerido

```txt
Tu árbol familiar ya empezó contigo.
Agrega familiares cercanos para empezar a darle forma a tu historia.
```

### Definition of Done

- No existe pantalla vacía sin explicación.
- El usuario entiende cuál es el siguiente paso.
- El árbol puede renderizar con una sola persona.

---

## Etapa 5.4 - Convertir Stage4Panel en panel UX real

### Objetivo

Transformar el panel técnico de Etapa 4 en un panel de acciones familiares simple.

### Cambio conceptual

De:

```txt
Etapa 4
DEV
unionId
single:<personId>
```

A:

```txt
Construye tu árbol
Persona seleccionada: [Nombre]

Acciones:
- Agregar padre
- Agregar madre
- Agregar pareja
- Agregar hijo/a
```

### Reglas UX

- El usuario debe seleccionar una persona o trabajar sobre la persona raíz por defecto.
- El panel debe mostrar la persona seleccionada.
- Las acciones deben usar lenguaje familiar.
- No mostrar IDs técnicos.
- No mostrar estado DEV salvo en herramientas aisladas.

### Definition of Done

- El usuario puede agregar familiares desde botones rápidos.
- El panel ya no se siente como herramienta de desarrollador.
- El panel mantiene las funciones técnicas existentes.

---

## Etapa 5.5 - Ajustar validaciones de familiares

### Objetivo

Alinear formularios con decisiones de producto.

### Regla vigente

| Campo | Usuario raíz | Familiares |
|---|---:|---:|
| Primer nombre | Obligatorio | Obligatorio |
| Apellido | Obligatorio | Requerido por ahora o recomendado |
| Fecha nacimiento | Obligatoria | Opcional |
| Lugar nacimiento | Opcional | Opcional |
| Fallecido/a | No obligatorio | Opcional / fase posterior |

### Cambios esperados

- No bloquear creación de padre/madre/hijo/pareja por falta de fecha de nacimiento.
- No bloquear creación por falta de lugar de nacimiento.
- Mantener nombre como mínimo obligatorio.
- Evaluar si apellido será obligatorio en familiares para mantener consistencia inicial.

### Definition of Done

- Se puede agregar familiar sin fecha de nacimiento.
- Se puede agregar familiar sin lugar de nacimiento.
- La persona raíz sigue requiriendo fecha de nacimiento.

---

## Etapa 5.6 - Manejo simple de hijos y múltiples parejas

### Objetivo

Soportar hijos de diferentes relaciones sin introducir divorcio/separación avanzada.

### Reglas

Si la persona seleccionada tiene una sola pareja/unión:

- Al agregar hijo/a, asociar a esa unión por defecto o confirmar de forma simple.

Si tiene más de una pareja/unión:

- Preguntar: "¿Con qué pareja quieres conectar este hijo/a?"
- Opciones:
  - Con pareja A.
  - Con pareja B.
  - Solo como hijo/a mío/a por ahora.

Si no tiene pareja:

- Permitir agregar hijo/a como hijo/a de persona soltera.

### Definition of Done

- Un usuario puede tener segunda pareja.
- Un usuario puede agregar hijos a diferentes relaciones.
- No se pide estado civil, divorcio ni separación.

---

## Entregables de la Etapa 5

1. Flujo real de usuario nuevo.
2. CreateMe u onboarding limpio.
3. TreeViewPage funcional para árbol con solo root.
4. EmptyTreeState o guía inicial.
5. Panel de acciones familiares con lenguaje de usuario.
6. Validaciones corregidas.
7. Legacy aislado.
8. Reglas de privacidad respetadas.
9. Criterios de aceptación documentados.
10. Base lista para tests de Etapa 6.

---

## Riesgos de la etapa

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Mezclar flujo DEV con flujo real | Confunde al usuario y al desarrollo | Aislar DEV. |
| Hacer obligatorio el árbol mínimo | Fricción inicial | Usarlo como guía, no bloqueo. |
| Pedir demasiados datos | Abandono | Formularios cortos. |
| Mostrar conceptos técnicos | Mala UX | Lenguaje familiar. |
| Rehacer arquitectura | Retraso innecesario | Evolución gradual. |
| Meter fotos/invitaciones | Scope creep | Fase futura. |

---

## Orden recomendado de implementación

1. Corregir navegación de `CreateMe`: ir a `/tree`.
2. Aislar Login DEV.
3. Crear estado de árbol con solo root.
4. Crear `EmptyTreeState`.
5. Adaptar `Stage4Panel` a panel UX.
6. Ajustar validaciones de familiares.
7. Aislar archivos legacy.
8. Probar flujo completo manualmente.
9. Documentar criterios de cierre.
10. Preparar tests para Etapa 6.

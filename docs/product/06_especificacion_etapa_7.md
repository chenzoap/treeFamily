# Especificación Funcional — Etapa 7

## Refinamiento UX, render y performance base para MVP

**Proyecto:** Tree Family / Árbol Genealógico
**Versión del plan base:** Plan_Etapas_Arbol_Genealogico-v0.03
**Estado previo:** Etapa 6 + Stage 6.1 cerradas
**Etapa activa:** Etapa 7
**Objetivo:** Refinar la pantalla actual del árbol antes de agregar nuevas funcionalidades mayores.

---

# 1. Resumen ejecutivo

La Etapa 7 tiene como objetivo convertir la pantalla actual `/tree` en una experiencia más clara, usable, visualmente ordenada y preparada para usuarios comunes.

Hasta Stage 6.1, el proyecto ya cuenta con:

* Registro e inicio de sesión.
* Creación de perfil raíz.
* Creación de árbol privado.
* Carga persistente del árbol.
* Agregar padre.
* Agregar madre.
* Agregar pareja.
* Agregar hijo/a.
* Crear relaciones familiares.
* Visualización funcional del árbol con D3.
* QA local inicial.
* Playwright E2E local funcionando.
* CI básico en GitHub Actions en verde.

El problema actual no es funcionalidad principal, sino **experiencia de producto**. La app ya funciona, pero la pantalla del árbol todavía debe sentirse menos técnica, más clara y más cercana a un producto real.

---

# 2. Objetivo de producto de Etapa 7

Convertir la pantalla del árbol en una experiencia visual clara, simple y confiable, donde el usuario pueda:

1. Ver su árbol familiar como elemento principal.
2. Entender qué persona está seleccionada.
3. Agregar familiares desde un panel lateral claro.
4. Ver cambios reflejados en el árbol.
5. Navegar visualmente sin sentirse perdido.
6. Recibir mensajes humanos cuando algo falta, carga o falla.

La pregunta principal de cierre es:

> ¿El usuario puede ver su árbol, entender quién está seleccionado y agregar familiares sin confundirse?

---

# 3. Alcance funcional de Etapa 7

## 3.1 Incluido

La Etapa 7 incluye:

| Área                 | Alcance                                                                       |
| -------------------- | ----------------------------------------------------------------------------- |
| Layout principal     | Árbol al centro y panel lateral como apoyo.                                   |
| Panel lateral        | Refinar `Stage4Panel` gradualmente para que sea más claro y menos técnico.    |
| Persona seleccionada | Mostrar de forma visible: “Estás editando a: [Nombre]”.                       |
| Acciones familiares  | Botones claros para agregar padre, madre, pareja e hijo/a.                    |
| Formularios          | Formularios contextuales según acción elegida.                                |
| Estado vacío         | Mensaje cálido cuando el árbol tiene solo la persona raíz o pocos familiares. |
| Feedback             | Mensajes visibles de éxito, error y carga.                                    |
| Render del árbol     | Mejorar separación de nodos, conectores y legibilidad.                        |
| Navegación visual    | Mantener o mejorar zoom/pan básico.                                           |
| Responsive básico    | Priorizar desktop/laptop; evitar que el panel destruya el espacio del árbol.  |
| Documentación        | Actualizar README/docs al estado real: Stage 6.1 cerrado y Etapa 7 activa.    |
| QA                   | Validar que las pruebas existentes siguen pasando.                            |

---

## 3.2 No incluido

Estas funciones quedan fuera de Etapa 7:

| Función                                | Motivo                 |
| -------------------------------------- | ---------------------- |
| Fotos familiares                       | Pertenece a Etapa 9.   |
| Páginas legales completas              | Pertenece a Etapa 7.1. |
| Invitaciones familiares                | Fase posterior.        |
| Colaboración familiar                  | Fase posterior.        |
| Roles de usuario                       | Fase posterior.        |
| Acciones desde nodo                    | Etapa 7.2.             |
| Menú radial o animaciones avanzadas    | Etapa 7.2.             |
| Agrupar ramas o mini-árboles           | Etapa 7.2/futuro.      |
| Editar relaciones avanzadas            | Etapa 8.               |
| Eliminar relaciones sin destruir datos | Etapa 8.               |
| Adoptivo/biológico en UI               | Futuro.                |
| Exportación PDF                        | Futuro.                |
| IA                                     | Futuro.                |

Regla de control de alcance:

> Etapa 7 debe mejorar la experiencia actual, no abrir nuevas capacidades grandes.

---

# 4. Decisiones de producto confirmadas

| Tema                 | Decisión                                                       |
| -------------------- | -------------------------------------------------------------- |
| Pantalla principal   | Árbol al centro.                                               |
| Panel lateral        | Apoyo para acciones, formularios y mensajes.                   |
| Agregar familiares   | En Etapa 7 se mantiene desde panel lateral.                    |
| Acciones desde nodo  | Se dejan para Etapa 7.2.                                       |
| Árbol grande         | MVP: zoom/pan básico y mejor separación.                       |
| Futuro árbol grande  | Agrupar ramas/mini-árboles en nodos expandibles.               |
| Tipo de árbol        | Árbol mixto centrado en persona raíz o persona seleccionada.   |
| Selección de persona | Debe verse claramente qué persona se está editando.            |
| Segunda pareja       | Mostrar con lenguaje simple, no técnico.                       |
| Padres desconocidos  | Campos opcionales; no crear nodos “Desconocido” todavía.       |
| Adoptivo/biológico   | Preparar modelo futuro, no UI en MVP.                          |
| Privacidad           | Árbol privado por defecto.                                     |
| Menores              | Permitido guardar datos, pero privacidad estricta por defecto. |
| Backend              | Solo tocar si es estrictamente necesario.                      |
| README/docs          | Actualización obligatoria.                                     |

---

# 5. Usuario objetivo de esta etapa

## Usuario principal

Persona común que quiere crear o continuar su árbol familiar privado.

No debe necesitar entender conceptos como:

* Nodos.
* Edges.
* Unions.
* Root person.
* Relationship type.
* Firestore.
* D3.

Debe entender frases como:

* “Estás editando a Fernando.”
* “Agregar padre.”
* “Agregar madre.”
* “Agregar pareja.”
* “Agregar hijo/a.”
* “Tu árbol es privado.”
* “Puedes completar estos datos después.”

---

# 6. Experiencia esperada

La pantalla `/tree` debe sentirse:

| Cualidad   | Descripción                                             |
| ---------- | ------------------------------------------------------- |
| Clara      | El usuario entiende lo que está viendo.                 |
| Familiar   | Los textos deben sentirse humanos y cercanos.           |
| Segura     | El usuario debe percibir que su información es privada. |
| Ordenada   | El árbol no debe sentirse amontonado.                   |
| Guiada     | El usuario sabe cuál es el siguiente paso.              |
| No técnica | No debe parecer una herramienta interna de desarrollo.  |

---

# 7. Layout funcional esperado

## 7.1 Estructura general

```txt
┌──────────────────────────────────────────────────────────────┐
│ Header                                                       │
│ Tree Family / Mi árbol familiar / Privado / Cerrar sesión    │
├───────────────────────┬──────────────────────────────────────┤
│ Panel lateral          │ Área principal del árbol             │
│                       │                                      │
│ Persona seleccionada   │         Árbol familiar               │
│ Acciones rápidas       │         centrado y navegable         │
│ Formulario contextual  │                                      │
│ Mensajes de estado     │                                      │
│                       │                                      │
└───────────────────────┴──────────────────────────────────────┘
```

---

## 7.2 Header

El header debe mantener una estructura simple:

* Nombre de la app o pantalla.
* Indicador de privacidad.
* Acción de cerrar sesión.

Texto recomendado:

```txt
Mi árbol familiar
Tu árbol es privado por defecto.
```

Botón:

```txt
Cerrar sesión
```

---

## 7.3 Panel lateral

El panel lateral debe ser el centro de control secundario.

Debe mostrar:

1. Estado inicial o guía.
2. Persona seleccionada.
3. Acciones disponibles.
4. Formulario contextual.
5. Mensaje de éxito/error.
6. Ayuda breve.

Orden recomendado:

```txt
[Primeros pasos / privacidad breve]

Estás editando a:
Fernando Aragon

¿Qué familiar quieres agregar?
[Agregar padre]
[Agregar madre]
[Agregar pareja]
[Agregar hijo/a]

[Formulario según acción]

[Mensaje de estado]
```

---

## 7.4 Área principal del árbol

El área principal debe priorizar visualización.

Debe incluir:

* SVG del árbol.
* Fondo limpio.
* Zoom/pan básico.
* Nodos legibles.
* Conectores claros.
* Persona raíz distinguible.
* Persona seleccionada distinguible.
* Parejas y relaciones visualmente entendibles.

No debe saturarse con demasiados controles.

---

# 8. Reglas funcionales del panel lateral

## 8.1 Persona seleccionada

La app debe mostrar siempre la persona activa.

Texto:

```txt
Estás editando a:
[Nombre completo]
```

Si no hay persona seleccionada, debe usar la persona raíz.

Texto alternativo:

```txt
Estás editando a la persona principal de tu árbol.
```

Criterios:

* Si `selectedPersonId` existe, usar esa persona.
* Si no existe, usar `rootPersonId`.
* Si ninguna persona se puede resolver, mostrar estado de error amigable.
* Nunca mostrar IDs técnicos al usuario.

---

## 8.2 Acciones familiares

Acciones visibles:

```txt
Agregar padre
Agregar madre
Agregar pareja
Agregar hijo/a
```

Reglas:

* Solo una acción activa a la vez.
* Al seleccionar acción, se muestra su formulario.
* Debe existir opción de cancelar o limpiar formulario.
* El botón de guardar debe estar deshabilitado si faltan datos obligatorios.
* Fecha y lugar de nacimiento deben ser opcionales.
* El panel debe indicar que los datos opcionales pueden completarse después.

---

## 8.3 Formulario base de persona

Campos recomendados para Etapa 7:

| Campo               | Requerido | Notas              |
| ------------------- | --------- | ------------------ |
| Nombre              | Sí        | Campo obligatorio. |
| Segundo nombre      | No        | Opcional.          |
| Apellido            | Sí        | Campo obligatorio. |
| Segundo apellido    | No        | Opcional.          |
| Fecha de nacimiento | No        | Opcional.          |
| Lugar de nacimiento | No        | Opcional.          |

Texto de ayuda:

```txt
No necesitas completar toda la información ahora. Puedes agregar más detalles después.
```

---

# 9. Reglas por acción familiar

## 9.1 Agregar padre

Como usuario, quiero agregar un padre a la persona seleccionada para construir mi línea familiar.

Reglas:

* Se crea una persona nueva.
* Se crea relación `PARENT_OF`.
* El `parentRole` debe ser `father`.
* La persona nueva queda conectada a la persona seleccionada.
* El árbol se actualiza al guardar.

Texto de acción:

```txt
Agregar padre a [Nombre]
```

Mensaje de éxito:

```txt
Padre agregado correctamente.
```

Mensaje de error:

```txt
No pudimos agregar el padre. Revisa los datos e intenta nuevamente.
```

---

## 9.2 Agregar madre

Como usuario, quiero agregar una madre a la persona seleccionada para construir mi línea familiar.

Reglas:

* Se crea una persona nueva.
* Se crea relación `PARENT_OF`.
* El `parentRole` debe ser `mother`.
* La persona nueva queda conectada a la persona seleccionada.
* El árbol se actualiza al guardar.

Texto de acción:

```txt
Agregar madre a [Nombre]
```

Mensaje de éxito:

```txt
Madre agregada correctamente.
```

Mensaje de error:

```txt
No pudimos agregar la madre. Revisa los datos e intenta nuevamente.
```

---

## 9.3 Agregar pareja

Como usuario, quiero agregar una pareja a la persona seleccionada para representar una relación familiar.

Reglas:

* Se crea una persona nueva.
* Se crea relación `PARTNER_OF`.
* Si ya existe pareja, se permite agregar otra pareja.
* No se debe usar lenguaje como “unión” en la UI principal.
* El árbol se actualiza al guardar.

Texto:

```txt
Agregar pareja a [Nombre]
```

Mensaje de éxito:

```txt
Pareja agregada correctamente.
```

Mensaje de error:

```txt
No pudimos agregar la pareja. Revisa los datos e intenta nuevamente.
```

---

## 9.4 Agregar hijo/a

Como usuario, quiero agregar un hijo o hija a la persona seleccionada para representar descendencia.

Reglas:

* Se crea una persona nueva.
* Se crea relación de padre/madre hacia el hijo/a.
* Si la persona seleccionada tiene pareja registrada, debe poder elegirse la pareja.
* Si no tiene pareja registrada, debe poder agregarse como hijo/a solo de la persona seleccionada.
* No se debe obligar al usuario a crear una pareja para agregar un hijo/a.

Textos recomendados:

```txt
Agregar hijo/a de [Nombre]
Agregar hijo/a con [Nombre de pareja]
Agregar hijo/a sin pareja registrada
```

Mensaje de éxito:

```txt
Hijo/a agregado correctamente.
```

Mensaje de error:

```txt
No pudimos agregar el hijo/a. Revisa los datos e intenta nuevamente.
```

---

# 10. Estado vacío y primeros pasos

El estado vacío actual ya va en buena dirección. En Etapa 7 debe mantenerse, pero integrarse visualmente mejor al panel lateral.

## Casos

### Caso 1: solo existe persona raíz

Texto:

```txt
Tu árbol empezó contigo, [Nombre].
Agrega dos familiares cercanos para empezar a darle forma a tu árbol.
```

Acciones sugeridas:

* Agregar padre
* Agregar madre
* Agregar pareja
* Agregar hijo/a

### Caso 2: existe una conexión

Texto:

```txt
Tu árbol ya tiene su primera conexión.
Agrega un familiar más para completar tu inicio.
```

### Caso 3: existen dos o más conexiones

Texto:

```txt
Tu árbol inicial ya tomó forma.
Puedes seguir agregando familiares cuando quieras.
```

---

# 11. Render visual del árbol

## 11.1 Objetivo visual

El árbol debe ser legible en casos normales:

* Persona raíz sola.
* Persona raíz + padre + madre.
* Persona raíz + pareja.
* Persona raíz + pareja + hijo/a.
* Persona raíz + padre + madre + hermanos.
* Persona raíz + segunda pareja básica.

---

## 11.2 Reglas visuales de nodos

Cada persona debe mostrarse como tarjeta simple.

Debe incluir:

* Nombre.
* Apellido.
* Diferenciación visual si es persona raíz.
* Diferenciación visual si es persona seleccionada.

Recomendación:

| Tipo de nodo         | Tratamiento visual                                |
| -------------------- | ------------------------------------------------- |
| Persona raíz         | Más destacada.                                    |
| Persona seleccionada | Borde/acento visual claro.                        |
| Persona normal       | Tarjeta blanca limpia.                            |
| Pareja satélite      | Tarjeta conectada a unión/pareja.                 |
| Nodo unión           | Punto pequeño o conector visual, no protagonista. |

Nota:

El usuario no debe pensar en “nodo unión”. Visualmente debe entenderlo como una conexión de pareja/familia.

---

## 11.3 Reglas visuales de conectores

| Relación             | Visual sugerido                            |
| -------------------- | ------------------------------------------ |
| Padre/madre → hijo/a | Línea sólida.                              |
| Pareja               | Línea horizontal o conector cercano.       |
| Unión con hijos      | Conector desde pareja hacia descendientes. |
| Hermanos             | Conectores distribuidos sin pisarse.       |

Evitar:

* Líneas cruzadas innecesarias.
* Nodos demasiado juntos.
* Texto pequeño difícil de leer.
* Parejas alejadas sin explicación visual.
* Que la persona seleccionada se pierda.

---

## 11.4 Zoom y pan

Etapa 7 debe mantener zoom/pan básico.

Criterios:

* El usuario puede mover el árbol.
* El usuario puede acercar/alejar.
* El árbol inicia centrado.
* El zoom inicial no debe dejar el árbol demasiado pequeño.
* El árbol no debe quedar fuera de vista al cargar.

Nota técnica:

Actualmente el render usa `window.innerWidth` como referencia. En Etapa 7 se recomienda evaluar si debe usarse el ancho real del contenedor del árbol para centrar mejor.

---

# 12. Reglas de responsive

Prioridad para Etapa 7:

1. Desktop.
2. Laptop.
3. Tablet básica si no implica gran complejidad.
4. Móvil queda para fase posterior o ajuste mínimo.

## Desktop/laptop

* Panel lateral con ancho suficiente para formularios.
* Árbol ocupa el resto de pantalla.
* El panel no debe reducir excesivamente el área visual.

## Pantallas pequeñas

Mínimo aceptable:

* No romper layout.
* Permitir scroll en panel.
* Mantener árbol visible.
* No superponer formularios sobre árbol.

No se requiere experiencia móvil final en esta etapa.

---

# 13. Feedback y mensajes

## 13.1 Mensajes de carga

Texto recomendado:

```txt
Cargando tu árbol familiar...
```

Evitar solo spinner sin contexto.

---

## 13.2 Mensajes de éxito

Ejemplos:

```txt
Padre agregado correctamente.
Madre agregada correctamente.
Pareja agregada correctamente.
Hijo/a agregado correctamente.
```

---

## 13.3 Mensajes de error

Los errores deben ser humanos.

Ejemplos:

```txt
No pudimos cargar tu árbol. Intenta nuevamente.
No pudimos guardar este familiar. Revisa los datos e intenta nuevamente.
Tu sesión expiró. Vuelve a iniciar sesión.
```

Evitar mostrar:

* Stack traces.
* IDs internos.
* Nombres de funciones Firebase.
* Errores técnicos crudos.

---

# 14. Historias de usuario de Etapa 7

## Historia 7.1 — Árbol como centro de experiencia

Como usuario,
quiero ver mi árbol familiar en el centro de la pantalla,
para entender visualmente cómo están conectados mis familiares.

Criterios de aceptación:

* El árbol ocupa el área principal.
* El panel lateral no invade la visualización.
* La persona raíz es visible.
* Las conexiones familiares son visibles.
* El árbol se puede mover/acercar si es necesario.

Prioridad: Alta
Fase: Etapa 7

---

## Historia 7.2 — Persona seleccionada clara

Como usuario,
quiero saber qué persona estoy editando,
para no agregar familiares a la persona equivocada.

Criterios de aceptación:

* El panel muestra “Estás editando a: [Nombre]”.
* Si no hay selección, usa la persona raíz.
* Las acciones se aplican a esa persona.
* No aparecen IDs técnicos.

Prioridad: Alta
Fase: Etapa 7

---

## Historia 7.3 — Acciones familiares claras

Como usuario,
quiero ver botones claros para agregar familiares,
para construir mi árbol sin aprender conceptos técnicos.

Criterios de aceptación:

* Se muestran botones para padre, madre, pareja e hijo/a.
* Solo una acción está activa a la vez.
* El formulario cambia según la acción.
* El usuario puede cancelar o cambiar de acción.

Prioridad: Alta
Fase: Etapa 7

---

## Historia 7.4 — Formularios simples

Como usuario,
quiero llenar pocos datos obligatorios,
para agregar familiares rápidamente.

Criterios de aceptación:

* Nombre y apellido son obligatorios.
* Fecha y lugar son opcionales.
* Se indica que puede completar datos después.
* El botón guardar está deshabilitado si faltan datos requeridos.
* La fecha opcional valida formato correcto.

Prioridad: Alta
Fase: Etapa 7

---

## Historia 7.5 — Estado inicial guiado

Como usuario nuevo,
quiero recibir una guía cuando mi árbol está vacío,
para saber cuál es el siguiente paso.

Criterios de aceptación:

* Si solo existe root, se muestra guía de primeros pasos.
* El mensaje usa el nombre de la persona raíz si está disponible.
* La guía recomienda agregar familiares cercanos.
* No se presenta como error.

Prioridad: Alta
Fase: Etapa 7

---

## Historia 7.6 — Feedback después de guardar

Como usuario,
quiero recibir confirmación al agregar un familiar,
para saber que la acción funcionó.

Criterios de aceptación:

* Al guardar exitosamente, aparece mensaje de éxito.
* El formulario se limpia o queda listo para nueva acción.
* El árbol se actualiza.
* No se requiere recargar manualmente.

Prioridad: Alta
Fase: Etapa 7

---

## Historia 7.7 — Error comprensible

Como usuario,
quiero entender qué pasó si algo falla,
para saber cómo continuar.

Criterios de aceptación:

* Los errores se muestran con lenguaje simple.
* Hay una acción clara como reintentar.
* No se muestran errores técnicos crudos.
* No se pierde información ya cargada si el error es parcial.

Prioridad: Alta
Fase: Etapa 7

---

## Historia 7.8 — Árbol legible en casos familiares básicos

Como usuario,
quiero que el árbol se vea ordenado con mis familiares cercanos,
para entender relaciones sin confusión.

Criterios de aceptación:

* Root + padre + madre se ve claro.
* Root + pareja + hijo/a se ve claro.
* Root + segunda pareja básica no rompe el layout.
* Los nodos no se pisan en casos normales.
* Las líneas son legibles.

Prioridad: Alta
Fase: Etapa 7

---

## Historia 7.9 — Privacidad visible básica

Como usuario,
quiero ver que mi árbol es privado,
para sentir confianza al ingresar datos familiares.

Criterios de aceptación:

* El header o panel indica “Tu árbol es privado”.
* No se promete compartir o colaboración todavía.
* No se abren páginas legales completas en esta etapa.

Prioridad: Media
Fase: Etapa 7
Nota: La profundización legal va en Etapa 7.1.

---

## Historia 7.10 — Documentación actualizada

Como desarrollador del proyecto,
quiero que README/docs reflejen el estado real,
para evitar confusión al continuar el desarrollo.

Criterios de aceptación:

* README deja de decir que la etapa actual es Etapa 5.
* README indica Etapa 6 + Stage 6.1 cerradas.
* README indica Etapa 7 activa.
* Se documenta que fotos/invitaciones quedan fuera por ahora.
* Se documentan comandos correctos de build/test.

Prioridad: Alta
Fase: Etapa 7

---

# 15. Tareas funcionales recomendadas

## 15.1 Frontend / UX

| ID      | Tarea                                                             | Prioridad |
| ------- | ----------------------------------------------------------------- | --------- |
| FE-7-01 | Reordenar visualmente `/tree` para que el árbol sea protagonista. | Alta      |
| FE-7-02 | Refinar panel lateral con bloques claros.                         | Alta      |
| FE-7-03 | Mejorar bloque “Estás editando a”.                                | Alta      |
| FE-7-04 | Renombrar textos de acciones con lenguaje humano.                 | Alta      |
| FE-7-05 | Mejorar formularios de persona.                                   | Alta      |
| FE-7-06 | Agregar/ajustar mensajes de éxito y error.                        | Alta      |
| FE-7-07 | Mejorar estado vacío / primeros pasos.                            | Alta      |
| FE-7-08 | Revisar scroll interno del panel.                                 | Media     |
| FE-7-09 | Revisar responsive desktop/laptop.                                | Media     |

---

## 15.2 Render / D3

| ID      | Tarea                                                                   | Prioridad |
| ------- | ----------------------------------------------------------------------- | --------- |
| D3-7-01 | Revisar centrado inicial del árbol.                                     | Alta      |
| D3-7-02 | Evaluar uso de ancho real del contenedor en vez de `window.innerWidth`. | Alta      |
| D3-7-03 | Mejorar tamaño/estilo de tarjetas de persona.                           | Media     |
| D3-7-04 | Diferenciar persona raíz.                                               | Alta      |
| D3-7-05 | Diferenciar persona seleccionada.                                       | Alta      |
| D3-7-06 | Revisar separación horizontal/vertical de nodos.                        | Alta      |
| D3-7-07 | Revisar conectores de pareja e hijos.                                   | Alta      |
| D3-7-08 | Validar casos con segunda pareja.                                       | Alta      |
| D3-7-09 | Evitar superposición en casos familiares medianos.                      | Media     |

---

## 15.3 Estado / interacción

| ID         | Tarea                                                                     | Prioridad |
| ---------- | ------------------------------------------------------------------------- | --------- |
| STATE-7-01 | Confirmar que `selectedPersonId` siempre tiene fallback a `rootPersonId`. | Alta      |
| STATE-7-02 | Preparar selección visual de persona en el árbol si no rompe alcance.     | Media     |
| STATE-7-03 | No implementar acciones desde nodo todavía.                               | Alta      |
| STATE-7-04 | Mantener Zustand como fuente de estado frontend.                          | Alta      |

---

## 15.4 Backend

Backend no debería ser protagonista en Etapa 7.

Solo tocar backend si se detecta:

* Error funcional actual.
* Falta de validación crítica.
* Mensaje imposible de manejar desde frontend.
* Inconsistencia de datos.

Tareas posibles:

| ID      | Tarea                                                                          | Prioridad |
| ------- | ------------------------------------------------------------------------------ | --------- |
| BE-7-01 | Revisar si errores de Functions devuelven mensajes suficientemente manejables. | Media     |
| BE-7-02 | No cambiar modelo de datos salvo necesidad real.                               | Alta      |
| BE-7-03 | No agregar fotos, permisos, invitaciones ni roles.                             | Alta      |

---

## 15.5 Documentación

| ID       | Tarea                                                        | Prioridad |
| -------- | ------------------------------------------------------------ | --------- |
| DOC-7-01 | Actualizar README.                                           | Alta      |
| DOC-7-02 | Crear documento `docs/product/06_especificacion_etapa_7.md`. | Alta      |
| DOC-7-03 | Actualizar estado actual del proyecto.                       | Alta      |
| DOC-7-04 | Documentar que Etapa 7.1 y 7.2 vienen después.               | Alta      |
| DOC-7-05 | Documentar que fotos pertenecen a Etapa 9.                   | Alta      |

---

# 16. Casos de prueba funcionales

## Caso QA-7-01 — Carga de árbol existente

Pasos:

1. Iniciar sesión con usuario que ya tiene árbol.
2. Ir a `/tree`.
3. Esperar carga.

Resultado esperado:

* El usuario ve el árbol.
* El panel muestra persona seleccionada.
* No aparece error.
* El árbol está centrado o razonablemente visible.

---

## Caso QA-7-02 — Árbol con solo root

Pasos:

1. Crear usuario nuevo.
2. Crear perfil.
3. Entrar a `/tree`.

Resultado esperado:

* Se ve persona raíz.
* Se muestra mensaje de primeros pasos.
* Se sugieren acciones familiares.
* No se siente como pantalla vacía.

---

## Caso QA-7-03 — Agregar padre

Pasos:

1. Seleccionar acción “Agregar padre”.
2. Completar nombre y apellido.
3. Guardar.

Resultado esperado:

* Aparece mensaje de éxito.
* Padre aparece en árbol.
* Relación se ve clara.
* No se rompe layout.

---

## Caso QA-7-04 — Agregar madre

Pasos:

1. Seleccionar acción “Agregar madre”.
2. Completar nombre y apellido.
3. Guardar.

Resultado esperado:

* Aparece mensaje de éxito.
* Madre aparece en árbol.
* Padre y madre se visualizan correctamente si ambos existen.

---

## Caso QA-7-05 — Agregar pareja

Pasos:

1. Seleccionar acción “Agregar pareja”.
2. Completar datos.
3. Guardar.

Resultado esperado:

* Pareja aparece conectada visualmente.
* No se muestra lenguaje técnico de unión.
* El árbol sigue legible.

---

## Caso QA-7-06 — Agregar hijo/a

Pasos:

1. Seleccionar acción “Agregar hijo/a”.
2. Elegir opción con pareja o sin pareja.
3. Completar datos.
4. Guardar.

Resultado esperado:

* Hijo/a aparece como descendiente.
* Conectores son claros.
* El panel sigue mostrando persona seleccionada.

---

## Caso QA-7-07 — Segunda pareja básica

Pasos:

1. Agregar una pareja a root.
2. Agregar otra pareja a root.
3. Agregar hijo/a con una de las parejas.

Resultado esperado:

* La app no falla.
* El árbol no se rompe.
* Las relaciones se mantienen entendibles.

---

## Caso QA-7-08 — Error de carga

Pasos:

1. Simular error de carga o desconexión.
2. Abrir `/tree`.

Resultado esperado:

* Se muestra mensaje humano.
* Existe acción para reintentar.
* No se muestran errores técnicos crudos.

---

## Caso QA-7-09 — Logout/login

Pasos:

1. Crear familiares.
2. Cerrar sesión.
3. Iniciar sesión de nuevo.
4. Ir a `/tree`.

Resultado esperado:

* Datos persisten.
* Árbol carga.
* Panel muestra persona activa correctamente.

---

## Caso QA-7-10 — Build y pruebas

Comandos esperados:

```bash
npm run build -w packages/frontend
npm run build -w packages/functions
npm run test:e2e
```

Resultado esperado:

* Build frontend pasa.
* Build functions pasa.
* E2E local existente sigue pasando.
* Si E2E falla por cambio visual, se ajusta solo si el flujo funcional sigue siendo correcto.

---

# 17. Definition of Done de Etapa 7

La Etapa 7 se puede cerrar cuando:

* [ ] `/tree` prioriza visualmente el árbol.
* [ ] El panel lateral funciona como apoyo.
* [ ] El panel ya no se siente como herramienta técnica.
* [ ] Se muestra claramente la persona seleccionada.
* [ ] El usuario puede agregar padre desde el panel.
* [ ] El usuario puede agregar madre desde el panel.
* [ ] El usuario puede agregar pareja desde el panel.
* [ ] El usuario puede agregar hijo/a desde el panel.
* [ ] Los formularios son claros y simples.
* [ ] Los campos opcionales están correctamente comunicados.
* [ ] Hay estado vacío útil para árbol inicial.
* [ ] Hay mensajes de éxito claros.
* [ ] Hay mensajes de error comprensibles.
* [ ] El árbol se ve claro con root + padre + madre.
* [ ] El árbol se ve claro con pareja + hijo/a.
* [ ] El árbol soporta segunda pareja básica sin romperse.
* [ ] Nodos y conectores no se pisan en casos normales.
* [ ] Zoom/pan básico se mantiene funcional.
* [ ] El árbol carga centrado o razonablemente visible.
* [ ] README queda actualizado al estado real.
* [ ] Se documenta que Etapa 7.1 y 7.2 vienen después.
* [ ] Build frontend pasa.
* [ ] Build functions pasa.
* [ ] Tests E2E locales existentes siguen pasando o se actualizan correctamente.
* [ ] No se agregan fotos, invitaciones, roles ni funciones fuera de alcance.

---

# 18. Riesgos detectados

## Riesgo 1 — Mezclar Etapa 7 con Etapa 7.2

Descripción:

Existe tentación de empezar con acciones desde nodo, animaciones o menú radial.

Mitigación:

Mantener Etapa 7 enfocada en UX base. Documentar ideas avanzadas para Etapa 7.2.

---

## Riesgo 2 — Panel demasiado técnico

Descripción:

`Stage4Panel` todavía puede sentirse como panel de desarrollo si los textos o estructura no están suficientemente cuidados.

Mitigación:

Refactor visual gradual, sin romper lógica existente.

---

## Riesgo 3 — Árbol visualmente confuso con más familiares

Descripción:

El render actual puede volverse difícil de leer cuando aumentan personas, parejas o hermanos.

Mitigación:

Ajustar separación, conectores, tamaño de nodos y centrado. No intentar resolver árboles enormes todavía.

---

## Riesgo 4 — Romper flujo funcional existente

Descripción:

Al mejorar UI/render, se pueden romper acciones ya validadas.

Mitigación:

Hacer cambios incrementales y correr pruebas después de cada bloque.

---

## Riesgo 5 — Documentación desalineada

Descripción:

README todavía indica Etapa 5 como estado actual, pero el plan v0.03 indica Etapa 6 + Stage 6.1 cerradas.

Mitigación:

Actualizar README y docs en esta etapa.

---

# 19. Restricciones técnicas

* Mantener React + Vite + TypeScript.
* Mantener Zustand.
* Mantener D3 para visualización.
* Mantener Firebase Auth/Firestore/Functions.
* No cambiar modelo de datos salvo necesidad real.
* No eliminar `Stage4Panel` de golpe.
* No mover acciones al nodo todavía.
* No introducir librerías visuales nuevas sin justificación.
* No hacer rediseño completo de arquitectura en Etapa 7.

---

# 20. Recomendación de implementación por bloques

## Bloque 1 — Documentación y estado

1. Crear `docs/product/06_especificacion_etapa_7.md`.
2. Actualizar README.
3. Actualizar estado del proyecto en docs.

## Bloque 2 — Layout `/tree`

1. Ajustar estructura visual.
2. Confirmar panel lateral y área principal.
3. Mejorar header y mensajes.

## Bloque 3 — Panel lateral

1. Mejorar bloque de persona seleccionada.
2. Mejorar acciones.
3. Mejorar formularios.
4. Mejorar feedback.

## Bloque 4 — Render D3

1. Revisar centrado.
2. Ajustar nodos.
3. Ajustar conectores.
4. Diferenciar persona raíz y seleccionada.
5. Validar casos familiares.

## Bloque 5 — QA

1. Build frontend.
2. Build functions.
3. E2E local.
4. Prueba manual de casos básicos.
5. Corrección de regresiones.

---

# 21. Orden recomendado de trabajo técnico

Orden sugerido:

```txt
1. Crear documentación de Etapa 7.
2. Actualizar README.
3. Mejorar layout general de TreeViewPage.
4. Refactor visual de Stage4Panel sin cambiar lógica principal.
5. Mejorar EmptyTreeState.
6. Mejorar TreeView para usar mejor el espacio disponible.
7. Mejorar renderFullTree.
8. Validar casos manuales.
9. Ejecutar builds/tests.
10. Cerrar Etapa 7 con checklist.
```

---

# 22. Preguntas no bloqueantes

Estas preguntas no impiden iniciar Etapa 7, pero deben decidirse durante la implementación:

1. ¿El panel lateral debe medir fijo `w-96` o usar un ancho adaptable entre 360px y 420px?
2. ¿La persona seleccionada debe resaltarse ya dentro del SVG en Etapa 7 o solo en el panel?
3. ¿El click en nodo para seleccionar persona entra en Etapa 7 o queda para Etapa 7.2?
4. ¿El botón “Centrar árbol” entra en Etapa 7 o se deja para Etapa 7.2?
5. ¿El árbol debe arrancar siempre centrado en root o en selectedPerson?
6. ¿Los nombres largos deben cortarse con ellipsis o partirse en dos líneas?

Recomendación PM/PO inicial:

* Panel lateral: fijo adaptable, aproximadamente 384px–420px.
* Resaltar selectedPerson en SVG: sí, si es sencillo y no rompe.
* Click en nodo: puede entrar como selección simple si es seguro; acciones desde nodo no.
* Botón “Centrar árbol”: útil, pero no obligatorio.
* Centrado inicial: selectedPerson si existe; si no, root.
* Nombres largos: máximo dos líneas o ellipsis controlado.

---

# 23. Cierre de especificación

La Etapa 7 queda definida como una etapa de refinamiento UX/render/performance base.

No debe convertirse en una etapa de nuevas funciones grandes.

La salida esperada no es “más funcionalidades”, sino una pantalla `/tree` más clara, más humana, más usable y más cercana a producto real.

Decisión final:

> Empezar Etapa 7 con documentación, actualización de README y refinamiento incremental de la pantalla actual del árbol, sin abrir fotos, invitaciones, acciones desde nodo ni privacidad legal completa todavía.

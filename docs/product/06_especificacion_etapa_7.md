# Especificación Funcional — Etapa 7

## Refinamiento UX, render y performance base para MVP

**Proyecto:** Tree Family / Árbol Genealógico
**Versión del plan base:** Plan_Etapas_Arbol_Genealogico-v0.03
**Estado previo:** Etapa 6 + Stage 6.1 cerradas
**Etapa activa:** Etapa 7
**Objetivo:** Refinar la pantalla actual del árbol, robustecer su layout familiar y mantener una semántica mínima correcta de las relaciones antes de agregar funcionalidades mayores.
**Última actualización:** 2026-07-02

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
| Layout reactivo       | Recalcular la geometría completa del árbol después de cambios en personas o relaciones. |
| Múltiples parejas     | Soportar varias uniones visibles sin superposición y con semántica mínima.      |
| Integridad defensiva  | Ignorar referencias huérfanas sin romper el render y reportarlas en desarrollo. |
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
| Editar o corregir relaciones existentes | La edición destructiva y general permanece en Etapa 8. En 4B sí se permite relacionar personas existentes como pareja y vincular un segundo progenitor a hijos existentes. |
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
| Tipos de unión visual | `couple`, `coParents` y `singleParent`, derivados de las relaciones existentes. |
| Estado de pareja      | Campo opcional `current`, `former` o `unknown`; aplica únicamente a relaciones `PARTNER_OF`. |
| Reflow del árbol      | Recalcular el layout completo después de cada mutación durante Etapa 7. |
| Optimización sectorial| Se reserva para Etapa 7.2, junto con ramas colapsables y árboles grandes. |
| Datos huérfanos       | El render debe tolerarlos e ignorarlos; la eliminación segura pertenece a Etapa 8. |
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
* La relación puede registrar de forma opcional `relationshipStatus`: `current`, `former` o `unknown`.
* Los registros existentes sin estado se interpretan como `unknown`.
* La interfaz debe usar “Pareja actual”, “Expareja” o “Relación de pareja”, según corresponda.
* No se debe asumir que una persona solo puede tener una pareja actual.
* No se debe usar lenguaje como “unión” en la UI principal.
* El árbol se actualiza y recalcula completamente al guardar.

Texto:

```txt
Agregar pareja a [Nombre]
```

Selector mínimo recomendado:

```txt
Tipo de relación
- Pareja actual
- Expareja
- Prefiero no especificar
```

La edición posterior de este estado pertenece a Etapa 8.

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
* Un hijo/a sin pareja registrada debe conservar una unión monoparental propia y no mezclarse visualmente con hijos de otra pareja.
* Cada hijo/a debe pertenecer visual y lógicamente a la unión correcta.

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

El render debe medir el ancho y alto reales del contenedor del árbol. No debe usar `window.innerWidth` para calcular el centrado, porque el panel lateral modifica el espacio disponible.

---


# 11.5 Bloque 4A — Motor de layout reactivo

## Objetivo

Garantizar que el árbol se vuelva a organizar de forma automática cuando se agreguen o cambien personas o relaciones, evitando superposiciones en familias de complejidad media.

## Decisión de Etapa 7

Durante Etapa 7 se recalculará el **layout completo** después de cada mutación de datos. No se recargará la página ni se volverán a solicitar datos innecesariamente: se reconstruirá la geometría del SVG a partir del estado actualizado.

Flujo esperado:

```txt
Cambio en personas o relaciones
→ reconstruir grupos familiares
→ medir ramas de abajo hacia arriba
→ asignar posiciones de arriba hacia abajo
→ verificar colisiones
→ renderizar nuevamente
→ mantener visible la persona principal
```

## Fases del motor

1. **Construcción de grupos familiares**
   - Personas.
   - Uniones de pareja.
   - Uniones monoparentales.
   - Hijos asociados a cada unión.

2. **Medición bottom-up**
   - Cada persona y unión calcula el ancho requerido por su rama completa.
   - El ancho de una unión debe considerar a la pareja, todos sus hijos y los descendientes de cada hijo.

3. **Posicionamiento top-down**
   - Cada unión recibe un bloque horizontal reservado.
   - Los hijos se distribuyen dentro del bloque de su unión.
   - Las distintas uniones de una persona no pueden invadir bloques vecinos.

4. **Verificación de colisiones**
   - Tarjeta contra tarjeta.
   - Rama contra rama.
   - Tarjeta contra conectores.
   - Familia contra familia.

5. **Render SVG**
   - Primero conectores.
   - Después marcadores de unión.
   - Finalmente tarjetas de personas y estados visuales.

## Reglas de reflow

- Toda alta de padre, madre, pareja o hijo/a dispara un nuevo cálculo.
- El cambio puede modificar el espacio requerido hacia abajo, hacia los lados y hasta generaciones superiores.
- El MVP prioriza previsibilidad y corrección sobre optimización prematura.
- El recálculo sectorial de ramas marcadas como modificadas se reserva para Etapa 7.2.
- No se continuará agregando offsets fijos como solución principal del layout.

## Criterios de aceptación

- Una pareja con al menos cinco hijos no genera tarjetas superpuestas.
- Dos o más parejas mantienen separados sus grupos de hijos.
- Un hijo monoparental no se mezcla con hijos de otra unión.
- Una rama lateral con pareja e hijos reserva su propio espacio.
- Las líneas no atraviesan tarjetas ni texto.
- La persona principal permanece identificable y razonablemente visible.

---

# 11.6 Bloque 4B — Tipos de unión y reconciliación familiar mínima

## Objetivo

Representar correctamente familias donde:

- dos personas son pareja;
- dos personas comparten hijos, pero no se ha declarado una relación de pareja;
- solo existe un progenitor registrado;
- la pareja se agrega después de haber creado hijos;
- dos personas existentes deben relacionarse posteriormente como pareja.

La regla central es:

> El diseño nunca debe obligar a declarar una pareja para ordenar el árbol, ni debe inventar una relación sentimental a partir de hijos compartidos.

---

## 11.6.1 Tipos internos de unión

El frontend construirá un tipo interno de unión familiar:

```ts
type UnionKind = "couple" | "coParents" | "singleParent";
```

| Tipo | Condición | Significado |
|---|---|---|
| `couple` | Existe una relación `PARTNER_OF` entre ambas personas. | Existe una relación de pareja explícitamente registrada. |
| `coParents` | Dos personas comparten al menos un hijo, pero no existe `PARTNER_OF`. | Son coprogenitores; no se afirma que sean o hayan sido pareja. |
| `singleParent` | El hijo tiene un solo progenitor conocido o registrado. | Unión monoparental; no se crea un nodo “Desconocido”. |

Estos tipos son una estructura derivada para layout y render. No es obligatorio persistir un documento adicional de unión en Firestore mientras las relaciones existentes permitan reconstruirla de forma determinista.

---

## 11.6.2 Reglas de construcción automática

### Unión `couple`

Se construye cuando existe:

```txt
A PARTNER_OF B
```

Los hijos que tengan `PARENT_OF` desde A y desde B se agrupan debajo de esa unión.

### Unión `coParents`

Se construye cuando:

```txt
A PARENT_OF Hijo
B PARENT_OF Hijo
```

pero no existe:

```txt
A PARTNER_OF B
```

Si A y B comparten varios hijos, todos se agrupan en una única unión coparental canónica para ese par de personas.

### Unión `singleParent`

Se construye cuando solo existe un progenitor válido para el hijo.

Si posteriormente se agrega un segundo progenitor, el hijo deja de pertenecer a la unión monoparental y pasa a una unión `coParents` o `couple`, según exista o no `PARTNER_OF` entre ambos adultos.

### Canonicalización

El par de progenitores debe canonicalizarse para evitar duplicados:

```txt
min(personAId, personBId) + "__" + max(personAId, personBId)
```

No deben construirse dos uniones diferentes para el mismo par y los mismos hijos.

---

## 11.6.3 Estado de una relación de pareja

El estado solo aplica a una relación explícita `PARTNER_OF`:

```ts
relationshipStatus?: "current" | "former" | "unknown";
```

| Valor | Texto visible |
|---|---|
| `current` | Pareja actual |
| `former` | Expareja |
| `unknown` | Relación de pareja |

Reglas:

- Los documentos antiguos sin el campo se interpretan como `unknown`.
- `coParents` y `singleParent` no utilizan `relationshipStatus`.
- No se debe asumir que una persona solo puede tener una pareja actual.
- La modificación posterior del estado de una pareja existente permanece en Etapa 8.

---

## 11.6.4 Relacionar dos personas existentes como pareja

El usuario debe poder crear `PARTNER_OF` entre dos personas que ya existen en el árbol.

Flujo mínimo:

1. Seleccionar la persona activa.
2. Elegir **Relacionar con una persona existente**.
3. Seleccionar a la otra persona.
4. Elegir el estado: pareja actual, expareja o no especificado.
5. Confirmar.
6. Crear `PARTNER_OF` sin duplicar personas ni relaciones.
7. Recalcular el layout.

Si ambas personas ya forman una unión `coParents`, esta debe convertirse visualmente en `couple` sin duplicar hijos ni relaciones `PARENT_OF`.

Textos recomendados:

```txt
Relacionar como pareja
Selecciona una persona existente
¿Actualmente son pareja?
```

Opciones:

```txt
Pareja actual
Expareja
Prefiero no especificar
```

Mensajes:

```txt
Relación de pareja creada.
Estas personas ya están relacionadas como pareja.
No se pudo crear la relación. Intenta nuevamente.
```

---

## 11.6.5 Agregar una pareja después de crear hijos

Al crear una pareja nueva para una persona que ya tiene hijos, la aplicación no debe asumir automáticamente que la nueva pareja es progenitor de esos hijos.

Después de guardar la pareja, la interfaz debe preguntar:

```txt
¿Esta persona también es padre o madre de alguno de los hijos existentes de [Nombre]?
```

Se mostrará una lista seleccionable de hijos elegibles.

Reglas:

- La selección es opcional.
- Cada hijo marcado crea un nuevo `PARENT_OF` desde la nueva pareja hacia ese hijo.
- Los hijos no marcados conservan su unión actual.
- No se debe duplicar una relación `PARENT_OF` existente.
- Durante el MVP, un hijo con dos progenitores distintos ya registrados no puede recibir un tercero desde este flujo.
- Los casos adoptivos, padrastros/madrastras y más de dos figuras parentales se reservan para una fase futura con semántica explícita.

Texto para un hijo no elegible:

```txt
Ya tiene dos progenitores registrados.
```

El resultado puede ser mixto:

```txt
Bélgica — Jack
    │
  Hijo A

Bélgica
    │
  Hijo B
```

---

## 11.6.6 Vincular hijos existentes a una relación

Debe existir una acción mínima de relación:

```txt
Administrar hijos de esta relación
```

En Etapa 7 su alcance se limita a **agregar el segundo progenitor** a hijos existentes que todavía tengan un solo progenitor registrado.

No incluye todavía:

- quitar un progenitor;
- cambiar filiaciones de forma destructiva;
- reasignar un hijo de una pareja a otra;
- adopción o parentesco legal;
- historial de cambios.

Esas operaciones permanecen en Etapa 8 o fases posteriores.

---

## 11.6.7 Reglas de visualización

| Tipo | Tratamiento visual inicial |
|---|---|
| `couple` | Conector terracota; puede mostrar etiqueta de pareja actual, expareja o relación de pareja. |
| `coParents` | Conector neutral beige/dorado; no debe usar iconografía romántica. |
| `singleParent` | Marcador neutral y tronco desde un solo progenitor. |

El layout debe agrupar a los hijos de forma uniforme sin convertir automáticamente a coprogenitores en pareja.

El pulido visual final de estos tres estados se realizará en el Bloque 4A.4 después de implementar la semántica.

---

## 11.6.8 Reglas de validación

`validate:tree` debe considerar válido que un hijo tenga dos progenitores sin `PARTNER_OF`.

Por tanto, este caso dejará de ser una advertencia:

```txt
Tiene 2 padres, pero no existe PARTNER_OF entre ellos.
```

El validador sí debe reportar:

- más de dos progenitores en el modelo MVP;
- `PARTNER_OF` duplicado o inverso duplicado;
- `PARENT_OF` duplicado;
- autorrelaciones;
- personas inexistentes;
- un estado de pareja no permitido;
- un hijo agrupado en más de una unión incompatible.

---

## 11.6.9 Criterios de aceptación

- Dos progenitores sin `PARTNER_OF` se muestran como coprogenitores, no como pareja.
- Dos progenitores con `PARTNER_OF` se muestran como pareja.
- Un solo progenitor se muestra mediante unión monoparental.
- Varios hijos del mismo par quedan agrupados en una sola unión.
- Crear `PARTNER_OF` sobre una unión coparental no duplica hijos.
- Se pueden relacionar dos personas existentes como pareja.
- Al crear una pareja nueva se pueden seleccionar hijos existentes elegibles.
- Los hijos no seleccionados mantienen su relación anterior.
- El validador no advierte por coprogenitores válidos.
- El árbol recalcula su layout después de cada cambio.

---

## Fuera de este bloque

Se mantiene en Etapa 8:

- editar nombres, fechas y demás información personal;
- cambiar el estado de una pareja existente;
- fechas de inicio o separación;
- eliminar una relación;
- quitar o reemplazar un progenitor;
- reasignaciones destructivas;
- adopción y tipos parentales avanzados;
- historial o deshacer cambios.

---

# 11.7 Bloque 4C — Integridad defensiva del árbol

## Objetivo

Evitar que datos inconsistentes o referencias huérfanas rompan el árbol completo.

## Caso detectado

Si una persona se elimina manualmente de Firestore, una unión o relación puede seguir conservando su ID. Firestore no aplica integridad referencial automática.

## Comportamiento requerido en Etapa 7

- Ignorar una unión que no pueda resolver las personas mínimas necesarias para representarse.
- No dibujar marcadores de unión vacíos.
- No detener el render del resto del árbol.
- Emitir una advertencia solo en desarrollo con los IDs afectados.
- Ampliar `validate:tree` para detectar:
  - relaciones con personas inexistentes;
  - parejas inexistentes dentro de una unión;
  - hijos inexistentes dentro de una unión;
  - referencias duplicadas o inconsistentes cuando sea posible.

## Alcance reservado para Etapa 8

La eliminación desde la aplicación deberá ejecutarse de forma segura y atómica:

1. Confirmar si se elimina una persona o solo un vínculo.
2. Actualizar o eliminar relaciones asociadas.
3. Actualizar uniones y referencias a hijos.
4. Preservar familiares que no deban eliminarse.
5. Ejecutar la operación mediante backend/transacción.

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


## Historia 7.11 — Layout reactivo sin superposiciones

Como usuario,  
quiero que el árbol se reorganice automáticamente al agregar familiares,  
para comprender mi familia sin mover manualmente nodos ni encontrar tarjetas superpuestas.

Criterios de aceptación:

* Cada mutación recalcula el layout.
* Las ramas reservan espacio según su descendencia.
* Una pareja con varios hijos sigue siendo legible.
* Las ramas vecinas se desplazan cuando necesitan más espacio.

Prioridad: Alta  
Fase: Etapa 7

---

## Historia 7.12 — Distinguir tipos de unión familiar

Como usuario,  
quiero que la aplicación diferencie pareja, coprogenitores y familia monoparental,  
para que el árbol represente correctamente mi familia sin inventar relaciones.

Criterios de aceptación:

* `PARTNER_OF` produce una unión `couple`.
* Dos progenitores sin `PARTNER_OF` producen una unión `coParents`.
* Un solo progenitor produce una unión `singleParent`.
* Los hijos compartidos se agrupan en una sola unión canónica.

Prioridad: Alta  
Fase: Etapa 7

---

## Historia 7.14 — Relacionar personas existentes como pareja

Como usuario,  
quiero relacionar como pareja a dos personas que ya existen en el árbol,  
para corregir o completar la historia familiar sin duplicarlas.

Criterios de aceptación:

* El usuario selecciona una persona existente.
* Puede indicar pareja actual, expareja o no especificado.
* No se crean personas duplicadas.
* Una unión coparental existente se transforma visualmente en pareja.
* Los hijos compartidos no se duplican.

Prioridad: Alta  
Fase: Etapa 7 — Bloque 4B

---

## Historia 7.15 — Asociar hijos existentes a una nueva pareja

Como usuario,  
quiero indicar cuáles hijos existentes también pertenecen a la nueva pareja,  
para construir la familia aunque haya creado primero a los hijos.

Criterios de aceptación:

* La aplicación no asigna hijos automáticamente.
* El usuario selecciona hijos elegibles.
* Se crea únicamente la relación parental faltante.
* Los hijos no seleccionados permanecen en su unión actual.
* Los hijos con dos progenitores registrados se muestran como no elegibles en el MVP.

Prioridad: Alta  
Fase: Etapa 7 — Bloque 4B

---

## Historia 7.16 — Identificar pareja actual o expareja

Como usuario,  
quiero indicar si una relación de pareja es actual, anterior o no especificada,  
para que el árbol no comunique una situación familiar incorrecta.

Criterios de aceptación:

* El alta de pareja permite seleccionar el estado mínimo.
* Los datos anteriores siguen funcionando como `unknown`.
* El estado solo aplica a `PARTNER_OF`.
* La edición posterior del estado queda fuera de Etapa 7.

Prioridad: Alta  
Fase: Etapa 7 — Bloque 4B

---

## Historia 7.13 — Tolerancia a referencias huérfanas

Como usuario,  
quiero que una inconsistencia aislada no haga desaparecer todo mi árbol,  
para poder seguir viendo la información válida.

Criterios de aceptación:

* El render ignora uniones no resolubles.
* No aparecen círculos o conectores vacíos.
* El resto del árbol se dibuja normalmente.
* Desarrollo y validadores reportan la inconsistencia.

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
| FE-7-10 | Agregar acción “Relacionar con persona existente”.                    | Alta      |
| FE-7-11 | Solicitar estado al crear una relación de pareja.                     | Alta      |
| FE-7-12 | Mostrar hijos elegibles después de agregar una pareja.                | Alta      |
| FE-7-13 | Diferenciar visualmente pareja, coprogenitores y monoparental.         | Alta      |

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
| D3-7-09 | Evitar superposición en casos familiares medianos.                      | Alta      |
| D3-7-10 | Implementar medición bottom-up de ramas familiares.                         | Alta      |
| D3-7-11 | Implementar posicionamiento top-down con bloques reservados.                | Alta      |
| D3-7-12 | Detectar colisiones entre tarjetas, ramas y conectores.                     | Alta      |
| D3-7-13 | Recalcular el layout completo después de cada mutación.                    | Alta      |
| D3-7-14 | Agrupar hijos por su unión correcta y soportar unión monoparental.         | Alta      |
| D3-7-15 | Terminar conectores exactamente en bordes de tarjetas y marcadores.        | Alta      |
| D3-7-16 | Renderizar estilos diferenciados para `couple`, `coParents` y `singleParent`. | Alta |

---

## 15.3 Estado / interacción

| ID         | Tarea                                                                     | Prioridad |
| ---------- | ------------------------------------------------------------------------- | --------- |
| STATE-7-01 | Confirmar que `selectedPersonId` siempre tiene fallback a `rootPersonId`. | Alta      |
| STATE-7-02 | Preparar selección visual de persona en el árbol si no rompe alcance.     | Media     |
| STATE-7-03 | No implementar acciones desde nodo todavía.                               | Alta      |
| STATE-7-04 | Mantener Zustand como fuente de estado frontend.                          | Alta      |
| STATE-7-05 | Disparar reflow completo cuando cambien personas, relaciones o uniones.      | Alta      |
| STATE-7-06 | Mantener compatibilidad con `relationshipStatus` ausente.                   | Alta      |
| STATE-7-07 | Derivar uniones canónicas `couple`, `coParents` y `singleParent`.              | Alta      |
| STATE-7-08 | Reconciliar hijos seleccionados después de crear una pareja.                  | Alta      |

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
| BE-7-04 | Incorporar estado mínimo de relación de pareja de forma retrocompatible.          | Alta      |
| BE-7-05 | Evitar que referencias huérfanas rompan respuestas o validaciones.                | Alta      |
| BE-7-06 | Ampliar `validate:tree` para detectar uniones y relaciones huérfanas.             | Alta      |
| BE-7-07 | Permitir crear `PARTNER_OF` entre personas existentes sin duplicados.          | Alta      |
| BE-7-08 | Crear relaciones parentales faltantes para hijos seleccionados.                | Alta      |
| BE-7-09 | Validar máximo de dos progenitores durante el flujo MVP.                        | Alta      |

---

## 15.5 Documentación

| ID       | Tarea                                                        | Prioridad |
| -------- | ------------------------------------------------------------ | --------- |
| DOC-7-01 | Actualizar README.                                           | Alta      |
| DOC-7-02 | Crear documento `docs/product/06_especificacion_etapa_7.md`. | Alta      |
| DOC-7-03 | Actualizar estado actual del proyecto.                       | Alta      |
| DOC-7-04 | Documentar que Etapa 7.1 y 7.2 vienen después.               | Alta      |
| DOC-7-05 | Documentar que fotos pertenecen a Etapa 9.                   | Alta      |
| DOC-7-06 | Crear y mantener `docs/product/07_direccion_visual_y_roadmap_ux.md`. | Alta      |

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


## Caso QA-7-10 — Pareja con cinco o más hijos

Pasos:

1. Crear una pareja.
2. Agregar al menos cinco hijos a esa unión.
3. Observar y navegar el árbol.

Resultado esperado:

* Los hijos se distribuyen dentro del bloque de su unión.
* No existen tarjetas superpuestas.
* Los conectores no atraviesan tarjetas.

---

## Caso QA-7-11 — Dos parejas con hijos diferentes

Pasos:

1. Agregar dos parejas a una persona.
2. Agregar hijos distintos a cada unión.

Resultado esperado:

* Cada grupo de hijos permanece asociado a la pareja correcta.
* Las dos ramas reservan espacio independiente.
* La persona principal sigue siendo identificable.

---

## Caso QA-7-12 — Hijo monoparental

Pasos:

1. Agregar un hijo/a sin pareja registrada.
2. Mantener también hijos de una pareja existente.

Resultado esperado:

* El hijo monoparental usa una unión independiente.
* No se mezcla visualmente con los hijos de otra pareja.

---

## Caso QA-7-13 — Pareja actual y expareja

Pasos:

1. Crear una pareja con estado actual.
2. Crear otra con estado de expareja.

Resultado esperado:

* Ambas relaciones tienen etiquetas comprensibles.
* El orden visual es consistente.
* No se asume que solo puede existir una pareja actual.

---

## Caso QA-7-17 — Coprogenitores sin relación de pareja

Pasos:

1. Crear un hijo con dos progenitores.
2. No crear `PARTNER_OF` entre ellos.
3. Cargar el árbol.

Resultado esperado:

* Los dos progenitores se muestran en una unión coparental neutral.
* No se etiquetan como pareja ni expareja.
* Los hijos compartidos permanecen agrupados.
* El validador no muestra una advertencia por ausencia de `PARTNER_OF`.

---

## Caso QA-7-18 — Convertir coprogenitores en pareja

Pasos:

1. Partir de una unión coparental existente.
2. Crear `PARTNER_OF` entre las dos personas.
3. Elegir un estado de relación.

Resultado esperado:

* La unión cambia a tipo `couple`.
* No se duplican personas, hijos ni relaciones parentales.
* El layout se recalcula.

---

## Caso QA-7-19 — Pareja agregada después de los hijos

Pasos:

1. Crear una persona con dos hijos monoparentales.
2. Agregar una pareja.
3. Seleccionar únicamente uno de los hijos como hijo de la nueva pareja.

Resultado esperado:

* El hijo seleccionado pasa a la unión de pareja o coparental correspondiente.
* El hijo no seleccionado permanece monoparental.
* No se crean relaciones duplicadas.

---

## Caso QA-7-20 — Hijo no elegible por límite MVP

Pasos:

1. Usar un hijo que ya tenga dos progenitores registrados.
2. Agregar una nueva pareja a uno de esos progenitores.
3. Abrir la selección de hijos existentes.

Resultado esperado:

* El hijo aparece deshabilitado o no seleccionable.
* Se explica que ya tiene dos progenitores registrados.
* No se crea un tercer `PARENT_OF` desde este flujo.

---

## Caso QA-7-14 — Referencia huérfana

Pasos:

1. Preparar una unión que referencie una persona inexistente en datos de prueba.
2. Cargar el árbol.

Resultado esperado:

* El árbol válido continúa visible.
* No aparece un marcador de unión vacío.
* La inconsistencia se informa en desarrollo o mediante `validate:tree`.

---

## Caso QA-7-15 — Árbol mediano

Pasos:

1. Cargar un árbol de entre 15 y 25 personas.
2. Incluir hermanos, varias parejas, hijos y una rama lateral con descendientes.

Resultado esperado:

* No hay superposiciones.
* El árbol puede moverse y escalarse.
* Las relaciones principales siguen siendo interpretables.

---

## Caso QA-7-16 — Build y pruebas

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
* [ ] Se muestra claramente la persona activa y el nodo central usa la etiqueta “Persona principal”.
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
* [ ] Una pareja con cinco o más hijos no genera superposiciones.
* [ ] Dos parejas con hijos diferentes reservan espacios independientes.
* [ ] Un hijo monoparental permanece separado de hijos de otra unión.
* [ ] El árbol se recalcula completamente después de altas o cambios de relaciones.
* [ ] Pareja actual, expareja y relación no especificada pueden distinguirse.
* [ ] El árbol diferencia `couple`, `coParents` y `singleParent`.
* [ ] Dos coprogenitores sin `PARTNER_OF` se consideran una configuración válida.
* [ ] El usuario puede relacionar dos personas existentes como pareja.
* [ ] Al agregar una pareja se pueden asociar hijos existentes elegibles sin asumir parentesco automáticamente.
* [ ] Convertir coprogenitores en pareja no duplica hijos ni relaciones.
* [ ] Las referencias huérfanas no rompen el render ni generan marcadores vacíos.
* [ ] Nodos y conectores no se pisan en casos normales.
* [ ] Zoom/pan básico se mantiene funcional.
* [ ] El árbol carga centrado o razonablemente visible.
* [ ] README queda actualizado al estado real.
* [ ] Se documenta que Etapa 7.1 y 7.2 vienen después.
* [ ] La dirección visual y el roadmap UX están consolidados en `07_direccion_visual_y_roadmap_ux.md`.
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

El README, la especificación funcional y el roadmap UX pueden quedar desalineados a medida que se descubren nuevos casos de render y producto.

Mitigación:

Actualizar los documentos al aprobar cambios de alcance, antes de continuar con código relacionado.

---


## Riesgo 6 — Corregir casos aislados con offsets fijos

Descripción:

Un desplazamiento constante puede resolver una captura concreta y provocar colisiones en otra configuración familiar.

Mitigación:

Separar medición, posicionamiento, colisiones y render. Reservar ancho por rama y evitar parches geométricos locales como solución principal.

---

## Riesgo 7 — Ambigüedad entre parejas actuales y anteriores

Descripción:

Mostrar varias parejas sin estado puede comunicar que todas son relaciones actuales.

Mitigación:

Añadir semántica mínima retrocompatible al crear la relación y reservar la edición avanzada para Etapa 8.

---

## Riesgo 8 — Referencias huérfanas en Firestore

Descripción:

Eliminar documentos manualmente o mediante flujos incompletos puede dejar relaciones y uniones que apunten a personas inexistentes.

Mitigación:

Render defensivo y validación en Etapa 7; eliminación transaccional y segura desde la aplicación en Etapa 8.

---

# 19. Restricciones técnicas

* Mantener React + Vite + TypeScript.
* Mantener Zustand.
* Mantener D3 para visualización.
* Mantener Firebase Auth/Firestore/Functions.
* No cambiar el modelo de datos salvo necesidad real o el campo opcional `relationshipStatus` aprobado para el Bloque 4B.
* No eliminar `Stage4Panel` de golpe.
* No mover acciones al nodo todavía.
* No introducir librerías visuales nuevas sin justificación.
* No hacer rediseño completo de arquitectura en Etapa 7.
* El motor de layout sí puede refactorizarse internamente para separar cálculo y render, siempre que no cambie el contrato funcional del MVP.
* Etapa 7 usará reflow completo; el recálculo sectorial se reserva para Etapa 7.2.
* No ocultar problemas de integridad: deben tolerarse en UI y reportarse en herramientas de desarrollo.

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

## Bloque 4A — Motor de layout reactivo

1. Construir grupos familiares y uniones monoparentales.
2. Medir ramas de abajo hacia arriba.
3. Posicionar bloques de arriba hacia abajo.
4. Detectar y resolver colisiones.
5. Recalcular el layout completo después de cada mutación.
6. Dibujar conectores que terminen en bordes.

## Bloque 4B — Tipos de unión y reconciliación familiar mínima

1. Documentar reglas de `couple`, `coParents` y `singleParent`.
2. Derivar uniones canónicas a partir de `PARTNER_OF` y `PARENT_OF`.
3. Construir automáticamente uniones coparentales sin inventar parejas.
4. Incorporar `relationshipStatus` opcional únicamente para `PARTNER_OF`.
5. Permitir relacionar dos personas existentes como pareja.
6. Convertir una unión coparental en pareja sin duplicar hijos.
7. Permitir seleccionar hijos existentes al crear una pareja.
8. Validar el límite de dos progenitores del MVP.
9. Actualizar `validate:tree` para aceptar coprogenitores válidos.
10. Aplicar estilos visuales diferentes durante el Bloque 4A.4.

## Bloque 4C — Integridad defensiva

1. Filtrar uniones y relaciones no resolubles.
2. Evitar marcadores o conectores huérfanos.
3. Emitir advertencias solo en desarrollo.
4. Ampliar `validate:tree`.
5. Mantener la eliminación transaccional para Etapa 8.

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
7. Implementar Bloque 4A: motor de layout reactivo.
8. Documentar Bloque 4B: tipos de unión y reglas de reconciliación.
9. Incorporar `couple`, `coParents` y `singleParent`.
10. Construir uniones coparentales automáticamente.
11. Permitir relacionar personas existentes como pareja.
12. Permitir seleccionar hijos existentes al crear pareja.
13. Actualizar `validate:tree`.
14. Ejecutar el pulido visual 4A.4 por tipo de unión.
15. Validar escenarios familiares y datos huérfanos.
16. Ejecutar builds/tests.
17. Cerrar Etapa 7 con checklist.
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

# 22.1 Documento complementario de diseño

La dirección visual oficial, los mockups aprobados, el sistema de color y la distribución de funcionalidades visuales entre Etapa 7 y etapas futuras se encuentran en:

```txt
docs/product/07_direccion_visual_y_roadmap_ux.md
```

Este documento debe consultarse antes de:

- Modificar la identidad visual.
- Cambiar el layout principal de `/tree`.
- Rediseñar nodos, conectores, formularios o paneles.
- Incorporar componentes inspirados en los mockups.
- Decidir si una función visual pertenece a Etapa 7, 7.1, 7.2 o a una etapa posterior.

Regla de consistencia:

> La especificación funcional define qué debe hacer Etapa 7; el documento de dirección visual define cómo debe sentirse, verse y evolucionar la experiencia.

---

# 23. Cierre de especificación

La Etapa 7 queda definida como una etapa de refinamiento UX/render/performance base.

No debe convertirse en una etapa de nuevas funciones grandes.

La salida esperada no es “más funcionalidades”, sino una pantalla `/tree` más clara, más humana, más usable y más cercana a producto real.

Decisión final:

> Empezar Etapa 7 con documentación, actualización de README y refinamiento incremental de la pantalla actual del árbol, sin abrir fotos, invitaciones, acciones desde nodo ni privacidad legal completa todavía.

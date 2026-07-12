# Dirección visual y roadmap de evolución UX
## Tree Family / Árbol Genealógico

**Tipo de documento:** Decisión de producto y diseño  
**Proyecto:** Tree Family / Árbol Genealógico  
**Estado del proyecto:** Stage 6.1 cerrado; Etapa 7 activa  
**Documento relacionado:** `docs/product/06_especificacion_etapa_7.md`  
**Fecha de aprobación:** 2026-06-16
**Última actualización:** 2026-07-02  
**Estado:** Aprobado para implementación gradual

---

## 1. Propósito del documento

Este documento consolida las decisiones de producto, UX y diseño visual aprobadas después de revisar los mockups del producto.

Su objetivo es evitar tres riesgos:

1. Perder ideas valiosas de los mockups por no implementarlas inmediatamente.
2. Mezclar funciones futuras con el alcance actual del MVP.
3. Cambiar repetidamente la dirección visual durante el desarrollo.

Los mockups se consideran una **visión de producto** y una **referencia de diseño**, no una obligación de implementar todas sus funciones en la Etapa 7.

---

## 2. Principio rector

Tree Family debe diferenciarse de los árboles genealógicos tradicionales mediante una experiencia:

- sencilla;
- visualmente clara;
- cálida y familiar;
- emocionalmente significativa;
- moderna sin ser compleja;
- atractiva sin saturar;
- usable por personas no técnicas;
- preparada para crecer progresivamente.

La regla principal será:

> Primero construir una experiencia clara y confiable; después incorporar interacciones avanzadas, animaciones y funciones emocionales.

---

## 3. Mockups aprobados como referencia

### 3.1 Prompt 6 — Sistema visual maestro

Se adopta como referencia principal para:

- paleta de colores;
- botones;
- inputs;
- nodos familiares;
- badges;
- estados de selección;
- composición general;
- jerarquía visual;
- estilo cálido de SaaS familiar.

### 3.2 Prompt 2 — Dashboard objetivo

Se adopta como referencia principal para:

- árbol como protagonista;
- distribución desktop;
- relación entre árbol y panel de detalle;
- lectura visual de personas y conexiones;
- acciones rápidas;
- experiencia general del dashboard.

### 3.3 Prompt 4 — Agregar familiar, detalle y estado vacío

Se adopta como referencia funcional para:

- selección del tipo de familiar;
- formulario de alta;
- panel de detalle;
- acciones rápidas;
- estado vacío centrado en la persona principal.

### 3.4 Prompt 5 — Responsive futuro

Se adopta como referencia para:

- navegación móvil;
- bottom sheets;
- detalle de persona;
- acciones rápidas en pantallas pequeñas;
- interacción táctil futura.

### 3.5 Prompt 3 — Autenticación y creación de perfil

Se adopta como referencia para:

- tono emocional del onboarding;
- continuidad visual entre registro, login y árbol;
- creación de perfil como comienzo de la historia familiar;
- vista previa futura del árbol.

---

## 4. Sistema visual oficial inicial

### 4.1 Paleta aprobada

| Token | Uso principal | Valor |
|---|---|---|
| `forest-600` | Color primario, botones, selección, confianza | `#2F5D50` |
| `cream-50` | Fondo principal | `#FFF9F0` |
| `warm-beige-100` | Superficies secundarias | `#F5EFE6` |
| `terracotta-500` | Acento emocional y acciones secundarias | `#C97C5D` |
| `gold-400` | Detalles decorativos y estados especiales | `#D8A94F` |
| `charcoal-900` | Texto principal | `#2B2B2B` |

### 4.2 Reglas de uso

- El verde bosque será el color primario del producto.
- El terracota se usará con moderación para acciones emocionales o secundarias.
- El dorado no se usará para texto crítico ni acciones principales.
- El fondo general será crema suave.
- Las tarjetas serán blancas o blanco cálido.
- Los bordes serán suaves y discretos.
- Las sombras serán ligeras.
- La decoración botánica será secundaria y de bajo contraste.
- La legibilidad tendrá prioridad sobre la ornamentación.

### 4.3 Regla de contenedores

Evitar “cajas dentro de cajas”.

No todos los bloques deben tener simultáneamente:

- borde;
- fondo;
- sombra;
- radio grande;
- padding amplio.

Cada pantalla debe tener una jerarquía clara de superficies:

1. Fondo de página.
2. Contenedor principal.
3. Secciones internas.
4. Controles y formularios.

---

## 5. Dirección aprobada para el dashboard

### 5.1 Prioridad visual

El árbol será el elemento principal de la pantalla.

El panel lateral será un elemento de apoyo para:

- mostrar la persona seleccionada;
- iniciar acciones;
- mostrar formularios;
- comunicar estados;
- guiar al usuario.

### 5.2 Estructura base de Etapa 7

```text
Header simple
├── Identidad del producto
├── Estado de privacidad
└── Cerrar sesión

Contenido principal
├── Panel lateral de apoyo
│   ├── Primeros pasos, cuando corresponda
│   ├── Persona seleccionada
│   ├── Acciones rápidas
│   ├── Formulario contextual
│   └── Mensajes de estado
└── Área principal del árbol
    ├── Árbol centrado
    ├── Zoom y desplazamiento
    ├── Persona raíz destacada
    └── Conectores legibles
```

### 5.3 Decisión sobre paneles futuros

El panel derecho de detalles mostrado en los mockups no será permanente en todas las resoluciones.

La solución futura preferida será un **drawer temporal y cerrable**, para no reducir innecesariamente el área del árbol en laptops.

---

## 6. Alcance inmediato — Etapa 7

### 6.1 Objetivo

Refinar la experiencia actual sin agregar grandes capacidades nuevas.

### 6.2 Funciones incluidas

| Función | Decisión |
|---|---|
| Aplicar paleta oficial | Sí |
| Refinar `TreeViewPage` | Sí |
| Limpiar `Stage4Panel` | Sí |
| Eliminar encabezados duplicados | Sí |
| Reducir cajas anidadas | Sí |
| Persona seleccionada clara | Sí |
| Botones de relación claros | Sí |
| Formularios contextuales | Sí |
| Estado vacío mejorado | Sí |
| Árbol centrado por contenedor | Sí |
| Persona raíz destacada | Sí |
| Persona seleccionada destacada | Sí, si no rompe el render |
| Zoom/pan básico | Sí |
| Mejorar nodos sin fotografía | Sí |
| Mejorar conectores | Sí |
| Motor de layout reactivo con reflow completo | Sí |
| Reserva de espacio por rama y detección de colisiones | Sí |
| Tipos `couple`, `coParents` y `singleParent` | Sí |
| Semántica mínima de pareja actual/expareja/no especificada | Sí |
| Relacionar personas existentes como pareja | Sí, Bloque 4B |
| Asociar hijos existentes al crear pareja | Sí, flujo no destructivo |
| Tolerancia a uniones y relaciones huérfanas | Sí |
| Mensajes de carga, éxito y error | Sí |
| Responsive básico desktop/laptop | Sí |
| Móvil completo | No |

### 6.3 Orden de implementación aprobado

1. Limpiar y refinar `Stage4Panel`.
2. Aplicar la paleta oficial a `TreeViewPage`.
3. Mejorar el bloque de persona seleccionada.
4. Mejorar botones de relación.
5. Mejorar formularios.
6. Mejorar el estado vacío.
7. Mejorar nodos y conectores básicos.
8. Implementar Bloque 4A: motor de layout reactivo.
9. Documentar Bloque 4B: tipos de unión y reconciliación.
10. Incorporar `couple`, `coParents` y `singleParent`.
11. Construir uniones coparentales automáticamente.
12. Relacionar personas existentes como pareja.
13. Asociar hijos existentes al crear pareja.
14. Actualizar el validador.
15. Ejecutar el pulido visual 4A.4 por tipo de unión.
16. Validar escenarios familiares simples y medianos.
17. Ejecutar build y E2E.
18. Actualizar documentación de avance.

---


### 6.4 Bloque 4A — Motor de layout reactivo

#### Decisión

El árbol debe reaccionar automáticamente a cada alta o cambio de personas y relaciones. En Etapa 7 se realizará un **reflow completo** de la geometría SVG después de cada mutación.

No se recargará la página. El estado actualizado provocará:

```text
Cambio de datos
→ reconstrucción de grupos familiares
→ medición bottom-up
→ posicionamiento top-down
→ verificación de colisiones
→ redibujado SVG
```

#### Reserva de espacio por familia

Cada unión debe reservar ancho según:

- la tarjeta de la persona y su pareja;
- el número de hijos;
- el ancho acumulado de las ramas de cada hijo;
- parejas y descendientes adicionales dentro de esas ramas;
- separación mínima respecto a familias vecinas.

La distribución no debe depender de offsets constantes como solución principal.

#### Alcance de Etapa 7

- Reflow completo y predecible.
- Soporte para árboles medianos.
- Varias parejas con hijos independientes.
- Hermanos con parejas y descendencia.
- Hijos monoparentales en un bloque propio.
- Conectores que terminen en bordes.
- Detección y corrección de colisiones antes de dibujar.

#### Etapa 7.2

Se reserva para:

- recálculo sectorial de ramas modificadas;
- propagación de cambios de ancho solo hacia ancestros y ramas vecinas;
- conservación avanzada de la cámara;
- animaciones de reflow;
- ramas colapsables y render parcial.

---

### 6.5 Bloque 4B — Tipos de unión y reconciliación familiar mínima

#### Problema de producto

La aplicación debe representar correctamente tres situaciones distintas:

1. Dos personas registradas explícitamente como pareja.
2. Dos personas que comparten hijos, sin afirmar que son pareja.
3. Una familia con un solo progenitor conocido.

La claridad visual no debe obtenerse falseando la historia familiar.

#### Tipos internos aprobados

```ts
type UnionKind = "couple" | "coParents" | "singleParent";
```

| Tipo | Fuente de datos | Significado |
|---|---|---|
| `couple` | `PARTNER_OF` | Relación de pareja explícita. |
| `coParents` | Hijos compartidos sin `PARTNER_OF` | Coprogenitores, sin inferir relación sentimental. |
| `singleParent` | Un solo `PARENT_OF` válido | Familia monoparental o segundo progenitor aún no registrado. |

#### Estado de pareja

```ts
relationshipStatus?: "current" | "former" | "unknown";
```

El estado se aplica únicamente a `couple`.

| Valor | Texto |
|---|---|
| `current` | Pareja actual |
| `former` | Expareja |
| `unknown` | Relación de pareja |

#### Reglas aprobadas

- Dos progenitores sin `PARTNER_OF` forman una unión visual `coParents`.
- No se debe obligar a crear una pareja para agrupar correctamente a los hijos.
- Varios hijos del mismo par se agrupan en una unión canónica.
- Crear `PARTNER_OF` sobre coprogenitores convierte la unión en `couple` sin duplicar hijos.
- El usuario puede relacionar dos personas existentes como pareja.
- Al crear una pareja después de los hijos, se pregunta qué hijos también pertenecen a esa persona.
- No se asignan hijos automáticamente.
- Durante el MVP, los hijos con dos progenitores ya registrados no aceptan un tercero desde este flujo.
- La edición general, eliminación y reasignación destructiva permanecen en Etapa 8.

#### Dirección visual para 4A.4

| Tipo | Estilo |
|---|---|
| `couple` | Terracota, con semántica de pareja. |
| `coParents` | Beige/dorado neutral, sin corazón ni lenguaje romántico. |
| `singleParent` | Marcador neutral y conexión desde una persona. |

#### Validación

`validate:tree` dejará de advertir por dos progenitores sin `PARTNER_OF`, porque será una configuración válida. Seguirá reportando referencias huérfanas, duplicados, autorrelaciones y más de dos progenitores dentro del modelo MVP.

#### Etapa 8

- Editar datos personales.
- Cambiar estado de una relación existente.
- Fechas de inicio y separación.
- Quitar o reemplazar progenitores.
- Eliminar o corregir relaciones de forma destructiva.
- Adopción y otros tipos parentales.

---

### 6.6 Bloque 4C — Integridad defensiva

#### Problema detectado

Firestore no elimina automáticamente relaciones o uniones cuando una persona es eliminada manualmente. Pueden quedar referencias huérfanas.

#### Alcance de Etapa 7

- Ignorar uniones no resolubles.
- No mostrar círculos ni conectores vacíos.
- Mantener visible el resto del árbol válido.
- Emitir advertencias solo en desarrollo.
- Ampliar `validate:tree` para detectar personas, parejas o hijos inexistentes.

#### Etapa 8

La eliminación desde la aplicación deberá ser transaccional y diferenciar:

- eliminar una persona;
- eliminar solo un vínculo;
- actualizar una unión;
- conservar familiares y descendencia válidos.

---

### 6.7 Criterios de cierre de los bloques 4A, 4B y 4C

- Una pareja con cinco o más hijos no se superpone.
- Dos parejas con hijos diferentes mantienen ramas independientes.
- Un hijo monoparental no se mezcla con otra unión.
- Hermanos con pareja e hijos reservan espacio lateral suficiente.
- Las líneas terminan en los bordes de tarjetas y marcadores.
- Pareja actual, expareja y relación no especificada se distinguen.
- Pareja, coprogenitores y unión monoparental se diferencian sin inventar relaciones.
- Dos personas existentes pueden relacionarse como pareja sin duplicarse.
- Los hijos existentes pueden asociarse de forma opcional a una nueva pareja.
- El validador acepta coprogenitores sin `PARTNER_OF`.
- Una referencia huérfana no rompe el árbol ni deja marcadores vacíos.
- El árbol se recalcula después de cada mutación.

---

## 7. Etapa 7.1 — Confianza, privacidad y páginas legales

### 7.1 Objetivo

Hacer visible cómo se protege la información familiar y preparar el producto para una beta con usuarios reales.

### 7.2 Alcance previsto

- Política de privacidad.
- Términos de uso.
- Política de menores.
- Página de eliminación de datos.
- Contacto de privacidad.
- Consentimiento y aceptación en registro.
- Aviso de árbol privado.
- Aviso al registrar datos de menores.
- Revisión de Firestore Rules.
- Revisión de datos familiares en logs y analytics.
- Revisión legal profesional antes del lanzamiento público.

---

## 8. Etapa 7.2 — UX/render/performance orientado a futuro

### 8.1 Objetivo

Crear la experiencia diferenciadora del producto sin comprometer el MVP base.

### 8.2 Selección desde nodo

- Click en una persona.
- Cambio de persona activa.
- Resaltado visual.
- Centrado opcional.
- Transición suave.
- Apertura de detalles.

### 8.3 Acciones desde nodo

- Menú contextual.
- Botones flotantes.
- Menú radial o desplegable.
- Agregar padre, madre, pareja o hijo/a desde el nodo.
- Animaciones discretas.
- Interacciones visibles, atractivas y no invasivas.

### 8.4 Drawer de detalle

- Información básica.
- Conexiones familiares.
- Acciones rápidas.
- Cerrar panel.
- Comportamiento adaptable por resolución.

### 8.5 Drawer de agregar familiar

- Selección de relación.
- Formulario contextual.
- Guardado sin perder el árbol.
- Transición lateral.
- Preparación para móvil.

### 8.6 Árboles grandes y recálculo sectorial

- Marcar como modificada la rama afectada.
- Recalcular el subárbol y propagar cambios de ancho hacia ancestros.
- Ajustar solo ramas vecinas con riesgo de colisión.
- Conservar la posición visual de áreas no afectadas.
- Colapsar ramas.
- Expandir ramas.
- Agrupar miniárboles.
- Mostrar cantidad de familiares ocultos.
- Renderizar solo ramas necesarias.
- Preservar rendimiento.

### 8.7 Controles visuales

- Centrar árbol.
- Restablecer zoom.
- Acercar.
- Alejar.
- Ajustar a pantalla.
- Mostrar nivel de zoom.

### 8.8 Optimización técnica de carga

Deuda técnica registrada durante Etapa 7:

- Bundle principal superior al umbral informativo de 500 kB de Vite.
- El build continúa siendo válido y la advertencia no bloquea la etapa.
- No se aumentará el límite únicamente para ocultar la advertencia.
- La separación avanzada mediante lazy loading, imports dinámicos y chunks específicos de Firebase/D3 se evaluará al cerrar Etapa 7 o durante Etapa 7.2.

---

## 9. Etapa 8 — Edición avanzada y manejo seguro de relaciones

Incluye:

- editar información de persona;
- eliminar una relación sin borrar accidentalmente la persona;
- cambiar una relación;
- confirmaciones destructivas;
- editar o corregir parejas existentes;
- cambiar una relación entre pareja actual, expareja o no especificada;
- fechas de inicio o separación;
- hijos de diferentes relaciones;
- quitar, reemplazar o reasignar progenitores de forma destructiva;
- corrección de padre/madre/pareja;
- validaciones de consistencia;
- separación entre “eliminar vínculo” y “eliminar persona”.

El botón “Editar información” de los mockups se considera una referencia futura hasta completar esta etapa.

---

## 10. Etapa 9 — Fotos y detalles emocionales

Incluye:

- foto de perfil;
- avatar o iniciales de respaldo;
- almacenamiento de imágenes;
- fecha y lugar de nacimiento visibles;
- persona fallecida;
- notas breves;
- mini biografía;
- tarjetas familiares más emocionales;
- mejora del perfil de persona.

La interfaz de Etapa 7 debe verse correctamente sin fotos.

---

## 11. Roadmap posterior preservado

### Etapa 10 — Navegación y gestión de familiares

- Sidebar completa.
- Página de personas.
- Búsqueda global.
- Filtros.
- Lista de familiares.
- Navegación entre árbol y perfiles.

### Etapa 11 — Invitaciones y colaboración

- Invitaciones.
- Vista de solo lectura.
- Roles.
- Permisos de edición.
- Auditoría de cambios.

### Etapa 12 — Recuerdos y contenido familiar

- Álbum familiar.
- Recuerdos.
- Historias.
- Documentos.
- Eventos.
- Línea de tiempo.

### Etapa 13 — Mobile responsive completo

- Navegación inferior.
- Bottom sheets.
- Detalle a pantalla completa.
- Árbol táctil.
- Gestos de zoom.

### Etapa 14 — Exportación y preservación

- PDF.
- Imagen del árbol.
- Impresión.
- Copias de seguridad.
- Importación/exportación.

### Etapa 15 — Funciones avanzadas e IA

- Detección de duplicados.
- Sugerencias inteligentes.
- Resúmenes familiares.
- Ayuda para documentar historias.
- Uso de IA solo con consentimiento y políticas claras.

### Fase comercial futura

- Plan gratuito.
- Límites.
- Suscripción.
- Más almacenamiento.
- Personalización.
- Funciones premium.

No se diseñará monetización antes de validar el valor central del producto.

---

## 12. Matriz consolidada

| Función | Etapa |
|---|---|
| Paleta y sistema visual | 7 |
| Layout limpio | 7 |
| Panel lateral refinado | 7 |
| Árbol centrado | 7 |
| Nodos sin foto mejorados | 7 |
| Estado vacío mejorado | 7 |
| Zoom/pan básico | 7 |
| Motor de layout reactivo | 7 |
| Reflow completo después de mutaciones | 7 |
| Reserva de espacio y detección de colisiones | 7 |
| Semántica mínima pareja/expareja | 7 |
| Integridad defensiva ante referencias huérfanas | 7 |
| Recálculo sectorial optimizado | 7.2 |
| Privacidad visible | 7 / 7.1 |
| Páginas legales | 7.1 |
| Click en nodo | 7.2 |
| Acciones desde nodo | 7.2 |
| Drawer de detalle | 7.2 |
| Drawer agregar familiar | 7.2 |
| Animaciones | 7.2 |
| Colapsar ramas | 7.2 |
| Miniárboles agrupados | 7.2 / futuro |
| Editar persona | 8 |
| Eliminar relación segura | 8 |
| Edición y corrección de relaciones existentes | 8 |
| Fotos | 9 |
| Biografías y notas | 9 |
| Sidebar completa | 10 |
| Búsqueda y filtros | 10 |
| Invitaciones | 11 |
| Colaboración | 11 |
| Álbum y recuerdos | 12 |
| Línea de tiempo | 12 |
| Mobile completo | 13 |
| PDF y exportación | 14 |
| IA | 15 |
| Premium | Fase comercial futura |

---

## 13. Reglas de accesibilidad y legibilidad

- Texto principal entre 14 y 16 px como mínimo.
- Etiquetas y ayudas no menores a 13 px salvo excepciones justificadas.
- Áreas táctiles/clicables suficientemente amplias.
- Contraste adecuado.
- No depender únicamente del color para comunicar estados.
- Soportar nombres largos.
- Mantener legibilidad para adultos mayores.
- Evitar animaciones rápidas o invasivas.
- Respetar `prefers-reduced-motion` en fases con animación.

---

## 14. Riesgos y mitigaciones

### Riesgo: implementar el mockup completo demasiado pronto

**Mitigación:** separar visión, MVP y fases futuras.

### Riesgo: depender de fotos para que el producto se vea bien

**Mitigación:** diseñar nodos sólidos con iniciales o avatar neutro.

### Riesgo: reducir demasiado el espacio del árbol

**Mitigación:** paneles futuros como drawers y navegación colapsable.

### Riesgo: decoración excesiva

**Mitigación:** ornamentos tenues y legibilidad como prioridad.

### Riesgo: cajas anidadas y UI pesada

**Mitigación:** jerarquía clara de superficies y bordes discretos.

### Riesgo: perder funciones futuras

**Mitigación:** mantenerlas registradas en este roadmap y revisarlas al cerrar cada etapa.

---


### Riesgo: corregir cada caso con offsets fijos

**Mitigación:** medir ramas completas, reservar bloques y separar cálculo geométrico del render SVG.

### Riesgo: confundir pareja con coprogenitores

**Mitigación:** derivar `couple`, `coParents` y `singleParent`; aplicar `relationshipStatus` únicamente a `PARTNER_OF`; no inventar relaciones sentimentales para mejorar el dibujo.

### Riesgo: referencias huérfanas en Firestore

**Mitigación:** render defensivo y validador en Etapa 7; eliminación segura y transaccional en Etapa 8.

### Riesgo: optimización sectorial prematura

**Mitigación:** usar reflow completo en árboles medianos durante Etapa 7 y mover la optimización incremental a Etapa 7.2.

---

## 15. Criterios para aceptar cambios visuales

Un cambio visual será aceptado cuando:

- mejora la claridad;
- mantiene la funcionalidad existente;
- respeta la paleta aprobada;
- evita duplicación visual;
- no reduce excesivamente el área del árbol;
- no introduce una función fuera de etapa;
- mantiene build y pruebas en verde;
- funciona sin fotografías;
- es comprensible para un usuario no técnico.
- mantiene separadas ramas familiares de complejidad media;
- recalcula el layout después de mutaciones;
- no deja marcadores o conectores huérfanos;
- no comunica de forma ambigua el estado de varias parejas.

---

## 16. Decisión final

Los mockups quedan oficialmente preservados como:

- visión visual del producto;
- referencia UX;
- fuente del roadmap;
- guía para componentes futuros.

La implementación será incremental.

La Etapa 7 adoptará el sistema visual y mejorará la experiencia existente. Las capacidades avanzadas se incorporarán en las etapas 7.1, 7.2, 8, 9 y posteriores según este documento.

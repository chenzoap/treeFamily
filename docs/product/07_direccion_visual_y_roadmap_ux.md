# Dirección visual y roadmap de evolución UX
## Tree Family / Árbol Genealógico

**Tipo de documento:** Decisión de producto y diseño  
**Proyecto:** Tree Family / Árbol Genealógico  
**Estado del proyecto:** Stage 6.1 cerrado; Etapa 7 activa  
**Documento relacionado:** `docs/product/06_especificacion_etapa_7.md`  
**Fecha de aprobación:** 2026-06-16  
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
7. Mejorar nodos y conectores.
8. Validar casos familiares representativos.
9. Ejecutar build y E2E.
10. Actualizar documentación de avance.

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

### 8.6 Árboles grandes

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

---

## 9. Etapa 8 — Edición avanzada y manejo seguro de relaciones

Incluye:

- editar información de persona;
- eliminar una relación sin borrar accidentalmente la persona;
- cambiar una relación;
- confirmaciones destructivas;
- segunda pareja;
- hijos de diferentes relaciones;
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
| Relaciones complejas | 8 |
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

---

## 16. Decisión final

Los mockups quedan oficialmente preservados como:

- visión visual del producto;
- referencia UX;
- fuente del roadmap;
- guía para componentes futuros.

La implementación será incremental.

La Etapa 7 adoptará el sistema visual y mejorará la experiencia existente. Las capacidades avanzadas se incorporarán en las etapas 7.1, 7.2, 8, 9 y posteriores según este documento.

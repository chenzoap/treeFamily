# Tree Family / Árbol Genealógico

Aplicación web para crear, visualizar y preservar un árbol familiar privado de forma simple, clara y emocionalmente significativa.

El objetivo del proyecto no es solo construir una demo técnica, sino desarrollar un producto real donde una persona pueda empezar su árbol familiar desde sí misma, agregar familiares cercanos y entender visualmente cómo están conectados.

---

## Estado actual del proyecto

**Estado:** Etapa 6 + Stage 6.1 cerradas  
**Etapa activa:** Etapa 7 — Refinamiento UX, render y performance base para MVP  
**Último hito cerrado:** Stage 6.1 — CI básico con GitHub Actions  
**Siguiente foco:** Refinar la pantalla `/tree` antes de agregar nuevas funcionalidades mayores.

### Resumen del avance actual

El proyecto ya cuenta con el flujo funcional principal del MVP:

- Usuario nuevo puede crear cuenta.
- Usuario puede iniciar sesión.
- Usuario puede crear su perfil personal.
- Se crea un árbol privado asociado al usuario autenticado.
- Usuario existente con árbol entra directamente a `/tree`.
- Usuario sin árbol es dirigido a `/create-profile`.
- Usuario puede visualizar su árbol.
- Usuario puede agregar padre.
- Usuario puede agregar madre.
- Usuario puede agregar pareja.
- Usuario puede agregar hijo/a.
- Se pueden crear relaciones familiares básicas.
- El árbol persiste después de cerrar sesión e iniciar sesión nuevamente.
- Existen pruebas E2E locales con Playwright para flujos principales.
- Existe CI básico en GitHub Actions para build de frontend y functions.

### Validación completada hasta Stage 6.1

- Usuario nuevo crea cuenta.
- Usuario crea perfil personal.
- Usuario entra a `/tree`.
- Usuario agrega padre.
- Usuario agrega madre.
- Usuario conecta padre y madre como pareja cuando corresponde.
- Usuario agrega pareja.
- Usuario agrega hijo/a.
- Usuario cierra sesión.
- Usuario inicia sesión otra vez.
- El árbol y las relaciones persisten.
- No permite crear cuenta con el mismo email.
- No aparece el bug de `Persona no encontrada`.
- Build local de frontend validado.
- Build local de functions validado.
- Pruebas E2E locales principales pasan.
- GitHub Actions ejecuta build de frontend y functions.

---

## Etapa activa: Etapa 7

### Nombre

**Etapa 7 — Refinamiento UX, render y performance base para MVP**

### Objetivo

Convertir la pantalla actual del árbol en una experiencia más clara, usable, visualmente ordenada y preparada para usuarios comunes.

La pregunta principal de cierre de esta etapa es:

> ¿El usuario puede ver su árbol, entender quién está seleccionado y agregar familiares sin confundirse?

### Alcance de Etapa 7

Incluye:

- Refinar la pantalla `/tree`.
- Priorizar el árbol como elemento central.
- Mantener el panel lateral como apoyo.
- Refactor gradual de `Stage4Panel` sin eliminarlo de golpe.
- Mostrar claramente la persona seleccionada: “Estás editando a: [Nombre]”.
- Mejorar textos de acciones familiares.
- Mejorar formularios y feedback de éxito/error.
- Mejorar estado vacío o primeros pasos.
- Mejorar separación de nodos y conectores.
- Mantener o mejorar zoom/pan básico.
- Revisar responsive básico para desktop/laptop.
- Actualizar documentación del proyecto.
- Verificar que builds y pruebas existentes sigan pasando.

No incluye:

- Fotos familiares.
- Invitaciones.
- Colaboración familiar.
- Roles avanzados.
- Acciones desde nodo.
- Menú radial.
- Animaciones avanzadas.
- Agrupación de ramas o mini-árboles.
- Privacidad legal completa.
- Exportación PDF.
- IA.

---

## Roadmap aprobado inmediato

```txt
1. Etapa 7   — Refinar pantalla actual del árbol
2. Etapa 7.1 — Confianza, privacidad visible y páginas legales base
3. Etapa 7.2 — UX/render/performance orientado a futuro
4. Etapa 8   — Edición avanzada y manejo seguro de relaciones
5. Etapa 9   — Fotos y detalles emocionales
```

### Etapa 7.1 — Próxima sub-etapa

Se enfocará en privacidad visible, confianza y páginas legales base:

- `/privacy`
- `/terms`
- `/children-privacy`
- `/data-deletion`
- Mensajes visibles de privacidad.
- Avisos sobre datos de menores.
- Confirmación de edad/aceptación en registro.

### Etapa 7.2 — Sub-etapa futura

Se enfocará en diferenciar visualmente el producto:

- Acciones desde nodo.
- Menú contextual visual.
- Posible menú radial.
- Animaciones suaves.
- Ramas colapsables o mini-árboles agrupados.
- Preparación de arquitectura frontend para árboles grandes.

---

## Visión del producto

Tree Family busca ayudar a las personas a construir y conservar la historia de su familia mediante una experiencia:

- Fácil de usar.
- Privada por defecto.
- Visualmente clara.
- Emocionalmente significativa.
- Pensada para usuarios comunes, no solo técnicos.
- Escalable para futuras funciones como fotos, invitaciones, colaboración y memorias familiares.

Promesa principal del producto:

> Crea tu árbol familiar privado de forma simple, empieza contigo, agrega a tus familiares cercanos y visualiza tu historia familiar sin complicaciones.

---

## Alcance del MVP

El MVP se enfoca en validar el flujo esencial:

```txt
Crear cuenta
→ Crear perfil personal
→ Crear árbol privado
→ Ver árbol
→ Agregar familiares directos
→ Visualizar relaciones básicas
```

### Funciones incluidas actualmente

- Registro con email y contraseña.
- Inicio de sesión.
- Protección contra cuentas duplicadas por email.
- Detección de árbol existente por usuario autenticado.
- Creación de perfil personal.
- Creación de árbol privado.
- Visualización inicial del árbol con persona raíz.
- Estado inicial guiado para agregar familiares.
- Agregar padre.
- Agregar madre.
- Agregar pareja.
- Agregar hijo/a.
- Crear relaciones familiares básicas.
- Cierre de sesión.
- Persistencia de árbol después de volver a iniciar sesión.
- Pruebas E2E locales iniciales.
- CI básico para validar build de frontend y functions.

---

## Funciones fuera del MVP por ahora

Estas funciones son valiosas, pero no pertenecen a la primera versión estable:

- Fotos familiares.
- Invitaciones a familiares.
- Roles de colaboración.
- Árbol público/social.
- Exportación PDF.
- Biografías largas.
- Documentos familiares.
- IA.
- Privacidad avanzada por persona.
- Divorcio/separación avanzada.
- App móvil nativa.
- Acciones visuales avanzadas desde nodo.
- Agrupación avanzada de ramas familiares.

Regla de producto:

> Primero se valida y refina el flujo básico del árbol. Las funciones emocionales y colaborativas se agregan después de tener una experiencia base sólida.

---

## Stack tecnológico

### Frontend

- React
- Vite
- TypeScript
- Tailwind CSS
- Zustand
- D3 / d3-hierarchy
- React Hook Form
- Zod
- React Router

### Backend / Infraestructura

- Firebase Authentication
- Firestore
- Firebase Cloud Functions
- Firebase Emulator Suite

### Calidad / Herramientas

- ESLint
- TypeScript
- Playwright
- GitHub Actions
- Scripts de validación y seed local

---

## Estructura principal del repositorio

```txt
treeFamily/
  .github/
    workflows/
      ci.yml

  docs/
    product/
    qa/
    technical/

  packages/
    frontend/
      src/
        components/
        pages/
        store/
        types/
        graph/
        visualization/
        lib/

    functions/
      src/

    firebase/
      firebase.json
      firebase.dev.json
      firestore.rules
      firestore.dev.rules

  scripts/
  tests/
  package.json
  playwright.config.ts
```

---

## Rutas principales

```txt
/login
/signup
/create-profile
/tree
```

### Flujo esperado

```txt
Usuario nuevo:
  /signup
  → /create-profile
  → /tree

Usuario existente:
  /login
  → si tiene árbol: /tree
  → si no tiene árbol: /create-profile
```

---

## Comandos útiles

### Instalar dependencias

```bash
npm install
```

### Ejecutar frontend

```bash
npm run web:dev
```

Alternativa directa por workspace:

```bash
npm run dev -w packages/frontend
```

### Ejecutar frontend + emuladores + seed

```bash
npm run dev
```

### Firebase Emulator Suite

```bash
npm run firebase:start:dev
```

### Seed local de Firestore

```bash
npm run firebase:seed
```

### Validar datos del árbol

```bash
npm run validate:tree
```

### Build frontend

```bash
npm run build -w packages/frontend
```

### Build functions

```bash
npm run build -w packages/functions
```

### Tests unitarios frontend

```bash
npm run test:unit
```

### Tests E2E

```bash
npm run test:e2e
```

### Ejecutar todos los tests configurados

```bash
npm test
```

---

## CI / GitHub Actions

El proyecto cuenta con workflow básico de CI en:

```txt
.github/workflows/ci.yml
```

El workflow se ejecuta en `push` y `pull_request` hacia `main` o `master`.

Actualmente valida:

- Instalación con `npm ci`.
- Build de frontend.
- Build de functions.

Comandos ejecutados por CI:

```bash
npm run build -w packages/frontend
npm run build -w packages/functions
```

Nota:

- Los tests E2E locales existen, pero no forman parte obligatoria del CI básico actual.
- La integración de E2E en CI puede agregarse en una etapa futura si se estabiliza el entorno de emuladores en GitHub Actions.

---

## Firebase Emulator Suite

Este proyecto usa Firebase Emulator Suite para desarrollo local.

Archivos locales como exports del emulador, logs o datos temporales no deberían formar parte del código fuente principal.

Se recomienda ignorar:

```gitignore
firebase-export-*/
firestore-debug.log
.firebase-seed/
```

La carpeta `.firebase-seed/` debe tratarse como dato local o seed controlado. Si contiene datos generados por pruebas locales, no debería versionarse salvo decisión explícita.

---

## Documentación del producto

La documentación principal vive en:

```txt
docs/product/
```

Documentos relevantes:

```txt
00_estado_actual_proyecto.md
01_decisiones_producto_confirmadas.md
02_mvp_alcance_vigente.md
03_plan_etapa_5.md
04_deuda_tecnica_actual.md
05_flujo_mvp_v1.md
06_especificacion_etapa_7.md
07_direccion_visual_y_roadmap_ux.md
```

Descripción:

- `docs/product/06_especificacion_etapa_7.md` — Alcance funcional, historias de usuario, reglas de producto, QA y Definition of Done de Etapa 7.
- `docs/product/07_direccion_visual_y_roadmap_ux.md` — Dirección visual oficial, mockups de referencia, sistema de colores y evolución UX distribuida por etapas.

Documentación QA:

```txt
docs/qa/
```

Documentos relevantes:

```txt
01_checklist_etapa_5_cierre.md
02_pruebas_manual_mvp.md
```

Documentación técnica:

```txt
docs/technical/
```

Documentos relevantes:

```txt
00_estructura_actual_detectada.md
01_estructura_recomendada_repo.md
02_mapa_archivos_actuales.md
03_funciones_backend_actuales.md
```

---

## Dirección visual oficial

La dirección visual del producto queda consolidada en:

```txt
docs/product/07_direccion_visual_y_roadmap_ux.md
```

Este documento define:

- Los mockups aprobados como referencia del producto.
- El sistema visual y la paleta inicial.
- Las reglas para fondos, superficies, bordes, sombras, nodos e inputs.
- Qué elementos visuales se implementan en Etapa 7.
- Qué funcionalidades pasan a Etapa 7.1, Etapa 7.2 y etapas posteriores.
- La evolución planificada para edición avanzada, fotos, colaboración, mobile, exportación e IA.

Regla de implementación:

> Los mockups representan la dirección objetivo del producto, pero cada elemento debe incorporarse en la etapa correspondiente sin ampliar innecesariamente el alcance del MVP.

---

## Checklist de cierre de Etapa 7

La Etapa 7 se puede cerrar cuando:

- [ ] `/tree` prioriza visualmente el árbol.
- [ ] El panel lateral funciona como apoyo.
- [ ] El panel ya no se siente como herramienta técnica.
- [ ] Se muestra claramente la persona seleccionada.
- [ ] El usuario puede agregar padre desde el panel.
- [ ] El usuario puede agregar madre desde el panel.
- [ ] El usuario puede agregar pareja desde el panel.
- [ ] El usuario puede agregar hijo/a desde el panel.
- [ ] Los formularios son claros y simples.
- [ ] Hay estado vacío útil para árbol inicial.
- [ ] Hay mensajes de éxito claros.
- [ ] Hay mensajes de error comprensibles.
- [ ] El árbol se ve claro con root + padre + madre.
- [ ] El árbol se ve claro con pareja + hijo/a.
- [ ] El árbol soporta segunda pareja básica sin romperse.
- [ ] Nodos y conectores no se pisan en casos normales.
- [ ] Zoom/pan básico se mantiene funcional.
- [ ] El árbol carga centrado o razonablemente visible.
- [ ] README queda actualizado al estado real.
- [ ] Build frontend pasa.
- [ ] Build functions pasa.
- [ ] Tests E2E locales existentes siguen pasando o se actualizan correctamente.
- [ ] No se agregan fotos, invitaciones, roles ni funciones fuera de alcance.

---

## Nota de producto

Tree Family debe avanzar con control de alcance.

La prioridad actual no es agregar más funciones, sino hacer que la experiencia existente se sienta clara, confiable y lista para un usuario real.

Principio rector:

> Primero un árbol simple, privado y entendible. Después fotos, colaboración, invitaciones y experiencias visuales avanzadas.

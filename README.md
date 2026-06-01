# Tree Family / Árbol Genealógico

Aplicación web para crear, visualizar y preservar un árbol familiar privado de forma simple, clara y emocionalmente significativa.

El objetivo del proyecto no es solo construir una demo técnica, sino desarrollar un producto real donde una persona pueda empezar su árbol familiar desde sí misma, agregar familiares cercanos y entender visualmente cómo están conectados.

---

## Estado actual del proyecto

**Etapa actual:** Etapa 5 completada funcionalmente  
**Último hito:** Flujo real de usuario nuevo + autenticación + árbol privado + acciones familiares básicas

### Validación manual completada

- Usuario nuevo crea cuenta.
- Usuario crea perfil personal.
- Usuario entra a `/tree`.
- Usuario agrega padre.
- Usuario agrega madre.
- Usuario conecta padre y madre como pareja.
- Usuario cierra sesión.
- Usuario inicia sesión otra vez.
- El árbol y la unión persisten.
- No permite crear cuenta con el mismo email.
- No aparece el bug de `Persona no encontrada`.

---

## Visión del producto

Tree Family busca ayudar a las personas a construir y conservar la historia de su familia mediante una experiencia:

- Fácil de usar.
- Privada por defecto.
- Visualmente clara.
- Emocionalmente significativa.
- Pensada para usuarios comunes, no solo técnicos.
- Escalable para futuras funciones como fotos, invitaciones, colaboración y memorias familiares.

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
- Crear unión entre padre y madre cuando el usuario lo confirma.
- Cierre de sesión.
- Persistencia de árbol después de volver a iniciar sesión.

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

---

## Stack tecnológico

### Frontend

- React
- Vite
- TypeScript
- Tailwind CSS
- Zustand
- D3 / lógica de visualización del árbol

### Backend / Infraestructura

- Firebase Authentication
- Firestore
- Firebase Cloud Functions
- Firebase Emulator Suite

### Calidad / Herramientas

- ESLint / TypeScript
- Playwright
- Scripts de validación y seed local

---

## Estructura principal del repositorio

```txt
treeFamily/
  docs/
    product/
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
npm run dev -w packages/frontend
```

### Build frontend

```bash
npm run build -w packages/frontend
```

### Build functions

```bash
npm run build -w packages/functions
```

### Ejecutar tests

```bash
npm test
```

> Nota: los comandos pueden variar según scripts actuales del `package.json`.

---

## Firebase Emulator Suite

Este proyecto usa Firebase Emulator Suite para desarrollo local.

Archivos locales como exports del emulador, logs o datos temporales no deberían formar parte del código fuente principal.

Se recomienda ignorar:

```gitignore
firebase-export-*/
firestore-debug.log
```

La carpeta `.firebase-seed/` debe tratarse como dato local o seed controlado. Si contiene datos generados por pruebas locales, no debería versionarse.

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

## Decisiones importantes del MVP

- El producto es privado primero.
- El usuario principal crea su propio árbol.
- Cada árbol tiene un único dueño en MVP.
- Una persona pertenece a un solo árbol.
- El árbol puede empezar solo con la persona raíz.
- La app guía al usuario a agregar dos familiares, pero no lo bloquea.
- La fecha de nacimiento es obligatoria para la persona raíz.
- La fecha de nacimiento es opcional para familiares.
- Padre y madre no se conectan automáticamente como pareja.
- La app pregunta si el usuario desea conectar padre y madre como pareja.
- No se implementa divorcio/separación avanzada en MVP.

---

## Próximos pasos recomendados

### Etapa 5 - Cierre formal

- Limpiar archivos locales del emulador que no deberían estar versionados.
- Confirmar que `.firebase-seed/` no se siga modificando en futuros commits si no será parte del código fuente.
- Crear tag estable de Etapa 5.

### Etapa 6 - Tests y CI local

- Pruebas de flujo auth.
- Pruebas de creación de árbol.
- Pruebas de relaciones familiares.
- Pruebas de permisos por owner.
- Pruebas de persistencia después de login/logout.
- Preparar GitHub Actions si corresponde.

### Etapa 7 - UX, render y performance

- Mejorar visualización del árbol.
- Mejorar diseño responsive.
- Mejorar experiencia del panel lateral.
- Optimizar layout del árbol.
- Pulir estados de carga, vacío y error.

---

## Estado de producto

El producto ya cuenta con una base funcional para el MVP:

```txt
Autenticación real
+ árbol privado
+ persona raíz
+ acciones familiares básicas
+ visualización inicial
+ persistencia
```

El siguiente objetivo es estabilizar con pruebas y preparar una base más sólida para futuras mejoras de UX y escalabilidad.

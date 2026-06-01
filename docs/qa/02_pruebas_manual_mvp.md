# 02 - Pruebas manuales MVP

## Proyecto

**Nombre:** Tree Family / Árbol Genealógico  
**Documento:** Pruebas manuales MVP  
**Etapa relacionada:** Etapa 6 - Tests y CI local  
**Objetivo:** Definir casos manuales para validar que el flujo MVP no se rompa antes de automatizar pruebas.

---

## 1. Objetivo del documento

Este documento define pruebas manuales para validar el MVP actual antes de avanzar con tests automáticos.

Estas pruebas sirven para:

- Confirmar que el flujo principal sigue funcionando.
- Detectar regresiones después de cambios.
- Guiar la creación de tests E2E.
- Documentar comportamiento esperado para QA.
- Evitar que nuevas funcionalidades rompan Etapa 5.

---

## 2. Alcance de pruebas

Las pruebas cubren:

- Registro.
- Login.
- Creación de perfil.
- Creación de árbol privado.
- Detección de árbol existente.
- Visualización inicial.
- Agregar padre.
- Agregar madre.
- Conectar padre y madre como pareja.
- Agregar pareja.
- Agregar hijo/a.
- Logout/login.
- Persistencia.
- Errores básicos.
- Casos de protección contra duplicados.

---

## 3. Preparación antes de probar

### 3.1 Requisitos

- Proyecto corriendo localmente.
- Firebase Emulator Suite activo.
- Frontend activo.
- Functions compiladas o disponibles en emulador.
- Navegador limpio o sesión cerrada.

### 3.2 Comandos base recomendados

Build frontend:

```bash
npm run build -w packages/frontend
```

Build functions:

```bash
npm run build -w packages/functions
```

Ejecutar desarrollo:

```bash
npm run dev
```

> Ajustar el comando si el `package.json` del proyecto usa otro script para frontend + emuladores.

### 3.3 Datos recomendados de prueba

Usar emails únicos por prueba:

```txt
test.stage6.001@example.com
test.stage6.002@example.com
test.stage6.003@example.com
```

Evitar cuentas personales reales en el emulador.

---

## 4. Casos de prueba manuales

### Caso 1 - Signup con email nuevo

**Objetivo:** validar que un usuario nuevo puede crear cuenta.

**Precondiciones:**

- El email no existe en Firebase Auth.
- Usuario no está autenticado.

**Pasos:**

1. Ir a `/signup`.
2. Ingresar email nuevo.
3. Ingresar contraseña.
4. Confirmar contraseña.
5. Hacer clic en `Crear cuenta`.

**Resultado esperado:**

- La cuenta se crea correctamente.
- El usuario es enviado a `/create-profile`.
- No se crea árbol todavía hasta completar perfil.

---

### Caso 2 - Signup con email ya registrado

**Objetivo:** validar que no se permite crear una cuenta duplicada.

**Precondiciones:**

- Ya existe una cuenta con el email de prueba.

**Pasos:**

1. Ir a `/signup`.
2. Ingresar email ya registrado.
3. Ingresar contraseña.
4. Confirmar contraseña.
5. Hacer clic en `Crear cuenta`.

**Resultado esperado:**

La app muestra:

```txt
Ya existe una cuenta con este correo. Inicia sesión.
```

Además:

- No se crea otro usuario.
- No se crea otro árbol.
- El usuario puede ir a login.

---

### Caso 3 - Login con usuario existente

**Objetivo:** validar que un usuario existente puede iniciar sesión.

**Precondiciones:**

- Existe una cuenta creada.
- El usuario tiene árbol creado.

**Pasos:**

1. Ir a `/login`.
2. Ingresar email existente.
3. Ingresar contraseña correcta.
4. Hacer clic en `Iniciar sesión`.

**Resultado esperado:**

- Login exitoso.
- Se ejecuta verificación de árbol existente.
- Si tiene árbol, entra directamente a `/tree`.
- No muestra `/create-profile`.

---

### Caso 4 - Login con contraseña incorrecta

**Objetivo:** validar mensaje de error al usar credenciales incorrectas.

**Pasos:**

1. Ir a `/login`.
2. Ingresar email existente.
3. Ingresar contraseña incorrecta.
4. Hacer clic en `Iniciar sesión`.

**Resultado esperado:**

- La app muestra `Correo o contraseña incorrectos.`
- No entra a `/tree`.
- No crea cuenta nueva.
- No crea árbol nuevo.

---

### Caso 5 - Crear perfil personal

**Objetivo:** validar creación de persona raíz y árbol privado.

**Precondiciones:**

- Usuario autenticado.
- Usuario no tiene árbol.
- Usuario está en `/create-profile`.

**Pasos:**

1. Ingresar nombre.
2. Ingresar apellido.
3. Ingresar fecha de nacimiento.
4. Opcional: ingresar segundo nombre, segundo apellido o lugar de nacimiento.
5. Hacer clic en `Crear mi árbol`.

**Resultado esperado:**

- Se crea árbol privado.
- Se crea persona raíz.
- El árbol queda asociado al usuario autenticado.
- El usuario es enviado a `/tree`.

---

### Caso 6 - Crear perfil sin fecha de nacimiento

**Objetivo:** validar que fecha de nacimiento es obligatoria para persona raíz.

**Pasos:**

1. Ingresar nombre.
2. Ingresar apellido.
3. Dejar fecha de nacimiento vacía.
4. Hacer clic en `Crear mi árbol`.

**Resultado esperado:**

- No se crea árbol.
- No se crea persona raíz.
- La app muestra error claro indicando que falta fecha de nacimiento.

---

### Caso 7 - Ver árbol con solo persona raíz

**Objetivo:** validar que el árbol funciona aunque solo exista el usuario.

**Pasos:**

1. Ir a `/tree`.

**Resultado esperado:**

- Se muestra la persona raíz.
- Se muestra guía inicial.
- Se muestran acciones rápidas:
  - Agregar padre.
  - Agregar madre.
  - Agregar pareja.
  - Agregar hijo/a.
- No hay pantalla vacía.
- No hay error visual.

---

### Caso 8 - Agregar padre

**Objetivo:** validar creación de padre.

**Pasos:**

1. Hacer clic en `Agregar padre`.
2. Ingresar nombre del padre.
3. Ingresar apellido.
4. Dejar fecha de nacimiento vacía.
5. Dejar lugar de nacimiento vacío.
6. Guardar.

**Resultado esperado:**

- Padre se crea correctamente.
- Fecha de nacimiento no es obligatoria.
- Lugar de nacimiento no es obligatorio.
- Padre aparece conectado en el árbol.

---

### Caso 9 - Agregar madre

**Objetivo:** validar creación de madre.

**Pasos:**

1. Hacer clic en `Agregar madre`.
2. Ingresar nombre de la madre.
3. Ingresar apellido.
4. Dejar fecha de nacimiento vacía.
5. Dejar lugar de nacimiento vacío.
6. Guardar.

**Resultado esperado:**

- Madre se crea correctamente.
- Fecha de nacimiento no es obligatoria.
- Lugar de nacimiento no es obligatorio.
- Madre aparece conectada en el árbol.
- Si ya existe padre, puede aparecer sugerencia para conectar padres.

---

### Caso 10 - Sugerencia para conectar padre y madre

**Objetivo:** validar que la app sugiere conectar padre y madre cuando ambos existen.

**Precondiciones:**

- Persona seleccionada tiene padre.
- Persona seleccionada tiene madre.
- Padre y madre no están conectados como pareja.
- Ambos nombres pueden resolverse.

**Pasos:**

1. Agregar padre.
2. Agregar madre.
3. Observar panel lateral.

**Resultado esperado:**

La app muestra sugerencia similar a:

```txt
Ya agregaste padre y madre para [Persona].

¿Quieres conectar a [Padre] y [Madre] como pareja para que el árbol se vea más completo?
```

Además:

- Se muestran ambos nombres correctamente.
- No aparece `Persona no encontrada`.
- Se muestran botones:
  - `Conectarlos`
  - `No por ahora`

---

### Caso 11 - Conectar padre y madre como pareja

**Objetivo:** validar creación de unión entre padre y madre.

**Pasos:**

1. Hacer clic en `Conectarlos`.

**Resultado esperado:**

- Se crea unión entre padre y madre.
- La visualización se actualiza.
- La sugerencia desaparece o queda resuelta.
- No se crea una persona duplicada.
- No se crea unión duplicada.

---

### Caso 12 - Rechazar conexión padre/madre por ahora

**Objetivo:** validar que el usuario puede decidir no conectar padre y madre.

**Pasos:**

1. Hacer clic en `No por ahora`.

**Resultado esperado:**

- No se crea unión.
- Padre y madre siguen existiendo.
- No se borran relaciones.
- La app no fuerza la conexión.
- El usuario puede continuar usando el árbol.

---

### Caso 13 - Agregar pareja

**Objetivo:** validar creación de pareja para una persona seleccionada.

**Pasos:**

1. Hacer clic en `Agregar pareja`.
2. Ingresar nombre.
3. Ingresar apellido.
4. Dejar fecha de nacimiento vacía.
5. Guardar.

**Resultado esperado:**

- Se crea la persona pareja.
- Se crea unión con la persona seleccionada.
- La pareja aparece visualmente conectada.
- No se requiere fecha de nacimiento.

---

### Caso 14 - Agregar hijo/a sin pareja

**Objetivo:** validar que se puede agregar hijo/a aunque no exista pareja.

**Pasos:**

1. Hacer clic en `Agregar hijo/a`.
2. Ingresar nombre.
3. Ingresar apellido.
4. Dejar fecha de nacimiento vacía.
5. Guardar.

**Resultado esperado:**

- Se crea hijo/a.
- Se conecta como descendiente de la persona seleccionada.
- No se obliga a crear pareja.
- No se requiere fecha de nacimiento.

---

### Caso 15 - Agregar hijo/a con pareja existente

**Objetivo:** validar que hijo/a puede conectarse a una unión existente.

**Precondiciones:**

- Persona seleccionada tiene una pareja/unión.

**Pasos:**

1. Hacer clic en `Agregar hijo/a`.
2. Ingresar datos mínimos.
3. Guardar.

**Resultado esperado:**

- Se crea hijo/a.
- Se conecta a la unión correcta.
- Se visualiza como descendiente de esa relación.
- No se requiere fecha de nacimiento.

---

### Caso 16 - Logout y persistencia

**Objetivo:** validar que los datos persisten después de cerrar sesión.

**Precondiciones:**

- Usuario tiene árbol con al menos padre, madre y unión creada.

**Pasos:**

1. Hacer clic en cerrar sesión.
2. Confirmar que sale de `/tree`.
3. Ir a `/login`.
4. Iniciar sesión con el mismo email.
5. Entrar a `/tree`.

**Resultado esperado:**

- El usuario entra a su árbol existente.
- No ve `/create-profile`.
- Padre, madre y unión siguen existiendo.
- No se crea árbol nuevo.

---

### Caso 17 - Usuario no autenticado intenta entrar a `/tree`

**Objetivo:** validar protección de ruta privada.

**Precondiciones:**

- No hay sesión activa.

**Pasos:**

1. Ir manualmente a `/tree`.

**Resultado esperado:**

- No se muestran datos privados.
- La app redirige a `/login` o muestra acceso requerido.
- No hay error técnico visible.

---

### Caso 18 - Usuario con cuenta pero sin árbol

**Objetivo:** validar que un usuario autenticado sin árbol va a crear perfil.

**Precondiciones:**

- Usuario autenticado.
- No existe árbol asociado al owner.

**Pasos:**

1. Iniciar sesión.
2. Esperar redirección.

**Resultado esperado:**

- La app ejecuta verificación de árbol.
- No encuentra árbol.
- Redirige a `/create-profile`.

---

### Caso 19 - No duplicar árbol por owner

**Objetivo:** validar protección contra duplicar árbol.

**Precondiciones:**

- Usuario ya tiene árbol.
- Usuario autenticado.

**Pasos:**

1. Intentar acceder manualmente a `/create-profile`.
2. Intentar crear árbol otra vez si la UI lo permite.

**Resultado esperado:**

- La app redirige a `/tree` si ya existe árbol.
- Backend rechaza creación duplicada.
- No se crea segundo árbol para el mismo owner.

---

### Caso 20 - Validar que no aparezca `Persona no encontrada`

**Objetivo:** validar corrección del bug visual de sugerencia padre/madre.

**Pasos:**

1. Agregar padre.
2. Agregar madre.
3. Observar sugerencia.
4. Cerrar sesión.
5. Iniciar sesión.
6. Volver a revisar árbol.

**Resultado esperado:**

- Nunca aparece `Persona no encontrada`.
- Si no se pueden resolver ambos nombres, la sugerencia no aparece.
- Si se muestran los nombres, ambos son correctos.

---

## 5. Matriz rápida de regresión antes de cada commit importante

Antes de hacer commit en cambios que afecten auth, tree o relaciones, ejecutar al menos:

| Caso | Obligatorio |
|---|:---:|
| Signup nuevo | Sí |
| Login existente | Sí |
| Crear perfil | Sí |
| Ver `/tree` | Sí |
| Agregar padre | Sí |
| Agregar madre | Sí |
| Conectar padre/madre | Sí |
| Logout/login | Sí |
| Persistencia de árbol | Sí |
| Signup email repetido | Sí |
| Verificar que no aparece `Persona no encontrada` | Sí |

---

## 6. Criterios para pasar a tests automáticos

Después de documentar y validar manualmente, se puede iniciar automatización con Playwright.

Prioridad de automatización:

1. Signup nuevo.
2. Signup con email repetido.
3. Login existente.
4. Crear perfil.
5. Ver root en `/tree`.
6. Agregar padre/madre.
7. Conectar padre/madre.
8. Logout/login y persistencia.

---

## 7. Observaciones PM/PO

Estas pruebas manuales deben mantenerse vivas.

Cada vez que se agregue una función importante al MVP, se debe decidir si:

- Se agrega un nuevo caso.
- Se modifica un caso existente.
- Se mueve una prueba a automatización.

La prioridad de Etapa 6 es proteger el flujo real que ya funciona, no ampliar todavía el producto.

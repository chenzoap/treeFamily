# 05 - Documento de flujo MVP v1

## Proyecto

**Nombre:** Tree Family / Árbol Genealógico  
**Documento:** Flujo MVP v1  
**Área:** Producto / UX / Requerimientos funcionales  
**Etapa relacionada:** Etapa 5 - Flujo real usuario nuevo + árbol mínimo sugerido  
**Estado:** Versión inicial lista para implementación  
**Responsable de producto:** PM/PO

---

## 1. Objetivo del documento

Este documento define el flujo funcional principal del MVP v1 para convertir la base técnica existente en una experiencia real de usuario.

El objetivo no es rediseñar todo el producto ni agregar funcionalidades avanzadas. El objetivo es definir con claridad cómo debe comportarse la app desde que un usuario entra por primera vez hasta que crea su árbol familiar privado y empieza a agregar familiares directos.

---

## 2. Objetivo del MVP v1

Permitir que un usuario pueda:

1. Entrar a la aplicación.
2. Registrarse o iniciar sesión.
3. Crear su perfil personal.
4. Crear automáticamente su árbol privado.
5. Ver su árbol aunque solo exista él/ella.
6. Recibir guía para agregar familiares.
7. Agregar padre, madre, pareja e hijo/a.
8. Visualizar relaciones familiares básicas.
9. Corregir datos básicos.
10. Desvincular relaciones sin borrar datos importantes accidentalmente.

---

## 3. Principios de producto para este flujo

### 3.1 Simplicidad primero

El usuario no debe pensar en:

- IDs.
- Colecciones.
- Documentos.
- Uniones técnicas.
- Relaciones internas.
- Estado DEV.
- Estructura de base de datos.

El usuario debe pensar en:

- Mi árbol.
- Mi familia.
- Agregar padre.
- Agregar madre.
- Agregar pareja.
- Agregar hijo/a.
- Editar información.
- Quitar relación.

### 3.2 El árbol puede empezar solo con el usuario

El MVP no debe bloquear al usuario obligándolo a crear tres personas desde el inicio.

Decisión vigente:

```txt
El usuario puede empezar solo.
La app debe guiarlo a completar al menos 2 familiares conectados.
```

### 3.3 Flujo práctico, experiencia emocional

El flujo debe ser directo y funcional, pero los textos deben sentirse humanos.

Ejemplo:

```txt
Tu árbol familiar ya empezó contigo.
Agrega familiares cercanos para empezar a darle forma a tu historia.
```

### 3.4 Privacidad por defecto

Todo árbol creado en MVP debe ser privado por defecto.

En MVP:

- Solo el owner puede ver el árbol.
- Solo el owner puede editar el árbol.
- No hay invitados.
- No hay roles.
- No hay árbol público.

### 3.5 No cerrar puertas técnicas

Aunque el MVP sea simple, debe permitir después:

- Segunda pareja.
- Hijos de diferentes relaciones.
- Invitaciones.
- Roles.
- Fotos.
- Biografías.
- Exportaciones.

Pero nada de eso debe complicar el flujo inicial.

---

## 4. Actores principales

### 4.1 Usuario nuevo

Persona que entra por primera vez y todavía no tiene árbol.

Necesita:

- Entender qué hacer.
- Crear su perfil.
- Ver su primer árbol sin confusión.
- Agregar familiares fácilmente.

### 4.2 Usuario existente con árbol

Persona que ya creó su árbol anteriormente.

Necesita:

- Entrar directamente al árbol.
- Continuar editando o agregando familiares.
- No repetir onboarding innecesariamente.

### 4.3 Usuario no autenticado

Persona que abre la app sin sesión activa.

Necesita:

- Ver claramente opciones de entrar o registrarse.
- No acceder a datos privados.

---

## 5. Estados principales del usuario

| Estado                                | Descripción                          | Pantalla esperada               |
| ------------------------------------- | ------------------------------------ | ------------------------------- |
| No autenticado                        | No hay sesión activa                 | Login / Signup                  |
| Autenticado sin árbol                 | Tiene cuenta, pero no tiene árbol    | Crear perfil personal           |
| Autenticado con árbol y solo root     | Tiene árbol con persona raíz         | TreeView con guía inicial       |
| Autenticado con árbol incompleto      | Tiene root + 1 familiar              | TreeView con progreso pendiente |
| Autenticado con árbol mínimo sugerido | Tiene root + 2 familiares conectados | TreeView normal                 |
| Error de permisos                     | Intenta acceder a árbol ajeno        | Mensaje de acceso denegado      |
| Error de carga                        | No se pudo cargar árbol              | Mensaje de error recuperable    |

---

## 6. Flujo general del MVP v1

```txt
Usuario abre la app
        |
        v
¿Está autenticado?
        |
   No   |   Sí
   v    |    v
Login / Signup     ¿Tiene árbol?
                    |
               No   |   Sí
               v    |    v
        Crear perfil personal     Cargar árbol
               |
               v
        Crear árbol privado + root
               |
               v
        Ir a pantalla del árbol
               |
               v
        Mostrar árbol con root
               |
               v
        Guiar para agregar familiares
```

---

# 7. Flujo 1 - Entrada a la app

## Objetivo

Determinar si el usuario debe ir a autenticación, creación de perfil o árbol.

## Precondiciones

- La app está cargando.
- Firebase está inicializado.
- Se puede conocer el estado de autenticación.

## Paso a paso

| Paso | Qué ve el usuario                       | Acción del sistema            |
| ---- | --------------------------------------- | ----------------------------- |
| 1    | Pantalla de carga breve                 | App revisa sesión activa      |
| 2    | Si no hay sesión, muestra login/signup  | Redirige a autenticación      |
| 3    | Si hay sesión, revisa si tiene árbol    | Consulta árbol por `ownerUid` |
| 4    | Si no tiene árbol, muestra crear perfil | Redirige a onboarding         |
| 5    | Si tiene árbol, muestra árbol           | Carga datos del árbol         |

## Resultado esperado

El usuario siempre termina en uno de estos destinos:

- Login / Signup.
- Crear perfil personal.
- Pantalla del árbol.

Nunca debe quedar en una pantalla vacía sin explicación.

## Errores posibles

| Error                       | Respuesta esperada                                               |
| --------------------------- | ---------------------------------------------------------------- |
| Firebase no responde        | Mostrar mensaje: "No pudimos cargar la app. Intenta nuevamente." |
| Sesión expirada             | Enviar a login.                                                  |
| No se puede verificar árbol | Mostrar error recuperable con botón "Reintentar".                |

## Criterios de aceptación

- Si no hay usuario autenticado, no se cargan datos privados.
- Si hay usuario autenticado sin árbol, se muestra creación de perfil.
- Si hay usuario autenticado con árbol, se muestra `/tree`.
- El usuario nunca ve IDs técnicos ni errores crudos del backend.

---

# 8. Flujo 2 - Registro / Login

## Objetivo

Permitir que el usuario acceda a la app de forma segura.

## Alcance MVP

Para MVP, el producto puede soportar técnicamente el método de autenticación actual, pero la experiencia debe quedar preparada para login/sign up real.

Opciones aceptables para implementación inicial:

- Email/password.
- Flujo temporal en emulador mientras se desarrolla.
- Auth anónimo solo si está claramente limitado a DEV.

## Qué ve el usuario

Pantalla simple con:

```txt
Bienvenido a Tree Family

Empieza a construir tu árbol familiar privado y conserva la historia de tu familia.

[Crear cuenta]
[Iniciar sesión]
```

## Reglas de producto

- El usuario no puede ver árboles sin autenticarse.
- El usuario no debe ver controles DEV.
- Si el auth anónimo se mantiene temporalmente, debe estar aislado de producción.
- Después de autenticarse, la app debe revisar si ya existe árbol.

## Errores posibles

| Error               | Respuesta esperada                               |
| ------------------- | ------------------------------------------------ |
| Email inválido      | "Revisa tu correo electrónico."                  |
| Contraseña inválida | "La contraseña no cumple los requisitos."        |
| Cuenta no existe    | "No encontramos una cuenta con esos datos."      |
| Error de red        | "No pudimos iniciar sesión. Intenta nuevamente." |

## Criterios de aceptación

- El usuario puede autenticarse.
- Después de autenticarse, se verifica si tiene árbol.
- No se crea un árbol duplicado si ya existe.
- El usuario no ve herramientas DEV.

---

# 9. Flujo 3 - Detección de árbol existente

## Objetivo

Evitar que un usuario con árbol existente repita el onboarding.

## Regla principal

Cada usuario tiene un árbol principal en MVP.

```txt
1 usuario autenticado → 1 árbol privado principal
```

## Paso a paso

| Paso | Acción del sistema                                                                    |
| ---- | ------------------------------------------------------------------------------------- |
| 1    | Obtener `uid` del usuario autenticado                                                 |
| 2    | Buscar árbol donde `ownerUid == uid`                                                  |
| 3    | Si existe, cargar árbol                                                               |
| 4    | Si no existe, enviar a crear perfil                                                   |
| 5    | Si hay más de uno por error, usar el más reciente o mostrar error controlado para DEV |

## Criterios de aceptación

- Usuario con árbol va directo a `/tree`.
- Usuario sin árbol va a crear perfil.
- No se crean árboles duplicados por recargar la página.
- La búsqueda respeta ownership.

---

# 10. Flujo 4 - Crear perfil personal

## Objetivo

Crear la persona raíz del árbol.

## Qué ve el usuario

Pantalla de perfil inicial:

```txt
Empecemos contigo

Tu árbol familiar comienza con tu información básica.
Luego podrás agregar a tus familiares.

[Formulario]
```

## Campos del formulario

| Campo               | Requerido   | Nota                                   |
| ------------------- | -----------:| -------------------------------------- |
| Primer nombre       | Sí          | Campo mínimo de identidad              |
| Apellido            | Sí          | Puede ser apellido paterno o principal |
| Fecha de nacimiento | Sí          | Obligatoria solo para usuario raíz     |
| Segundo nombre      | No          | Opcional                               |
| Apellido materno    | No          | Opcional                               |
| Lugar de nacimiento | No          | Opcional                               |
| Género/sexo         | No para MVP | Evitar si no es necesario              |
| Foto                | No MVP      | Fase futura                            |
| Biografía           | No MVP      | Fase futura                            |

## Acción principal

Botón:

```txt
Crear mi árbol
```

## Reglas de producto

- La fecha de nacimiento es obligatoria para la persona raíz.
- Esta regla no aplica a familiares.
- Al guardar, se debe crear:
  - árbol privado.
  - persona raíz.
  - vínculo owner-tree.
  - `rootPersonId`.
- El usuario no debe tener que elegir estructura técnica.

## Resultado exitoso

Después de guardar:

```txt
Tu árbol familiar ya empezó contigo.
```

Luego redirigir a:

```txt
/tree
```

## Errores posibles

| Error                  | Respuesta esperada                                     |
| ---------------------- | ------------------------------------------------------ |
| Falta primer nombre    | "Ingresa tu nombre."                                   |
| Falta apellido         | "Ingresa tu apellido."                                 |
| Falta fecha nacimiento | "Ingresa tu fecha de nacimiento para crear tu perfil." |
| Fecha inválida         | "Revisa la fecha de nacimiento."                       |
| Ya existe árbol        | Redirigir a `/tree`, no crear duplicado.               |
| Error backend          | "No pudimos crear tu árbol. Intenta nuevamente."       |

## Criterios de aceptación

- No se puede crear persona raíz sin fecha de nacimiento.
- Se crea un árbol privado.
- Se crea una persona raíz.
- El árbol queda asociado al usuario autenticado.
- El usuario es enviado a `/tree`.
- No se crean duplicados si el usuario reintenta.

---

# 11. Flujo 5 - Crear árbol privado

## Objetivo

Crear la estructura mínima técnica del árbol.

## Acción técnica recomendada

Usar la función existente o equivalente:

```txt
createTreeWithRootPerson
```

## Datos mínimos del árbol

| Campo          | Descripción            |
| -------------- | ---------------------- |
| `treeId`       | ID del árbol           |
| `ownerUid`     | UID del usuario dueño  |
| `rootPersonId` | Persona raíz           |
| `visibility`   | Privado                |
| `createdAt`    | Fecha de creación      |
| `updatedAt`    | Fecha de actualización |

## Datos mínimos de persona raíz

| Campo        | Descripción            |
| ------------ | ---------------------- |
| `personId`   | ID de persona          |
| `treeId`     | Árbol al que pertenece |
| `firstName`  | Nombre                 |
| `lastName`   | Apellido               |
| `birthDate`  | Fecha obligatoria      |
| `birthPlace` | Opcional               |
| `createdAt`  | Fecha de creación      |
| `updatedAt`  | Fecha de actualización |

## Reglas backend

La función debe validar:

- Usuario autenticado.
- Datos requeridos.
- Que el usuario no tenga ya un árbol activo.
- Crear árbol y root de forma consistente.
- Retornar `treeId` y `rootPersonId`.

## Criterios de aceptación

- La creación es atómica o consistente.
- Si falla una parte, no queda árbol corrupto.
- Retorna datos necesarios para cargar `/tree`.
- El árbol queda privado por defecto.

---

# 12. Flujo 6 - Pantalla del árbol con solo usuario raíz

## Objetivo

Evitar pantalla vacía y guiar al usuario a construir su árbol.

## Qué ve el usuario

Debe ver:

1. Header de la app.
2. Nodo de su persona.
3. Panel lateral o área de acciones.
4. Mensaje de guía.
5. Botones rápidos.

## Mensaje sugerido

```txt
Tu árbol familiar ya empezó contigo.

Agrega familiares cercanos para empezar a darle forma a tu historia.
```

## Botones principales

- Agregar padre.
- Agregar madre.
- Agregar pareja.
- Agregar hijo/a.

## Regla de árbol mínimo sugerido

Si el árbol tiene solo root:

```txt
Progreso: 0 de 2 familiares sugeridos
```

Si tiene root + 1 familiar conectado:

```txt
Progreso: 1 de 2 familiares sugeridos
```

Si tiene root + 2 familiares conectados:

```txt
Tu árbol inicial ya tomó forma
```

## Criterios de aceptación

- El árbol renderiza con una sola persona.
- No hay error por falta de relaciones.
- El usuario ve un siguiente paso claro.
- No se obliga a crear familiares.
- Los botones rápidos están visibles.

---

# 13. Flujo 7 - Seleccionar persona en el árbol

## Objetivo

Permitir que el usuario realice acciones sobre una persona específica.

## Qué ve el usuario

Al seleccionar un nodo:

```txt
Persona seleccionada:
Fernando Aragon

Acciones:
[Agregar padre]
[Agregar madre]
[Agregar pareja]
[Agregar hijo/a]
[Editar información]
```

## Reglas

- Si no hay persona seleccionada, usar persona raíz por defecto.
- El panel debe indicar claramente sobre quién se realizará la acción.
- No mostrar IDs técnicos.
- No permitir acciones si el árbol no está cargado.

## Criterios de aceptación

- Al hacer clic en un nodo, el panel actualiza la persona seleccionada.
- Las acciones se aplican a la persona correcta.
- Si se recarga la página, puede volver a root como selección por defecto.

---

# 14. Flujo 8 - Agregar padre

## Objetivo

Permitir agregar el padre de una persona seleccionada.

## Entrada del flujo

Usuario hace clic en:

```txt
Agregar padre
```

## Formulario

| Campo            | Requerido      | Nota                                                    |
| ---------------- | --------------:| ------------------------------------------------------- |
| Primer nombre    | Sí             | Mínimo requerido                                        |
| Apellido         | Sí/Recomendado | Recomendado mantener requerido en MVP para consistencia |
| Fecha nacimiento | No             | Opcional para familiares                                |
| Lugar nacimiento | No             | Opcional                                                |
| Fallecido/a      | No             | Puede diferirse                                         |

## Qué espera el usuario

Que la persona se agregue arriba de la persona seleccionada como padre.

## Acción técnica

Usar función:

```txt
addParentToPerson
```

Con parámetro conceptual:

```txt
parentRole = "father"
```

## Reglas de producto

- Fecha nacimiento no debe bloquear.
- Lugar nacimiento no debe bloquear.
- Debe conectarse al hijo/persona seleccionada.
- Si ya existe padre, la app debe advertir antes de reemplazar o impedir duplicado.

## Errores posibles

| Error             | Respuesta esperada                                 |
| ----------------- | -------------------------------------------------- |
| Falta nombre      | "Ingresa el nombre del padre."                     |
| Ya existe padre   | "Esta persona ya tiene un padre registrado."       |
| Error de permisos | "No tienes permiso para editar este árbol."        |
| Error backend     | "No pudimos agregar el padre. Intenta nuevamente." |

## Criterios de aceptación

- Se puede agregar padre sin fecha nacimiento.
- Se puede agregar padre sin lugar nacimiento.
- El nuevo padre aparece en el árbol.
- La relación padre-hijo queda guardada.
- No se duplica padre accidentalmente.

---

# 15. Flujo 9 - Agregar madre

## Objetivo

Permitir agregar la madre de una persona seleccionada.

## Entrada del flujo

Usuario hace clic en:

```txt
Agregar madre
```

## Formulario

| Campo            | Requerido      | Nota                                                    |
| ---------------- | --------------:| ------------------------------------------------------- |
| Primer nombre    | Sí             | Mínimo requerido                                        |
| Apellido         | Sí/Recomendado | Recomendado mantener requerido en MVP para consistencia |
| Fecha nacimiento | No             | Opcional para familiares                                |
| Lugar nacimiento | No             | Opcional                                                |
| Fallecido/a      | No             | Puede diferirse                                         |

## Acción técnica

Usar función:

```txt
addParentToPerson
```

Con parámetro conceptual:

```txt
parentRole = "mother"
```

## Reglas de producto

- Fecha nacimiento no debe bloquear.
- Lugar nacimiento no debe bloquear.
- Debe conectarse a la persona seleccionada.
- Si ya existe madre, la app debe advertir antes de reemplazar o impedir duplicado.

## Errores posibles

| Error             | Respuesta esperada                                 |
| ----------------- | -------------------------------------------------- |
| Falta nombre      | "Ingresa el nombre de la madre."                   |
| Ya existe madre   | "Esta persona ya tiene una madre registrada."      |
| Error de permisos | "No tienes permiso para editar este árbol."        |
| Error backend     | "No pudimos agregar la madre. Intenta nuevamente." |

## Criterios de aceptación

- Se puede agregar madre sin fecha nacimiento.
- Se puede agregar madre sin lugar nacimiento.
- La nueva madre aparece en el árbol.
- La relación madre-hijo queda guardada.
- No se duplica madre accidentalmente.

---

# 16. Flujo 10 - Agregar pareja

## Objetivo

Permitir agregar una pareja o unión familiar a una persona seleccionada.

## Entrada del flujo

Usuario hace clic en:

```txt
Agregar pareja
```

## Lenguaje de producto

Usar "pareja" en UI.

Evitar mostrar "unión" como concepto principal, aunque internamente se use `union`.

## Formulario

| Campo            | Requerido      | Nota                                  |
| ---------------- | --------------:| ------------------------------------- |
| Primer nombre    | Sí             | Mínimo requerido                      |
| Apellido         | Sí/Recomendado | Recomendado mantener requerido en MVP |
| Fecha nacimiento | No             | Opcional                              |
| Lugar nacimiento | No             | Opcional                              |
| Fallecido/a      | No             | Puede diferirse                       |

## Acción técnica

1. Crear persona pareja.
2. Crear unión entre persona seleccionada y nueva pareja.

Función recomendada:

```txt
createUnion
```

## Reglas de producto

- Una persona puede tener más de una pareja/unión.
- No preguntar en MVP si están casados, divorciados o separados.
- La unión representa una relación familiar relevante.
- La pareja debe pertenecer al mismo árbol.
- No se debe duplicar la misma pareja si ya existe.

## Errores posibles

| Error              | Respuesta esperada                                  |
| ------------------ | --------------------------------------------------- |
| Falta nombre       | "Ingresa el nombre de la pareja."                   |
| Relación duplicada | "Esta pareja ya está conectada en el árbol."        |
| Error de permisos  | "No tienes permiso para editar este árbol."         |
| Error backend      | "No pudimos agregar la pareja. Intenta nuevamente." |

## Criterios de aceptación

- Se puede agregar pareja sin fecha nacimiento.
- Se crea una persona nueva.
- Se crea una unión con la persona seleccionada.
- La pareja aparece visualmente conectada.
- Se permite más de una pareja en casos futuros.

---

# 17. Flujo 11 - Agregar hijo/a

## Objetivo

Permitir agregar hijo/a a una persona seleccionada.

## Entrada del flujo

Usuario hace clic en:

```txt
Agregar hijo/a
```

## Formulario

| Campo            | Requerido      | Nota                                  |
| ---------------- | --------------:| ------------------------------------- |
| Primer nombre    | Sí             | Mínimo requerido                      |
| Apellido         | Sí/Recomendado | Recomendado mantener requerido en MVP |
| Fecha nacimiento | No             | Opcional                              |
| Lugar nacimiento | No             | Opcional                              |
| Fallecido/a      | No             | Puede diferirse                       |

## Caso A - Persona sin pareja/unión

### Comportamiento

Permitir agregar hijo/a como hijo/a de la persona seleccionada.

Texto sugerido:

```txt
Se agregará como hijo/a de [Nombre].
Puedes conectar una pareja más adelante si lo necesitas.
```

### Acción técnica

Crear hijo/a conectado a la persona seleccionada sin unión completa, o mediante mecanismo existente para hijo de persona soltera si ya existe.

### Criterio de aceptación

- Se puede agregar hijo/a aunque no exista pareja.
- El árbol muestra descendencia correctamente.
- No se obliga a crear pareja.

## Caso B - Persona con una sola pareja/unión

### Comportamiento

La app puede asociar el hijo/a a esa unión de forma directa, mostrando confirmación simple.

Texto sugerido:

```txt
Se agregará como hijo/a de esta relación.
```

### Acción técnica

Usar:

```txt
addChildToUnion
```

### Criterio de aceptación

- El hijo/a queda conectado a la unión correcta.
- Se visualiza como descendiente de esa pareja.
- No se pide información innecesaria.

## Caso C - Persona con varias parejas/uniones

### Comportamiento

La app debe preguntar:

```txt
¿Con qué pareja quieres conectar este hijo/a?
```

Opciones:

- Con pareja A.
- Con pareja B.
- Solo como hijo/a mío/a por ahora.

### Acción técnica

- Si elige pareja, usar `addChildToUnion`.
- Si elige solo como hijo/a, usar relación de hijo/a individual si está soportada.

### Criterio de aceptación

- El usuario puede tener hijos de diferentes relaciones.
- El usuario no necesita definir divorcio/separación.
- El hijo/a queda conectado al contexto correcto.

## Errores posibles

| Error                                        | Respuesta esperada                                                       |
| -------------------------------------------- | ------------------------------------------------------------------------ |
| Falta nombre                                 | "Ingresa el nombre del hijo/a."                                          |
| No se seleccionó pareja cuando era necesario | "Elige con qué pareja conectar este hijo/a o agrégalo solo como hijo/a." |
| Error de permisos                            | "No tienes permiso para editar este árbol."                              |
| Error backend                                | "No pudimos agregar el hijo/a. Intenta nuevamente."                      |

## Criterios de aceptación generales

- Se puede agregar hijo/a sin fecha nacimiento.
- Se puede agregar hijo/a sin lugar nacimiento.
- Se soporta hijo/a sin pareja.
- Se soporta hijo/a con una pareja.
- Se soporta hijo/a con varias parejas seleccionando unión.
- La visualización se actualiza después de guardar.

---

# 18. Flujo 12 - Editar persona

## Objetivo

Permitir corregir información básica de una persona.

## Entrada del flujo

Usuario selecciona una persona y hace clic en:

```txt
Editar información
```

## Campos editables MVP

| Campo            | Persona raíz  | Familiar     |
| ---------------- | -------------:| ------------:|
| Primer nombre    | Sí            | Sí           |
| Apellido         | Sí            | Sí           |
| Fecha nacimiento | Sí, requerida | Sí, opcional |
| Lugar nacimiento | Sí, opcional  | Sí, opcional |
| Segundo nombre   | Opcional      | Opcional     |
| Apellido materno | Opcional      | Opcional     |

## Reglas

- Editar persona no debe romper relaciones.
- Cambiar datos no debe cambiar `personId`.
- Para persona raíz, fecha nacimiento sigue requerida.
- Para familiares, fecha nacimiento puede quedar vacía.
- Se debe actualizar `updatedAt`.

## Errores posibles

| Error          | Respuesta esperada                                    |
| -------------- | ----------------------------------------------------- |
| Nombre vacío   | "Ingresa un nombre válido."                           |
| Fecha inválida | "Revisa la fecha de nacimiento."                      |
| Error permisos | "No tienes permiso para editar esta persona."         |
| Error backend  | "No pudimos guardar los cambios. Intenta nuevamente." |

## Criterios de aceptación

- El usuario puede editar datos básicos.
- Las relaciones se conservan.
- El árbol se actualiza visualmente.
- No se muestran detalles técnicos.

---

# 19. Flujo 13 - Desvincular relación

## Objetivo

Permitir corregir relaciones sin borrar personas accidentalmente.

## Principio clave

Desvincular no es lo mismo que borrar.

```txt
Desvincular relación = quitar conexión.
Borrar persona = eliminar registro.
```

En MVP, debe priorizarse desvincular antes que borrar.

## Casos

### Caso A - Quitar padre/madre

Texto de confirmación:

```txt
¿Quieres quitar esta relación?

La persona seguirá existiendo en tu árbol, pero ya no aparecerá como padre/madre de [Nombre].
```

### Caso B - Quitar pareja

Texto de confirmación:

```txt
¿Quieres quitar esta pareja del árbol?

Las personas no serán eliminadas. Solo se quitará la conexión entre ellas.
```

### Caso C - Quitar hijo/a de una unión

Texto de confirmación:

```txt
¿Quieres quitar esta relación familiar?

El hijo/a seguirá existiendo en el árbol, pero ya no estará conectado a esta relación.
```

## Reglas

- Siempre pedir confirmación.
- No borrar persona automáticamente.
- No borrar árbol.
- No borrar otras relaciones no relacionadas.
- Si una unión queda sin hijos, puede mantenerse o eliminarse según regla técnica definida.
- Si una persona queda aislada, debe seguir existiendo hasta que se implemente borrado seguro.

## Errores posibles

| Error              | Respuesta esperada                                   |
| ------------------ | ---------------------------------------------------- |
| Relación no existe | "Esta relación ya no existe o fue modificada."       |
| Error permisos     | "No tienes permiso para modificar este árbol."       |
| Error backend      | "No pudimos quitar la relación. Intenta nuevamente." |

## Criterios de aceptación

- El usuario puede quitar una relación.
- La persona no se elimina.
- El árbol se actualiza.
- Hay confirmación previa.
- No hay pérdida accidental de datos.

---

# 20. Flujo 14 - Visualizar árbol

## Objetivo

Mostrar las relaciones familiares de forma clara.

## Elementos esperados

La pantalla del árbol debe incluir:

- Header.
- Área visual del árbol.
- Nodo de persona raíz.
- Nodos familiares.
- Conexiones claras.
- Panel lateral de acciones.
- Estado de carga.
- Estado vacío guiado.
- Estado de error recuperable.

## Reglas visuales MVP

- La persona raíz debe identificarse fácilmente.
- Padres/madres deben aparecer en generación superior.
- Hijos deben aparecer en generación inferior.
- Parejas deben aparecer conectadas horizontalmente o con lógica visual clara.
- No saturar con demasiada información en cada nodo.
- Mostrar nombre y apellido como mínimo.
- Fecha/lugar pueden mostrarse en detalle, no necesariamente en nodo.

## Criterios de aceptación

- El árbol se entiende con root + padres.
- El árbol se entiende con pareja + hijo.
- El árbol se entiende con segunda pareja de forma simple.
- El árbol no falla con una sola persona.
- El usuario puede seleccionar nodos.

---

# 21. Flujo 15 - Árbol mínimo sugerido

## Objetivo

Guiar al usuario sin bloquearlo.

## Regla

El árbol mínimo sugerido se cumple cuando:

```txt
persona raíz + 2 familiares conectados
```

## Estados de progreso

| Estado        | Mensaje sugerido                                                                          |
| ------------- | ----------------------------------------------------------------------------------------- |
| 0 familiares  | "Agrega dos familiares cercanos para empezar a darle forma a tu árbol."                   |
| 1 familiar    | "Tu árbol ya tiene su primera conexión. Agrega un familiar más para completar tu inicio." |
| 2+ familiares | "Tu árbol inicial ya tomó forma. Puedes seguir agregando familiares cuando quieras."      |

## Reglas

- No bloquear navegación.
- No impedir guardar.
- No obligar a completar inmediatamente.
- No mostrar como error.
- Presentarlo como guía positiva.

## Criterios de aceptación

- El progreso se calcula con familiares conectados, no personas aisladas.
- El usuario puede ignorar la sugerencia.
- La app sigue funcionando aunque no se complete.

---

# 22. Estados de error globales

## Error de autenticación

Mensaje:

```txt
Tu sesión ha expirado. Inicia sesión nuevamente.
```

Acción:

- Enviar a login.

## Error de permisos

Mensaje:

```txt
No tienes permiso para ver o editar este árbol.
```

Acción:

- Bloquear acceso.
- No mostrar datos.
- Ofrecer volver a inicio.

## Error de carga

Mensaje:

```txt
No pudimos cargar tu árbol. Intenta nuevamente.
```

Acción:

- Botón Reintentar.
- Mantener sesión.

## Error de guardado

Mensaje:

```txt
No pudimos guardar los cambios. Revisa la información e intenta nuevamente.
```

Acción:

- Mantener formulario abierto.
- No perder datos ingresados.

## Error de datos incompletos

Mensaje:

```txt
Completa los campos requeridos.
```

Acción:

- Marcar campos requeridos.
- No mostrar errores técnicos.

---

# 23. Reglas funcionales consolidadas

## 23.1 Reglas de usuario y árbol

- Un usuario autenticado tiene un árbol principal en MVP.
- Cada árbol tiene un único owner.
- El árbol es privado por defecto.
- Solo el owner puede ver o editar.
- Una persona pertenece a un solo árbol en MVP.

## 23.2 Reglas de persona raíz

- Debe existir una persona raíz.
- La persona raíz representa al usuario registrado.
- Debe tener nombre, apellido y fecha de nacimiento.
- No debe duplicarse al recargar o reintentar.

## 23.3 Reglas de familiares

- Nombre requerido.
- Apellido recomendado o requerido por consistencia inicial.
- Fecha de nacimiento opcional.
- Lugar de nacimiento opcional.
- Pueden agregarse progresivamente.
- No deben requerir información que el usuario quizá no conozca.

## 23.4 Reglas de relaciones

- Padre/madre se conectan con una persona existente.
- Pareja crea una unión simple.
- Hijo/a puede conectarse a una persona o unión.
- Una persona puede tener múltiples parejas/uniones.
- No se maneja divorcio/separación avanzada en MVP.
- Desvincular relación no elimina personas.

## 23.5 Reglas de UX

- Usar botones rápidos.
- Evitar formularios largos.
- Evitar lenguaje técnico.
- Mostrar siempre siguiente paso claro.
- Confirmar acciones destructivas.
- Mantener tono cálido, familiar y confiable.

---

# 24. Historias de usuario cubiertas por este flujo

| #   | Historia                                                                                   | Prioridad  | Fase |
| --- | ------------------------------------------------------------------------------------------ | ----------:| ---- |
| 1   | Como usuario nuevo, quiero registrarme para tener un árbol privado asociado a mi cuenta.   | Alta       | MVP  |
| 2   | Como usuario nuevo, quiero crear mi perfil personal para iniciar mi árbol desde mí.        | Alta       | MVP  |
| 3   | Como usuario, quiero que mi árbol se cree aunque solo esté yo para empezar sin presión.    | Alta       | MVP  |
| 4   | Como usuario, quiero ver sugerencias para agregar familiares cercanos.                     | Alta       | MVP  |
| 5   | Como usuario, quiero agregar a mi padre para representar mi ascendencia.                   | Alta       | MVP  |
| 6   | Como usuario, quiero agregar a mi madre para representar mi ascendencia.                   | Alta       | MVP  |
| 7   | Como usuario, quiero agregar una pareja para representar una relación familiar importante. | Alta       | MVP  |
| 8   | Como usuario, quiero agregar un hijo/a para representar mi descendencia.                   | Alta       | MVP  |
| 9   | Como usuario, quiero ver mi árbol visualmente para entender mis relaciones.                | Alta       | MVP  |
| 10  | Como usuario, quiero editar información básica para corregir errores.                      | Alta       | MVP  |
| 11  | Como usuario, quiero desvincular una relación sin borrar personas.                         | Media-Alta | MVP  |

---

# 25. Notas para frontend

## Componentes sugeridos

```txt
CreateProfilePage
TreeViewPage
TreeSidePanel
EmptyTreeState
SelectedPersonCard
PersonBasicForm
AddFatherForm
AddMotherForm
AddPartnerForm
AddChildForm
ConfirmDialog
```

## Comportamiento esperado

- `CreateProfilePage` crea root + árbol.
- `TreeViewPage` carga datos del árbol.
- `EmptyTreeState` aparece si solo existe root.
- `TreeSidePanel` reemplaza gradualmente a `Stage4Panel`.
- `PersonBasicForm` debe permitir campos opcionales para familiares.
- No mostrar datos técnicos al usuario.

## Navegación esperada

```txt
/                 → decide según auth y árbol
/login            → login/signup
/create-profile   → crear perfil si no hay árbol
/tree             → árbol principal
```

Si por ahora se mantiene `CreateMe.tsx`, puede cumplir el rol de `/create-profile`.

---

# 26. Notas para backend

## Funciones principales

```txt
createTreeWithRootPerson
getTreeData
createUnion
addChildToUnion
addParentToPerson
```

## Recomendaciones

- Mantener `claimTreeOwnership` solo DEV.
- No usar `addPerson` y `addRelationship` como flujo principal.
- Validar ownership en todas las mutaciones.
- No permitir que una persona de otro árbol sea conectada.
- Permitir familiares sin fecha/lugar de nacimiento.
- Evitar duplicados de árbol por usuario.

---

# 27. Notas para QA

## Pruebas manuales mínimas

1. Usuario nuevo sin árbol crea perfil.
2. Usuario nuevo es enviado a `/tree`.
3. Árbol con solo root se muestra correctamente.
4. Usuario agrega padre sin fecha nacimiento.
5. Usuario agrega madre sin lugar nacimiento.
6. Usuario agrega pareja.
7. Usuario agrega hijo con una pareja.
8. Usuario agrega hijo sin pareja.
9. Usuario agrega segunda pareja.
10. Usuario agrega hijo con segunda pareja.
11. Usuario edita nombre de familiar.
12. Usuario desvincula relación sin borrar persona.
13. Usuario existente vuelve y entra directo al árbol.
14. Usuario no autenticado no puede ver árbol.
15. Usuario no owner no puede leer árbol ajeno.

## Pruebas de errores

1. Crear perfil sin fecha nacimiento debe fallar.
2. Crear familiar sin fecha nacimiento debe permitir guardar.
3. Crear padre duplicado debe impedir o advertir.
4. Error backend debe mostrar mensaje amigable.
5. Pérdida de sesión debe enviar a login.
6. Error de permisos no debe mostrar datos privados.

---

# 28. Definition of Done del flujo MVP v1

El flujo MVP v1 se considera terminado cuando:

- El usuario puede registrarse o iniciar sesión.
- El usuario sin árbol puede crear perfil personal.
- La persona raíz requiere fecha de nacimiento.
- Se crea un árbol privado.
- El usuario llega a `/tree`.
- El árbol renderiza con solo root.
- La app guía a agregar dos familiares.
- El usuario puede agregar padre.
- El usuario puede agregar madre.
- El usuario puede agregar pareja.
- El usuario puede agregar hijo/a.
- La fecha de nacimiento es opcional para familiares.
- El lugar de nacimiento es opcional para familiares.
- El usuario puede editar información básica.
- El usuario puede desvincular relaciones sin borrar personas.
- El owner es el único que puede ver/editar su árbol.
- No hay lenguaje DEV visible en el flujo principal.
- No hay navegación a pantallas legacy en el flujo principal.
- Los errores se muestran con mensajes comprensibles.

---

# 29. Decisiones fuera del alcance de este documento

No se diseñan en este flujo:

- Fotos.
- Invitaciones.
- Roles.
- Colaboración.
- Exportación PDF.
- Biografías largas.
- Documentos familiares.
- IA.
- Árbol público.
- App móvil nativa.
- Privacidad avanzada por persona.
- Divorcio/separación avanzada.

Estas funciones quedan para fases futuras.

---

# 30. Doble verificación PM/PO

## Verificación de alineación con decisiones confirmadas

| Punto                                | Estado     |
| ------------------------------------ | ---------- |
| Producto privado primero             | Confirmado |
| Usuario crea su propio árbol         | Confirmado |
| Flujo práctico + tono emocional      | Confirmado |
| Puede empezar solo con root          | Confirmado |
| Guía para 2 familiares               | Confirmado |
| Fecha obligatoria solo para root     | Confirmado |
| Fecha opcional para familiares       | Confirmado |
| Uniones simples                      | Confirmado |
| Segunda pareja sin divorcio avanzado | Confirmado |
| Un owner por árbol                   | Confirmado |
| Sin invitaciones en MVP              | Confirmado |
| Botones rápidos como UX principal    | Confirmado |

## Verificación de alcance

Este documento no agrega funciones fuera del MVP. Mantiene fuera:

- Fotos.
- Invitaciones.
- Roles.
- Exportación PDF.
- IA.
- App móvil nativa.
- Privacidad avanzada.

## Verificación técnica básica

El flujo es compatible con la base actual porque aprovecha:

- `createTreeWithRootPerson`.
- `getTreeData`.
- `createUnion`.
- `addChildToUnion`.
- `addParentToPerson`.
- `TreeViewPage`.
- `Stage4Panel`, evolucionándolo gradualmente.
- `useTreeStore`.
- Modelo actual de personas y uniones.

## Riesgo principal detectado

El punto más delicado es el caso de hijo/a sin pareja si el backend actual solo soporta `addChildToUnion` y no una relación directa padre-hijo para descendencia de persona soltera.

Recomendación:

```txt
Validar técnicamente si ya existe soporte real para hijo/a sin pareja.
Si existe, mantenerlo.
Si no existe, definir una función o regla simple antes de implementar ese flujo.
```

---

# 31. Conclusión PM/PO

El MVP v1 debe validar la experiencia esencial:

> Una persona puede empezar su árbol familiar privado desde sí misma, agregar familiares cercanos y entender visualmente cómo están conectados.

La prioridad de implementación debe ser:

1. Onboarding real.
2. Árbol privado con root.
3. Pantalla del árbol sin estado vacío confuso.
4. Acciones rápidas para familiares.
5. Validaciones alineadas con producto.
6. Corrección básica de errores.
7. Seguridad por owner.

Todo lo que no ayude directamente a este flujo debe esperar.

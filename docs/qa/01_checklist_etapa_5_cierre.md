# 01 - Checklist de cierre Etapa 5

## Proyecto

**Nombre:** Tree Family / Árbol Genealógico  
**Etapa:** Etapa 5 - Flujo real usuario nuevo + árbol mínimo sugerido  
**Documento:** Checklist de cierre  
**Estado:** Completado funcionalmente y validado manualmente

---

## 1. Objetivo de la Etapa 5

Convertir la base funcional construida hasta Etapa 4 en una experiencia real de usuario nuevo.

Flujo objetivo:

```txt
Usuario nuevo
→ Crear cuenta
→ Crear perfil personal
→ Crear árbol privado
→ Entrar a /tree
→ Agregar familiares directos
→ Confirmar persistencia
```

---

## 2. Alcance validado

La Etapa 5 incluyó:

- Rutas reales:
  - `/login`
  - `/signup`
  - `/create-profile`
  - `/tree`
- Registro de usuario con email y contraseña.
- Inicio de sesión.
- Validación de email existente.
- Creación de perfil personal.
- Creación de árbol privado.
- Detección de árbol existente por usuario autenticado.
- Prevención de árbol duplicado por owner.
- Visualización del árbol con persona raíz.
- Empty state / guía inicial para agregar familiares.
- Agregar padre.
- Agregar madre.
- Agregar pareja.
- Agregar hijo/a.
- Sugerencia para conectar padre y madre como pareja.
- Corrección del bug `Persona no encontrada`.
- Persistencia después de cerrar sesión e iniciar sesión nuevamente.

---

## 3. Checklist funcional validado

| # | Validación | Estado |
|---:|---|:---:|
| 1 | Usuario nuevo crea cuenta con email nuevo. | OK |
| 2 | Usuario nuevo es redirigido correctamente al flujo de crear perfil. | OK |
| 3 | Usuario crea perfil personal. | OK |
| 4 | Se crea un árbol privado asociado al usuario autenticado. | OK |
| 5 | Usuario entra a `/tree`. | OK |
| 6 | El árbol muestra la persona raíz. | OK |
| 7 | El árbol muestra guía inicial para agregar familiares. | OK |
| 8 | Usuario puede agregar padre. | OK |
| 9 | Usuario puede agregar madre. | OK |
| 10 | Al existir padre y madre, aparece sugerencia para conectarlos como pareja. | OK |
| 11 | La sugerencia muestra ambos nombres correctamente. | OK |
| 12 | La sugerencia nunca muestra `Persona no encontrada`. | OK |
| 13 | Usuario puede conectar padre y madre como pareja. | OK |
| 14 | Se crea la unión entre padre y madre. | OK |
| 15 | Usuario puede cerrar sesión. | OK |
| 16 | Usuario puede iniciar sesión nuevamente con el mismo email. | OK |
| 17 | Al iniciar sesión, el usuario entra directo a `/tree` si ya tiene árbol. | OK |
| 18 | El árbol persiste después de logout/login. | OK |
| 19 | La unión entre padre y madre persiste después de logout/login. | OK |
| 20 | Usuario no puede crear una cuenta nueva con un email ya registrado. | OK |
| 21 | La app muestra el mensaje: `Ya existe una cuenta con este correo. Inicia sesión.` | OK |
| 22 | No se crea otro árbol al intentar registrar el mismo email. | OK |
| 23 | Botón de cerrar sesión funciona correctamente. | OK |
| 24 | No se usa auth anónimo como flujo principal. | OK |
| 25 | No se navega a pantallas legacy como flujo principal. | OK |

---

## 4. Bugs detectados y resueltos

### 4.1 Creación repetida de árboles

**Problema:** el flujo anterior podía crear un árbol nuevo porque no existía separación clara entre signup, login, create-profile y tree.

**Solución:** se crearon rutas separadas y se agregó validación con `getMyTreeSummary`.

**Estado:** Resuelto.

### 4.2 Usuario con mismo email

**Problema:** no existía una pantalla real de login/signup, por lo que la app no podía validar correctamente si el usuario ya existía.

**Solución:** se implementó flujo de signup/login con Firebase Authentication.

**Resultado esperado:**

```txt
Usuario intenta registrarse con email existente
→ Firebase responde error
→ App muestra mensaje claro
→ No crea otro árbol
```

**Estado:** Resuelto.

### 4.3 `Persona no encontrada`

**Problema:** la sugerencia para conectar padre y madre podía mostrar una persona sin resolver.

**Solución:** la sugerencia solo se muestra cuando padre, madre y nombres están resueltos.

**Estado:** Resuelto.

---

## 5. Decisiones de producto confirmadas durante Etapa 5

| Decisión | Estado |
|---|:---:|
| El producto es privado primero. | Confirmada |
| El usuario principal crea su propio árbol. | Confirmada |
| El árbol puede empezar solo con la persona raíz. | Confirmada |
| La app guía a agregar dos familiares, pero no bloquea. | Confirmada |
| La fecha de nacimiento es obligatoria para persona raíz. | Confirmada |
| La fecha de nacimiento es opcional para familiares. | Confirmada |
| Padre y madre no se conectan automáticamente como pareja. | Confirmada |
| La app debe sugerir conectar padre y madre si ambos existen. | Confirmada |
| No se implementa divorcio/separación avanzada en MVP. | Confirmada |
| No se guarda email en la persona raíz por ahora. | Confirmada |
| No se crea `users/{uid}` por ahora. | Confirmada |

---

## 6. Archivos principales involucrados

### Frontend

```txt
packages/frontend/src/App.tsx
packages/frontend/src/pages/LoginPage.tsx
packages/frontend/src/pages/SignupPage.tsx
packages/frontend/src/pages/CreateProfilePage.tsx
packages/frontend/src/pages/TreeViewPage.tsx
packages/frontend/src/components/Stage4Panel.tsx
packages/frontend/src/components/tree/EmptyTreeState.tsx
packages/frontend/src/store/useTreeStore.ts
packages/frontend/src/types/family.ts
```

### Backend

```txt
packages/functions/src/index.ts
```

### Documentación

```txt
docs/product/
docs/technical/
docs/qa/
README.md
```

---

## 7. Definition of Done de Etapa 5

La Etapa 5 se considera cerrada funcionalmente porque:

- El usuario puede crear cuenta.
- El usuario puede iniciar sesión.
- El usuario puede crear perfil personal.
- El usuario puede crear su árbol privado.
- El sistema detecta árbol existente.
- El sistema evita árbol duplicado por owner.
- El usuario puede entrar a `/tree`.
- El usuario puede agregar familiares directos.
- El usuario puede conectar padre y madre como pareja.
- El flujo persiste después de logout/login.
- El signup con email existente muestra error correcto.
- No se muestra `Persona no encontrada`.
- La funcionalidad fue validada manualmente.

---

## 8. Estado final

```txt
Etapa 5: Completada funcionalmente
Estado recomendado: Lista para protegerse con pruebas en Etapa 6
```

---

## 9. Siguiente etapa

```txt
Etapa 6 - Tests y CI local
```

Prioridad:

1. Documentar pruebas manuales del MVP.
2. Revisar scripts actuales.
3. Crear primeros tests E2E simples.
4. Revisar `.github/workflows`.
5. Preparar CI básico.

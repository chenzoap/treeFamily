# 01 - Decisiones de producto confirmadas

Este documento registra decisiones base del producto que se consideran vigentes para el MVP.  
Solo deberían cambiar si aparece una razón fuerte de producto, técnica, legal o de seguridad.

---

## 1. Naturaleza del producto

| Tema | Decisión |
|---|---|
| Tipo de producto inicial | Aplicación privada/familiar. |
| Alcance social | No será pública ni social en MVP. |
| Usuario principal | Persona que crea su propio árbol. |
| Enfoque inicial | Uso personal y familiar privado. |
| Estilo de experiencia | Flujo práctico con textos y visuales emocionales. |

---

## 2. Usuario principal

La primera versión está pensada para:

> Una persona que quiere empezar su propio árbol familiar de forma sencilla, privada y visual.

No se prioriza inicialmente:

- Usuario que crea árboles para terceros.
- Genealogista profesional.
- Red social familiar.
- Investigación histórica avanzada.
- Plataforma colaborativa multiusuario.

---

## 3. Promesa principal del MVP

La promesa principal es:

> En pocos minutos puedes crear tu árbol familiar privado, empezar contigo, agregar familiares cercanos y ver cómo están conectados.

---

## 4. Inicio del árbol

| Pregunta | Decisión |
|---|---|
| ¿El usuario puede empezar solo? | Sí. |
| ¿Debe crear obligatoriamente dos familiares al inicio? | No. |
| ¿La app debe guiarlo a completar dos familiares? | Sí. |
| ¿El árbol mínimo es bloqueo? | No. |
| ¿El árbol mínimo es sugerencia de progreso? | Sí. |

---

## 5. Definición de árbol iniciado

Un árbol se considera iniciado cuando existe:

- Usuario autenticado.
- Árbol privado creado.
- Persona raíz asociada al usuario.
- `ownerUid` asociado al árbol.

---

## 6. Definición de árbol mínimo sugerido

Un árbol se considera mínimamente completo a nivel de onboarding cuando existe:

- Persona raíz.
- Al menos dos familiares conectados.

Esto no debe bloquear al usuario.  
Debe funcionar como guía visual o progreso inicial.

---

## 7. Datos obligatorios y opcionales

### Usuario registrado / persona raíz

| Campo | Decisión |
|---|---|
| Primer nombre | Obligatorio. |
| Apellido | Obligatorio. |
| Fecha de nacimiento | Obligatoria. |
| Lugar de nacimiento | Opcional. |
| Segundo nombre | Opcional. |
| Apellido materno | Opcional. |
| Foto | No MVP. |
| Biografía | No MVP. |

### Familiares agregados

| Campo | Decisión |
|---|---|
| Primer nombre | Obligatorio. |
| Apellido | Recomendado / requerido para orden inicial. |
| Fecha de nacimiento | Opcional. |
| Lugar de nacimiento | Opcional. |
| Fallecido/a | Puede entrar si no complica, pero no debe bloquear Etapa 5. |
| Foto | Fase futura. |
| Biografía | Fase futura. |

---

## 8. Relaciones familiares en MVP

El MVP debe soportar:

- Padre.
- Madre.
- Pareja.
- Hijo/a.
- Uniones simples.
- Segunda pareja de forma simple.
- Hijos de diferentes relaciones mediante uniones.

No debe soportar todavía de forma avanzada:

- Divorcio.
- Separación formal.
- Estado legal de matrimonio.
- Custodia.
- Relaciones públicas/sociales.
- Colaboración multiusuario.

---

## 9. Privacidad

| Tema | Decisión |
|---|---|
| Privacidad inicial | Árbol privado por defecto. |
| Dueño del árbol | Un único owner por árbol en MVP. |
| Quién puede ver | Solo el owner. |
| Quién puede editar | Solo el owner. |
| Invitaciones | No MVP. |
| Roles | No MVP. |
| Menores de edad | Protegidos por privacidad general del árbol. |

---

## 10. Pertenencia de personas

| Tema | Decisión |
|---|---|
| Una persona puede pertenecer a varios árboles | No en MVP. |
| Modelo MVP | Una persona pertenece a un solo árbol. |
| Compartir personas entre árboles | Fase futura. |

---

## 11. UX principal

La experiencia principal para agregar familiares debe ser mediante botones rápidos:

- Agregar padre.
- Agregar madre.
- Agregar pareja.
- Agregar hijo/a.

El formulario genérico puede existir internamente o como herramienta secundaria, pero no debe ser el flujo principal de usuario.

---

## 12. Lenguaje del producto

La app debe evitar lenguaje técnico frente al usuario.

Evitar mostrar:

- `unionId`
- `treeId`
- `rootPersonId`
- `ownerUid`
- `DEV`
- `Etapa 4`
- `claim ownership`
- nombres internos de funciones

Usar lenguaje simple:

- Mi árbol.
- Agregar familiar.
- Agregar padre.
- Agregar madre.
- Agregar pareja.
- Agregar hijo/a.
- Persona seleccionada.
- Quitar relación.
- Editar información.

---

## 13. Principio de producto

Regla guía:

> Si una función no ayuda directamente a que el usuario cree, entienda o corrija su primer árbol familiar, no pertenece al MVP.

---

## 14. Decisión estratégica

No competir inicialmente contra plataformas genealógicas avanzadas.  
El producto debe ganar primero por:

- Simplicidad.
- Claridad visual.
- Privacidad.
- Construcción progresiva.
- Valor emocional.

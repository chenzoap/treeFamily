# 02 - MVP: alcance vigente

## Objetivo del MVP

Permitir que un usuario cree su cuenta, registre su perfil personal, cree un árbol familiar privado, agregue familiares directos mediante acciones simples y visualice relaciones familiares básicas de forma clara.

---

## Flujo central del MVP

```txt
Usuario entra
→ se registra o inicia sesión
→ crea su perfil personal
→ se crea su árbol privado
→ llega a la pantalla del árbol
→ ve su nodo raíz
→ recibe guía para agregar familiares
→ agrega padre/madre/pareja/hijo
→ visualiza conexiones familiares
→ puede corregir datos básicos
```

---

## Problema que el MVP debe resolver

El MVP debe resolver este problema principal:

> Una persona quiere empezar a construir su árbol familiar sin sentirse abrumada por formularios largos, conceptos técnicos o relaciones difíciles de entender.

---

## Must Have

Estas funciones deben entrar en el MVP.

| Función | Justificación |
|---|---|
| Registro/login | Necesario para persistencia y privacidad. |
| Crear perfil personal | Punto de partida del árbol. |
| Fecha de nacimiento obligatoria para usuario raíz | Dato base de identidad del usuario. |
| Crear árbol privado automáticamente | Evita complejidad inicial. |
| Mostrar árbol aunque solo exista el usuario | Evita pantalla vacía o bloqueo. |
| Botones rápidos para agregar familiares | Hace la experiencia simple. |
| Agregar padre | Relación esencial. |
| Agregar madre | Relación esencial. |
| Agregar pareja | Relación esencial. |
| Agregar hijo/a | Relación esencial. |
| Uniones simples | Permite parejas e hijos de diferentes relaciones. |
| Editar información básica | Necesario para corregir errores. |
| Desvincular relación | Permite corregir sin borrar personas. |
| Seguridad por owner | Base de privacidad. |
| Visualización clara del árbol | Valor principal del producto. |

---

## Should Have

Importante, pero puede moverse si afecta el cierre de Etapa 5.

| Función | Justificación |
|---|---|
| Indicador de progreso de árbol mínimo sugerido | Mejora onboarding. |
| Estado vacío emocional | Reduce sensación de app incompleta. |
| Confirmación antes de borrar/desvincular | Protege contra errores. |
| Campo fallecido/a | Dato familiar importante. |
| Lugar de nacimiento | Valor emocional, pero no crítico. |
| Segundo nombre / apellido materno | Útil, pero no esencial. |

---

## Could Have

Funciones buenas para Fase 2 o posterior.

| Función | Justificación |
|---|---|
| Fotos | Alto valor emocional, pero requiere storage y permisos. |
| Comentarios breves | Enriquece memoria familiar. |
| Biografía corta | Valiosa, pero no valida el core. |
| Mejor diseño visual de nodos | Puede venir después de validar flujo. |
| Búsqueda dentro del árbol | Útil con árboles grandes. |
| Filtros visuales | No necesario al inicio. |

---

## Won't Have en MVP

No implementar en primera versión.

| Función | Motivo |
|---|---|
| Invitaciones familiares | Requiere roles y permisos. |
| Colaboración familiar | Alta complejidad de edición y conflictos. |
| Privacidad avanzada por persona | Primero privacidad por árbol. |
| Exportar PDF | Útil, pero no valida el core. |
| Documentos familiares | Storage, privacidad y estructura adicional. |
| IA | Riesgo alto y no esencial. |
| Árbol público/social | Contradice estrategia privada inicial. |
| Separación/divorcio avanzado | Complejidad innecesaria para MVP. |
| Personas compartidas entre árboles | No necesario todavía. |
| App móvil nativa | Primero web responsive. |

---

## Alcance funcional exacto de Etapa 5

Etapa 5 debe enfocarse en:

1. Convertir el flujo actual en un flujo real de usuario nuevo.
2. Detectar si el usuario ya tiene árbol.
3. Si no tiene árbol, pedir creación de perfil.
4. Crear árbol privado con persona raíz.
5. Enviar al usuario a la pantalla del árbol.
6. Mostrar el árbol aunque solo exista el usuario.
7. Mostrar guía para agregar dos familiares.
8. Adaptar panel de acciones familiares.
9. Ajustar validaciones de familiares.
10. Remover o aislar elementos DEV de la experiencia real.

---

## Criterios de cierre del MVP inicial

El MVP inicial se considera aceptable cuando:

- Un usuario puede iniciar sesión o registrarse.
- Un usuario nuevo puede crear su perfil.
- La fecha de nacimiento del usuario raíz es obligatoria.
- Se crea un árbol privado asociado al usuario.
- El usuario llega a la pantalla del árbol.
- El árbol muestra al menos al usuario raíz.
- La app sugiere agregar familiares.
- El usuario puede agregar padre.
- El usuario puede agregar madre.
- El usuario puede agregar pareja.
- El usuario puede agregar hijo/a.
- El usuario puede ver las conexiones principales.
- El usuario puede editar información básica.
- El usuario puede desvincular una relación sin borrar accidentalmente a una persona.
- Las reglas de seguridad impiden acceso a árboles de otros usuarios.

---

## Regla de control de alcance

Cualquier nueva función debe evaluarse con esta pregunta:

> ¿Ayuda directamente al usuario a crear y entender su primer árbol familiar privado?

Si la respuesta es no, debe ir a fase futura.

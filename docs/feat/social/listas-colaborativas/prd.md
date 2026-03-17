# PRD: Listas colaborativas — múltiples editores por lista

**Feature:** listas-colaborativas
**Categoria:** social
**Fecha:** 2026-03-17
**Issue:** [#155](https://github.com/benoffi7/modo-mapa/issues/155)
**Prioridad:** Media

---

## Contexto

Las listas compartidas (v2.13.0) permiten compartir via link pero solo el creador puede editar. Varios usuarios quieren colaborar en una misma lista (ej: "Lugares para almorzar del equipo").

## Problema

- Solo el creador de la lista puede agregar o quitar comercios.
- No hay forma de invitar a otros usuarios como editores.
- Las listas compartidas son read-only para los receptores.

## Solución

### S1: Invitar editores

- El creador puede invitar usuarios por email o userId como editores.
- Flujo: botón "Invitar editor" en la vista de lista → buscar usuario → enviar invitación.
- La invitación se guarda como subcolección `editors` en el documento de la lista.

### S2: Permisos de editor

- Los editores pueden: agregar comercios, quitar comercios que ellos agregaron.
- Los editores NO pueden: eliminar la lista, cambiar visibilidad, quitar comercios de otros, invitar nuevos editores.
- Solo el creador (owner) tiene permisos completos.

### S3: Firestore rules

- Permitir escritura en `lists/{listId}/items` si el usuario es owner o editor.
- Array `editorIds` en el documento de la lista para validación rápida.
- Rules: `request.auth.uid in resource.data.editorIds || request.auth.uid == resource.data.ownerId`.

### S4: UI indicadores

- Badge "Colaborativa" en listas con editores.
- Avatares de los editores en el header de la lista.
- Indicador de quién agregó cada comercio.

---

## Scope

| Item | Prioridad | Esfuerzo |
|------|-----------|----------|
| Campo editorIds en lista | Alta | XS |
| Firestore rules para editores | Alta | S |
| Invitar editor (buscar usuario) | Alta | M |
| Permisos diferenciados owner/editor | Alta | S |
| Badge y avatares en UI | Media | S |
| Indicador de quién agregó | Baja | XS |

**Esfuerzo total estimado:** M

---

## Out of Scope

- Roles adicionales (viewer, moderator).
- Notificaciones cuando un editor agrega un comercio.
- Historial de cambios en la lista.
- Límite de editores por lista.
- Chat o comentarios dentro de la lista.

---

## Success Criteria

1. El creador puede invitar editores por email o username.
2. Los editores pueden agregar y quitar sus propios comercios.
3. Los editores no pueden eliminar la lista ni quitar comercios ajenos.
4. Las Firestore rules validan permisos de owner y editor.
5. La UI muestra claramente que la lista es colaborativa y quiénes son los editores.

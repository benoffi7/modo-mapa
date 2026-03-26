# PRD: Listas compartidas

**Feature:** listas-compartidas
**Categoria:** social
**Fecha:** 2026-03-16
**Issue:** #142
**Prioridad:** Media

---

## Contexto

Los favoritos permiten guardar comercios pero son una lista única y privada. No es posible organizar comercios en categorías temáticas ni compartirlos con otros usuarios.

## Problema

- Una sola lista de favoritos no escala cuando el usuario tiene muchos comercios guardados.
- No hay forma de organizar favoritos por contexto ("Almuerzo", "Café con amigos", "Vegano").
- No se pueden compartir selecciones curadas con otros usuarios.

## Solución

### S1: Crear listas temáticas

- El usuario puede crear listas con nombre y descripción opcional.
- Agregar comercios a una lista desde el BusinessSheet (menú de favoritos expandido).
- Ver y gestionar listas desde el menú lateral.

### S2: Compartir listas

- Generar link público para cada lista.
- El receptor puede ver la lista sin necesidad de cuenta.
- Usuarios autenticados pueden "copiar" la lista a sus propias listas.

### S3: Gestión de listas

- Reordenar comercios dentro de una lista (drag & drop).
- Eliminar comercios de una lista.
- Eliminar lista completa.

---

## Scope

| Item | Prioridad | Esfuerzo |
|------|-----------|----------|
| Modelo de datos (colección lists) | Alta | S |
| CRUD de listas | Alta | M |
| Agregar/quitar comercios de listas | Alta | M |
| Generar y visualizar link compartido | Media | M |
| Vista pública de lista (sin auth) | Media | M |
| Drag & drop para reordenar | Baja | S |

**Esfuerzo total estimado:** L

---

## Out of Scope

- Listas colaborativas (múltiples editores).
- Listas sugeridas por la plataforma.
- Importar/exportar listas.
- Límite de cantidad de listas por usuario (definir si es necesario post-launch).

---

## Success Criteria

1. El usuario puede crear, editar y eliminar listas temáticas.
2. Se pueden agregar comercios a una lista desde el BusinessSheet.
3. Cada lista tiene un link compartible que funciona sin autenticación.
4. La vista de lista muestra los comercios con su información básica.
5. La sección de listas es accesible desde el menú lateral.

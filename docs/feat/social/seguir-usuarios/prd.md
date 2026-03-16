# PRD: Seguir usuarios

**Feature:** seguir-usuarios
**Categoria:** social
**Fecha:** 2026-03-16
**Issue:** #129
**Prioridad:** Baja

---

## Contexto

Modo Mapa tiene funcionalidades sociales (comentarios, ratings, tags) pero no hay conexión entre usuarios. No es posible ver qué comercios descubrieron o calificaron amigos o colegas.

## Problema

- No hay forma de descubrir comercios a través de la actividad de personas de confianza.
- El descubrimiento depende exclusivamente de rankings globales y búsqueda.
- No existe concepto de red social dentro de la app.

## Solución

### S1: Sistema de follows

- Permitir seguir a otros usuarios por su perfil público.
- Relación unidireccional (seguir, no "amistad").
- Colección `follows` en Firestore con `followerId` y `followedId`.

### S2: Feed de actividad

- Sección en el menú lateral "Actividad" que muestra acciones recientes de usuarios seguidos.
- Tipos de actividad: nuevo rating, nuevo comentario, nuevo favorito.
- Feed paginado con scroll infinito.

### S3: Perfil público

- Página de perfil con displayName, avatar, cantidad de ratings/comments.
- Lista de comercios calificados visible para seguidores.

---

## Scope

| Item | Prioridad | Esfuerzo |
|------|-----------|----------|
| Modelo follows (colección Firestore) | Alta | S |
| Buscar y seguir usuarios | Alta | M |
| Feed de actividad | Alta | L |
| Perfil público básico | Media | M |
| Configuración de privacidad | Media | S |

**Esfuerzo total estimado:** XL

---

## Out of Scope

- Mensajería directa entre usuarios.
- Sugerencias de "a quién seguir".
- Feed algorítmico (solo cronológico).
- Importar contactos del teléfono.

---

## Success Criteria

1. Un usuario puede buscar y seguir a otro usuario.
2. El feed muestra actividad reciente de usuarios seguidos.
3. El perfil público muestra estadísticas básicas del usuario.
4. Un usuario puede dejar de seguir en cualquier momento.
5. La privacidad se respeta según configuración del usuario.

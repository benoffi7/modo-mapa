# PRD: Recomendaciones entre usuarios

**Feature:** recomendaciones-usuarios
**Categoria:** social
**Fecha:** 2026-03-16
**Issue:** #135
**Prioridad:** Media
**Milestone:** v2.25.0
**Depende de:** #129 (Seguir usuarios)

---

## Contexto

Actualmente no hay forma de compartir un comercio directamente con otro usuario dentro de la app. El descubrimiento es individual y no aprovecha la confianza entre personas conocidas.

## Problema

- No se pueden recomendar comercios a amigos dentro de la plataforma.
- Para compartir un comercio, el usuario debe salir de la app (WhatsApp, etc.).
- Se pierde contexto: el receptor no sabe quién recomendó ni por qué.

## Solución

### S1: Botón "Recomendar" en BusinessSheet

- Agregar acción "Recomendar" que abre un selector de usuarios.
- El selector reutiliza la búsqueda de usuarios de Seguir usuarios (#129): solo muestra perfiles públicos.
- El usuario elige el destinatario y opcionalmente agrega un mensaje corto.
- Se crea una notificación in-app: "Juan te recomienda Cafe Roma".

### S2: Bandeja de recomendaciones

- Sección en el menú para ver recomendaciones recibidas.
- Cada recomendación muestra: quién recomendó, el comercio, mensaje opcional, fecha.
- Acción directa para abrir el BusinessSheet del comercio recomendado.

### S3: Compartir externo (fallback)

- Si el destinatario no está en la plataforma, generar un deep link para compartir por WhatsApp/SMS.

---

## Scope

| Item | Prioridad | Esfuerzo |
|------|-----------|----------|
| Modelo de datos (colección recommendations) | Alta | S |
| Botón recomendar + selector de usuario | Alta | M |
| Notificación in-app al destinatario | Alta | S |
| Bandeja de recomendaciones recibidas | Media | M |
| Deep link para compartir externo | Baja | M |

**Esfuerzo total estimado:** L

---

## Out of Scope

- Recomendaciones algorítmicas ("Te podría gustar...").
- Recomendaciones grupales (a múltiples usuarios a la vez).
- Historial de recomendaciones enviadas.
- Integración con redes sociales.

---

## Success Criteria

1. Un usuario puede recomendar un comercio a otro usuario desde el BusinessSheet.
2. El destinatario recibe notificación in-app con la recomendación.
3. La bandeja muestra todas las recomendaciones recibidas.
4. Se puede abrir el comercio directamente desde la recomendación.

---

## Tests

- Tests unitarios para hook de recomendaciones (enviar, recibir, listar).
- Tests de servicio para CRUD de recomendaciones.
- Tests de Firestore rules para recomendaciones.
- Tests de componente para RecommendDialog y bandeja.
- Cobertura mínima: 80%.

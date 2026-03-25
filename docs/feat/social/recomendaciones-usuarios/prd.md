# PRD: Recomendaciones entre usuarios

**Feature:** recomendaciones-usuarios
**Categoria:** social
**Fecha:** 2026-03-25
**Issue:** #135
**Prioridad:** Media
**Milestone:** v2.26.0
**Depende de:** #129 (Seguir usuarios)

---

## Contexto

Modo Mapa ya cuenta con un sistema de compartir comercios via deep link externo (Web Share API / clipboard) y un perfil publico de usuario, pero no existe un mecanismo para recomendar un comercio directamente a otro usuario dentro de la app. El issue #129 (Seguir usuarios) introduce la relacion social entre usuarios que habilita esta funcionalidad. Con #135, el descubrimiento de comercios se vuelve social: "Juan te recomienda Cafe Roma" es mas relevante que un algoritmo.

## Problema

- No se pueden recomendar comercios a otros usuarios dentro de la plataforma; la unica opcion es copiar un link y enviarlo por WhatsApp u otra app externa, perdiendo contexto.
- El receptor de un link externo no sabe quien lo recomendo ni por que, eliminando el factor de confianza personal.
- No hay forma de ver un historial de recomendaciones recibidas, por lo que las sugerencias de amigos se pierden si no se actua inmediatamente.

## Solucion

### S1: Boton "Recomendar" en BusinessSheet

- Nuevo boton con icono `PersonAdd` o `Send` en la barra de acciones del BusinessSheet (junto a favorito, direcciones, compartir).
- Al tocar, abre un dialog (`RecommendDialog`) con:
  - Buscador de usuarios (reutiliza la busqueda de perfiles publicos de #129). Solo muestra usuarios seguidos + perfiles publicos.
  - Campo opcional de mensaje corto (max 200 chars).
  - Boton "Recomendar" que crea el documento y cierra el dialog.
- Optimistic UI: toast de exito inmediato ("Recomendacion enviada"), rollback si falla.
- Rate limit: max 20 recomendaciones/dia (precheck en UI + server-side en trigger).
- Solo para usuarios autenticados con email (no anonimos), dado que requiere perfil publico.

### S2: Notificacion in-app al destinatario

- Nuevo tipo de notificacion `recommendation` generado por Cloud Function trigger `onRecommendationCreated`.
- Formato: "{senderName} te recomienda {businessName}".
- Click en la notificacion abre el BusinessSheet del comercio.
- Respeta el setting de notificaciones del destinatario (nuevo toggle `notifyRecommendations` en `userSettings`).

### S3: Bandeja de recomendaciones recibidas

- Nueva seccion "Recomendaciones" en SideMenu, entre "Sugeridos para vos" y "Sorprendeme".
- Lista paginada (20 items) con `usePaginatedQuery`.
- Cada item muestra: avatar + nombre del remitente, nombre del comercio, mensaje opcional, fecha relativa.
- Click abre el BusinessSheet.
- Badge con count de no leidas en el item del menu.
- Pull-to-refresh. Lazy-loaded via `React.lazy()`.
- Empty state motivacional: "Todavia no recibiste recomendaciones. Segui a otros usuarios para empezar!"

### S4: Compartir externo (fallback)

- Si el usuario quiere recomendar a alguien que no esta en la plataforma, opcion de generar deep link `?business={id}&from={userId}` para compartir via Web Share API (reutiliza ShareButton existente).
- Fuera de scope principal, se resuelve con el share existente.

---

## Scope

| Item | Prioridad | Esfuerzo |
|------|-----------|----------|
| Coleccion `recommendations` (modelo de datos + Firestore rules) | Alta | S |
| `services/recommendations.ts` (create, list received, mark read) | Alta | S |
| `RecommendDialog` (buscador de usuario + mensaje + submit) | Alta | M |
| Boton "Recomendar" en BusinessSheet | Alta | S |
| Cloud Function trigger `onRecommendationCreated` (rate limit + notificacion) | Alta | M |
| Seccion "Recomendaciones" en SideMenu (`ReceivedRecommendations.tsx`) | Media | M |
| Toggle `notifyRecommendations` en userSettings | Media | S |
| Analytics events (recommendation_sent, recommendation_opened, recommendation_viewed) | Media | S |
| Admin: recomendaciones en tab Actividad | Baja | S |

**Esfuerzo total estimado:** L

---

## Out of Scope

- Recomendaciones algoritmicas ("Te podria gustar...") — ya cubierto por "Sugeridos para vos".
- Recomendaciones grupales (a multiples usuarios a la vez en un solo envio).
- Historial de recomendaciones enviadas por el usuario (solo bandeja de recibidas).
- Integracion con redes sociales (Facebook, Instagram).
- Recomendaciones bidireccionales (no es un chat, es una accion unidireccional).

---

## Tests

### Archivos que necesitaran tests

| Archivo | Tipo | Que testear |
|---------|------|-------------|
| `src/services/recommendations.ts` | Service | CRUD: create, fetchReceived, markAsRead. Validacion de inputs. Cache invalidation |
| `functions/src/triggers/recommendations.ts` | Trigger | Rate limit (20/dia), notificacion creada, respeta notifyRecommendations setting, counters |
| `src/components/RecommendDialog.tsx` | Component | Busqueda de usuarios, submit, validacion mensaje (max 200), loading/error states |
| `src/components/menu/ReceivedRecommendations.tsx` | Component | Lista vacia, items renderizados, click navega, mark as read |

### Criterios de testing

- Cobertura >= 80% del codigo nuevo
- Tests de validacion para todos los inputs del usuario
- Todos los paths condicionales cubiertos
- Side effects verificados (cache, analytics, notifications)

---

## Seguridad

- [ ] Firestore rules para `recommendations`: auth required, create solo owner (`senderId == auth.uid`), read solo destinatario (`recipientId == auth.uid`) o admin, no update por cliente, delete solo owner
- [ ] `keys().hasOnly()` en create para prevenir inyeccion de campos
- [ ] Validacion de longitud de mensaje (max 200 chars) en rules y client
- [ ] Rate limit server-side (20/dia) via `checkRateLimit` en trigger
- [ ] No exponer existencia de usuarios: busqueda solo retorna perfiles publicos (reutiliza patron de #129)
- [ ] `senderId` validado como `request.auth.uid` en rules (no confiable desde cliente)
- [ ] Moderacion del mensaje opcional via `checkModeration` en trigger

---

## Offline

### Data flows

| Operacion | Tipo (read/write) | Estrategia offline | Fallback UI |
|-----------|-------------------|-------------------|-------------|
| Enviar recomendacion | write | Encolar en IndexedDB via `withOfflineSupport` | Toast "Se enviara cuando vuelvas a conectar" |
| Listar recomendaciones recibidas | read | Firestore persistent cache (prod) | Datos cacheados, OfflineIndicator visible |
| Marcar como leida | write | Encolar en IndexedDB | Optimistic UI, sync al reconectar |

### Checklist offline

- [ ] Reads de Firestore: usan persistencia offline? Si, `persistentLocalCache` en prod
- [ ] Writes: tienen queue offline o optimistic UI? Si, via `withOfflineSupport` wrapper
- [ ] APIs externas: hay manejo de error de red? N/A (solo Firestore)
- [ ] UI: hay indicador de estado offline en contextos relevantes? Si, `OfflineIndicator` global
- [ ] Datos criticos: disponibles en cache para primera carga? Si, Firestore persistent cache

### Esfuerzo offline adicional: S

---

## Modularizacion

La solucion debe mantener separacion estricta UI/logica:

- `useRecommendations` hook encapsula fetch paginado, mark as read, unread count
- `RecommendDialog` recibe `businessId`/`businessName` via props, usa `useUserSearch` de #129
- `ReceivedRecommendations` usa `usePaginatedQuery` + `PaginatedListShell`, sin logica en SideMenu
- `services/recommendations.ts` maneja toda la interaccion con Firestore

### Checklist modularizacion

- [ ] Logica de negocio en hooks/services (no inline en componentes de layout)
- [ ] Componentes nuevos son reutilizables fuera del contexto actual de layout
- [ ] No se agregan useState de logica de negocio a AppShell o SideMenu
- [ ] Props explicitas en vez de dependencias implicitas a contextos de layout

---

## Success Criteria

1. Un usuario autenticado puede recomendar un comercio a otro usuario desde el BusinessSheet y el destinatario recibe notificacion in-app.
2. La bandeja de recomendaciones recibidas muestra todas las recomendaciones con datos del remitente, comercio y mensaje.
3. Click en una recomendacion abre el BusinessSheet del comercio.
4. Rate limit de 20 recomendaciones/dia se aplica correctamente (UI precheck + server-side).
5. La funcionalidad respeta configuracion de notificaciones del destinatario (`notifyRecommendations`).

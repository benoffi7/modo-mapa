# PRD: Feedback Status Tracking

**Issue:** #73
**Fecha:** 2026-03-14

## Descripcion

Permitir a los usuarios ver el estado de sus envios de feedback y recibir respuestas del equipo administrador. Agrega una seccion "Mis envios" al menu lateral, un sistema de estados (state machine) para cada feedback, y notificaciones cuando el admin responde.

## Contexto del proyecto

- **Feedback existente** (`src/components/menu/FeedbackForm.tsx`): formulario unidireccional de envio. El usuario envia feedback pero no puede ver el historial ni recibir respuestas.
- **Coleccion Firestore `feedback`**: documentos con `userId`, `message`, `category`, `createdAt`, `flagged`. Sin campo de estado ni respuesta.
- **SideMenu** (`src/components/layout/SideMenu.tsx`): drawer lateral con secciones dinámicas. Section type incluye `'feedback'` para el formulario de envio.
- **Notificaciones** (`src/components/notifications/NotificationItem.tsx`): sistema existente con tipos `like`, `photo_approved`, `photo_rejected`, `ranking`.
- **Cloud Functions**: trigger `onFeedbackCreated` que aplica rate limit, moderacion y contadores.
- **Admin dashboard**: `FeedbackList.tsx` muestra feedback recibido en tabla sin acciones de respuesta.

## Requisitos funcionales

### 1. Status state machine

Cada feedback tiene un estado que sigue la siguiente maquina de estados:

```text
pending -> viewed -> responded -> resolved
```

- `pending` ("Enviado"): estado inicial al crear feedback.
- `viewed` ("Visto"): el admin marco el feedback como visto (reservado para uso futuro).
- `responded` ("Respondido"): el admin envio una respuesta al usuario.
- `resolved` ("Resuelto"): el admin marco el feedback como resuelto/cerrado.

### 2. Seccion "Mis envios" en SideMenu

- Nuevo item "Mis envios" en la navegacion del drawer con icono `InboxOutlined`.
- Click abre una lista con todos los feedback enviados por el usuario.
- Cada item muestra: chip de categoria, chip de estado, preview del mensaje y fecha.
- Click en un item expande el detalle completo del mensaje.
- Si el feedback tiene respuesta del admin, se muestra en un bloque destacado.
- Indicador visual (punto verde) cuando hay una respuesta no leida por el usuario.

### 3. Respuestas del admin

- El admin puede responder a un feedback desde Cloud Functions (callable `respondToFeedback`).
- La respuesta se guarda en el documento de feedback (`adminResponse`, `respondedAt`, `respondedBy`).
- El estado cambia automaticamente a `responded`.
- Se crea una notificacion para el usuario.

### 4. Resolucion de feedback

- El admin puede marcar un feedback como resuelto (callable `resolveFeedback`).
- El estado cambia a `resolved`.

### 5. Notificaciones

- Cuando el admin responde, se crea una notificacion de tipo `feedback_response`.
- El usuario ve la notificacion en el sistema existente de notificaciones.
- La preferencia `notifyFeedback` en UserSettings controla si se envia la notificacion.

### 6. Marcado de lectura por el usuario

- Cuando el usuario expande un feedback con respuesta no leida, se marca `viewedByUser: true`.
- El punto verde de "no leido" desaparece.

## Requisitos no funcionales

- Respuesta del admin: maximo 500 caracteres (`MAX_ADMIN_RESPONSE_LENGTH`).
- El usuario solo puede leer sus propios feedback (Firestore rules).
- Solo el admin puede actualizar `status`, `adminResponse`, `respondedAt`, `respondedBy`.
- Solo el owner puede actualizar `viewedByUser`.
- Las Cloud Functions requieren admin con email verificado.

## Consideraciones UX

- La lista de "Mis envios" sigue la misma estructura visual que las demas listas del menu (FavoritesList, CommentsList, RatingsList).
- El bloque de respuesta del admin usa `bgcolor: 'action.hover'` para diferenciarse visualmente.
- Estado vacio: icono `InboxOutlined` + "No enviaste feedback todavia".
- El indicador de respuesta no leida es un punto verde de 8px junto a los chips de estado.

## Seguridad

- Firestore rules: `read` solo para owner o admin; `update` separado para admin (campos de respuesta) y owner (solo `viewedByUser`).
- Cloud Functions callable con `enforceAppCheck` y validacion de admin por email.
- Rate limit y moderacion existentes se mantienen en el trigger `onFeedbackCreated`.

# PRD — Panel de configuración de usuario

## Contexto

Phase 3 (v2.2) introdujo perfil público de usuario y notificaciones in-app. Actualmente no hay forma de que el usuario controle su visibilidad ni qué notificaciones recibe. Issue [#59](https://github.com/benoffi7/modo-mapa/issues/59).

## Objetivo

Dar al usuario control sobre su privacidad y preferencias de notificaciones desde un panel de configuración accesible en el menú lateral.

## Funcionalidades

### F1 — Panel de configuración

- Nueva sección "Configuración" en el menú lateral (icono engranaje)
- Accesible solo para usuarios autenticados
- Organizado en secciones con dividers

### F2 — Privacidad del perfil

- Toggle "Perfil público" (Switch de MUI)
- **Desactivado** (default): el click en tu nombre no abre el perfil. Se muestra solo el nombre sin estilo clickeable
- **Activado**: otros usuarios pueden ver tu perfil al hacer click en tu nombre en comentarios
- El estado se persiste en Firestore en `userSettings/{userId}`

### F3 — Preferencias de notificaciones

- Toggle principal "Notificaciones" que activa/desactiva todas
- Toggles granulares (indentados, deshabilitados si el principal está off):
  - "Likes en comentarios" — cuando alguien da like a tu comentario
  - "Fotos de menú" — cuando aprueban/rechazan tu foto
  - "Rankings" — cuando se publica un nuevo ranking
- Por defecto: todas desactivadas
- Cloud Functions consultan las preferencias antes de crear una notificación

### F4 — Persistencia

- Colección `userSettings/{userId}` con un doc por usuario
- Schema:

```typescript
interface UserSettings {
  profilePublic: boolean;       // default: false
  notificationsEnabled: boolean; // default: false
  notifyLikes: boolean;          // default: false
  notifyPhotos: boolean;         // default: false
  notifyRankings: boolean;       // default: false
  updatedAt: Date;
}
```

- Si el doc no existe, se asumen los defaults (todo desactivado)
- Firestore rules: solo el owner puede leer/escribir su propio doc

## Flujo de usuario

1. Abre menú lateral → sección "Configuración"
2. Ve toggles con estado actual (o defaults si nunca configuró)
3. Cambia un toggle → se guarda inmediatamente en Firestore (no hay botón "Guardar")
4. Feedback visual: el toggle cambia optimisticamente

## Impacto en features existentes

### Perfil público (UserProfileSheet)

- Al hacer click en un nombre en comentarios, se debe verificar si el usuario target tiene `profilePublic: true`
- Si es `false`, no abrir el drawer
- El nombre en comentarios no muestra estilo clickeable (sin cursor pointer ni underline) para usuarios con perfil privado

### Notificaciones (Cloud Functions)

- `createNotification()` en `functions/src/utils/notifications.ts` debe verificar las preferencias del destinatario antes de crear la notificación
- Si `notificationsEnabled: false` → no crear ninguna
- Si `notifyLikes: false` → no crear notificación de tipo `like`
- Si `notifyPhotos: false` → no crear de tipo `photo_approved` / `photo_rejected`
- Si `notifyRankings: false` → no crear de tipo `ranking`

## Fuera de scope

- Notificaciones push (web push notifications)
- Configuración de tema (ya existe el toggle de dark mode en el menú)
- Configuración de idioma
- Eliminación de cuenta

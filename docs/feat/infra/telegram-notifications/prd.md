# PRD: Notificaciones via Telegram Bot

**Feature:** telegram-notifications
**Fecha:** 2026-03-15
**Prioridad:** Alta (engagement y retention)
**Trigger:** El sistema de notificaciones actual (in-app polling cada 60s) solo funciona mientras el usuario tiene la app abierta. No hay forma de re-enganchar usuarios cuando la cierran.

---

## Problem

Modo Mapa tiene un sistema de notificaciones in-app robusto (likes, replies, fotos aprobadas, rankings, respuestas a feedback) pero con una limitacion critica: **las notificaciones solo se ven si el usuario abre la app**. El polling cada 60s es visibility-aware y se pausa cuando la tab esta en background.

Consecuencias:
- Los usuarios no se enteran de likes/replies hasta que vuelven a abrir la app.
- No hay mecanismo de re-engagement (nadie vuelve "porque le llego algo").
- El admin no recibe alertas en tiempo real de contenido reportado o rate-limit violations.
- Las metricas de actividad (rankings semanales, nuevos comentarios) no tienen canal push.

### Por que Telegram y no Web Push / FCM

| Alternativa | Problema |
|-------------|----------|
| Web Push (FCM) | Requiere service worker dedicado, permisos del browser, incompatible con iOS Safari < 16.4, conflicto potencial con el SW de Workbox/PWA existente |
| Email | Latencia alta, spam filters, requiere email verificado (muchos usuarios son anonimos) |
| Telegram Bot | Sin permisos del browser, funciona en mobile/desktop, el usuario ya tiene Telegram, setup simple con Bot API + webhook, sin costo |

---

## Solution

Bot de Telegram (`@ModoMapaBot`) que envia notificaciones push a usuarios vinculados. Cloud Function como webhook receptor + triggers existentes como emisores.

### Arquitectura

```
[Firestore trigger] → [notificationDispatcher CF] → [Telegram Bot API]
                                                   → [In-app notification] (existente)
```

El dispatcher lee la preferencia del usuario y envia por el canal configurado.

---

### S1: Vinculacion de cuenta Telegram

**Flujo:**
1. Usuario abre Settings > Notificaciones > "Recibir por Telegram"
2. App genera un codigo temporal (6 chars, TTL 5 min) y lo guarda en Firestore `telegramLinks/{code}`
3. UI muestra: "Enviale este codigo al bot: @ModoMapaBot" + boton deeplink `https://t.me/ModoMapaBot?start={code}`
4. Usuario envia `/start {code}` al bot
5. Cloud Function webhook valida el codigo, guarda `telegramChatId` en `users/{uid}`
6. Bot responde: "Listo! Vas a recibir notificaciones de Modo Mapa aca."
7. App detecta la vinculacion (listener en `users/{uid}`) y actualiza la UI

**Desvinculacion:** Boton en Settings que borra `telegramChatId`. El bot tambien acepta `/stop`.

**Files:**
- `src/components/user/TelegramLinkPanel.tsx` (nuevo)
- `src/components/user/SettingsPanel.tsx` (integrar panel)
- `functions/src/telegram/webhook.ts` (nuevo - webhook handler)
- `functions/src/telegram/bot.ts` (nuevo - Telegram API client)

**Firestore:**
- `telegramLinks/{code}`: `{ userId, createdAt, expiresAt }`
- `users/{uid}`: agregar campo `telegramChatId?: string`

### S2: Webhook Cloud Function

- Endpoint HTTPS callable: `POST /telegram-webhook`
- Valida el `X-Telegram-Bot-Api-Secret-Token` header
- Procesa comandos: `/start {code}`, `/stop`, `/status`
- Rate limit: 10 requests/min por chatId (reusar infra existente de `_rateLimits`)

**Files:**
- `functions/src/telegram/webhook.ts`
- `functions/src/index.ts` (export)

### S3: Dispatcher de notificaciones

Modificar los triggers existentes que crean notificaciones in-app para que TAMBIEN despachen via Telegram si el usuario tiene `telegramChatId`.

**Triggers a modificar:**
| Trigger | Notificacion Telegram |
|---------|-----------------------|
| `onCommentLikeCreated` | "A {user} le gusto tu comentario en {business}" |
| `onCommentCreated` (reply) | "{user} respondio tu comentario en {business}" |
| `onMenuPhotoUpdated` (approved) | "Tu foto de menu de {business} fue aprobada" |
| `onMenuPhotoUpdated` (rejected) | "Tu foto de menu de {business} fue rechazada" |

**Fase 2 (futuro):**
| Trigger | Notificacion |
|---------|-------------|
| Rankings semanales | "Subiste al puesto #{n} en el ranking semanal!" |
| Feedback respondido | "El admin respondio tu feedback" |
| Admin alerts | Contenido reportado, rate-limit violations |

**Files:**
- `functions/src/utils/notifications.ts` (agregar `dispatchTelegram()`)
- `functions/src/triggers/` (los 4 triggers de fase 1)

### S4: Preferencias granulares

Extender el sistema de preferencias de notificacion existente (`userSettings.notifications`) para incluir canal:

```typescript
notifications: {
  enabled: boolean;          // master toggle (existente)
  likes: boolean;            // (existente)
  replies: boolean;          // (existente)
  photos: boolean;           // (existente)
  rankings: boolean;         // (existente)
  channel: 'in-app' | 'telegram' | 'both';  // NUEVO
}
```

Default: `'in-app'` (comportamiento actual, sin cambios para usuarios existentes).

**Files:**
- `src/types/user.ts` (agregar campo)
- `src/components/user/SettingsPanel.tsx` (selector de canal)
- `functions/src/utils/notifications.ts` (leer preferencia)

---

## Scope

| Item | Prioridad | Esfuerzo | Riesgo |
|------|-----------|----------|--------|
| S1: Vinculacion cuenta | Critical | M | Bajo - flujo standard de Telegram bots |
| S2: Webhook CF | Critical | S | Bajo - endpoint stateless |
| S3: Dispatcher (fase 1) | Critical | M | Medio - tocar 4 triggers existentes |
| S4: Preferencias canal | Medium | S | Bajo - extension de schema existente |

**Esfuerzo total estimado:** ~2-3 sesiones de trabajo

---

## Out of Scope

- Comandos interactivos en el bot (buscar comercios, ver ratings desde Telegram)
- Inline keyboards para acciones (like desde Telegram)
- Grupos de Telegram (solo chats 1:1 con el bot)
- Web Push / FCM (puede evaluarse como canal adicional a futuro)
- Notificaciones para usuarios anonimos (requiere cuenta con email para vincular -- o no, pueden vincular Telegram directamente)
- Internacionalizacion del bot (solo es-AR)

---

## Success Criteria

1. Un usuario puede vincular su cuenta de Telegram en < 30 segundos
2. Las notificaciones llegan al chat de Telegram en < 5 segundos desde el evento
3. El usuario puede desvincularse desde la app o desde el bot
4. Las preferencias granulares respetan el canal elegido
5. El sistema in-app existente sigue funcionando identico para usuarios sin Telegram
6. Zero leakage: ningun `chatId` se expone en Firestore rules al cliente

---

## Consideraciones de seguridad

- **Bot token** en Secret Manager (no en env vars del workflow)
- **Webhook secret** para validar requests entrantes de Telegram
- **`telegramChatId`** como campo server-only: Firestore rules deben bloquear lectura/escritura desde el cliente. Solo Cloud Functions lo leen/escriben
- **Codigos de vinculacion**: TTL 5 min, single-use, borrado despues de uso
- **Rate limiting**: tanto en el webhook (10 req/min) como en el dispatcher (no spamear al usuario)
- **No PII en mensajes**: usar nombres de display, no emails

---

## Dependencies

- Bot de Telegram creado via @BotFather (config manual, 1 min)
- Bot token en Firebase Secret Manager
- Webhook URL registrada en Telegram Bot API (se hace en el deploy)
- Firestore rules actualizadas para proteger `telegramChatId`

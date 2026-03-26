# PRD: Chatbot Multiplataforma (Telegram + Slack)

**Feature:** chatbot-multiplatforma
**Categoria:** infra
**Fecha:** 2026-03-17
**Prioridad:** Alta

---

## Contexto

Modo Mapa es una webapp centrada en un mapa de negocios gastronómicos. Actualmente toda la interacción es vía browser. Agregar bots en Telegram y Slack permite que los usuarios interactúen con las funcionalidades de la app desde sus plataformas de mensajería, sin abrir el navegador.

## Problema

- Los usuarios solo pueden interactuar con Modo Mapa desde el browser.
- No hay canal conversacional para descubrir negocios rápidamente ("sorprendeme").
- No se aprovechan plataformas donde los usuarios ya pasan tiempo (Telegram, Slack).

## Solución

Un sistema de chatbot con arquitectura de **core compartido + adaptadores por plataforma**, desplegado como Cloud Functions de Firebase.

---

## Arquitectura

```
Telegram webhook ──→ adaptador Telegram ──┐
                                           ├──→ Bot Core ──→ Firestore / Business Data
Slack webhook ─────→ adaptador Slack ──────┘
```

### Capas

1. **Adaptadores** (`functions/src/bot/adapters/`): Reciben webhooks, normalizan input, formatean respuestas al formato de cada plataforma.
2. **Bot Core** (`functions/src/bot/core/`): Lógica de negocio, manejo de comandos, acceso a datos. Agnóstico de plataforma.
3. **Servicios** (`functions/src/bot/services/`): Acceso a Firestore, business data, auth. Reutilizan utils existentes donde sea posible.

### Formato común de mensajes

```typescript
interface BotRequest {
  userId: string;          // Firebase UID (post-vinculación)
  platformUserId: string;  // Telegram chat_id o Slack user_id
  platform: 'telegram' | 'slack';
  command: string;         // Comando normalizado
  args: string[];          // Argumentos del comando
  location?: { lat: number; lng: number }; // Si comparte ubicación
}

interface BotResponse {
  text: string;            // Texto principal (markdown genérico)
  buttons?: Button[];      // Acciones inline
  image?: string;          // URL de imagen (ej: foto de menú)
}
```

---

## Autenticación y vinculación de cuenta

### Flujo de vinculación

1. Usuario inicia el bot → recibe mensaje de bienvenida.
2. Bot pide email y contraseña de su cuenta de Modo Mapa.
3. Bot llama a Firebase Auth (server-side via Admin SDK) para verificar credenciales.
4. Se guarda el mapeo `platformUserId → firebaseUid` en Firestore (`botUsers` collection).
5. Sesión queda vinculada — no necesita volver a autenticarse.

### Collection `botUsers`

```
botUsers/{platform}_{platformUserId}
{
  firebaseUid: string,
  platform: 'telegram' | 'slack',
  platformUserId: string,
  linkedAt: Timestamp,
  lastActiveAt: Timestamp
}
```

### Seguridad

- Las credenciales se reciben por mensaje privado (DM) y **no se almacenan** — solo se usan para verificar y obtener el UID.
- En Telegram se rechaza auth en grupos, solo en chat privado.
- Rate limit en intentos de login: 5 intentos / hora por platformUserId.
- El usuario puede desvincular su cuenta con `/desvincular`.

---

## Comandos

### Descubrimiento

| Comando | Descripción | Ejemplo |
|---------|-------------|---------|
| `/sorprendeme` | Negocio aleatorio | "🎲 *La Panera Rosa* — Panadería en Palermo. ⭐ 4.2" |
| `/buscar <texto>` | Buscar por nombre | `/buscar panera` |
| `/categoria <cat>` | Filtrar por categoría | `/categoria cafe` |
| `/cerca` | Negocios cercanos (requiere ubicación) | Compartir ubicación → top 5 más cercanos |
| `/detalle <nombre>` | Info completa de un negocio | Dirección, teléfono, rating, tags, precio |

### Favoritos

| Comando | Descripción |
|---------|-------------|
| `/favoritos` | Listar mis favoritos |
| `/fav <nombre>` | Agregar a favoritos |
| `/unfav <nombre>` | Quitar de favoritos |

### Interacción

| Comando | Descripción |
|---------|-------------|
| `/comentar <nombre> <texto>` | Dejar un comentario |
| `/rating <nombre> <1-5>` | Calificar un negocio |
| `/tags <nombre>` | Ver tags de un negocio |
| `/votar <nombre> <tag>` | Votar un tag predefinido |

### Rankings y perfil

| Comando | Descripción |
|---------|-------------|
| `/ranking` | Top 10 semanal |
| `/miperfil` | Mi badge, score, posición |
| `/miscomentarios` | Mis últimos comentarios |
| `/misratings` | Mis últimos ratings |

### Listas compartidas

| Comando | Descripción |
|---------|-------------|
| `/listas` | Mis listas compartidas |
| `/lista <nombre>` | Ver items de una lista |
| `/agregaralista <lista> <negocio>` | Agregar negocio a lista |

### Cuenta

| Comando | Descripción |
|---------|-------------|
| `/vincular` | Vincular cuenta de Modo Mapa |
| `/desvincular` | Desvincular cuenta |
| `/notificaciones on/off` | Toggle notificaciones por bot |
| `/ayuda` | Lista de comandos disponibles |

### Lenguaje natural (fase 2)

Además de comandos, el bot entiende frases casuales:

- "sorprendeme" → `/sorprendeme`
- "quiero un café" → `/categoria cafe`
- "qué hay cerca?" → `/cerca` (pide ubicación si no la tiene)
- "mis favoritos" → `/favoritos`

---

## Notificaciones push (opcional, fase 2)

Si el usuario tiene notificaciones habilitadas, el bot le envía:

- Likes en sus comentarios
- Respuestas a sus comentarios
- Fotos aprobadas/rechazadas
- Cambios de ranking
- Respuestas a su feedback

Esto requiere un trigger en Cloud Functions que, al crear una `notification`, también la envíe por bot si el usuario tiene cuenta vinculada.

---

## Diferencias por plataforma

| Aspecto | Telegram | Slack |
|---------|----------|-------|
| **Formato** | MarkdownV2 | mrkdwn (Block Kit) |
| **Botones** | Inline Keyboard | Button elements |
| **Ubicación** | Nativa (share location) | No nativa (pedir lat/lng o dirección) |
| **Auth webhook** | Token + update secret | Signing secret + verification |
| **Grupos** | Soportado (pero auth solo en DM) | Soportado en canales/DMs |
| **Rate limits** | 30 msg/seg global | Varía por workspace |

---

## Cloud Functions (endpoints)

```typescript
// Webhooks
export const telegramWebhook = onRequest(handleTelegramWebhook);
export const slackWebhook = onRequest(handleSlackWebhook);

// Setup (one-time, admin callable)
export const setupTelegramBot = onCall(registerTelegramWebhook);
export const setupSlackBot = onCall(registerSlackWebhook);
```

### Secrets (Firebase Functions config)

- `TELEGRAM_BOT_TOKEN` — Token del bot de Telegram (bot nuevo, separado del admin bot)
- `SLACK_BOT_TOKEN` — OAuth token del Slack app
- `SLACK_SIGNING_SECRET` — Para verificar webhooks de Slack

---

## Estructura de archivos

```
functions/src/bot/
├── adapters/
│   ├── telegram.ts        # Webhook handler + response formatter
│   └── slack.ts           # Webhook handler + response formatter
├── core/
│   ├── router.ts          # Normaliza input → comando → handler
│   ├── commands/
│   │   ├── discovery.ts   # sorprendeme, buscar, categoria, cerca, detalle
│   │   ├── favorites.ts   # favoritos, fav, unfav
│   │   ├── interaction.ts # comentar, rating, tags, votar
│   │   ├── rankings.ts    # ranking, miperfil, miscomentarios, misratings
│   │   ├── lists.ts       # listas, lista, agregaralista
│   │   └── account.ts     # vincular, desvincular, notificaciones, ayuda
│   └── nlp.ts             # Fase 2: intent detection para lenguaje natural
├── services/
│   ├── auth.ts            # Vinculación platformUser ↔ Firebase UID
│   ├── businesses.ts      # Acceso a business data (JSON estático)
│   └── firestore.ts       # Queries a Firestore (ratings, comments, favorites, etc.)
└── types.ts               # BotRequest, BotResponse, interfaces comunes
```

---

## Fases de implementación

### Fase 1: MVP
- Arquitectura core + adaptadores
- Vinculación de cuenta
- Comandos de descubrimiento: `/sorprendeme`, `/buscar`, `/categoria`, `/detalle`
- `/favoritos`, `/fav`, `/unfav`
- `/ayuda`
- Deploy en ambas plataformas

### Fase 2: Interacción completa
- `/comentar`, `/rating`, `/tags`, `/votar`
- `/ranking`, `/miperfil`
- `/listas`
- NLP básico para lenguaje natural
- Notificaciones push vía bot

### Fase 3: Mejoras
- `/cerca` con ubicación
- Inline mode en Telegram (buscar negocios desde cualquier chat)
- Slash commands nativos en Slack
- Métricas de uso del bot en admin dashboard

---

## Métricas de éxito

- Usuarios vinculados (botUsers count)
- Comandos ejecutados por día (por plataforma)
- Comandos más usados
- Retención: usuarios activos semanales vía bot
- Conversión: acciones en bot que llevan a visitar la webapp

---

## Fuera de alcance

- Subir fotos de menú vía bot (UX compleja, mejor en webapp)
- Funcionalidades de admin vía bot
- Bot de voz
- Integración con otros bots/apps de terceros

---

## Dependencias

- Firebase Cloud Functions v2 (ya configurado)
- Firebase Admin SDK (ya disponible)
- Telegram Bot API (nuevo bot, @BotFather)
- Slack API (nueva app en api.slack.com)
- Business data: `src/data/businesses.json` (se copia o importa en functions)

## Riesgos

- **Credenciales por chat**: Aunque es DM, el usuario escribe su contraseña en texto plano. Alternativa futura: magic link por email.
- **Rate limits de plataforma**: Telegram limita 30 msg/seg, Slack varía. Necesita queue si hay muchos usuarios.
- **Consistencia de datos**: El bot lee Firestore directamente — mismas reglas de seguridad aplican server-side vía Admin SDK.
- **Mantenimiento dual**: Cada feature nueva en la webapp requiere considerar si se expone en el bot.

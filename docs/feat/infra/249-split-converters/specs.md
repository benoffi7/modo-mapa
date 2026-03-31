# Specs: Refactor: splitear converters.ts

**PRD:** [prd.md](prd.md)
**Fecha:** 2026-03-30

---

## Modelo de datos

No hay cambios en el modelo de datos. Este refactor es puramente organizativo: mover codigo existente a archivos mas pequenos sin modificar ningun tipo, campo ni coleccion.

### Interfaces afectadas

Ninguna. Todos los tipos se importan desde `src/types/` y no se modifican.

---

## Firestore Rules

No se modifican. Los converters son funciones puras de transformacion client-side.

### Rules impact analysis

No aplica. No se agregan queries nuevas ni se cambia la logica de ninguna query existente.

### Field whitelist check

No aplica. No se agregan ni modifican campos en ningun servicio.

---

## Cloud Functions

No aplica. Los converters son exclusivamente del frontend (`src/config/`).

---

## Componentes

No hay componentes nuevos ni modificados. Los converters son consumidos por servicios y hooks, no por componentes.

---

## Textos de usuario

No aplica. Los converters no contienen textos visibles al usuario.

---

## Hooks

No hay hooks nuevos ni modificados. Los hooks que importan desde `config/converters` seguiran importando desde la misma ruta gracias al barrel re-export.

---

## Servicios

No hay servicios nuevos ni modificados. Los 22 archivos de servicios que importan converters no necesitan cambios de import path.

---

## Estructura de archivos

### Archivo original (505 lineas)

`src/config/converters.ts` contiene 18 converters:

| Converter | Tipo | Lineas aprox. |
|-----------|------|---------------|
| `userProfileConverter` | UserProfile | 15 |
| `userSettingsConverter` | UserSettings | 47 |
| `ratingConverter` | Rating | 23 |
| `commentConverter` | Comment | 29 |
| `commentLikeConverter` | CommentLike | 9 |
| `userTagConverter` | UserTag | 15 |
| `customTagConverter` | CustomTag | 19 |
| `favoriteConverter` | Favorite | 13 |
| `menuPhotoConverter` | MenuPhoto | 29 |
| `priceLevelConverter` | PriceLevel | 21 |
| `feedbackConverter` | Feedback | 32 |
| `followConverter` | Follow | 16 |
| `activityFeedItemConverter` | ActivityFeedItem | 28 |
| `checkinConverter` | CheckIn | 22 |
| `recommendationConverter` | Recommendation | 28 |
| `sharedListConverter` | SharedList | 30 |
| `listItemConverter` | ListItem | 20 |
| `trendingDataConverter` | TrendingData | 28 |
| `userRankingConverter` | UserRanking | 21 |
| `notificationConverter` | AppNotification | 29 |

### Archivos destino

```text
src/config/converters/
  index.ts              — barrel re-export
  userConverters.ts     — userProfileConverter, userSettingsConverter
  businessConverters.ts — ratingConverter, commentConverter, commentLikeConverter,
                          userTagConverter, customTagConverter, favoriteConverter,
                          menuPhotoConverter, priceLevelConverter
  socialConverters.ts   — followConverter, activityFeedItemConverter,
                          recommendationConverter, checkinConverter
  listConverters.ts     — sharedListConverter, listItemConverter
  rankingConverters.ts  — userRankingConverter, notificationConverter,
                          trendingDataConverter
  feedbackConverters.ts — feedbackConverter
```

### Estimacion de tamano por archivo

| Archivo | Lineas estimadas | Dentro de limite? |
|---------|-----------------|-------------------|
| `index.ts` | ~20 | Si (< 400) |
| `userConverters.ts` | ~70 (imports + 2 converters) | Si |
| `businessConverters.ts` | ~170 (imports + 8 converters) | Si |
| `socialConverters.ts` | ~105 (imports + 4 converters) | Si |
| `listConverters.ts` | ~60 (imports + 2 converters) | Si |
| `rankingConverters.ts` | ~90 (imports + 3 converters) | Si |
| `feedbackConverters.ts` | ~45 (imports + 1 converter) | Si |

Ningun archivo supera 200 lineas (criterio del PRD).

---

## Consumidores (23 archivos, sin cambios)

Todos los consumidores importan desde `../config/converters` o `../../config/converters` (sin extension `.ts`). Cuando TypeScript resuelve `config/converters`, si encuentra un directorio con `index.ts`, lo usa automaticamente. No se necesitan cambios en ningun consumidor.

| Archivo consumidor | Converters importados |
|---|---|
| `services/businessData.ts` | ratingConverter, commentConverter, userTagConverter, customTagConverter, priceLevelConverter, menuPhotoConverter |
| `services/ratings.ts` | ratingConverter |
| `services/comments.ts` | commentConverter |
| `services/favorites.ts` | favoriteConverter |
| `services/menuPhotos.ts` | menuPhotoConverter |
| `services/priceLevels.ts` | priceLevelConverter |
| `services/feedback.ts` | feedbackConverter |
| `services/follows.ts` | followConverter |
| `services/checkins.ts` | checkinConverter |
| `services/activityFeed.ts` | activityFeedItemConverter |
| `services/recommendations.ts` | recommendationConverter |
| `services/sharedLists.ts` | sharedListConverter, listItemConverter |
| `services/trending.ts` | trendingDataConverter |
| `services/rankings.ts` | userRankingConverter |
| `services/notifications.ts` | notificationConverter |
| `services/suggestions.ts` | favoriteConverter, ratingConverter, userTagConverter |
| `services/userProfile.ts` | userProfileConverter, userSettingsConverter (+ otros) |
| `services/userSettings.ts` | userSettingsConverter |
| `services/admin/users.ts` | userProfileConverter, userSettingsConverter (+ otros) |
| `services/admin/content.ts` | feedbackConverter, menuPhotoConverter, trendingDataConverter, userRankingConverter, sharedListConverter |
| `services/admin/social.ts` | followConverter, recommendationConverter |
| `services/admin/activity.ts` | activityFeedItemConverter (+ otros) |
| `hooks/usePriceLevelFilter.ts` | priceLevelConverter |
| `hooks/useVerificationBadges.ts` | ratingConverter, checkinConverter |

---

## Integracion

### Resolucion de modulos TypeScript/Vite

Cuando se importa `from '../config/converters'`:

1. TypeScript busca `config/converters.ts` (archivo)
2. Si no existe, busca `config/converters/index.ts` (directorio con barrel)

Al eliminar `converters.ts` y crear `converters/index.ts`, la resolucion funciona identicamente. Vite usa la misma logica de resolucion de Node/TS.

### Preventive checklist

- [x] **Service layer**: No aplica — no se agregan componentes
- [x] **Duplicated constants**: No aplica — solo se mueve codigo
- [x] **Context-first data**: No aplica
- [x] **Silent .catch**: No aplica
- [x] **Stale props**: No aplica

---

## Tests

El archivo de test actual (`src/config/converters.test.ts`, 516 lineas, 42 test cases) cubre 15 de los 18 converters. Faltan tests para:

- `trendingDataConverter`
- `followConverter`
- `activityFeedItemConverter`
- `checkinConverter`
- `recommendationConverter`

### Estrategia de tests

Mantener un unico archivo de test que importa desde el barrel (`./converters`). Razones:

1. El test file ya tiene 516 lineas y 42 cases que cubren 15 converters
2. Mover assertions entre archivos no agrega valor — solo cambia la ubicacion
3. El test importa desde `./converters` (barrel), que valida que el barrel re-exporta correctamente
4. Si el barrel falla, todos los tests fallan — es la mejor validacion de la integracion

Sin embargo, el test file de 516 lineas tambien supera el limite de 400. Se splitea en archivos por dominio paralelos a los converters.

| Archivo test | Que testear | Tipo |
|-------------|-------------|------|
| `src/config/converters/userConverters.test.ts` | toFirestore/fromFirestore de userProfile y userSettings | Unit |
| `src/config/converters/businessConverters.test.ts` | toFirestore/fromFirestore de rating, comment, commentLike, userTag, customTag, favorite, menuPhoto, priceLevel | Unit |
| `src/config/converters/socialConverters.test.ts` | toFirestore/fromFirestore de follow, activityFeedItem, recommendation, checkin | Unit |
| `src/config/converters/listConverters.test.ts` | toFirestore/fromFirestore de sharedList, listItem | Unit |
| `src/config/converters/rankingConverters.test.ts` | toFirestore/fromFirestore de userRanking, notification, trendingData | Unit |
| `src/config/converters/feedbackConverters.test.ts` | toFirestore/fromFirestore de feedback | Unit |

### Tests nuevos a agregar

Para los 5 converters sin cobertura, agregar tests en el archivo de dominio correspondiente:

| Converter | Archivo test | Cases nuevos |
|-----------|-------------|-------------|
| `trendingDataConverter` | `rankingConverters.test.ts` | toFirestore, fromFirestore con businesses, fromFirestore con array vacio |
| `followConverter` | `socialConverters.test.ts` | round-trip |
| `activityFeedItemConverter` | `socialConverters.test.ts` | toFirestore, fromFirestore con referenceId default |
| `checkinConverter` | `socialConverters.test.ts` | toFirestore con/sin location, fromFirestore con/sin location |
| `recommendationConverter` | `socialConverters.test.ts` | toFirestore, fromFirestore con defaults |

---

## Analytics

No aplica.

---

## Offline

No aplica. Los converters son funciones puras de transformacion client-side. El comportamiento offline de los consumidores no cambia.

---

## Decisiones tecnicas

### 1. Barrel re-export vs actualizar imports

**Decision:** Usar barrel `index.ts` que re-exporta todo.
**Razon:** Los 23 consumidores no necesitan cambios. TypeScript resuelve `config/converters` como `config/converters/index.ts` automaticamente.
**Alternativa rechazada:** Actualizar los 23+ imports a rutas especificas (`config/converters/businessConverters`). Mas cambios, mas riesgo, sin beneficio claro.

### 2. Splitear tests vs mantener un unico test file

**Decision:** Splitear tests en archivos por dominio paralelos a los converters.
**Razon:** El test file actual (516 lineas) tambien viola la directiva de 400 lineas. Splitear mantiene la coherencia: cada modulo tiene su test adyacente.
**Alternativa rechazada:** Un unico test file. Seguiria violando el limite y no seria coherente con el split del source.

### 3. feedbackConverter en archivo propio vs en businessConverters

**Decision:** Archivo propio `feedbackConverters.ts`.
**Razon:** Feedback es un dominio distinto de business (no esta asociado a un comercio necesariamente). El PRD lo propone asi.
**Alternativa rechazada:** Agruparlo con business. Semanticamente incorrecto.

---

## Hardening de seguridad

No aplica. Este refactor no agrega superficies de ataque. Los converters son funciones puras de transformacion de datos sin interaccion con la red ni input de usuario.

---

## Deuda tecnica: mitigacion incorporada

| Issue | Que se resuelve | Paso del plan |
|-------|----------------|---------------|
| #249 converters.ts 505 lineas | Archivo eliminado, reemplazado por 6 archivos < 200 lineas cada uno | Fase 1 completa |
| converters.test.ts 516 lineas | Test file tambien splitado por dominio | Fase 2 |
| 5 converters sin tests (trending, follow, activity, checkin, recommendation) | Tests agregados en archivos de dominio correspondientes | Fase 2 |

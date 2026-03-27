# PRD: Rating post check-in — prompt 2-4h despues de check-in

**Feature:** rating-post-checkin
**Categoria:** social
**Fecha:** 2026-03-27
**Issue:** #199
**Prioridad:** Media

---

## Contexto

Modo Mapa ya cuenta con un sistema de check-in en comercios (Firestore `checkins` collection, cooldown de 4h, limite 10/dia, proximidad soft) y un sistema de ratings (1-5 estrellas + multi-criterio). Sin embargo, no existe un vinculo entre ambas acciones: el usuario hace check-in pero no recibe ningun estimulo posterior para calificar el comercio visitado. Este patron de "rating post-visita" es comun en apps como Uber, Google Maps y DoorDash para capturar feedback fresco.

## Problema

- Los ratings dependen de que el usuario vuelva voluntariamente al comercio en el mapa y decida calificarlo, lo cual tiene baja conversion
- Los check-ins generan datos de visita valiosos pero no se aprovechan como trigger para engagement adicional
- Los ratings obtenidos son potencialmente menos frescos porque no se capturan en el momento optimo post-visita (2-4 horas despues, cuando la experiencia esta fresca pero el usuario ya evaluo la visita completa)

## Solucion

### S1 — Hook `useRatingPrompt`: logica de deteccion y estado

Un hook dedicado que al montar (apertura de la app) consulta los check-ins recientes del usuario y determina si hay alguno elegible para prompt de rating.

**Criterios de elegibilidad:**
- Check-in con `createdAt` entre 2 y 8 horas atras (ventana ampliada vs las 2-4h del issue para cubrir usuarios que abren la app mas tarde)
- El usuario NO tiene un rating existente para ese `businessId` (consulta `ratings` collection con doc ID `{userId}__{businessId}`)
- El prompt no fue descartado previamente para ese check-in (tracking en localStorage)
- Maximo 1 prompt activo a la vez (el check-in elegible mas reciente)

**Constantes** (en `src/constants/checkin.ts`):
- `RATING_PROMPT_MIN_HOURS = 2`
- `RATING_PROMPT_MAX_HOURS = 8`
- `RATING_PROMPT_MAX_PER_DAY = 3` (evitar fatiga si el usuario hace muchos check-ins)

El hook expone: `{ promptData: { businessId, businessName, checkInId } | null, dismiss: () => void, navigate: () => void }`.

### S2 — Componente `RatingPromptBanner`: UI del prompt

Banner dismisseable que aparece en la zona superior del Home (debajo del search bar, antes del mapa), siguiendo el patron existente de banners contextuales (similar a `AccountBanner` y `ActivityReminder`).

**Diseno:**
- Card compacta con fondo `action.hover`, borde izquierdo `warning.main` (4px)
- Icono de estrella + texto: "Como fue tu visita a {businessName}?"
- Boton primario: "Calificar" (abre BusinessSheet del comercio)
- Boton secundario (IconButton X): dismiss
- Animacion fade-in (200ms) y fade-out al dismiss
- Dark mode aware (usa tokens de MUI theme)

**Interaccion:**
- Tap en "Calificar" -> `setSelectedBusiness(business)` via `SelectionContext` (patron existente de deep linking), lo que abre el BusinessSheet. Scroll automatico a la seccion de rating no es necesario porque ya esta visible arriba del sheet
- Tap en X -> dismiss, se guarda en localStorage para no volver a mostrar ese check-in
- Si el usuario califica (rating submit detectado via `anon-interaction` event o refetch), el banner desaparece automaticamente

### S3 — Analytics y metricas

Nuevos eventos en `constants/analyticsEvents.ts`:
- `EVT_RATING_PROMPT_SHOWN` — el banner se muestra (con `business_id`, `hours_since_checkin`)
- `EVT_RATING_PROMPT_CLICKED` — el usuario toca "Calificar"
- `EVT_RATING_PROMPT_DISMISSED` — el usuario descarta el prompt
- `EVT_RATING_PROMPT_CONVERTED` — el usuario efectivamente deja un rating despues de ver el prompt (requiere tracking del flujo completo)

---

## Scope

| Item | Prioridad | Esfuerzo |
|------|-----------|----------|
| Hook `useRatingPrompt` (logica de elegibilidad, localStorage tracking) | Alta | M |
| Constantes en `constants/checkin.ts` | Alta | S |
| Componente `RatingPromptBanner` (UI, dismiss, navegacion) | Alta | M |
| Integracion en Home/AppShell (render condicional del banner) | Alta | S |
| Analytics events (4 eventos nuevos) | Alta | S |
| Tests del hook `useRatingPrompt` | Alta | M |
| Tests del componente `RatingPromptBanner` | Media | S |

**Esfuerzo total estimado:** M

---

## Out of Scope

- Push notifications nativas (Web Push) para el prompt de rating — esto seria una mejora futura que requiere permisos adicionales y service worker changes
- Prompt de rating para visitas sin check-in (basado en localStorage de "recientes") — podria evaluarse despues de medir la conversion de este approach
- Multi-prompt simultaneo (mostrar varios banners para varios check-ins) — siempre se muestra maximo 1
- Personalizacion del timing por usuario (machine learning sobre horarios optimos)
- Recordatorio por notificacion in-app (tipo `notifications` collection) — el banner es suficiente como primer iteracion

---

## Tests

### Archivos que necesitaran tests

| Archivo | Tipo | Que testear |
|---------|------|-------------|
| `src/hooks/useRatingPrompt.ts` | Hook | Ventana de tiempo (2-8h), exclusion si ya califico, exclusion si ya dismisseado, limite diario de prompts, seleccion del check-in mas reciente, dismiss persiste en localStorage |
| `src/hooks/useRatingPrompt.test.ts` | Test | 10-12 cases: happy path, too early (<2h), too late (>8h), already rated, already dismissed, max per day, no checkins, multiple eligible (picks most recent), dismiss function, auto-hide after rating |
| `src/components/home/RatingPromptBanner.tsx` | Component | Render con datos, click en calificar navega a business, click en X dismiss, no render si null |
| `src/components/home/RatingPromptBanner.test.tsx` | Test | 4-5 cases: renders banner, calificar click calls navigate, dismiss click calls dismiss, null data renders nothing |

### Criterios de testing

- Cobertura >= 80% del codigo nuevo
- Tests de validacion para la ventana de tiempo (edge cases en limites 2h y 8h)
- Todos los paths condicionales cubiertos (ya califico, ya dismisseo, limite diario)
- Side effects verificados (localStorage writes, analytics tracking, SelectionContext update)
- Mock strategy: mock `fetchMyCheckIns` y `getDoc` de ratings, mock `localStorage`, mock `trackEvent`, fake timers para ventana de tiempo

---

## Seguridad

- [ ] No se crean colecciones nuevas en Firestore (se leen `checkins` y `ratings` existentes, ambas ya con rules)
- [ ] localStorage keys para dismiss tracking no contienen datos sensibles (solo `checkInId` como key)
- [ ] Validacion client-side de que el `businessId` del check-in existe en `allBusinesses` antes de mostrar el prompt (previene prompts para comercios eliminados)
- [ ] Sin strings magicos: usar `COLLECTIONS.CHECKINS` y `COLLECTIONS.RATINGS` existentes
- [ ] Analytics events no incluyen PII (solo `business_id` y `hours_since_checkin`)

---

## Offline

### Data flows

| Operacion | Tipo (read/write) | Estrategia offline | Fallback UI |
|-----------|-------------------|-------------------|-------------|
| Fetch check-ins recientes del usuario | read | Firestore persistent cache en prod sirve datos cacheados | Si no hay datos cacheados, no mostrar banner (silencioso) |
| Check si existe rating para businessId | read | Firestore persistent cache | Asumir que no hay rating, mostrar prompt (peor caso: usuario ve prompt pero ya califico) |
| Dismiss del prompt | write (localStorage) | Funciona offline nativamente | N/A |
| Navegacion a BusinessSheet | local state | Funciona offline (SelectionContext) | BusinessSheet maneja su propio estado offline |

### Checklist offline

- [x] Reads de Firestore: usan persistencia offline (persistent cache en prod ya habilitado)
- [ ] Writes: no hay writes a Firestore en esta feature (dismiss es localStorage)
- [ ] APIs externas: no se usan APIs externas
- [ ] UI: no se necesita indicador offline especifico (si offline, simplemente no aparece el banner o aparece con datos cacheados)
- [x] Datos criticos: check-ins recientes disponibles en cache si el usuario los vio antes

### Esfuerzo offline adicional: S

No se requiere esfuerzo adicional significativo. La feature es read-only desde Firestore y el dismiss es localStorage. El comportamiento degradado (no mostrar banner) es aceptable.

---

## Modularizacion

La logica vive enteramente en un hook dedicado (`useRatingPrompt`), siguiendo el patron establecido por `useActivityReminder` y `useOnboardingHint`. El componente `RatingPromptBanner` recibe datos via props del hook.

### Checklist modularizacion

- [ ] Logica de negocio en hooks/services: toda la logica de elegibilidad en `useRatingPrompt`, no en AppShell ni en el banner
- [ ] Componentes nuevos son reutilizables: `RatingPromptBanner` recibe `businessName`, `onRate`, `onDismiss` como props explicitas
- [ ] No se agregan useState de logica de negocio a AppShell o SideMenu: AppShell solo consume `const { promptData, dismiss, navigate } = useRatingPrompt()`
- [ ] Props explicitas en vez de dependencias implicitas: el banner no importa contextos directamente, recibe todo via props
- [ ] Cada prop de accion tiene handler real: `onRate` llama a `setSelectedBusiness` + tracking, `onDismiss` persiste en localStorage + tracking

---

## Success Criteria

1. Despues de hacer check-in y abrir la app 2-8 horas mas tarde, aparece un banner preguntando "Como fue tu visita a {nombre}"
2. Tocar "Calificar" abre el BusinessSheet del comercio visitado, facilitando la calificacion inmediata
3. El banner no aparece si el usuario ya califico ese comercio, si ya lo descarto, o si supero 3 prompts en el dia
4. La conversion check-in-a-rating es medible via los 4 analytics events (`shown`, `clicked`, `dismissed`, `converted`)
5. El feature no genera queries adicionales en cada apertura de app para usuarios sin check-ins recientes (short-circuit temprano si no hay check-ins en las ultimas 8h)

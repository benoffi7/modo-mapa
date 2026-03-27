# Plan: Rating post check-in prompt

**Specs:** [specs.md](specs.md)
**Fecha:** 2026-03-27

---

## Fases de implementacion

### Fase 1: Constantes y analytics events

**Branch:** `feat/rating-post-checkin`

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/constants/checkin.ts` | Agregar `RATING_PROMPT_MIN_HOURS = 2`, `RATING_PROMPT_MAX_HOURS = 8`, `RATING_PROMPT_MAX_PER_DAY = 3` |
| 2 | `src/constants/storage.ts` | Agregar `STORAGE_KEY_RATING_PROMPT_DISMISSED = 'rating_prompt_dismissed'` y `STORAGE_KEY_RATING_PROMPT_SHOWN_TODAY = 'rating_prompt_shown_today'` |
| 3 | `src/constants/analyticsEvents.ts` | Agregar `EVT_RATING_PROMPT_SHOWN`, `EVT_RATING_PROMPT_CLICKED`, `EVT_RATING_PROMPT_DISMISSED`, `EVT_RATING_PROMPT_CONVERTED` |

### Fase 2: Hook `useRatingPrompt`

| Paso | Archivo | Cambio |
|------|---------|--------|
| 4 | `src/hooks/useRatingPrompt.ts` | Crear hook completo. Imports: `useAuth`, `useNavigateToBusiness`, `fetchMyCheckIns`, `getDoc`/`doc` de firestore, `allBusinesses`, `trackEvent`, constantes de checkin y storage. Implementar logica de elegibilidad con short-circuit: fetch check-ins, filtrar por ventana 2-8h, filtrar dismisses de localStorage, validar businessId en allBusinesses, verificar limite diario, getDoc para rating existence. Exponer `{ promptData, dismiss, navigateToBusiness }`. Dismiss: agregar checkInId a localStorage array, trackear `EVT_RATING_PROMPT_DISMISSED`, setear promptData null. Navigate: llamar `navigateToBusiness(businessId)` del hook importado, trackear `EVT_RATING_PROMPT_CLICKED`, registrar checkInId como dismissed. Auto-hide via `anon-interaction` listener con refs estables (patron de `useActivityReminder`). Track `EVT_RATING_PROMPT_SHOWN` una sola vez con `analyticsTracked` ref. Track `EVT_RATING_PROMPT_CONVERTED` cuando se detecta rating post-prompt |

### Fase 3: Componente `RatingPromptBanner`

| Paso | Archivo | Cambio |
|------|---------|--------|
| 5 | `src/components/home/RatingPromptBanner.tsx` | Crear componente. Props: `businessName: string`, `onRate: () => void`, `onDismiss: () => void`. UI: Box con `bgcolor: 'action.hover'`, `borderLeft: 4px solid`, `borderColor: 'warning.main'`. Dentro: Stack horizontal con Icon Star, Typography con "Como fue tu visita a {businessName}?", Button "Calificar" que llama `onRate`, IconButton Close que llama `onDismiss`. Wrappear en MUI `Fade` con `in={true}` timeout 200ms. Padding compacto (px: 2, py: 1.5). Responsive: texto con `variant="body2"` |

### Fase 4: Integracion en HomeScreen

| Paso | Archivo | Cambio |
|------|---------|--------|
| 6 | `src/components/home/HomeScreen.tsx` | Importar `useRatingPrompt` y `RatingPromptBanner`. Invocar `const { promptData, dismiss, navigateToBusiness } = useRatingPrompt()`. Renderizar condicionalmente: `{promptData && <RatingPromptBanner businessName={promptData.businessName} onRate={navigateToBusiness} onDismiss={dismiss} />}` entre `<GreetingHeader />` y `<QuickActions />` |

### Fase 5: Tests

| Paso | Archivo | Cambio |
|------|---------|--------|
| 7 | `src/hooks/useRatingPrompt.test.ts` | Crear test file. Setup: mock `../config/firebase`, `../config/collections`, `firebase/firestore` (getDoc, doc, collection), `../services/checkins` (fetchMyCheckIns), `../utils/analytics` (trackEvent), `../hooks/useBusinesses` (allBusinesses), `../hooks/useNavigateToBusiness`, `../context/AuthContext` (useAuth). Use `vi.useFakeTimers()` para controlar Date.now(). 12 test cases: (1) happy path 3h, (2) too early 1h, (3) too late 9h, (4) edge 2h exact, (5) edge 8h exact, (6) already rated, (7) already dismissed, (8) max per day, (9) multiple picks most recent, (10) no user, (11) no check-ins, (12) business not in allBusinesses skips to next |
| 8 | `src/components/home/RatingPromptBanner.test.tsx` | Crear test file. 4 test cases: (1) renders banner with businessName text, (2) calificar button calls onRate, (3) close button calls onDismiss, (4) shows star icon |

---

## Orden de implementacion

1. `src/constants/checkin.ts` -- sin dependencias
2. `src/constants/storage.ts` -- sin dependencias
3. `src/constants/analyticsEvents.ts` -- sin dependencias
4. `src/hooks/useRatingPrompt.ts` -- depende de pasos 1-3
5. `src/components/home/RatingPromptBanner.tsx` -- sin dependencias logicas
6. `src/components/home/HomeScreen.tsx` -- depende de pasos 4 y 5
7. `src/hooks/useRatingPrompt.test.ts` -- depende de paso 4
8. `src/components/home/RatingPromptBanner.test.tsx` -- depende de paso 5

Pasos 1-3 pueden ejecutarse en paralelo. Pasos 4 y 5 pueden ejecutarse en paralelo. Pasos 7 y 8 pueden ejecutarse en paralelo.

## Riesgos

1. **Latencia del fetch inicial:** `fetchMyCheckIns` con limit 20 + N `getDoc` calls secuenciales para ratings pueden causar un flash de banner si la respuesta es lenta. **Mitigacion:** El banner tiene fade-in de 200ms. Si la verificacion tarda, el banner simplemente aparece despues de un breve delay (no hay estado loading visible para esta feature, por diseno).

2. **Datos stale en Firestore persistent cache:** En produccion, el cache de Firestore podria servir check-ins desactualizados o ratings que no existen aun. **Mitigacion:** El peor caso es mostrar un prompt innecesario (usuario ya califico), lo cual es benigno: al abrir BusinessSheet, vera su rating existente. El PRD acepta este tradeoff en la seccion Offline.

3. **localStorage pollution si el usuario hace muchos check-ins:** El array de dismissed IDs crece indefinidamente. **Mitigacion:** Al verificar, se puede limpiar IDs de check-ins con mas de 24h (fuera de la ventana de 8h, no sirven). Implementar limpieza en el hook al montar.

## Criterios de done

- [ ] Banner aparece en HomeScreen 2-8h despues de un check-in sin rating
- [ ] "Calificar" navega al BusinessSheet del comercio correcto (tab Buscar)
- [ ] Dismiss persiste en localStorage y no vuelve a aparecer para ese check-in
- [ ] Maximo 3 prompts por dia
- [ ] Banner no aparece si el usuario ya califico el comercio
- [ ] 4 analytics events se disparan correctamente
- [ ] Auto-hide funciona al calificar desde el BusinessSheet
- [ ] Tests pasan con >= 80% coverage en codigo nuevo
- [ ] No lint errors
- [ ] Build succeeds

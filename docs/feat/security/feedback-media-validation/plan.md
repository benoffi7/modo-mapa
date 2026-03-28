# Plan: Feedback Media URL Validation

**Specs:** [specs.md](specs.md)
**Fecha:** 2026-03-28

---

## Fases de implementacion

### Fase 1: Validacion server-side (Firestore rules)

**Branch:** `feat/feedback-media-validation`

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `firestore.rules` | Agregar validacion de `mediaUrl` formato (regex `^https://firebasestorage\\.googleapis\\.com/.*`) y `mediaType` enum (`['image', 'pdf']`) en la regla de **create** del bloque `feedback`. Agregar como dos condiciones `&&` al final de la cadena existente. |
| 2 | `firestore.rules` | Agregar validacion de `mediaUrl` formato y `mediaType` enum en la regla de **update** del bloque owner `mediaUrl`/`mediaType`. Extender el bloque existente con tres condiciones: `mediaUrl is string`, `mediaUrl.matches(...)`, `mediaType in [...]`. |

### Fase 2: Util frontend + tipo TypeScript

| Paso | Archivo | Cambio |
|------|---------|--------|
| 3 | `src/utils/media.ts` | Crear archivo nuevo con funcion `isValidStorageUrl(url: string \| undefined \| null): boolean`. Constante local `STORAGE_URL_PREFIX`. |
| 4 | `src/utils/media.test.ts` | Crear tests: URLs validas de Firebase Storage, URLs externas, `javascript:`, `data:`, string vacia, `undefined`, `null`. ~10 test cases. |
| 5 | `src/types/index.ts` | Cambiar `mediaType?: 'image' \| 'video' \| 'pdf'` a `mediaType?: 'image' \| 'pdf'` en la interfaz `Feedback`. |
| 6 | `src/config/converters.ts` | Actualizar cast en `feedbackConverter.fromFirestore` de `'image' \| 'video' \| 'pdf'` a `'image' \| 'pdf'`. |
| 7 | `src/constants/messages/feedback.ts` | Agregar `mediaNotAvailable: 'Adjunto no disponible'` al objeto `MSG_FEEDBACK`. |

### Fase 3: Sanitizacion en componentes

| Paso | Archivo | Cambio |
|------|---------|--------|
| 8 | `src/components/admin/FeedbackList.tsx` | Importar `isValidStorageUrl` de `../../utils/media` y `MSG_FEEDBACK` de `../../constants/messages`. Wrappear renderizado de media (~linea 159) con guard `isValidStorageUrl(f.mediaUrl)`. Agregar fallback `<Typography variant="caption" color="text.disabled">{MSG_FEEDBACK.mediaNotAvailable}</Typography>` cuando `f.mediaUrl` existe pero no pasa validacion. Tambien proteger el Dialog de media fullscreen: en `setMediaOpen`, solo setear si `isValidStorageUrl`. |
| 9 | `src/components/menu/MyFeedbackList.tsx` | Importar `isValidStorageUrl` de `../../utils/media` y `MSG_FEEDBACK` de `../../constants/messages`. Wrappear renderizado de media (~linea 116) con guard `isValidStorageUrl(fb.mediaUrl)`. Agregar mismo fallback Typography. |

### Fase 4: Tests y verificacion

| Paso | Archivo | Cambio |
|------|---------|--------|
| 10 | `src/config/converters.test.ts` | Verificar que el test existente de feedbackConverter con `mediaType: 'image'` sigue pasando. Si el test actual usa `'video'`, actualizarlo a `'image'` o `'pdf'`. |
| 11 | (terminal) | Ejecutar `npm run lint` para verificar sin errores. |
| 12 | (terminal) | Ejecutar `npm run test:run` para verificar todos los tests pasan. |

---

## Orden de implementacion

1. `firestore.rules` — Fase 1 (pasos 1-2): las reglas son independientes del codigo frontend
2. `src/utils/media.ts` + `src/utils/media.test.ts` — Fase 2 (pasos 3-4): util pura sin dependencias
3. `src/types/index.ts` + `src/config/converters.ts` — Fase 2 (pasos 5-6): cambio de tipo, debe hacerse antes de tocar componentes
4. `src/constants/messages/feedback.ts` — Fase 2 (paso 7): texto del fallback
5. `src/components/admin/FeedbackList.tsx` — Fase 3 (paso 8): depende de pasos 3 y 7
6. `src/components/menu/MyFeedbackList.tsx` — Fase 3 (paso 9): depende de pasos 3 y 7
7. `src/config/converters.test.ts` — Fase 4 (paso 10): verificar tipo actualizado
8. Lint + tests — Fase 4 (pasos 11-12)

---

## Estimacion de archivos

| Archivo | Lineas actuales | Lineas estimadas post-cambio | Accion |
|---------|----------------|------------------------------|--------|
| `firestore.rules` | ~190 | ~196 (+6 lineas de validacion) | OK |
| `src/utils/media.ts` | 0 (nuevo) | ~10 | OK |
| `src/utils/media.test.ts` | 0 (nuevo) | ~40 | OK |
| `src/types/index.ts` | ~139 | ~139 (cambio in-place) | OK |
| `src/config/converters.ts` | 497 | 497 (cambio in-place) | Archivo ya en zona warning pero es exceptuado (config) |
| `src/constants/messages/feedback.ts` | 4 | 5 (+1 linea) | OK |
| `src/components/admin/FeedbackList.tsx` | 317 | ~325 (+8 lineas guard) | OK |
| `src/components/menu/MyFeedbackList.tsx` | 151 | ~159 (+8 lineas guard) | OK |

---

## Riesgos

1. **Regex en Firestore rules rechaza URLs validas de Storage**: Las download URLs de Firebase Storage siempre empiezan con `https://firebasestorage.googleapis.com/`. Si Firebase cambiara el dominio, las URLs nuevas serian rechazadas. Mitigacion: el regex es conservador (solo valida prefijo), y Firebase ha mantenido este dominio desde el lanzamiento. Si cambia, habra que actualizar rules y el util frontend.

2. **Datos existentes con `mediaType: 'video'`**: Si algun documento de feedback tiene `mediaType: 'video'` (improbable ya que el servicio nunca lo setea), el converter lo casteara a `'image' | 'pdf'` lo cual es un cast invalido a runtime. Mitigacion: agregar fallback en converter (`as 'image' | 'pdf'` ya es un cast, no una validacion runtime; TypeScript no previene esto a runtime, pero la UI simplemente renderizaria como imagen lo cual es inofensivo).

3. **Deploy order**: Las rules se despliegan independientemente del frontend. Si se despliegan las rules primero, el flujo normal de `sendFeedback` sigue funcionando porque genera URLs validas. No hay riesgo de rotura por deploy parcial.

---

## Criterios de done

- [x] Firestore rules validan `mediaUrl` como Firebase Storage URL en create y update
- [x] Firestore rules validan `mediaType` como `'image'` o `'pdf'` en create y update
- [x] `isValidStorageUrl` util creada con tests
- [x] `FeedbackList.tsx` no renderiza media sin validar URL
- [x] `MyFeedbackList.tsx` no renderiza media sin validar URL
- [x] Tipo `Feedback.mediaType` actualizado (sin `'video'`)
- [x] Converter actualizado
- [x] Texto de fallback centralizado en messages
- [x] Tests pasan con >= 80% cobertura en codigo nuevo
- [x] No lint errors
- [x] Build succeeds

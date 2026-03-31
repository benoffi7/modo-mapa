# Plan: Offline Hardening (#271-#273)

**Specs:** [specs.md](specs.md)
**Fecha:** 2026-03-31

---

## Branch

`fix/offline-hardening`

---

## Fase 1: CRITICAL — recommendations.ts (#271)

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/services/recommendations.ts` | Importar `getCountOfflineSafe` desde `'../utils/getCountOfflineSafe'` |
| 2 | `src/services/recommendations.ts` | `countUnreadRecommendations`: reemplazar `getCountFromServer(query(...))` + `snap.data().count` por `return getCountOfflineSafe(query(...))` |
| 3 | `src/services/recommendations.ts` | `countRecommendationsSentToday`: reemplazar `getCountFromServer(...)` + `snap.data().count` por `return await getCountOfflineSafe(...)` dentro del try |
| 4 | `src/services/recommendations.ts` | Remover `getCountFromServer` del import de `'firebase/firestore'` si ya no hay otros usos |
| 5 | `src/services/recommendations.test.ts` | Agregar test: `countUnreadRecommendations` con `navigator.onLine = false` retorna 0 |
| 6 | `src/services/recommendations.test.ts` | Agregar test: `countRecommendationsSentToday` con `navigator.onLine = false` retorna cache o 0 |

---

## Fase 2: HIGH — offline guards (#272)

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/components/business/MenuPhotoUpload.tsx` | Importar `useConnectivity` desde `'../../context/ConnectivityContext'` |
| 2 | `src/components/business/MenuPhotoUpload.tsx` | Agregar `const { isOffline } = useConnectivity();` en el cuerpo del componente |
| 3 | `src/components/business/MenuPhotoUpload.tsx` | Boton "Enviar": `disabled={!selectedFile \|\| uploading \|\| isOffline}` y `title={isOffline ? 'Requiere conexion' : undefined}` |
| 4 | `src/components/lists/EditorsDialog.tsx` | Importar `useConnectivity` desde `'../../context/ConnectivityContext'` |
| 5 | `src/components/lists/EditorsDialog.tsx` | Importar `MSG_OFFLINE` desde `'../../constants/messages'` |
| 6 | `src/components/lists/EditorsDialog.tsx` | Agregar `const { isOffline } = useConnectivity();` en el cuerpo del componente |
| 7 | `src/components/lists/EditorsDialog.tsx` | `handleRemove`: guard `if (isOffline) { toast.warning(MSG_OFFLINE.noConnection); return; }` al inicio |
| 8 | `src/components/lists/EditorsDialog.tsx` | IconButton remover: agregar `isOffline` a `disabled` |
| 9 | `src/components/lists/SharedListsView.tsx` | En `useEffect` de `fetchFeaturedLists`: leer localStorage `mm_featured_lists` antes del fetch y poblar `featuredLists` si el cache es valido (TTL 24h) |
| 10 | `src/components/lists/SharedListsView.tsx` | En el `.then` de `fetchFeaturedLists`: guardar resultado en `localStorage` |

---

## Fase 3: MEDIUM — fallbacks imagen y notificaciones (#273)

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/constants/messages/common.ts` | Agregar `markReadError`, `markAllReadError`, `settingUpdateError` |
| 2 | `src/components/business/MenuPhotoSection.tsx` | `<img>`: agregar `onError={() => setPhotoUrl(null)}` |
| 3 | `src/components/business/MenuPhotoViewer.tsx` | Agregar `const [imageError, setImageError] = useState(false);` |
| 4 | `src/components/business/MenuPhotoViewer.tsx` | `useEffect(() => { setImageError(false); }, [photoUrl])` para reset al cambiar foto |
| 5 | `src/components/business/MenuPhotoViewer.tsx` | Renderizar error state Box con Typography si `imageError`, si no renderizar `<img onError={() => setImageError(true)}>` |
| 6 | `src/context/NotificationsContext.tsx` | Importar `useToast` desde `'./ToastContext'` |
| 7 | `src/context/NotificationsContext.tsx` | Importar `MSG_COMMON` desde `'../constants/messages'` |
| 8 | `src/context/NotificationsContext.tsx` | `markRead`: mover updates de state antes del await; envolver await en try/catch que revierte y llama `toast.error(MSG_COMMON.markReadError)` |
| 9 | `src/context/NotificationsContext.tsx` | `markAllRead`: mover updates de state antes del await con snapshot de valores previos; catch revierte a previos y llama `toast.error(MSG_COMMON.markAllReadError)` |
| 10 | `src/context/NotificationsContext.tsx` | `loadCountOnly` catch: reemplazar `// silent` por `logger.warn('[NotificationsContext] loadCountOnly failed:', err)` |
| 11 | `src/hooks/useUserSettings.ts` | Importar `useToast` desde `'../context/ToastContext'` |
| 12 | `src/hooks/useUserSettings.ts` | Importar `MSG_COMMON` desde `'../constants/messages'` |
| 13 | `src/hooks/useUserSettings.ts` | En `updateSetting` catch: agregar `toast.warning(MSG_COMMON.settingUpdateError)` despues del revert |

---

## Fase final: Documentacion

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `docs/reference/patterns.md` | Verificar que el patron `getCountOfflineSafe` ya este documentado (si no, agregar referencia en la seccion "Offline queue") |

---

## Orden de implementacion

1. Fase 1 completa (recommendations.ts + tests) — sin dependencias externas
2. Fase 2, pasos 1-3 (MenuPhotoUpload) — independiente
3. Fase 2, pasos 4-8 (EditorsDialog) — independiente
4. Fase 2, pasos 9-10 (SharedListsView) — independiente
5. Fase 3, paso 1 (agregar mensajes a common.ts) — debe ir antes de pasos 6-13
6. Fase 3, pasos 2-5 (MenuPhotoSection + MenuPhotoViewer) — independiente
7. Fase 3, pasos 6-10 (NotificationsContext) — requiere paso 5
8. Fase 3, pasos 11-13 (useUserSettings) — requiere paso 5

---

## Estimacion de tamano de archivos

| Archivo | Lineas actuales | Lineas estimadas | Delta |
|---------|-----------------|-----------------|-------|
| `src/services/recommendations.ts` | 134 | 132 | -2 (import limpieza) |
| `src/components/business/MenuPhotoUpload.tsx` | 147 | 151 | +4 |
| `src/components/lists/EditorsDialog.tsx` | 117 | 125 | +8 |
| `src/components/lists/SharedListsView.tsx` | 190 | 208 | +18 |
| `src/components/business/MenuPhotoSection.tsx` | 167 | 168 | +1 |
| `src/components/business/MenuPhotoViewer.tsx` | 74 | 84 | +10 |
| `src/context/NotificationsContext.tsx` | 130 | 148 | +18 |
| `src/hooks/useUserSettings.ts` | 99 | 104 | +5 |
| `src/constants/messages/common.ts` | 7 | 10 | +3 |

Ningun archivo supera 400 lineas. Sin riesgo de decomposicion.

---

## Riesgos

1. **markAllRead revert con snapshot de previos:** `markAllRead` captura `notifications` y `unreadCount` en el closure al momento de ejecutar. Si hay una actualizacion concurrente entre el inicio y el error, el revert puede ser inexacto. Riesgo bajo — el poll de `loadCountOnly` reconciliara en el proximo ciclo.

2. **LocalStorage parse failure:** Si el cache de featured lists esta corrupto (JSON invalido), el `try/catch` lo ignora y el fetch sigue normal. Sin riesgo de crash.

3. **useUserSettings.toast en el hook:** `useToast` usa un context. El hook `useUserSettings` se usa dentro de `NotificationsProvider` que esta dentro del arbol que tiene `ToastProvider`. Verificar que el orden de providers en `main.tsx` no invierta esta relacion antes de implementar.

---

## Guardrails de modularidad

- [x] Ningun componente nuevo importa `firebase/firestore` directamente
- [x] No se crean archivos nuevos — todos los cambios son en archivos existentes
- [x] Logica de negocio (guard offline) en hooks/services o en el handler del componente — no en JSX
- [x] Ningun archivo resultante supera 400 lineas

## Guardrails de accesibilidad y UI

- [x] Los IconButtons existentes ya tienen `aria-label` — no se rompen
- [x] Botones disabled offline tienen `title` para contexto
- [x] Error state de imagen usa Typography (no bloquea render)
- [x] Toast en revert usa `warning` para useUserSettings (no un error critico) y `error` para writes de notificaciones (escritura fallida)

## Guardrails de copy

- [x] "leida" con tilde
- [x] Terminologia consistente con el resto de mensajes de error en common.ts

## Criterios de done

- [ ] `countUnreadRecommendations` y `countRecommendationsSentToday` no usan `getCountFromServer` directamente
- [ ] Tests nuevos en `recommendations.test.ts` pasan
- [ ] Boton "Enviar" en MenuPhotoUpload deshabilitado offline
- [ ] Boton remover editor en EditorsDialog deshabilitado offline con toast
- [ ] Featured lists se muestran desde cache si el fetch falla offline
- [ ] Imagen rota en MenuPhotoSection muestra estado vacio (no imagen rota)
- [ ] Imagen rota en MenuPhotoViewer muestra mensaje (no pantalla negra)
- [ ] markRead/markAllRead muestran toast si la escritura falla y revierten el estado
- [ ] updateSetting muestra toast si el servidor falla y revierte el toggle
- [ ] `loadCountOnly` ya no tiene catch silencioso
- [ ] Sin errores de lint
- [ ] Build exitoso

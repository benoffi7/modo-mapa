# Plan: #284 Toast missing in settings + stale cache fallback

**Specs:** [specs.md](specs.md)
**Fecha:** 2026-03-31

---

## Fases de implementacion

### Fase 1: Los tres fixes + tests

**Branch:** `fix/284-toast-stale-cache`

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/constants/messages/business.ts` | Agregar `photoReportError: 'No se pudo reportar la foto'` al objeto `MSG_BUSINESS` |
| 2 | `src/hooks/useUserSettings.ts` | En `updateLocality` catch: agregar `toast.warning(MSG_COMMON.settingUpdateError)` y `toast` al dep array de `useCallback` |
| 3 | `src/hooks/useUserSettings.ts` | En `clearLocality` catch: agregar `toast.warning(MSG_COMMON.settingUpdateError)` y `toast` al dep array de `useCallback` |
| 4 | `src/hooks/useUserSettings.ts` | En `updateDigestFrequency` catch: agregar `toast.warning(MSG_COMMON.settingUpdateError)` y `toast` al dep array de `useCallback` |
| 5 | `src/components/business/MenuPhotoViewer.tsx` | Importar `useToast` e `MSG_BUSINESS`; reemplazar catch de `handleReport` con `logger.error(...)` (sin guardia DEV) + `toast.error(MSG_BUSINESS.photoReportError)` |
| 6 | `src/components/lists/SharedListsView.tsx` | En el `useEffect` de `featuredLists`: remover condición TTL del warm; declarar `warmedFromCache`; el `.catch` no limpia el state si `warmedFromCache` es true |
| 7 | `src/hooks/useUserSettings.test.ts` (nuevo) | Tests: `updateLocality` revierte + toast en error; `clearLocality` revierte + toast en error; `updateDigestFrequency` revierte + toast en error |
| 8 | `src/components/business/MenuPhotoViewer.test.tsx` (nuevo) | Tests: éxito marca `reported`; error muestra `toast.error`; botón disabled en offline |
| 9 | `src/components/lists/SharedListsView.test.tsx` (nuevo) | Tests: cache expirado se muestra cuando fetch falla; cache fresco se reemplaza con fetch exitoso; sin cache + fetch falla → lista vacía |

---

## Orden de implementacion

1. Paso 1 primero — `MSG_BUSINESS.photoReportError` debe existir antes de que el componente lo importe (paso 5).
2. Pasos 2-4 independientes entre sí — pueden hacerse en cualquier orden.
3. Pasos 5 y 6 independientes entre sí — pueden hacerse en cualquier orden.
4. Pasos 7-9 después de sus respectivos cambios de implementación.

---

## Riesgos

| Riesgo | Mitigacion |
|--------|-----------|
| `toast` en dep array de `useCallback` causa renders extra | `ToastContext` ya usa `useMemo` con valor estable — referencia no cambia entre renders |
| Mostrar cache expirado confunde al usuario con datos desactualizados | La sección "Destacadas" es curatorial (baja frecuencia de cambio, 24h TTL es razonable). No se agrega badge de "stale" por ahora — el fetch siempre corre en background y reemplaza si tiene éxito |

---

## Estimacion de tamaño de archivos resultantes

| Archivo | Lineas actuales | Lineas estimadas | Accion requerida |
|---------|----------------|-----------------|-----------------|
| `src/hooks/useUserSettings.ts` | 103 | ~115 | OK — bien bajo limite |
| `src/components/business/MenuPhotoViewer.tsx` | 84 | ~90 | OK |
| `src/components/lists/SharedListsView.tsx` | 219 | ~225 | OK |
| `src/constants/messages/business.ts` | 14 | 15 | OK |
| `src/hooks/useUserSettings.test.ts` | 0 (nuevo) | ~70 | OK |
| `src/components/business/MenuPhotoViewer.test.tsx` | 0 (nuevo) | ~60 | OK |
| `src/components/lists/SharedListsView.test.tsx` | 0 (nuevo) | ~70 | OK |

---

## Guardrails de modularidad

- [x] Ningun componente nuevo importa `firebase/firestore` directamente
- [x] Sin archivos nuevos de dominio — solo modificaciones a existentes
- [x] Logica de negocio en hooks/services, no en componentes
- [x] Ningun archivo resultante supera 400 lineas

## Guardrails de seguridad

No aplican — sin colecciones nuevas, sin reglas nuevas, sin campos nuevos.

## Guardrails de accesibilidad y UI

- [x] Sin elementos interactivos nuevos
- [x] Toast usa sistema global existente (no inline, no `<Typography onClick>`)

## Guardrails de copy

- [x] `'No se pudo reportar la foto'` — sin voseo requerido (mensaje de error pasivo)
- [x] `'No se pudo guardar el cambio'` — ya existente, tilde en ninguna palabra requerida
- [x] Strings en `src/constants/messages/` (no hardcodeados)

---

## Fase final: Documentacion

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `docs/reference/patterns.md` | Sin cambios — el patron toast en catch ya está documentado |
| 2 | `docs/reference/features.md` | Sin cambios — no hay funcionalidad nueva visible |

---

## Criterios de done

- [ ] `updateLocality`, `clearLocality`, `updateDigestFrequency` muestran `toast.warning` en error
- [ ] `handleReport` en `MenuPhotoViewer` muestra `toast.error` en error
- [ ] `SharedListsView` usa cache expirado como fallback cuando fetch falla
- [ ] `if (import.meta.env.DEV)` removido del catch de `handleReport`
- [ ] Tests nuevos pasan (3 archivos)
- [ ] No lint errors
- [ ] Build exitoso

# Plan: Notificaciones Digest

**Specs:** [specs.md](specs.md)
**Fecha:** 2026-03-30

## Fases de implementación

### Fase 1 — Tipos + constantes

| Paso | Archivo | Cambio |
|---|---|---|
| 1 | `src/types/index.ts` | Agregar `notificationDigest` a `UserSettings`, agregar `DigestGroup` interface |
| 2 | `src/constants/notifications.ts` | Crear con `DIGEST_LABELS` (singular/plural/icon por tipo) y `DIGEST_MAX_GROUPS` |
| 3 | `src/constants/timing.ts` | Cambiar `POLL_INTERVAL_MS` de `60_000` a `300_000` |

### Fase 2 — Modificar NotificationsContext

| Paso | Archivo | Cambio |
|---|---|---|
| 1 | `src/context/NotificationsContext.tsx` | Leer `notificationDigest` de `useUserSettings()`. Si `'realtime'` → polling cada `POLL_INTERVAL_MS`. Si `'daily'` o `'weekly'` → solo carga inicial al montar, sin `setInterval` |
| 2 | `src/context/NotificationsContext.test.tsx` | Agregar tests: polling activo en realtime, sin polling en daily/weekly |

### Fase 3 — Hook `useNotificationDigest`

| Paso | Archivo | Cambio |
|---|---|---|
| 1 | `src/hooks/useNotificationDigest.ts` | Crear hook: consume `useNotifications()`, filtra no leídas, agrupa por tipo, genera labels, retorna max 3 grupos |
| 2 | `src/hooks/useNotificationDigest.test.ts` | Tests: agrupación, máximo 3, sin datos, mix leídas/no leídas |

### Fase 4 — Componente `ActivityDigestSection`

| Paso | Archivo | Cambio |
|---|---|---|
| 1 | `src/components/home/ActivityDigestSection.tsx` | Crear componente con estado con datos (lista de grupos) y estado vacío (CTA) |
| 2 | `src/components/home/ActivityDigestSection.test.tsx` | Tests: render con actividad, render CTA, link "Ver todas" |
| 3 | `src/components/home/HomeScreen.tsx` | Import + agregar `<ActivityDigestSection />` después de `<ForYouSection />` |

### Fase 5 — Selector de frecuencia en Settings

| Paso | Archivo | Cambio |
|---|---|---|
| 1 | `src/components/profile/SettingsMenu.tsx` | Agregar sección "Frecuencia de notificaciones" con 3 chips (Tiempo real, Diario, Semanal). Persistir en `userSettings.notificationDigest` via `updateUserSettings()` |
| 2 | Tests de SettingsMenu | Agregar caso de selector de frecuencia |

### Fase 6 — Analytics + lint + commit

| Paso | Archivo | Cambio |
|---|---|---|
| 1 | `src/constants/analyticsEvents.ts` | Agregar eventos `digest_*` |
| 2 | — | Correr lint, fix, tests |
| 3 | — | Commit |

## Orden de implementación

1. `src/types/index.ts` (types)
2. `src/constants/notifications.ts` (nuevo)
3. `src/constants/timing.ts` (modificar)
4. `src/context/NotificationsContext.tsx` (modificar) + test
5. `src/hooks/useNotificationDigest.ts` + test
6. `src/components/home/ActivityDigestSection.tsx` + test
7. `src/components/home/HomeScreen.tsx` (modificar)
8. `src/components/profile/SettingsMenu.tsx` (modificar)
9. `src/constants/analyticsEvents.ts` (agregar)

## Riesgos

- **Breaking test de NotificationsContext**: el test existente asume polling cada 60s. Actualizar assertions al nuevo intervalo
- **Settings sin migración**: usuarios existentes no tendrán `notificationDigest` → default a `'realtime'` con `??` operator
- **Digest vacío en usuarios nuevos**: sin notificaciones previas el digest siempre muestra CTA. Aceptable, el CTA guía al usuario

## Criterios de done

- [ ] `POLL_INTERVAL_MS` cambiado a 300000
- [ ] `NotificationsContext` respeta preferencia de digest
- [ ] `useNotificationDigest` agrupa correctamente por tipo con labels
- [ ] `ActivityDigestSection` muestra resumen o CTA según estado
- [ ] Selector de frecuencia en Settings funciona y persiste
- [ ] Tests pasan (incluyendo test existente de NotificationsContext actualizado)
- [ ] Analytics trackeados
- [ ] Lint sin errores

# Changelog: Feedback Status Tracking

**Issue:** #73
**Fecha:** 2026-03-14

## Archivos creados

- `src/components/menu/MyFeedbackList.tsx` -- Lista de feedback del usuario con expand/collapse, chips de estado/categoria, bloque de respuesta admin e indicador de no leido
- `functions/src/admin/feedback.ts` -- Cloud Functions callable `respondToFeedback` y `resolveFeedback` con validacion de admin, actualizacion de estado y creacion de notificacion
- `docs/feat/content/feedback-status/prd.md` -- PRD
- `docs/feat/content/feedback-status/specs.md` -- Especificaciones tecnicas
- `docs/feat/content/feedback-status/plan.md` -- Plan tecnico
- `docs/feat/content/feedback-status/changelog.md` -- Este archivo

## Archivos modificados

- `src/types/index.ts` -- Agregados `FeedbackStatus` type, campos nuevos en `Feedback` (status, adminResponse, respondedAt, respondedBy, viewedByUser), `'feedback_response'` en `NotificationType`, `notifyFeedback` en `UserSettings`
- `src/constants/feedback.ts` -- Agregados `FEEDBACK_STATUSES` map (label + color por estado) y `MAX_ADMIN_RESPONSE_LENGTH`
- `src/config/converters.ts` -- Actualizado `feedbackConverter` (parsea status, adminResponse, respondedAt, respondedBy, viewedByUser) y `userSettingsConverter` (parsea notifyFeedback con default true)
- `src/services/feedback.ts` -- Agregadas funciones `fetchUserFeedback` (query por userId con converter) y `markFeedbackViewed` (updateDoc viewedByUser)
- `src/components/layout/SideMenu.tsx` -- Agregada seccion `'my-feedback'` al type Section, titulo "Mis envios", lazy import de MyFeedbackList, item en navegacion con icono InboxOutlined, render condicional
- `src/components/menu/SettingsPanel.tsx` -- Agregado SettingRow "Respuestas a feedback" con toggle `notifyFeedback`
- `src/components/notifications/NotificationItem.tsx` -- Tipo `feedback_response` manejado por el sistema existente (sin icono dedicado)
- `src/components/admin/FeedbackList.tsx` -- Sin cambios en esta iteracion (acciones admin via Cloud Functions callable, no UI inline)
- `functions/src/triggers/feedback.ts` -- Agregado paso 3: establece `status: 'pending'` en documentos nuevos de feedback
- `functions/src/utils/notifications.ts` -- Agregado `'feedback_response'` al type y mapeo a preferencia `notifyFeedback`
- `functions/src/index.ts` -- Export de `respondToFeedback` y `resolveFeedback` desde `./admin/feedback`
- `firestore.rules` -- Regla `feedback` actualizada: allow read para owner/admin, allow update con dos paths (admin: campos respuesta; owner: viewedByUser), allow delete para owner

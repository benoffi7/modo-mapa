# Informe de Usabilidad, Mejoras Funcionales e Ideas — Modo Mapa

*Actualizado: 2026-03-15*
*Considerando todos los issues hasta #112 como implementados (incl. #100-#112, comments improvements, comments-next, comments-admin-gaps, performance semaphores, custom claims, staging environment)*

---

## 1. USABILIDAD — Problemas detectados

| Problema | Severidad | Issue | Detalle |
|----------|-----------|-------|---------|
| **Sin feedback visual en errores** | Alta | [#138](https://github.com/benoffi7/modo-mapa/issues/138) | Si falla un rating, comment o favorite, el UI optimista no revierte. El usuario cree que se guardo |
| **Rate limit descubierto post-submit** | Media | [#133](https://github.com/benoffi7/modo-mapa/issues/133) | El limite de 5 comments/dia solo se muestra despues de intentar postear. Deberia mostrarse antes |
| **Drag handle del BusinessSheet poco visible** | Media | [#128](https://github.com/benoffi7/modo-mapa/issues/128) | La barra gris es muy sutil; usuarios no descubren que pueden arrastrar |
| **Sin pull-to-refresh** | Media | [#146](https://github.com/benoffi7/modo-mapa/issues/146) | Implementado en Rankings (#99). Falta en mapa y otras secciones |
| **Loading inconsistente** | Baja | [#143](https://github.com/benoffi7/modo-mapa/issues/143) | Algunas secciones tienen skeleton loaders (Comments, Settings, Profile) pero el mapa y BusinessSheet no |
| **Mapa no navegable por teclado** | Media | [#148](https://github.com/benoffi7/modo-mapa/issues/148) | Markers solo accesibles por click/touch. Sin Tab navigation |
| **Sin onboarding** | Baja | [#144](https://github.com/benoffi7/modo-mapa/issues/144) | #79 Help Section mitiga parcialmente. Falta onboarding interactivo |

---

## 2. MEJORAS FUNCIONALES (cara al usuario)

### A. Quick wins (bajo esfuerzo, alto impacto)

1. **Toast de error/exito global** ([#138](https://github.com/benoffi7/modo-mapa/issues/138)) — Snackbar MUI para confirmar acciones y mostrar errores
2. **Pre-check de rate limit** ([#133](https://github.com/benoffi7/modo-mapa/issues/133)) — Verificar limite diario antes de mostrar input de comentario
3. **Confirmacion al salir de formulario** ([#130](https://github.com/benoffi7/modo-mapa/issues/130)) — Preguntar antes de descartar comentario en progreso

### B. Mejoras de engagement

4. **"Primeros pasos" gamificado** ([#145](https://github.com/benoffi7/modo-mapa/issues/145)) — Checklist para nuevos usuarios con reward visual al completar
5. **Sugerencias contextuales** ([#134](https://github.com/benoffi7/modo-mapa/issues/134)) — Tooltips para usuarios con 0 ratings

### C. Mejoras de datos/contenido

6. **Distancia al usuario** ([#147](https://github.com/benoffi7/modo-mapa/issues/147)) — Mostrar "a 300m" en busqueda/favoritos. Haversine ya disponible en suggestions
7. **Ordenar comercios por cercania** ([#137](https://github.com/benoffi7/modo-mapa/issues/137)) — Opcion en favoritos y sugerencias

---

## 3. IDEAS DE NUEVAS FUNCIONES

### Sociales

- **Listas compartidas** ([#142](https://github.com/benoffi7/modo-mapa/issues/142)) — "Mis favoritos de almuerzo" -> compartir lista con link
- **"Fui aca" check-in** ([#131](https://github.com/benoffi7/modo-mapa/issues/131)) — Registro de visita con timestamp (evolucion de "Recientes" pero activo)
- **Recomendaciones entre usuarios** ([#135](https://github.com/benoffi7/modo-mapa/issues/135)) — "Juan te recomienda Cafe Roma"
- **Seguir usuarios** ([#129](https://github.com/benoffi7/modo-mapa/issues/129)) — Ver actividad de amigos/colegas en un feed

### Descubrimiento

- **"Sorprendeme"** ([#139](https://github.com/benoffi7/modo-mapa/issues/139)) — Boton random que abre un comercio al azar no visitado
- **"Trending"** ([#140](https://github.com/benoffi7/modo-mapa/issues/140)) — Comercios con mas actividad esta semana

### Contenido

- **Preguntas y respuestas** ([#127](https://github.com/benoffi7/modo-mapa/issues/127)) — "Tienen opcion vegana?" -> otros usuarios responden
- **Menu digital** ([#132](https://github.com/benoffi7/modo-mapa/issues/132)) — Embeber o linkear URL de menu del comercio

### Infraestructura/UX

- **Modo offline mejorado** ([#136](https://github.com/benoffi7/modo-mapa/issues/136)) — Cola de acciones pendientes que se sincronizan al reconectar

---

## 4. FEATURES DOCUMENTADAS PENDIENTES DE IMPLEMENTAR

### Enhanced Abuse Alerts (3 fases)

**Docs:** `docs/feat/admin/enhanced-abuse-alerts/` — PRD aprobado, specs y plan listos para Fase 1.

| Fase | Mejoras | Esfuerzo |
|------|---------|----------|
| Fase 1 | KPI cards + filtro por fechas + export CSV | Bajo (todo client-side) |
| Fase 2 | Acciones sobre alertas (revisar/descartar/bloquear) + detalle usuario inline | Medio |
| Fase 3 | Notificaciones realtime (onSnapshot) + vista reincidentes agrupada por usuario | Medio |

### PerformancePanel decomposition

**Origen:** backlog post-merge (`docs/feat/admin/performance-semaphores/backlog.md`, item 4)
**Severidad:** Baja — `PerformancePanel.tsx` tiene 514 lineas, se propone extraer subcomponentes a `src/components/admin/perf/`.

### Telegram Notifications

**Docs:** `docs/feat/infra/telegram-notifications/` — placeholder vacio, PRD no existe. Definir si sigue en scope o se descarta.

---

## 5. Resumen de priorizacion sugerida

| Prioridad | Items |
|-----------|-------|
| **P0 — Critico** | Toast de errores ([#138](https://github.com/benoffi7/modo-mapa/issues/138)), pre-check rate limit ([#133](https://github.com/benoffi7/modo-mapa/issues/133)) |
| **P1 — Alta** | Enhanced Abuse Alerts Fase 1, onboarding gamificado ([#145](https://github.com/benoffi7/modo-mapa/issues/145)), distancia al usuario ([#147](https://github.com/benoffi7/modo-mapa/issues/147)), pull-to-refresh global ([#146](https://github.com/benoffi7/modo-mapa/issues/146)) |
| **P2 — Media** | "Sorprendeme" ([#139](https://github.com/benoffi7/modo-mapa/issues/139)), listas compartidas ([#142](https://github.com/benoffi7/modo-mapa/issues/142)), Enhanced Abuse Alerts Fase 2 |
| **P3 — Nice to have** | Trending ([#140](https://github.com/benoffi7/modo-mapa/issues/140)), Q&A ([#127](https://github.com/benoffi7/modo-mapa/issues/127)), menu digital ([#132](https://github.com/benoffi7/modo-mapa/issues/132)), PerformancePanel decomposition |

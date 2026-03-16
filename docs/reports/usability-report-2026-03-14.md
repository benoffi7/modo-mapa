# Informe de Usabilidad, Mejoras Funcionales e Ideas — Modo Mapa

*Actualizado: 2026-03-16*
*Considerando todos los issues hasta #112 como implementados (incl. #100-#112, comments improvements, comments-next, comments-admin-gaps, performance semaphores, custom claims, staging environment)*

---

## 1. USABILIDAD — Problemas detectados

| Problema | Severidad | Issue | Detalle |
|----------|-----------|-------|---------|
| ~~**Sin feedback visual en errores**~~ | ~~Alta~~ | ~~[#138](https://github.com/benoffi7/modo-mapa/issues/138)~~ | ✅ v2.10.0 — Toast global implementado |
| ~~**Rate limit descubierto post-submit**~~ | ~~Media~~ | ~~[#133](https://github.com/benoffi7/modo-mapa/issues/133)~~ | ✅ v2.10.0 — Pre-check con Alert y contador |
| **Drag handle del BusinessSheet poco visible** | Media | [#128](https://github.com/benoffi7/modo-mapa/issues/128) | La barra gris es muy sutil; usuarios no descubren que pueden arrastrar |
| ~~**Sin pull-to-refresh**~~ | ~~Media~~ | ~~[#146](https://github.com/benoffi7/modo-mapa/issues/146)~~ | ✅ v2.11.0 — Implementado en todas las listas |
| **Loading inconsistente** | Baja | [#143](https://github.com/benoffi7/modo-mapa/issues/143) | Algunas secciones tienen skeleton loaders (Comments, Settings, Profile) pero el mapa y BusinessSheet no |
| **Mapa no navegable por teclado** | Media | [#148](https://github.com/benoffi7/modo-mapa/issues/148) | Markers solo accesibles por click/touch. Sin Tab navigation |
| ~~**Sin onboarding**~~ | ~~Baja~~ | ~~[#145](https://github.com/benoffi7/modo-mapa/issues/145)~~ | ✅ v2.11.0 — Onboarding gamificado con checklist |

---

## 2. MEJORAS FUNCIONALES (cara al usuario)

### A. Quick wins — ✅ Completados

1. ~~**Toast de error/exito global** ([#138](https://github.com/benoffi7/modo-mapa/issues/138))~~ — ✅ v2.10.0
2. ~~**Pre-check de rate limit** ([#133](https://github.com/benoffi7/modo-mapa/issues/133))~~ — ✅ v2.10.0
3. **Confirmacion al salir de formulario** ([#130](https://github.com/benoffi7/modo-mapa/issues/130)) — Pendiente

### B. Mejoras de engagement — ✅ Completados

4. ~~**"Primeros pasos" gamificado** ([#145](https://github.com/benoffi7/modo-mapa/issues/145))~~ — ✅ v2.11.0
5. **Sugerencias contextuales** ([#134](https://github.com/benoffi7/modo-mapa/issues/134)) — Pendiente

### C. Mejoras de datos/contenido — ✅ Parcial

6. ~~**Distancia al usuario** ([#147](https://github.com/benoffi7/modo-mapa/issues/147))~~ — ✅ v2.11.0
7. **Ordenar comercios por cercania** ([#137](https://github.com/benoffi7/modo-mapa/issues/137)) — Pendiente

---

## 3. IDEAS DE NUEVAS FUNCIONES

### Sociales

- **Listas compartidas** ([#142](https://github.com/benoffi7/modo-mapa/issues/142)) — En desarrollo. Specs aprobados
- **Listas colaborativas** ([#155](https://github.com/benoffi7/modo-mapa/issues/155)) — Múltiples editores por lista. Requiere #142
- **Listas sugeridas por la plataforma** ([#156](https://github.com/benoffi7/modo-mapa/issues/156)) — Curadas por admin o auto-generadas. Requiere #142
- **"Fui aca" check-in** ([#131](https://github.com/benoffi7/modo-mapa/issues/131)) — Registro de visita con timestamp
- **Recomendaciones entre usuarios** ([#135](https://github.com/benoffi7/modo-mapa/issues/135)) — "Juan te recomienda Cafe Roma"
- **Seguir usuarios** ([#129](https://github.com/benoffi7/modo-mapa/issues/129)) — Ver actividad de amigos/colegas en un feed

### Descubrimiento

- ~~**"Sorprendeme"** ([#139](https://github.com/benoffi7/modo-mapa/issues/139))~~ — ✅ v2.12.0
- **"Trending"** ([#140](https://github.com/benoffi7/modo-mapa/issues/140)) — Comercios con mas actividad esta semana

### Contenido

- **Preguntas y respuestas** ([#127](https://github.com/benoffi7/modo-mapa/issues/127)) — Q&A por comercio
- ~~**Menu digital** ([#132](https://github.com/benoffi7/modo-mapa/issues/132))~~ — Cerrado (not planned). Reemplazado por #149

### Infraestructura/UX

- **Modo offline mejorado** ([#136](https://github.com/benoffi7/modo-mapa/issues/136)) — Cola de acciones pendientes
- **Gesto swipe para cerrar menú** ([#152](https://github.com/benoffi7/modo-mapa/issues/152)) — Patrón mobile estándar
- **Mejoras visuales del menú** ([#153](https://github.com/benoffi7/modo-mapa/issues/153)) — Tracking con capturas

### Crecimiento y conversión

- **Onboarding de cuenta** ([#157](https://github.com/benoffi7/modo-mapa/issues/157)) — Incentivar verificación de email. Banner motivacional, pantalla de beneficios, recordatorios suaves
- **Localidad del usuario** ([#154](https://github.com/benoffi7/modo-mapa/issues/154)) — Ubicación por defecto sin GPS. Mejora Sorpréndeme y centrado del mapa

### Arquitectura y producto

- **Rediseño del home** ([#158](https://github.com/benoffi7/modo-mapa/issues/158)) — Evaluar alternativas al mapa central. La app creció y el mapa fullscreen puede no ser el mejor home. Tab navigation, feed, dashboard
- **Métricas por funcionalidad y panel orquestador** ([#159](https://github.com/benoffi7/modo-mapa/issues/159)) — Métricas granulares por sección y feature. Requisito en PRDs y criterios de aceptación. Agente orquestador del panel admin. Análisis app vs panel

---

## 4. FEATURES DOCUMENTADAS PENDIENTES DE IMPLEMENTAR

### Enhanced Abuse Alerts (3 fases)

**Docs:** `docs/feat/admin/enhanced-abuse-alerts/`

| Fase | Mejoras | Estado |
|------|---------|--------|
| Fase 1 | KPI cards + filtro por fechas + export CSV | ✅ Implementado |
| Fase 2 | Acciones (revisar/descartar) + detalle usuario + filtros estado | ✅ v2.12.0 |
| Fase 3 | Notificaciones realtime (onSnapshot) + vista reincidentes agrupada | Pendiente |

### PerformancePanel decomposition

**Origen:** backlog post-merge (`docs/feat/admin/performance-semaphores/backlog.md`, item 4)
**Severidad:** Baja — `PerformancePanel.tsx` tiene 514 lineas, se propone extraer subcomponentes.

### Telegram Notifications

**Docs:** `docs/feat/infra/telegram-notifications/` — placeholder vacio. Definir si sigue en scope.

---

## 5. Resumen de priorizacion sugerida

| Prioridad | Items | Estado |
|-----------|-------|--------|
| **P0 — Critico** | Toast de errores ([#138](https://github.com/benoffi7/modo-mapa/issues/138)), pre-check rate limit ([#133](https://github.com/benoffi7/modo-mapa/issues/133)) | ✅ v2.10.0 |
| **P1 — Alta** | Enhanced Abuse Alerts Fase 1, onboarding gamificado ([#145](https://github.com/benoffi7/modo-mapa/issues/145)), distancia al usuario ([#147](https://github.com/benoffi7/modo-mapa/issues/147)), pull-to-refresh global ([#146](https://github.com/benoffi7/modo-mapa/issues/146)) | ✅ v2.11.0 |
| **P2 — Media** | "Sorprendeme" ([#139](https://github.com/benoffi7/modo-mapa/issues/139)), Enhanced Abuse Alerts Fase 2 | ✅ v2.12.0 |
| **P2 — Media** | Listas compartidas ([#142](https://github.com/benoffi7/modo-mapa/issues/142)) | En desarrollo |
| **P2 — Media** | Métricas por funcionalidad ([#159](https://github.com/benoffi7/modo-mapa/issues/159)) | Nuevo — Alta prioridad |
| **P2 — Media** | Onboarding de cuenta ([#157](https://github.com/benoffi7/modo-mapa/issues/157)) | Nuevo |
| **P3 — Nice to have** | Trending ([#140](https://github.com/benoffi7/modo-mapa/issues/140)), Q&A ([#127](https://github.com/benoffi7/modo-mapa/issues/127)), PerformancePanel decomposition | Pendiente |
| **Exploración** | Rediseño del home ([#158](https://github.com/benoffi7/modo-mapa/issues/158)) | Requiere #159 primero |

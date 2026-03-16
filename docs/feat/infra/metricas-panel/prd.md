# PRD: Métricas por funcionalidad + Panel orquestador + PerformancePanel decomposition

**Feature:** metricas-panel
**Categoria:** infra
**Fecha:** 2026-03-16
**Issue:** #159
**Prioridad:** Alta

---

## Contexto

La app tiene 27 eventos de analytics y métricas diarias agregadas, pero no hay visibilidad por funcionalidad. El admin no puede responder: "¿Cuánto se usa Sorpréndeme?", "¿Qué % completa el onboarding?", "¿Las listas compartidas se usan?". Además, PerformancePanel.tsx tiene 508 líneas sin descomposición.

## Problema

1. Métricas globales sin desglose por feature
2. No se puede medir adopción ni engagement por funcionalidad
3. PerformancePanel monolítico (508 líneas)
4. Datos no reflejados: writesByCollection/readsByCollection/deletesByCollection están en el tipo pero nunca se calculan
5. No hay requisito formal de que cada feature tenga métricas en el panel

## Solución

### S1: Nuevo tab "Features" en admin

Tab dedicado con métricas por funcionalidad, usando los eventos de analytics ya existentes agregados en dailyMetrics.

### S2: Agregar agregación por feature en dailyMetrics

Extender la Cloud Function scheduled para calcular métricas por feature desde las colecciones existentes.

### S3: Descomponer PerformancePanel

Extraer subcomponentes reutilizables del panel de performance.

### S4: Rellenar writesByCollection

Computar las métricas por colección que ya están en el tipo pero nunca se populan.

---

## Scope

| Item | Prioridad | Esfuerzo |
|------|-----------|----------|
| PerformancePanel decomposition (subcomponentes) | Alta | M |
| Nuevo tab Features en admin | Alta | M |
| Agregación featureMetrics en dailyMetrics | Alta | M |
| Rellenar writesByCollection en dailyMetrics | Media | S |
| Documentar requisito de métricas en PRDs | Media | XS |

---

## Out of Scope

- Métricas realtime (solo agregación diaria)
- A/B testing infrastructure
- Custom dashboards configurables
- Alertas automáticas por métricas (futuro)

---

## Success Criteria

1. Tab "Features" visible en admin con métricas por funcionalidad
2. PerformancePanel descompuesto en subcomponentes (<200 líneas cada uno)
3. dailyMetrics incluye featureMetrics y writesByCollection
4. Cada feature del backlog tiene métricas identificadas

# PRD — Integrar Sentry para error tracking

**Fecha:** 2026-03-12

---

## Objetivo

Integrar Sentry como plataforma de error tracking para el frontend y Cloud Functions, obteniendo visibilidad completa sobre errores en produccion.

---

## Contexto

Actualmente la app no tiene ningun sistema de monitoreo de errores en produccion:

- Los `console.error` estan condicionados a `import.meta.env.DEV`, por lo que en produccion no se registra nada.
- `ErrorBoundary.tsx` existe y renderiza un fallback UI, pero no reporta los errores a ningun servicio externo.
- En Cloud Functions, los errores se loguean a Cloud Logging pero no hay alertas ni agrupacion inteligente de errores.

Esto significa que si un usuario experimenta un error en produccion, no tenemos forma de saberlo hasta que alguien lo reporte manualmente.

---

## Requisitos funcionales

| ID | Requisito | Prioridad |
|----|-----------|-----------|
| RF-1 | Capturar excepciones no manejadas en el frontend (unhandled exceptions + unhandled rejections) | Alta |
| RF-2 | Capturar errores del `ErrorBoundary` y reportarlos a Sentry | Alta |
| RF-3 | Capturar errores async en el service layer (`src/services/`) en produccion | Alta |
| RF-4 | Capturar errores en Cloud Functions y reportarlos a Sentry | Alta |
| RF-5 | Subir source maps en CI para stack traces legibles | Alta |
| RF-6 | Diferenciar errores por environment (production vs development) | Media |

---

## Requisitos no funcionales

- No debe impactar el rendimiento de la app (Sentry SDK es lazy por defecto).
- El DSN de Sentry se configura via variables de entorno (`VITE_SENTRY_DSN` para frontend, `SENTRY_DSN` para functions).
- Source maps se suben en CI y **no** se sirven publicamente.
- Compatible con React 19 y Vite 7.3.
- Compatible con Cloud Functions v2 (Node 22).

---

## Fuera de alcance

- Performance monitoring (APM / tracing).
- Session replay.
- Dashboards personalizados en Sentry.
- Alertas custom (se usaran las alertas por defecto de Sentry).

---

## Metricas de exito

- 100% de errores no manejados en frontend se reportan a Sentry.
- Errores del `ErrorBoundary` aparecen en Sentry con component stack.
- Errores en Cloud Functions aparecen en Sentry con contexto de la funcion.
- Stack traces en Sentry son legibles (source maps funcionando).

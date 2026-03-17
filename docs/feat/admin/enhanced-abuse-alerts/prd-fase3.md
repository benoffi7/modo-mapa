# PRD: Abuse Alerts Fase 3 — Notificaciones realtime + vista reincidentes

**Feature:** enhanced-abuse-alerts (Fase 3)
**Categoria:** admin / seguridad
**Fecha:** 2026-03-17
**Issue:** [#162](https://github.com/benoffi7/modo-mapa/issues/162)
**Prioridad:** Alta

---

## Contexto

Fase 1 (v2.12.0): KPI cards, filtro de fechas, export CSV.
Fase 2 (v2.12.0): Acciones revisar/descartar, filtro de estado, detalle de usuario con badge reincidente.

Actualmente el admin debe abrir manualmente el panel de abuse alerts para ver nuevas alertas. No hay notificación proactiva cuando se genera una alerta, y la vista de reincidentes es limitada (solo badge inline, sin vista dedicada).

## Problema

1. El admin no se entera de nuevas alertas de abuso hasta que abre el panel manualmente.
2. No hay vista consolidada de usuarios reincidentes — solo un badge >3 alertas en el detalle inline.
3. No hay priorización por severidad: una alerta de rate limit pesa igual que un flagged content.

## Solución

### S1: Notificaciones realtime para admins

- Migrar la carga de abuse logs a `onSnapshot` en vez del fetch estático actual.
- Cuando llegan nuevas alertas (docs añadidos desde la última carga), mostrar un toast/snackbar informativo: "N alertas nuevas de abuso".
- Usar el sistema de toast existente (`useToast`) para las notificaciones en-app.
- Badge en el tab de Abuse Alerts del panel admin mostrando cantidad de pendientes.

### S2: Vista de usuarios reincidentes

- Nueva pestaña/sección en el panel de Abuse Alerts: "Reincidentes".
- Tabla de usuarios con >3 alertas, ordenados por cantidad de alertas DESC.
- Columnas: userId (truncado), total alertas, tipo más frecuente, última alerta, estado.
- Click en un usuario expande el historial completo de alertas de ese usuario.
- Filtro por cantidad mínima de alertas (>3, >5, >10).

### S3: Severidad de alertas

- Agregar campo `severity` a AbuseLog: `'low' | 'medium' | 'high'`.
- Mapeo por defecto basado en tipo:
  - `rate_limit` → `low`
  - `top_writers` → `medium`
  - `flagged` → `high`
- Indicador visual de severidad en la tabla (color del chip).
- Filtro por severidad.

---

## Scope

| Item | Prioridad | Esfuerzo |
|------|-----------|----------|
| Migrar a onSnapshot para abuse logs | Alta | S |
| Toast de nuevas alertas | Alta | S |
| Badge de pendientes en tab | Alta | XS |
| Vista de reincidentes | Alta | M |
| Campo severity en AbuseLog | Media | S |
| Filtro por severidad | Media | S |

**Esfuerzo total estimado:** M

---

## Dependencias

- Sistema de toast existente (`useToast` de `ToastContext`)
- `onSnapshot` de Firebase (ya disponible, no usado actualmente para abuse logs)
- AbuseAlerts.tsx (238 líneas) — se crearán subcomponentes para reincidentes

---

## Out of Scope

- Bloquear usuario desde el panel (requiere Firebase Auth admin SDK, se evalúa para v3.0)
- Email alerts a admins (se puede hacer con Cloud Functions pero excede el scope)
- Push notifications nativas (requiere FCM setup para admin)
- Patrones de detección automática (ML/heurísticas)

---

## Success Criteria

1. El admin ve un toast cuando llegan nuevas alertas de abuso sin recargar la página.
2. El tab de abuse alerts muestra badge con cantidad de alertas pendientes.
3. La vista de reincidentes muestra usuarios con >3 alertas ordenados por cantidad.
4. Se puede filtrar por severidad y por cantidad mínima de alertas en reincidentes.
5. El cambio a onSnapshot no degrada performance (mismo límite de 200 docs).

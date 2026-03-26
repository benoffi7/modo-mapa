# Plan: Enhanced Abuse Alerts — Fase 2

**Feature:** enhanced-abuse-alerts (Fase 2)

---

## Paso 1: Tipos y converter

- Agregar reviewed/dismissed/reviewedAt a AbuseLog.
- Actualizar adminConverters.ts.

## Paso 2: Firestore rules

- Permitir update parcial por admin en abuseLogs.

## Paso 3: Service layer

- reviewAbuseLog y dismissAbuseLog en admin.ts.

## Paso 4: UI — acciones y filtros

- Botones Revisar/Descartar en panel expandido.
- Chip toggle Pendientes/Todas.
- Badge "Reincidente" y stats de usuario inline.

## Paso 5: Tests

- Test de functions (si se agregan).
- Lint y build.

---

## Criterios de merge

- [ ] Botón Revisar marca la alerta como revisada
- [ ] Botón Descartar oculta la alerta
- [ ] Filtro Pendientes/Todas funciona
- [ ] Detalle de usuario muestra total alertas y badge reincidente
- [ ] Firestore rules permiten update parcial
- [ ] Lint y tests pasan

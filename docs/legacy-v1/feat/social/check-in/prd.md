# PRD: Check-in — Fui acá

**Feature:** check-in
**Categoria:** social
**Fecha:** 2026-03-16 (actualizado 2026-03-20)
**Issue:** #131
**Prioridad:** Media
**Version:** v2.24 (standalone — unica feature del release)

---

## Contexto

La sección "Recientes" muestra comercios visitados basándose en interacciones implícitas (abrir el BusinessSheet). No existe un registro explícito de visita que el usuario pueda controlar.

Check-in era parte de un grupo de features sociales (junto con Recomendaciones y Seguir usuarios). Ahora es la unica feature de v2.24 para mantener releases pequeños y enfocados.

## Problema

- "Recientes" no refleja visitas reales, solo navegación en la app.
- No hay historial de visitas con timestamps que el usuario pueda consultar.
- No se puede diferenciar entre "miré el comercio" y "fui físicamente".

## Solución

### S1: Botón Check-in en BusinessSheet

- Agregar botón "Fui acá" en el BusinessSheet, debajo de BusinessHeader.
- Registra timestamp y opcionalmente la ubicación del usuario.
- Validación soft de proximidad (estar a menos de 500m del comercio): muestra advertencia pero permite continuar.
- Cooldown de 4 horas por comercio para evitar duplicados accidentales.
- Limite diario de 10 check-ins para evitar abuso.

### S2: Historial de visitas

- Nueva sección "Mis visitas" en el menú lateral (SideMenu).
- Lista cronológica de check-ins con fecha y nombre del comercio.
- Click en un check-in navega al comercio en el mapa.
- Estadísticas básicas en header: total de visitas, comercios únicos visitados.
- Pull-to-refresh y lazy loading.

---

## Scope

| Item | Prioridad | Esfuerzo |
|------|-----------|----------|
| Modelo de datos (colección checkins, tipos, constantes) | Alta | S |
| Reglas Firestore + rate limit | Alta | S |
| Service layer (checkins.ts) | Alta | S |
| Cloud Function trigger (onCheckInCreated) | Alta | S |
| Hooks (useCheckIn, useMyCheckIns) | Alta | S |
| Botón check-in en BusinessSheet (CheckInButton) | Alta | S |
| Historial de visitas en SideMenu (CheckInsView) | Alta | M |
| Validación de proximidad (soft) | Media | S |
| Analytics events | Media | S |
| Tests (>=80% coverage) | Alta | M |

**Esfuerzo total estimado:** M

---

## Out of Scope

- Check-in automático por geofencing.
- Compartir check-ins en redes sociales.
- Gamificación (badges por cantidad de visitas) — ver issue #145.
- Fotos asociadas al check-in.
- **Integración con perfil** (stats en perfil, badge en mapa) — se implementa con Seguir usuarios en v2.25.

---

## Success Criteria

1. El usuario puede registrar "Fui acá" en cualquier comercio.
2. El historial muestra todas las visitas con fecha.
3. Se valida proximidad cuando la ubicación está disponible (soft: advierte pero no bloquea).
4. Los check-ins se diferencian visualmente de los "recientes" implícitos.
5. Cooldown de 4h por comercio y limite de 10/dia funcionan correctamente.

---

## Tests

### Unit Tests

- **useCheckIn hook**: estados (idle, loading, success, error), cooldown logic, proximity check.
- **useMyCheckIns hook**: fetch, pagination, refresh.
- **checkins service**: createCheckIn, fetchMyCheckIns, fetchCheckInsForBusiness.
- **CheckInButton component**: render states (ready, cooldown, checked-in, loading).
- **CheckInsView component**: lista vacia, con datos, navegacion a comercio.

### Integration Tests

- **Firestore rules**: create allowed con auth, blocked sin auth, blocked si userId no coincide, read solo propios, update/delete bloqueados, rate limit.
- **Cloud Function trigger**: onCheckInCreated ejecuta correctamente.

### Coverage Target

- Minimo 80% en todos los archivos nuevos.

# PRD: Check-in — Fui acá

**Feature:** check-in
**Categoria:** social
**Fecha:** 2026-03-16
**Issue:** #131
**Prioridad:** Media

---

## Contexto

La sección "Recientes" muestra comercios visitados basándose en interacciones implícitas (abrir el BusinessSheet). No existe un registro explícito de visita que el usuario pueda controlar.

## Problema

- "Recientes" no refleja visitas reales, solo navegación en la app.
- No hay historial de visitas con timestamps que el usuario pueda consultar.
- No se puede diferenciar entre "miré el comercio" y "fui físicamente".

## Solución

### S1: Botón Check-in en BusinessSheet

- Agregar botón "Fui acá" en el BusinessSheet.
- Registra timestamp y opcionalmente la ubicación del usuario.
- Validación opcional de proximidad (estar a menos de 500m del comercio).

### S2: Historial de visitas

- Nueva sección "Mis visitas" en el menú lateral.
- Lista cronológica de check-ins con fecha y comercio.
- Estadísticas básicas: total de visitas, comercios únicos visitados.

### S3: Integración con perfil

- Mostrar cantidad de check-ins en el perfil del usuario.
- Badge visual para comercios visitados en el mapa.

---

## Scope

| Item | Prioridad | Esfuerzo |
|------|-----------|----------|
| Modelo de datos (colección checkins) | Alta | S |
| Botón check-in en BusinessSheet | Alta | S |
| Historial de visitas | Alta | M |
| Validación de proximidad | Media | S |
| Stats en perfil | Baja | S |

**Esfuerzo total estimado:** M

---

## Out of Scope

- Check-in automático por geofencing.
- Compartir check-ins en redes sociales.
- Gamificación (badges por cantidad de visitas) — ver issue #145.
- Fotos asociadas al check-in.

---

## Success Criteria

1. El usuario puede registrar "Fui acá" en cualquier comercio.
2. El historial muestra todas las visitas con fecha.
3. Se valida proximidad cuando la ubicación está disponible.
4. Los check-ins se diferencian visualmente de los "recientes" implícitos.

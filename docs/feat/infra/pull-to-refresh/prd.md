# PRD: Pull-to-refresh global

**Feature:** pull-to-refresh
**Categoria:** infra
**Fecha:** 2026-03-16
**Issue:** #146
**Prioridad:** Media

---

## Contexto

Pull-to-refresh fue implementado en Rankings (#99) y funciona correctamente. Sin embargo, otras secciones que muestran datos actualizables (mapa, favoritos, comentarios) no tienen esta funcionalidad.

## Problema

- El usuario no puede forzar una recarga de datos en la mayoría de las secciones.
- Si los datos están desactualizados (caché de Firestore), no hay forma manual de refrescar.
- Patrón UX esperado en apps móviles que falta en secciones clave.

## Solución

### S1: Pull-to-refresh en secciones del menú lateral

- Agregar pull-to-refresh en: Favoritos, Comentarios, Recientes.
- Reutilizar el patrón implementado en Rankings.
- El refresh recarga los datos desde Firestore (bypass caché).

### S2: Pull-to-refresh en mapa

- Gesto de pull-to-refresh en el mapa recarga markers del viewport actual.
- Cuidar que no interfiera con el gesto de pan/zoom del mapa.
- Alternativa: botón "Recargar" visible si los datos tienen más de X minutos.

### S3: Componente reutilizable

- Extraer la lógica de pull-to-refresh de Rankings en un componente/hook reutilizable.
- `usePullToRefresh(onRefresh)` que maneja el gesto y el estado de loading.

---

## Scope

| Item | Prioridad | Esfuerzo |
|------|-----------|----------|
| Extraer hook/componente reutilizable de Rankings | Alta | S |
| Pull-to-refresh en Favoritos | Alta | XS |
| Pull-to-refresh en Comentarios | Alta | XS |
| Pull-to-refresh en Recientes | Media | XS |
| Pull-to-refresh o botón recargar en mapa | Media | M |

**Esfuerzo total estimado:** S-M

---

## Out of Scope

- Auto-refresh periódico (polling).
- Pull-to-refresh en Settings o Profile (datos raramente desactualizados).
- Indicador de "última actualización" por sección.

---

## Success Criteria

1. Favoritos, Comentarios y Recientes soportan pull-to-refresh.
2. El mapa tiene un mecanismo de recarga manual (pull o botón).
3. El patrón de Rankings se reutiliza sin duplicar código.
4. El refresh efectivamente recarga datos frescos de Firestore.

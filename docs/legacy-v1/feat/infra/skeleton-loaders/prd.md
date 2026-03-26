# PRD: Loading consistente — skeleton loaders en mapa y BusinessSheet

**Feature:** skeleton-loaders
**Categoria:** infra
**Fecha:** 2026-03-16
**Issue:** #143
**Prioridad:** Media

---

## Contexto

Algunas secciones de la app ya tienen skeleton loaders (Comments, Settings, Profile) implementados con `Skeleton` de MUI. Sin embargo, el mapa principal y el BusinessSheet muestran un estado vacío o spinner genérico durante la carga.

## Problema

- El mapa muestra un espacio vacío mientras cargan los markers.
- El BusinessSheet muestra un spinner genérico, no un skeleton que refleje el layout final.
- La inconsistencia entre secciones con y sin skeleton da una impresión de falta de pulido.
- Los skeleton loaders mejoran la percepción de velocidad (contenido "por llegar").

## Solución

### S1: Skeleton del mapa

- Mientras cargan los markers, mostrar skeleton de la zona del mapa con placeholders grisáceos.
- Transición suave de skeleton a markers reales.
- Si la geolocalización tarda, mostrar skeleton centrado en ubicación por defecto.

### S2: Skeleton del BusinessSheet

- Reemplazar spinner por skeleton que replica el layout: foto, nombre, dirección, rating, tabs.
- Usar componentes `Skeleton` de MUI con variantes `text`, `rectangular`, `circular`.
- Mantener la misma altura para evitar layout shift.

### S3: Patrón reutilizable

- Crear componentes skeleton reutilizables (`BusinessSheetSkeleton`, `MapSkeleton`).
- Seguir el patrón existente de los skeleton loaders ya implementados.

---

## Scope

| Item | Prioridad | Esfuerzo |
|------|-----------|----------|
| BusinessSheetSkeleton component | Alta | S |
| MapSkeleton component | Media | S |
| Integración en BusinessSheet | Alta | S |
| Integración en mapa | Media | S |
| Transición suave skeleton → contenido | Media | XS |

**Esfuerzo total estimado:** S-M

---

## Out of Scope

- Skeleton loaders para el menú lateral (ya tiene en algunas secciones).
- Skeleton para imágenes individuales (lazy loading es suficiente).
- Shimmer animation customizado (usar el default de MUI).

---

## Success Criteria

1. El BusinessSheet muestra skeleton loader en lugar de spinner durante la carga.
2. El mapa muestra un estado de carga visual mientras cargan los markers.
3. No hay layout shift entre skeleton y contenido real.
4. Los nuevos skeletons siguen el patrón de los existentes (MUI Skeleton).

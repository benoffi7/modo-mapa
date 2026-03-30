# Backlog de Producto — Modo Mapa

*Actualizado: 2026-03-30 (post merge: #229/#230/#231/#232 closed, v2.31.0)*
*Fuente de verdad para priorización, estado de issues y roadmap. Actualizado automáticamente post-merge.*

---

> Versiones implementadas: ver [Changelog](changelog.md)

---

## Issues abiertos

### Tech debt

| Issue | Titulo | PRD | Estado |
|-------|--------|-----|--------|
| [#236](https://github.com/benoffi7/modo-mapa/issues/236) | Tech debt: security + architecture findings v2.31.0 | [PRD](../feat/infra/tech-debt-v2-31-0/prd.md) | PRD/specs/plan listos |
| [#168](https://github.com/benoffi7/modo-mapa/issues/168) | Vite 8 y ESLint 10 bloqueados por peer deps | — | Bloqueado por dependencias upstream |

### UX

| Issue | Titulo | PRD | Estado |
|-------|--------|-----|--------|
| [#235](https://github.com/benoffi7/modo-mapa/issues/235) | Agregar color a iconos de Acciones Rapidas en Home | [PRD](../feat/ux/color-iconos-acciones-rapidas/prd.md) | PRD/specs/plan listos |

### Features futuras

| Issue | Titulo | Estado |
|-------|--------|--------|
| [#205](https://github.com/benoffi7/modo-mapa/issues/205) | Seguir tags/categorias — descubrir negocios por interes | Propuesta |
| [#203](https://github.com/benoffi7/modo-mapa/issues/203) | Notificaciones digest — resumen diario/semanal | Propuesta |
| [#201](https://github.com/benoffi7/modo-mapa/issues/201) | Badges de verificacion de usuario | Propuesta |
| [#200](https://github.com/benoffi7/modo-mapa/issues/200) | Trending por zona — rankings filtrados por localidad | Propuesta |

---

## Deuda tecnica identificada (new-home session)

| Item | Estado |
|------|--------|
| Firestore rules field whitelist: auditar todas las colecciones (no solo `sharedLists`) | Pendiente — agregar a merge Phase 1i |
| Mutable prop audit: componentes que reciben datos como props y los modifican | Pendiente — agregar a specs template |
| Copy audit: tildes y signos de apertura en todos los archivos `.ts`/`.tsx` | Parcial — corregidos los dialogos de confirmacion y listas |

---

## Metricas de progreso

| Metrica | Valor |
|---------|-------|
| Issues abiertos | 7 (#168, #200, #201, #203, #205, #235, #236) |
| Issues cerrados | #128–#199, #207–#232 (59) |
| Versiones publicadas | v2.10.0 – v2.31.0 |

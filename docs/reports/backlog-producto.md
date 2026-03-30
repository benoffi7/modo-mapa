# Backlog de Producto — Modo Mapa

*Actualizado: 2026-03-30 (post merge: #235-#239 closed, v2.32.0)*
*Fuente de verdad para priorización, estado de issues y roadmap. Actualizado automáticamente post-merge.*

---

> Versiones implementadas: ver [Changelog](changelog.md)

---

## Issues abiertos

### Tech debt

| Issue | Titulo | Estado |
|-------|--------|--------|
| [#168](https://github.com/benoffi7/modo-mapa/issues/168) | Vite 8 y ESLint 10 bloqueados por peer deps | Bloqueado por dependencias upstream |

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
| Firestore rules field whitelist: auditar todas las colecciones | **Completado** v2.32.0 (#237) — todas limpias |
| Mutable prop audit: componentes que modifican props | **Completado** v2.32.0 (#238) — sin violaciones |
| Copy audit: tildes y signos de apertura | **Completado** v2.32.0 (#239) — 54 archivos corregidos |
| Rate limit docs falta campo `userId` para cleanup en account deletion | Pendiente — detectado en audit v2.32.0 |

---

## Metricas de progreso

| Metrica | Valor |
|---------|-------|
| Issues abiertos | 5 (#168, #200, #201, #203, #205) |
| Issues cerrados | #128–#199, #207–#239 (64) |
| Versiones publicadas | v2.10.0 – v2.32.0 |

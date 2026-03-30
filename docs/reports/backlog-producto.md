# Backlog de Producto — Modo Mapa

*Actualizado: 2026-03-30 (post merge: #241-#246 closed, v2.33.0)*
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

## Deuda tecnica resuelta

| Item | Estado |
|------|--------|
| Firestore rules field whitelist audit | Completado v2.32.0 (#237) |
| Mutable prop audit | Completado v2.32.0 (#238) |
| Copy audit: tildes y voseo | Completado v2.32.0 (#239) |
| Rate limit docs userId cleanup | Completado v2.32.1 (#240) |
| affectedKeys() en update rules | Completado v2.33.0 (#241) |
| Rate limit menuPhotos/listItems + sharedLists validation | Completado v2.33.0 (#242) |
| Service layer violations (AuthContext, MenuPhoto) | Completado v2.33.0 (#243) |
| firestore.md 8 colecciones + sidebar 224 links rotos | Completado v2.33.0 (#244) |
| Performance (dynamic import, parallel queries, split context, dead code) | Completado v2.33.0 (#245) |
| Dark mode hardcoded colors | Completado v2.33.0 (#246) |

---

## Metricas de progreso

| Metrica | Valor |
|---------|-------|
| Issues abiertos | 5 (#168, #200, #201, #203, #205) |
| Issues cerrados | #128–#199, #207–#246 (71) |
| Versiones publicadas | v2.10.0 – v2.33.0 |

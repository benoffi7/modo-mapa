# PRD: Modo offline mejorado

**Feature:** modo-offline
**Categoria:** infra
**Fecha:** 2026-03-16
**Issue:** #136
**Prioridad:** Media

---

## Contexto

Modo Mapa usa Firebase con persistencia offline habilitada, lo que permite leer datos cacheados sin conexión. Sin embargo, las acciones de escritura (ratings, comentarios, favoritos) fallan silenciosamente o muestran errores genéricos cuando no hay conectividad.

## Problema

- Las escrituras offline fallan y el UI optimista no revierte correctamente.
- El usuario no sabe si su acción se guardó o se perdió.
- No hay cola de acciones pendientes que se sincronicen al reconectar.
- Experiencia frustrante en zonas con conectividad intermitente.

## Solución

### S1: Cola de acciones pendientes

- Implementar queue local (IndexedDB o localStorage) para acciones de escritura.
- Tipos de acciones encolables: rating, comentario, toggle favorito.
- Cada acción se guarda con timestamp y datos completos para replay.

### S2: Sincronización automática

- Detectar reconexión vía `navigator.onLine` + listener de Firebase connectivity.
- Al reconectar, procesar la cola en orden FIFO.
- Reintentos con backoff exponencial si la sincronización falla.

### S3: Indicador visual

- Badge en el menú mostrando cantidad de acciones pendientes.
- Banner sutil "Sin conexión — tus acciones se guardarán al reconectar".
- Confirmación visual cuando la cola se sincroniza exitosamente.

---

## Scope

| Item | Prioridad | Esfuerzo |
|------|-----------|----------|
| Cola de acciones en IndexedDB | Alta | M |
| Encolado de ratings, comments, favorites | Alta | M |
| Detección de conectividad | Alta | S |
| Sincronización automática al reconectar | Alta | M |
| Indicador visual de pendientes | Media | S |
| Banner de modo offline | Media | S |

**Esfuerzo total estimado:** L

---

## Out of Scope

- Caché offline del mapa (tiles) — depende del proveedor de mapas.
- Edición offline de datos existentes.
- Resolución de conflictos (last-write-wins por simplicidad).
- Service Worker para PWA completa.

---

## Success Criteria

1. El usuario puede calificar, comentar y favoritear sin conexión.
2. Las acciones se sincronizan automáticamente al reconectar.
3. Indicador visual claro de acciones pendientes.
4. No se pierden acciones si la app se cierra y reabre offline.

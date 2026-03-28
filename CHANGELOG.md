# Changelog

Todos los cambios notables del proyecto se documentan en este archivo.

El formato se basa en [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- Agente `copy-auditor` para auditoria de ortografia y tildes en archivos `.ts`/`.tsx`
- Audit de field whitelist en Firestore rules (merge Phase 1i)
- Audit de mutable props en template de specs
- SpecialsSection cards navegan a secciones correspondientes (trending a recientes, featured_list a listas)
- Firestore rules para colecciones `specials` y `achievements`
- Avatar selection persiste a Firestore (`users/{uid}.avatarId`)
- CollaborativeTab back handler para Android (hardware back button)
- ListCardGrid: layout responsive con `auto-fill`, cards cuadradas con `aspect-ratio: 1`, contenido centrado
- Chip "Destacada" en listas sigue design system (`borderRadius: 1`)
- ListDetailScreen: optimistic updates al volver atras (color, isPublic, itemCount)
- ListDetailScreen: dialog de confirmacion para eliminar lista
- ListDetailScreen: toggle publico/privado con rollback on error
- Business items en listas usan `cardSx` unificado

### Fixed

- Firestore rules faltantes para colecciones `specials` y `achievements`
- `removeBusinessFromList` usaba `businessId` en vez de `listItem.id` (corrupcion de datos)
- Cambio de color en listas rechazado por Firestore rules (faltaban `color` e `icon` en whitelist `hasOnly`)
- Lista no aparecia despues de crearla (insert optimistico faltante)
- Cambios no reflejados al volver desde detalle de lista (optimistic updates faltantes)
- Icono de candado no se actualizaba al togglear publico/privado (prop stale)
- SpecialsSection cards no hacian nada al clickear (callbacks no-op)
- Faltaba signo de apertura `?` en dialogos de confirmacion
- Errores de ortografia: "vacia" corregido a "vacía", "publica" corregido a "pública"

### Changed

- Business items en listas usan `cardSx` unificado en vez de estilos inline
- ListCardGrid usa columnas responsive con `auto-fill` y cards cuadradas centradas
- Avatar selection ahora persiste a Firestore en vez de solo localStorage

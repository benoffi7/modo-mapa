# PRD: Docs: actualizar firestore.md (8 colecciones faltantes) + limpiar sidebar (170 links rotos)

**Feature:** 244-docs-firestore-sidebar
**Categoria:** infra
**Fecha:** 2026-03-29
**Issue:** #244
**Prioridad:** Alta

---

## Contexto

La documentacion de referencia del proyecto tiene dos problemas criticos detectados en auditoria: `firestore.md` no documenta 8 colecciones que ya existen en produccion (checkins, follows, activityFeed, recommendations, sharedLists, listItems, specials, achievements), y la sidebar de la documentacion (`_sidebar.md`) tiene aproximadamente 170 links rotos producto de la reorganizacion de `docs/prd/` a `docs/feat/`. Ademas, colecciones existentes como `users`, `userSettings`, `feedback` y `comments` tienen campos faltantes en la documentacion. Las referencias de version y conteo de tabs admin en `project-reference.md` y `features.md` tambien estan desactualizadas.

## Problema

- **firestore.md incompleto**: 8 colecciones no documentadas significan que los agentes de implementacion y el desarrollador no tienen referencia de schema al trabajar con esas colecciones. Esto causa inconsistencias y regresiones.
- **Campos faltantes en colecciones existentes**: `users` no documenta `displayNameLower`, `avatarId`, `followersCount`, `followingCount`. `userSettings` no documenta `notifyFollowers`, `notifyRecommendations`, `locality*`. `feedback` no documenta `rating`, `businessId`, `businessName`, `mediaType pdf`. `comments` no documenta el campo `type`.
- **~170 links rotos en sidebar**: la reorganizacion de carpetas dejo links apuntando a paths inexistentes. Esto inutiliza la navegacion de la documentacion en GitHub Pages.
- **Datos desactualizados**: version dice 2.32.0 (es 2.32.1), admin dice 11/13 tabs (son 16), path de HelpSection incorrecto.

## Solucion

### S1. Documentar las 8 colecciones faltantes en firestore.md

Agregar documentacion completa (campos, tipos TypeScript, indices, rules reference) para: `checkins`, `follows`, `activityFeed` (subcollection), `recommendations`, `sharedLists`, `listItems`, `specials`, `achievements`. Seguir el formato existente de las colecciones ya documentadas.

### S2. Completar campos faltantes en colecciones existentes

Agregar los campos faltantes a las secciones de `users`, `userSettings`, `feedback` y `comments` en firestore.md.

### S3. Limpiar sidebar de links rotos

Auditar todos los links en `_sidebar.md`. Eliminar entradas que apuntan a archivos inexistentes. Verificar que cada link tiene un archivo correspondiente en disco.

### S4. Actualizar datos desactualizados en reference docs

Corregir version, conteo de tabs admin, y paths incorrectos en `project-reference.md` y `features.md`.

---

## Scope

| Item | Prioridad | Esfuerzo |
|------|-----------|----------|
| Documentar 8 colecciones faltantes en firestore.md | Must | M |
| Completar campos faltantes en colecciones existentes | Must | S |
| Auditar y limpiar ~170 links rotos en _sidebar.md | Must | M |
| Actualizar version, tabs admin, paths en project-reference.md y features.md | Must | S |
| Verificar que todos los links de sidebar resuelven a archivos existentes | Should | S |

**Esfuerzo total estimado:** L

---

## Out of Scope

- Crear documentacion nueva para features que no la tienen (solo se actualiza documentacion existente)
- Agregar nuevas secciones a la sidebar que no existian antes
- Migrar archivos de documentacion de ubicacion (la reorganizacion ya se hizo)
- Actualizar otros archivos de reference/ que no estan mencionados en el issue

---

## Tests

### Archivos que necesitaran tests

| Archivo | Tipo | Que testear |
|---------|------|-------------|
| `docs/_sidebar.md` | Manual | Verificar que cada link resuelve a un archivo existente en disco |
| `docs/reference/firestore.md` | Manual | Verificar que todas las colecciones de produccion estan documentadas |
| N/A | Script | Opcional: script que verifica links rotos en sidebar |

### Criterios de testing

- Cobertura >= 80% del codigo nuevo
- Tests de validacion para todos los inputs del usuario
- Todos los paths condicionales cubiertos
- Side effects verificados (cache, analytics, notifications)

---

## Seguridad

- [ ] No exponer secretos, API keys o emails reales en la documentacion de colecciones
- [ ] Verificar que la documentacion de rules en firestore.md refleja las rules reales deployeadas
- [ ] No documentar detalles de implementacion de seguridad que faciliten ataques (ej: no documentar el email exacto del admin en firestore.md)

### Vectores de ataque automatizado

| Superficie | Ataque posible | Mitigacion requerida |
|-----------|---------------|---------------------|
| Documentacion publica (repo es publico) | Info disclosure de schema que facilite ataques dirigidos | No documentar campos internos de seguridad; mantener reglas de seguridad en security.md separado |

---

## Deuda tecnica y seguridad

### Issues relacionados

| Issue | Relacion | Accion |
|-------|----------|--------|
| Reorganizacion docs/prd/ a docs/feat/ | Causa | La reorganizacion dejo los links rotos que este issue limpia |
| #237 Firestore rules audit | Complementario | #237 audito rules; este issue documenta el schema que las rules protegen |

### Mitigacion incorporada

- Se completa la documentacion de schema para todas las colecciones, facilitando futuras auditorias de seguridad
- Se restaura la navegabilidad de la documentacion en GitHub Pages

---

## Offline

### Data flows

| Operacion | Tipo (read/write) | Estrategia offline | Fallback UI |
|-----------|-------------------|-------------------|-------------|
| N/A | N/A | N/A | N/A |

### Checklist offline

- [x] Reads de Firestore: N/A (solo documentacion)
- [x] Writes: N/A
- [x] APIs externas: N/A
- [x] UI: N/A
- [x] Datos criticos: N/A

### Esfuerzo offline adicional: N/A

---

## Modularizacion y % monolitico

Este feature modifica exclusivamente archivos de documentacion. No hay cambios en el codigo fuente.

### Checklist modularizacion

- [x] Logica de negocio en hooks/services (N/A - solo docs)
- [x] Componentes nuevos son reutilizables (N/A)
- [x] No se agregan useState de logica de negocio a AppShell o SideMenu
- [x] Props explicitas en vez de dependencias implicitas
- [x] Cada prop de accion tiene un handler real especificado
- [x] Ningun componente nuevo importa directamente de `firebase/firestore`
- [x] Archivos nuevos van en carpeta de dominio correcta
- [x] Si el feature necesita estado global: N/A
- [x] Ningun archivo nuevo supera 400 lineas

### Impacto en % monolitico

| Aspecto | Impacto | Justificacion |
|---------|---------|---------------|
| Acoplamiento de componentes | = | Solo documentacion |
| Estado global | = | Solo documentacion |
| Firebase coupling | = | Solo documentacion |
| Organizacion por dominio | = | Solo documentacion |

---

## Success Criteria

1. Las 8 colecciones faltantes estan documentadas en firestore.md con campos, tipos y rules reference
2. Los campos faltantes de `users`, `userSettings`, `feedback` y `comments` estan documentados
3. `_sidebar.md` no tiene links rotos (verificable con script o manualmente)
4. `project-reference.md` muestra version correcta (2.32.1) y conteo correcto de tabs admin (16)
5. `features.md` muestra conteo correcto de tabs admin y path correcto de HelpSection

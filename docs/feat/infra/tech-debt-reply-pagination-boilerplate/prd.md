# PRD: Tech debt — InlineReplyForm unused, FollowedList manual pagination, duplicated boilerplate

**Feature:** tech-debt-reply-pagination-boilerplate
**Categoria:** infra
**Fecha:** 2026-03-29
**Issue:** #234
**Prioridad:** Media

---

## Contexto

Durante la auditoria de merge de #227, el architecture agent identifico cuatro violaciones a coding standards que aumentan la deuda tecnica del proyecto. Los archivos afectados estan en `components/business/` y `components/social/`, ambos dominios con alta actividad de desarrollo reciente (comments, follows, questions).

## Problema

- **InlineReplyForm existe pero no se usa.** Tanto `BusinessComments` como `BusinessQuestions` duplican ~60 lineas de JSX para el formulario de respuesta inline, incluyendo logica de rate limit, TextField con estilos, botones de enviar/cancelar, y manejo de Enter/Escape. El componente extraido (`InlineReplyForm.tsx`, 100 lineas) ya cubre estos casos pero nunca fue adoptado.
- **FollowedList gestiona paginacion manualmente** con 6 `useState` (`items`, `isLoading`, `error`, `hasMore`, `isLoadingMore`, `lastDoc`) y un `loadPage` callback, en vez de usar `usePaginatedQuery` que ya resuelve todo esto con cache de primera pagina (2-min TTL). Se pierde el beneficio del query cache y se duplica logica.
- **Snackbar + UserProfileSheet se renderizan identicos** en `BusinessComments` y `BusinessQuestions` (~15 lineas cada uno). Este footer podria extraerse a un componente compartido.
- **`MAX_FOLLOWS` y `PAGE_SIZE` estan definidos localmente** en `src/services/follows.ts` (lineas 22-23) en vez de vivir en `src/constants/` como requieren los coding standards.

## Solucion

### S1. Adoptar InlineReplyForm en BusinessComments y BusinessQuestions

Reemplazar el JSX inline de reply en ambos componentes por `<InlineReplyForm />`. El componente ya tiene las props necesarias (`replyingToName`, `replyText`, `onSubmit`, `onCancel`, `isSubmitting`, `isOverDailyLimit`, `inputRef`). Esto elimina ~60 lineas duplicadas por componente (~120 lineas total).

### S2. Migrar FollowedList a usePaginatedQuery

Reemplazar los 6 `useState` + `loadPage` callback por una invocacion de `usePaginatedQuery` con los constraints apropiados. La query base es `fetchFollowing` que retorna docs de la coleccion `follows`. Despues de obtener los IDs, se resuelven nombres con `fetchUserDisplayNames`. El hook ya maneja `isLoading`, `error`, `hasMore`, `isLoadingMore`, `loadMore`, y el cache de primera pagina.

Nota: `usePaginatedQuery` espera `QueryConstraint[]` y opera sobre una coleccion directamente. `fetchFollowing` retorna un resultado custom. Puede requerirse un adapter o refactor leve del hook para acomodar la necesidad de post-procesar docs (resolver displayNames).

### S3. Extraer CommentListFooter

Crear `src/components/common/CommentListFooter.tsx` que encapsule el patron repetido de `<Snackbar>` de undo-delete + `<UserProfileSheet>`. Props: `deleteSnackbarProps`, `profileUser`, `onCloseProfile`. Adoptarlo en BusinessComments y BusinessQuestions.

### S4. Mover constantes a src/constants/

Mover `MAX_FOLLOWS` y `PAGE_SIZE` de `src/services/follows.ts` a `src/constants/social.ts` (o el modulo de constantes apropiado). Actualizar imports en `follows.ts` y en cualquier otro archivo que los use. Renombrar `PAGE_SIZE` a algo mas descriptivo como `FOLLOWS_PAGE_SIZE` para evitar colisiones.

---

## Scope

| Item | Prioridad | Esfuerzo |
|------|-----------|----------|
| S1. Adoptar InlineReplyForm en BusinessComments | Alta | S |
| S1. Adoptar InlineReplyForm en BusinessQuestions | Alta | S |
| S2. Migrar FollowedList a usePaginatedQuery | Media | M |
| S3. Extraer CommentListFooter | Baja | S |
| S4. Mover constantes a src/constants/ | Alta | S |
| Tests para cambios | Media | S |

**Esfuerzo total estimado:** S

---

## Out of Scope

- Refactorizar `usePaginatedQuery` para soportar post-processing nativo de docs (si no encaja directamente, se usa adapter)
- Refactorizar el contenido de InlineReplyForm (el componente ya existe y funciona)
- Migrar otros componentes que usen paginacion manual (solo FollowedList)
- Reorganizar otros archivos de `components/menu/` a carpetas de dominio (cubierto por #reorganizar-components-menu)

---

## Tests

### Archivos que necesitaran tests

| Archivo | Tipo | Que testear |
|---------|------|-------------|
| `src/components/common/CommentListFooter.tsx` | Componente | Renderiza Snackbar con props, renderiza UserProfileSheet, llama onClose |
| `src/components/business/InlineReplyForm.tsx` | Componente | Ya existe, verificar que no se rompa con la adopcion |
| `src/components/social/FollowedList.tsx` | Componente | Verificar que la migracion a usePaginatedQuery mantiene el comportamiento |

### Criterios de testing

- Cobertura >= 80% del codigo nuevo
- Tests de validacion para todos los inputs del usuario
- Todos los paths condicionales cubiertos
- Side effects verificados (cache, analytics, notifications)

Nota: Los cambios son mayormente refactors que eliminan codigo. El riesgo principal es regresion, no logica nueva. Los tests existentes de BusinessComments y BusinessQuestions (si existen) deben seguir pasando. El componente `CommentListFooter` es mayormente visual (~15 lineas de JSX) y podria caer en la excepcion de "componentes puramente visuales sin logica".

---

## Seguridad

Este feature es un refactor interno sin superficies nuevas expuestas. No hay cambios en Firestore rules, Cloud Functions, ni inputs de usuario.

- [x] No se agregan colecciones nuevas
- [x] No se agregan endpoints nuevos
- [x] No se modifica logica de autenticacion
- [x] No se agregan inputs de usuario

### Vectores de ataque automatizado

No aplica. Este feature no expone superficies nuevas. Los componentes refactorizados mantienen las mismas validaciones y rate limits existentes.

---

## Deuda tecnica y seguridad

### Issues relacionados

| Issue | Relacion | Accion |
|-------|----------|--------|
| #234 | es el issue | Resolver los 4 items como parte de este feature |

### Mitigacion incorporada

- Eliminar ~120 lineas de JSX duplicado (reply forms)
- Eliminar ~30 lineas de estado manual de paginacion en FollowedList
- Eliminar ~30 lineas de footer duplicado (Snackbar + UserProfileSheet)
- Centralizar constantes `MAX_FOLLOWS` y `PAGE_SIZE` en `src/constants/`
- FollowedList gana cache de primera pagina (2-min TTL) al adoptar `usePaginatedQuery`

---

## Offline

### Data flows

| Operacion | Tipo (read/write) | Estrategia offline | Fallback UI |
|-----------|-------------------|-------------------|-------------|
| FollowedList carga seguidos | read | Firestore persistent cache (ya existente) | PaginatedListShell error state |

### Checklist offline

- [x] Reads de Firestore: usan persistencia offline (sin cambios, Firestore persistent cache ya activo)
- [x] Writes: no hay writes nuevos en este feature
- [x] APIs externas: no aplica
- [x] UI: sin cambios en indicadores offline
- [x] Datos criticos: sin cambios

### Esfuerzo offline adicional: S (ninguno)

---

## Modularizacion y % monolitico

### Checklist modularizacion

- [x] Logica de negocio en hooks/services (FollowedList migra a usePaginatedQuery)
- [x] Componentes nuevos son reutilizables fuera del contexto actual de layout (CommentListFooter)
- [x] No se agregan useState de logica de negocio a AppShell o SideMenu
- [x] Props explicitas en vez de dependencias implicitas a contextos de layout
- [x] Cada prop de accion tiene un handler real especificado
- [x] Ningun componente nuevo importa directamente de `firebase/firestore`
- [x] Archivos nuevos van en carpeta de dominio correcta (`common/` para CommentListFooter)
- [x] Si el feature necesita estado global, no aplica
- [x] Ningun archivo nuevo supera 400 lineas

### Impacto en % monolitico

| Aspecto | Impacto | Justificacion |
|---------|---------|---------------|
| Acoplamiento de componentes | - | Reduce duplicacion entre BusinessComments y BusinessQuestions |
| Estado global | = | Sin cambios en contextos |
| Firebase coupling | - | FollowedList deja de manejar cursores Firestore directamente |
| Organizacion por dominio | - | Constantes migran a src/constants/ per coding standards |

---

## Success Criteria

1. `InlineReplyForm` se usa en BusinessComments y BusinessQuestions, eliminando el JSX duplicado de reply
2. `FollowedList` usa `usePaginatedQuery` (o adapter) y se beneficia del cache de primera pagina
3. `CommentListFooter` encapsula el Snackbar + UserProfileSheet compartido
4. `MAX_FOLLOWS` y `PAGE_SIZE` (renombrado) viven en `src/constants/` con imports actualizados
5. Todos los tests existentes pasan sin modificaciones de logica

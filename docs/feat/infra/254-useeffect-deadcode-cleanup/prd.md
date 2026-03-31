# PRD: useEffect race conditions + async handlers sin try/catch + dead exports

**Feature:** 254-useeffect-deadcode-cleanup
**Categoria:** infra
**Fecha:** 2026-03-30
**Issue:** #254
**Prioridad:** Media

---

## Contexto

La auditoria de codigo detecto 3 categorias de problemas: 8 useEffect con llamadas async que no tienen cancellation guard (pueden causar setState en componentes desmontados), 3 async handlers sin try/catch (errores no manejados), y 18 exports muertos (13 constantes + 5 collection getters) que nunca se importan. Los useEffect sin guard son un bug potencial que puede causar warnings de React y race conditions.

## Problema

- **MEDIUM**: 8 useEffect ejecutan funciones async y llaman setState sin verificar si el componente sigue montado. Esto puede causar el warning "Can't perform a React state update on an unmounted component" y race conditions si el componente se desmonta antes de que la promise resuelva.
  - `useProfileStats.ts:21`
  - `MenuPhotoSection.tsx:29,42`
  - `RecommendDialog.tsx:37`
  - `SpecialsSection.tsx:65`
  - `SharedListsView.tsx:37`
  - `MyFeedbackList.tsx:47`
  - `PhotoReviewCard.tsx:27`
- **LOW**: 3 async handlers no tienen try/catch, lo que significa que errores de Firestore se pierden silenciosamente sin feedback al usuario.
  - `CheckInButton.tsx:26` (handleClick)
  - `CommentsList.tsx:45` (onConfirmDelete)
  - `CommentsList.tsx:58` (handleEditSave)
- **LOW**: 13 constantes y 5 collection getters son exportados pero nunca importados por ningun archivo.

## Solucion

### S1: Agregar cancellation guards a useEffect

Para cada uno de los 8 useEffect identificados, agregar un patron de cancellation:

```typescript
useEffect(() => {
  let cancelled = false;
  async function load() {
    const data = await fetchSomething();
    if (!cancelled) setState(data);
  }
  load();
  return () => { cancelled = true; };
}, [deps]);
```

Seguir el patron ya usado en otros hooks del proyecto (ej: `useAsyncData`).

### S2: Agregar try/catch a async handlers

Para los 3 handlers identificados, wrappear en try/catch con `logger.error()` y feedback via `useToast()` donde corresponda:

- `CheckInButton.tsx`: toast de error en check-in fallido.
- `CommentsList.tsx` (onConfirmDelete): toast de error en delete fallido.
- `CommentsList.tsx` (handleEditSave): toast de error en edit fallido.

Seguir el patron existente de error handling (logger centralizado + toast global).

### S3: Eliminar dead exports

Eliminar las 13 constantes y 5 collection getters que no tienen consumidores. Verificar con grep que realmente no se usan antes de eliminar.

**Constantes**: `OFFLINE_BACKOFF_BASE_MS`, `MAX_EDITORS_PER_LIST`, `ADD_BUSINESS_URL`, `TRUNCATE_*`, `MIN_RATING`, `MAX_RATING`, `PASSWORD_MIN_LENGTH`, `PASSWORD_RULES`, `MAX_CHECKINS_PER_DAY`, `FOLLOWS_PAGE_SIZE`, `BADGES`.

**Collection getters**: `getCheckinsCollection`, `getSharedListsCollection`, `getListItemsCollection`, `getFollowsCollection`, `getPriceLevelsCollection`.

---

## Scope

| Item | Prioridad | Esfuerzo |
|------|-----------|----------|
| Cancellation guards en 8 useEffect | P1 | S |
| try/catch en 3 async handlers | P2 | S |
| Eliminar 13 dead constants | P3 | S |
| Eliminar 5 dead collection getters | P3 | S |

**Esfuerzo total estimado:** M

---

## Out of Scope

- Refactorizar los useEffect a hooks extraidos (solo agregar guard).
- Agregar tests para los useEffect corregidos (componentes visuales, baja prioridad).
- Buscar mas dead code mas alla de lo reportado en el issue.
- Cambiar la logica de negocio de los handlers.

---

## Tests

### Archivos que necesitaran tests

| Archivo | Tipo | Que testear |
|---------|------|-------------|
| N/A directamente | N/A | Los cambios son defensivos (guards y try/catch); los tests existentes deben seguir pasando |

### Criterios de testing

- `npm run test:run` pasa sin errores tras los cambios.
- `npm run lint` pasa sin errores (verificar que eliminar exports no rompe nada).
- Verificar manualmente que las constantes eliminadas no se usan via `grep -r "CONSTANT_NAME" src/`.
- Si algun componente tiene tests existentes, verificar que siguen pasando.

---

## Seguridad

- [ ] Error handling: los 3 handlers corregidos muestran feedback al usuario en vez de fallar silenciosamente.
- [ ] Sin eval/Function: no aplica.

---

## Deuda tecnica y seguridad

### Issues relacionados

| Issue | Relacion | Accion |
|-------|----------|--------|
| #253 architecture cleanup | complementario | Ambos limpian dead code; coordinar para evitar conflictos |

### Mitigacion incorporada

- Los cancellation guards previenen race conditions y warnings de React.
- Los try/catch con toast dan feedback visible al usuario.
- Eliminar dead exports reduce el surface area del codebase y mejora tree-shaking.

---

## Offline

### Data flows

| Operacion | Tipo (read/write) | Estrategia offline | Fallback UI |
|-----------|-------------------|-------------------|-------------|
| useEffect loads (8 archivos) | read | Firestore persistent cache existente | Los guards previenen setState en unmount |
| Async handlers (3 archivos) | write | Los try/catch atrapan errores de red | Toast de error con mensaje descriptivo |

### Checklist offline

- [x] Reads de Firestore: usan persistencia offline existente
- [x] Writes: los try/catch nuevos manejan errores de red
- [x] APIs externas: no aplica
- [ ] UI: los toast de error informan sobre fallos de escritura
- [x] Datos criticos: no cambian

### Esfuerzo offline adicional: S (ninguno, solo mejora error handling existente)

---

## Modularizacion y % monolitico

### Checklist modularizacion

- [x] Logica de negocio en hooks/services (no se mueve logica, solo se agregan guards)
- [x] No se agregan componentes nuevos
- [x] No se agregan useState de logica de negocio a AppShell o SideMenu
- [x] Ningun archivo nuevo importa directamente de `firebase/firestore`
- [x] Eliminacion de dead exports reduce surface area

### Impacto en % monolitico

| Aspecto | Impacto | Justificacion |
|---------|---------|---------------|
| Acoplamiento de componentes | = | No hay nuevos acoplamientos |
| Estado global | = | No hay cambios de estado global |
| Firebase coupling | - | Eliminar 5 collection getters muertos reduce surface area de Firebase |
| Organizacion por dominio | = | No hay cambios de organizacion |

---

## Success Criteria

1. Los 8 useEffect identificados tienen cancellation guard (`let cancelled = false` + cleanup function).
2. Los 3 async handlers tienen try/catch con logger.error() y toast de error visible al usuario.
3. Las 13 constantes muertas y 5 collection getters muertos estan eliminados.
4. `npm run test:run` pasa sin errores.
5. `npm run lint` pasa sin errores.
6. `grep -r "CONSTANT_NAME" src/` no encuentra referencias a las constantes eliminadas.

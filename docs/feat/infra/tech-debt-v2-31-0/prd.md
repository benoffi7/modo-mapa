# PRD: Tech debt — security + architecture findings from v2.31.0 merge

**Feature:** tech-debt-v2-31-0
**Categoria:** infra
**Fecha:** 2026-03-29
**Issue:** #236
**Prioridad:** Alta (contiene findings de seguridad H-1 y M-1)

---

## Contexto

Durante la auditoria de merge de v2.31.0 (features #229/#232: listas compartidas con iconos y editores colaborativos), se identificaron 10 findings en 4 categorias: seguridad, arquitectura, performance y copy. Estos findings son deuda tecnica que debe resolverse antes de avanzar con features nuevas, ya que incluyen un leak de UID (H-1) y endpoints callables sin rate limiting (M-1).

## Problema

- **Seguridad:** La respuesta de `inviteListEditor` retorna `targetUid` al cliente, lo que permite al owner de una lista mapear emails a UIDs de Firebase Auth. Ademas, `EditorsDialog` muestra los primeros 8 caracteres del UID como texto secundario, exponiendo informacion interna. Ninguno de los dos callables (`inviteListEditor`/`removeListEditor`) tiene rate limiting.
- **Arquitectura:** `CheckInButton` duplica la guarda de auth (`user.isAnonymous`) que deberia vivir en `useCheckIn`. Ademas tiene un stale-closure bug donde `status` se captura antes de que `performCheckIn` lo actualice, resultando en que el toast de exito siempre se muestra incluso si hay error. `CATEGORY_LABELS` se importa desde dos paths distintos (`types/index.ts` y `constants/business.ts`), y `useConnectivity` tiene un re-export wrapper innecesario en `hooks/useConnectivity.ts`.
- **Performance:** `ListDetailScreen` importa eagerly 3 componentes de dialog (`IconPicker`, `EditorsDialog`, `InviteEditorDialog`) que solo se usan al interactuar. `handleEditorsChanged` no esta wrapeado en `useCallback`. `DirectionsButton` no usa `memo` y subscribe a todo `useFilters` cuando solo necesita `userLocation`.
- **Copy:** 4 mensajes de error en `constants/messages/list.ts` usan el patron "Error al..." inconsistente con el resto del proyecto que usa "No se pudo...".

## Solucion

### S1. Security fixes (H-1, M-1, M-3)

**H-1: Email enumeration + UID leak en `inviteListEditor`**

- Cambiar la respuesta de `inviteListEditor` de `{ success: true, targetUid }` a `{ success: true }`.
- El frontend ya no necesita el `targetUid` — el `editorIds` se refetchea via `handleEditorsChanged` → `fetchSharedList`.
- El error de `getUserByEmail` ya devuelve un mensaje generico ("No se pudo enviar la invitacion. Verifica el email e intenta de nuevo."), lo cual es correcto.

**M-1: Rate limit en callables de editores**

- Agregar `checkRateLimit()` en `inviteListEditor` y `removeListEditor` con limite de 10/dia por usuario.
- Seguir el patron existente de `checkRateLimit` usado en triggers (coleccion `_rateLimits`, clave `{userId}__{actionType}`).

**M-3: UID leak en EditorsDialog**

- Eliminar `secondary={editor.uid.slice(0, 8) + '...'}` del `ListItemText` en `EditorsDialog`.
- Reemplazar con un indicador neutral (ej: rol "Editor") o simplemente no mostrar secondary text.

### S2. Architecture fixes

**CheckInButton auth guard + stale closure**

- Mover la guarda `if (!user || user.isAnonymous)` a `useCheckIn.performCheckIn` y `useCheckIn.undoCheckIn`. Retornar un resultado tipado (`{ blocked: 'auth' | 'cooldown' | 'none' }`) para que el componente muestre el toast adecuado.
- Corregir el stale-closure: el toast de exito debe depender del resultado de `performCheckIn`, no de `status` capturado antes de la llamada. Refactorizar para que `performCheckIn` retorne un resultado (`'success' | 'error'`) y el componente actue en base a eso.

**CATEGORY_LABELS dual import**

- Elegir `constants/business.ts` como la unica fuente canonica (ya lo es).
- Actualizar los 5 archivos que importan desde `types/index.ts` para importar desde `constants/business`.
- Eliminar el re-export de `CATEGORY_LABELS` en `types/index.ts`. Mantener `PREDEFINED_TAGS` y `PRICE_LEVEL_LABELS` por ahora si tienen consumidores.

**useConnectivity dual import**

- Eliminar `src/hooks/useConnectivity.ts` (wrapper de 1 linea).
- Actualizar los 14 archivos que importan desde `hooks/useConnectivity` para importar desde `context/ConnectivityContext`.

### S3. Performance fixes

**Lazy-load dialogs en ListDetailScreen**

- Convertir `IconPicker`, `EditorsDialog` e `InviteEditorDialog` a imports con `React.lazy()` + `Suspense`.
- Seguir el patron existente del proyecto donde todas las secciones del menu son lazy-loaded.

**useCallback para handleEditorsChanged**

- Wrappear `handleEditorsChanged` en `useCallback` con dependencia en `[list.id]`.

**DirectionsButton memo + selective context**

- Wrappear `DirectionsButton` con `memo`.
- Extraer `userLocation` como prop desde el parent (`BusinessSheetHeader`) en vez de subscribirse directamente a `useFilters`. Esto evita re-renders cuando otros filtros cambian.

### S4. Copy fixes

- Reemplazar los 4 mensajes "Error al..." en `constants/messages/list.ts` por el patron "No se pudo...":
  - `deleteError`: "Error al eliminar lista" → "No se pudo eliminar la lista"
  - `colorError`: "Error al cambiar color" → "No se pudo cambiar el color"
  - `visibilityError`: "Error al cambiar visibilidad" → "No se pudo cambiar la visibilidad"
  - `iconError`: "Error al cambiar icono" → "No se pudo cambiar el icono"
- Verificar `addFavoritesError` y `favoriteUpdateError` (tambien usan "Error al...") y corregir.

### S5. Icon migration (L-3)

- Agregar un mapa de fallback en `getListIconById` que mapee IDs legacy (si existieran en Firestore, ej: `sun`, `moon`, `rainbow`) al icono mas cercano del catalogo actual, o al icono default.
- Dado que el catalogo actual de `listIcons.ts` no contiene esos IDs y `getListIconById` ya retorna `undefined` para IDs desconocidos, la UI ya usa un fallback. La mejora es documentar esto y agregar un migration script opcional que normalice los datos en Firestore.

---

## Scope

| Item | Prioridad | Esfuerzo |
|------|-----------|----------|
| H-1: Eliminar `targetUid` de respuesta `inviteListEditor` | Alta | S |
| M-1: Rate limit en `inviteListEditor` y `removeListEditor` | Alta | S |
| M-3: Eliminar UID de secondary text en `EditorsDialog` | Alta | S |
| CheckInButton: mover auth guard a hook + fix stale closure | Media | M |
| CATEGORY_LABELS: unificar import path | Media | S |
| useConnectivity: eliminar re-export wrapper | Media | S |
| Lazy-load 3 dialogs en ListDetailScreen | Media | S |
| useCallback para handleEditorsChanged | Baja | S |
| DirectionsButton: memo + extraer userLocation como prop | Baja | S |
| Copy: corregir 6 mensajes "Error al..." | Baja | S |
| L-3: Documentar fallback de iconos legacy | Baja | S |
| Rate limit en otros callables user-facing sin rate limit | Media | S |
| Eliminar re-export de `PREDEFINED_TAGS`/`PRICE_LEVEL_LABELS` en `types/index.ts` | Baja | S |
| Migrar icon IDs legacy en Firestore (normalizar datos existentes) | Baja | S |

**Esfuerzo total estimado:** M

---

## Out of Scope

- Refactor completo de `ListDetailScreen` (tiene 280+ lineas pero esta dentro del limite de 400)

---

## Tests

### Archivos que necesitaran tests

| Archivo | Tipo | Que testear |
|---------|------|-------------|
| `functions/src/callable/inviteListEditor.ts` | Callable (existente) | Verificar que la respuesta NO incluye `targetUid`. Verificar rate limit rechaza >10/dia. |
| `functions/src/callable/removeListEditor.ts` | Callable (existente) | Verificar rate limit rechaza >10/dia. |
| `src/hooks/useCheckIn.ts` | Hook (existente) | Auth guard retorna `blocked: 'auth'` para anonimos. Resultado de `performCheckIn` refleja exito/error correctamente. |
| `src/components/lists/EditorsDialog.tsx` | Componente | Verificar que no se renderiza ningun UID en el DOM. |
| `src/constants/listIcons.ts` | Util (existente) | `getListIconById('unknown')` retorna `undefined`. Iconos validos retornan correctamente. |

### Criterios de testing

- Cobertura >= 80% del codigo nuevo
- Tests de validacion para todos los inputs del usuario
- Todos los paths condicionales cubiertos
- Side effects verificados (rate limit writes, response shape)

---

## Seguridad

- [x] `inviteListEditor` ya devuelve error generico para email no encontrado (correcto, no cambiar)
- [ ] Eliminar `targetUid` de la respuesta de `inviteListEditor` (H-1)
- [ ] Agregar `checkRateLimit()` a `inviteListEditor` con limite 10/dia (M-1)
- [ ] Agregar `checkRateLimit()` a `removeListEditor` con limite 10/dia (M-1)
- [ ] Eliminar UID parcial del secondary text en `EditorsDialog` (M-3)
- [ ] Verificar que ningun otro componente expone UIDs de otros usuarios en la UI

### Vectores de ataque automatizado

| Superficie | Ataque posible | Mitigacion requerida |
|-----------|---------------|---------------------|
| `inviteListEditor` callable | Email enumeration: un atacante puede probar emails para verificar existencia en Firebase Auth | Error generico ya implementado. Rate limit 10/dia previene fuerza bruta. App Check en prod. |
| `inviteListEditor` response | UID harvesting: respuesta incluye `targetUid` que mapea email a UID | Eliminar `targetUid` de response (H-1) |
| `removeListEditor` callable | Spam de removes: un atacante owner puede invocar masivamente | Rate limit 10/dia. Solo el owner puede invocar. |
| `EditorsDialog` UI | UID scraping via DOM inspection | Eliminar UID del rendered text (M-3) |

---

## Deuda tecnica y seguridad

### Issues relacionados

| Issue | Relacion | Accion |
|-------|----------|--------|
| #168 (Vite 8 + ESLint 10) | No afecta | Independiente, peer deps blocker |
| Backlog: Firestore rules field whitelist audit | Afecta | `inviteListEditor`/`removeListEditor` escriben a `sharedLists` — verificar que `editorIds` esta en `hasOnly()` de las rules de update |
| Backlog: Copy audit tildes/signos | Mitiga | Los 6 mensajes corregidos reducen deuda de copy |

### Mitigacion incorporada

- Rate limiting en callables de listas: cierra gap donde `inviteListEditor` y `removeListEditor` eran los unicos callables user-facing sin rate limit server-side.
- Eliminacion de UID leaks: alinea con la politica del proyecto de no exponer informacion interna de Firebase Auth.
- Copy consistency: reduce la deuda de copy audit pendiente del backlog.

---

## Offline

### Data flows

| Operacion | Tipo (read/write) | Estrategia offline | Fallback UI |
|-----------|-------------------|-------------------|-------------|
| `inviteListEditor` callable | write | No soporta offline (callable requiere conexion) | Error toast con mensaje de red |
| `removeListEditor` callable | write | No soporta offline (callable requiere conexion) | Error toast con mensaje de red |
| `handleEditorsChanged` (refetch) | read | Firestore persistent cache devuelve ultimo valor | Datos stale, no se muestra error |

### Checklist offline

- [x] Reads de Firestore: usan persistencia offline (Firestore persistent cache en prod)
- [ ] Writes: los callables no soportan offline — esto es correcto, son operaciones admin que requieren confirmacion server-side
- [x] APIs externas: no aplica
- [x] UI: `InviteEditorDialog` ya usa `useConnectivity` para detectar estado offline
- [x] Datos criticos: `editorIds` viene con la lista en el fetch inicial

### Esfuerzo offline adicional: S (sin cambios necesarios)

---

## Modularizacion y % monolitico

### Checklist modularizacion

- [x] Logica de negocio en hooks/services: auth guard se mueve a `useCheckIn` hook
- [x] Componentes nuevos son reutilizables: no hay componentes nuevos, solo refactors
- [x] No se agregan useState de logica de negocio a AppShell o SideMenu
- [x] Props explicitas: `DirectionsButton` recibe `userLocation` como prop en vez de subscribirse a context
- [x] Cada prop de accion tiene handler real: no aplica (no hay props nuevas de accion)
- [x] Ningun componente nuevo importa directamente de `firebase/firestore`
- [x] Archivos nuevos van en carpeta de dominio correcta: no hay archivos nuevos
- [x] useConnectivity: eliminar re-export innecesario reduce indirection
- [x] Ningun archivo nuevo supera 400 lineas

### Impacto en % monolitico

| Aspecto | Impacto | Justificacion |
|---------|---------|---------------|
| Acoplamiento de componentes | - | `DirectionsButton` se desacopla de `useFilters`, `CheckInButton` delega auth a hook |
| Estado global | = | No se agrega ni modifica estado global |
| Firebase coupling | = | Rate limit se agrega en functions (correcto), no en frontend |
| Organizacion por dominio | - | Se elimina el re-export wrapper `hooks/useConnectivity.ts`, reduciendo indirection |

---

## Success Criteria

1. La respuesta de `inviteListEditor` no contiene `targetUid` ni ningun otro identificador interno.
2. Ambos callables (`inviteListEditor`, `removeListEditor`) rechazan con `resource-exhausted` al superar 10 invocaciones/dia por usuario.
3. `EditorsDialog` no renderiza ningun fragmento de UID en el DOM.
4. `CheckInButton` no muestra toast de exito cuando `performCheckIn` falla.
5. `CATEGORY_LABELS` tiene un unico import path (`constants/business.ts`) en todo el codebase.
6. Los 3 dialogs de `ListDetailScreen` se cargan via `React.lazy()` y no aparecen en el bundle inicial de la pantalla.
7. Todos los mensajes de error en `constants/messages/list.ts` usan el patron "No se pudo...".

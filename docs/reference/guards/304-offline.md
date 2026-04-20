# Guard: Offline behavior (#304)

**Feature:** [304-offline-lists-notifications](../../feat/infra/304-offline-lists-notifications/prd.md)
**Fecha:** 2026-04-18
**Issue:** [#304](https://github.com/benoffi7/modo-mapa/issues/304)
**Scope:** Regresion-guard para escrituras offline, callables y fallbacks de Google Maps.

---

## Contexto

El audit `/health-check` (2026-04-18) detecto que el dominio **Lists**, las operaciones
pequenas de **notifications** y escrituras de **profile** fallaban silenciosamente offline.
#304 agrega 6 nuevos `OfflineActionType` (list_create, list_update, list_toggle_public,
list_delete, list_item_add, list_item_remove) y un `MapErrorBoundary` para fallback de Google Maps.

Este documento consolida las reglas que mantienen la cobertura offline y los comandos
para detectar regresiones en auditorias futuras.

---

## Reglas

### 1. Mutaciones Firestore pasan por offline queue o guard explicito

Toda mutacion (`addDoc` / `setDoc` / `updateDoc` / `deleteDoc`) en `src/services/`
DEBE cumplir una de las siguientes:

- Ejecutarse a traves de `withOfflineSupport(...)` (registra la accion en la queue), O
- Estar envuelta en un guard `navigator.onLine` / `useConnectivity().isOffline` que
  retorna temprano o deshabilita la UI invocadora.

Excepciones permitidas:

- `src/services/admin/*` (flujo admin con red garantizada).
- Tests (`*.test.ts`, `*.test.tsx`).
- El wrapper `withOfflineSupport` mismo.

### 2. httpsCallable gated por estado de conexion

Todo `httpsCallable` en componentes user-facing (`src/components/`) o en servicios
(`src/services/`) DEBE estar gated por:

- `useConnectivity().isOffline` (preferido en componentes React), O
- `navigator.onLine` (para helpers puros).

El boton/accion que lo dispara debe estar `disabled` cuando hay offline, con feedback
visual (toast, tooltip "Requiere conexion", etc.).

### 3. Conteos Firestore con fallback offline

Todo uso de `getCountFromServer` DEBE pasar por el helper `getCountOfflineSafe`
(que captura el error offline y devuelve el ultimo count conocido o 0).

### 4. Lists CRUD registradas como OfflineActionType

Las 6 operaciones del dominio Lists DEBEN estar registradas como `OfflineActionType`
y enqueueadas via `withOfflineSupport`:

| Operacion | OfflineActionType |
|-----------|-------------------|
| `createList` | `list_create` |
| `updateList` | `list_update` |
| `toggleListPublic` | `list_toggle_public` |
| `deleteList` | `list_delete` (bloqueada offline, pero tipo definido para replay) |
| `addBusinessToList` | `list_item_add` |
| `removeBusinessFromList` | `list_item_remove` |

Si aparece una mutation nueva al dominio Lists, agregar el `OfflineActionType`
correspondiente antes de mergear.

### 5. APIProvider siempre envuelto en MapErrorBoundary

Todo uso de `APIProvider` (de `@vis.gl/react-google-maps`) DEBE estar dentro de un
`<MapErrorBoundary>`. Sin excepciones: el boundary cubre API key vacia, quota excedida,
offline en primer render y tracker blockers que corten el script.

---

## Patrones de deteccion (grep)

Ejecutar estos comandos durante audits. Cada hit requiere revision manual.

### Detectar mutaciones sin offline wrapper

```bash
grep -rn "addDoc\|setDoc\|updateDoc" src/services/ --include="*.ts" \
  | grep -v admin \
  | grep -v test \
  | grep -v withOfflineSupport
```

Inspeccionar cada hit: debe haber un guard `isOffline` / `navigator.onLine` en el
caller, o la funcion debe ser invocada solo desde `syncEngine.executeAction` (replay path).

### Detectar httpsCallable sin guard

```bash
grep -rn "httpsCallable" src/components/ src/services/ \
  | grep -v admin \
  | grep -v test \
  | grep -v navigator.onLine \
  | grep -v isOffline
```

Cada hit debe tener `disabled={isOffline}` en el boton invocador o un `if (isOffline) return`
antes del call.

### Detectar getCountFromServer sin wrapper

```bash
grep -rn "getCountFromServer" src/ --include="*.ts" \
  | grep -v test \
  | grep -v getCountOfflineSafe
```

No debe haber hits fuera de la definicion de `getCountOfflineSafe`.

### Detectar APIProvider sin MapErrorBoundary

```bash
grep -rn "APIProvider" src/components/ | grep -v MapErrorBoundary
```

Unico hit permitido: la implementacion de `MapErrorBoundary.tsx` (que no lo usa pero
puede referirlo en JSDoc) y el archivo que importa `APIProvider` dentro del boundary.

---

## Checklist pre-merge

- [ ] `grep` de mutaciones → todos los hits tienen wrapper o guard.
- [ ] `grep` de `httpsCallable` → todos los hits tienen `isOffline` gate.
- [ ] `grep` de `getCountFromServer` → zero hits fuera de `getCountOfflineSafe`.
- [ ] `grep` de `APIProvider` → dentro de `MapErrorBoundary` sin excepciones.
- [ ] Nuevas mutations de dominio Lists tienen `OfflineActionType` asignado.
- [ ] Tests de `syncEngine.executeAction` cubren los 6 branches de list_*.

---

## Relacionado

- PRD: [docs/feat/infra/304-offline-lists-notifications/prd.md](../../feat/infra/304-offline-lists-notifications/prd.md)
- Specs: [docs/feat/infra/304-offline-lists-notifications/specs.md](../../feat/infra/304-offline-lists-notifications/specs.md)
- Plan: [docs/feat/infra/304-offline-lists-notifications/plan.md](../../feat/infra/304-offline-lists-notifications/plan.md)
- Patterns offline: [docs/reference/patterns.md](../patterns.md)
- Agente offline-auditor: [.claude/agents/offline-auditor.md](../../../.claude/agents/offline-auditor.md)

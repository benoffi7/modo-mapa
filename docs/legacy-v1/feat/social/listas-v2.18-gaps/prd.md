# PRD: Gaps pendientes en listas v2.18 (#155, #156, #160)

**Feature:** listas-v2.18-gaps
**Categoria:** social
**Fecha:** 2026-03-19
**Issues relacionados:** [#155](https://github.com/benoffi7/modo-mapa/issues/155), [#156](https://github.com/benoffi7/modo-mapa/issues/156), [#160](https://github.com/benoffi7/modo-mapa/issues/160)
**Prioridad:** Alta — bloquea merge a main

---

## Contexto

Las tres features de listas (#155 colaborativas, #156 sugeridas, #160 mejoras) fueron implementadas parcialmente. Hay backends funcionales con UIs incompletas, y patrones que no se aplicaron consistentemente (staging DB, App Check). Este PRD documenta los gaps exactos para completar las features.

### Estado actual vs PRD original

| PRD Item | Estado | Gap |
|----------|--------|-----|
| **#155 S3** Invitar editor | OK | Funciona con Firebase Auth lookup |
| **#155 S3** Remover editor | Backend OK | NO HAY UI para remover editores |
| **#155 S4** Lista de editores actual | Backend OK | NO HAY UI — solo muestra chip con cantidad |
| **#155 S5** Editor agrega items | Rules OK | `AddToListDialog` NO muestra listas donde el usuario es editor |
| **#155 S5** Sección "Compartidas conmigo" | OK | Funciona |
| **#155 S4** Badge "Colaborativa" | OK | Funciona |
| **#156 S2** Admin toggle featured | OK | Funciona via Cloud Function |
| **#156 S3** Listas auto-generadas | OK | Scheduled function funciona |
| **#156 S4** Sección "Destacadas" en UI | OK | Funciona via Cloud Function |
| **#160 S1** Persistir lista compartida | OK | Funciona |
| **#160 S2** Copiar lista | OK | Funciona |
| **#160 S3** Favoritos masivos | OK | Funciona (batch, no individual) |
| **#160 S3** Favorito individual por comercio | NO | No implementado |

---

## Gaps a resolver

### G1: UI para ver y remover editores (owner)

**PRD original:** #155 S4 — "Lista de editores actuales con botón remover"

**Estado:** El chip `GroupIcon + count` existe pero no es interactivo. No hay forma de ver quiénes son los editores ni de removerlos.

**Implementación:**
- Al tocar el chip de editores (o un botón dedicado), abrir un dialog que muestre:
  - Lista de editores con displayName (fetch del doc `users/{uid}`)
  - Botón remover (X) por editor que llama a `removeListEditor` Cloud Function
- Agregar service wrapper en el cliente para `removeListEditor`:
  ```typescript
  // src/services/sharedLists.ts
  export async function removeEditor(listId: string, targetUid: string): Promise<void> {
    const { httpsCallable } = await import('firebase/functions');
    const { functions } = await import('../config/firebase');
    const databaseId = import.meta.env.VITE_FIRESTORE_DATABASE_ID || undefined;
    const fn = httpsCallable(functions, 'removeListEditor');
    await fn({ listId, targetUid, databaseId });
  }
  ```

**Cloud Function:** `removeListEditor` ya existe y acepta `databaseId`.

---

### G2: Editor puede agregar comercios desde AddToListDialog

**PRD original:** #155 S5 — "El editor ve la lista en modo editable (puede agregar/quitar comercios)"

**Estado:** `AddToListDialog.tsx` solo muestra listas donde `ownerId == user.uid`. Un editor no ve las listas colaborativas al agregar un comercio desde el mapa.

**Implementación:**
- En `AddToListDialog.tsx`, hacer un segundo query para listas donde el user es editor:
  ```typescript
  const editorSnap = await getDocs(
    query(getSharedListsCollection(), where('editorIds', 'array-contains', user.uid))
  );
  ```
- Mergear ambos resultados (owned + editor) y mostrar en el dialog
- Marcar las listas de editor con un badge "Colaborativa" para distinguirlas
- El `addBusinessToList` ya funciona porque las Firestore rules permiten que editores modifiquen `itemCount` y creen items

**Nota staging:** Este query directo puede fallar por las rules complejas de `sharedLists` (mismo problema que tuvimos con `fetchFeaturedLists`). Si falla, mover a una Cloud Function `getEditableLists(userId, databaseId)`.

---

### G3: Favorito individual por comercio en lista compartida

**PRD original:** #160 S3 — "Ícono de corazón por comercio individual para toggle de favorito inline"

**Estado:** Solo existe el botón batch "Marcar todos como favoritos". No hay toggle individual.

**Implementación:**
- En la vista de lista compartida (deep link / featured), agregar un `FavoriteButton` por cada comercio
- Reusar el patrón de `FavoriteButton` existente (o un `IconButton` con `FavoriteIcon`)
- Requiere saber si cada comercio ya es favorito del usuario (query de favoritos)

---

### G4: Indicador `addedBy` en items de lista colaborativa

**PRD original:** #155 S4 — "Indicador de quién agregó cada comercio (campo `addedBy` en `listItems`)"

**Estado:** El campo `addedBy` existe en el tipo `ListItem` y se pasa opcionalmente en `addBusinessToList()`, pero la UI no lo muestra en ningún lugar.

**Implementación:**
- En listas colaborativas (con editores), mostrar un texto sutil debajo de cada item: "Agregado por {displayName}"
- Requiere fetch del displayName del `addedBy` uid desde la colección `users`

**Prioridad:** Baja — puede quedar para un siguiente PR.

---

## Directivas técnicas (lecciones del 2026-03-19)

Todos los cambios DEBEN seguir estas reglas:

### Cloud Functions
- Usar `getDb(databaseId)` de `helpers/env.ts` — NUNCA `getFirestore()` directo
- `ENFORCE_APP_CHECK = false` (ya configurado globalmente)
- Toda callable DEBE aceptar `databaseId?: string` del cliente
- El frontend SIEMPRE pasa `import.meta.env.VITE_FIRESTORE_DATABASE_ID` a las callables

### Queries de Firestore
- Colecciones con rules complejas (sharedLists): usar Cloud Functions con Admin SDK
- Colecciones con rules simples: queries directos OK
- NUNCA usar `.catch(() => {})` silencioso — siempre `console.error`

### Staging
- Después de implementar, desplegar functions: `npx firebase-tools deploy --only functions:<name> --project modo-mapa-app`
- Correr `scripts/pre-staging-check.sh` antes de pushear
- Verificar que el GH Action de staging completó antes de decir "probá"

### Tests
- Todo code nuevo requiere tests ≥80% cobertura
- Mocks de `helpers/env` deben incluir `ENFORCE_APP_CHECK` y `getDb`

---

## Scope

| Gap | Prioridad | Esfuerzo | Bloquea merge |
|-----|-----------|----------|---------------|
| G1: UI ver/remover editores | Alta | S | Sí |
| G2: Editor agrega items desde dialog | Alta | M | Sí |
| G3: Favorito individual | Media | S | No |
| G4: Indicador addedBy | Baja | S | No |

**Esfuerzo total:** M

---

## Tests requeridos

| Archivo | Qué testear |
|---------|-------------|
| `AddToListDialog.tsx` (o test) | Que muestre listas de editor además de las propias |
| `removeListEditor` Cloud Function | Ya tiene tests — verificar que pasen |
| `inviteListEditor` Cloud Function | Actualizar mock para usar `getAuth().getUserByEmail` |

---

## Success Criteria

1. El owner puede ver la lista de editores con nombre y remover cualquiera.
2. Un editor ve las listas colaborativas en `AddToListDialog` y puede agregar comercios.
3. Los tests pasan con ≥80% cobertura.
4. `scripts/pre-staging-check.sh` pasa sin errores.
5. Todo funciona en staging sin errores de auth, DB, ni rules.

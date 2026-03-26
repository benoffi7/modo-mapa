# Specs: Listas colaborativas — múltiples editores por lista

**PRD:** [prd.md](./prd.md)
**Issue:** #155
**Estado:** Pendiente de aprobación

---

## S1: Modelo de datos — campo `editorIds`

Actualizar tipo en `src/types/index.ts`:

```typescript
export interface SharedList {
  id: string;
  ownerId: string;
  name: string;
  description: string;
  isPublic: boolean;
  itemCount: number;
  featured?: boolean;
  editorIds?: string[];    // NEW — max 5
  createdAt: Date;
  updatedAt: Date;
}
```

Actualizar `ListItem`:

```typescript
export interface ListItem {
  id: string;
  listId: string;
  businessId: string;
  addedBy?: string;        // NEW — userId de quien agregó
  createdAt: Date;
}
```

**Constante:** Agregar `MAX_EDITORS_PER_LIST = 5` a `src/constants/lists.ts`.

**Converter** (`src/config/converters.ts`):

- `sharedListConverter`: agregar `editorIds: (d.get('editorIds') as string[]) ?? []`
- `listItemConverter`: agregar `addedBy: d.get('addedBy') ?? ''`

---

## S2: Firestore rules para editores

Actualizar `firestore.rules` para `sharedLists`:

```text
match /sharedLists/{docId} {
  function isOwner() {
    return resource.data.ownerId == request.auth.uid;
  }
  function isEditor() {
    return request.auth.uid in resource.data.get('editorIds', []);
  }

  allow read: if request.auth != null
    && (isOwner() || isEditor()
        || resource.data.isPublic == true
        || resource.data.get('featured', false) == true);

  allow create: if request.auth != null
    && request.resource.data.keys().hasOnly([
      'ownerId', 'name', 'description', 'isPublic', 'itemCount',
      'createdAt', 'updatedAt', 'featured', 'editorIds'])
    && request.resource.data.ownerId == request.auth.uid
    && request.resource.data.name is string
    && request.resource.data.name.size() > 0
    && request.resource.data.name.size() <= 50
    && request.resource.data.description is string
    && request.resource.data.description.size() <= 200
    && request.resource.data.isPublic is bool
    && request.resource.data.itemCount == 0
    && request.resource.data.createdAt == request.time
    && request.resource.data.updatedAt == request.time;

  // Owner: full update. Editor: only itemCount + updatedAt (via addBusiness/removeBusiness)
  allow update: if request.auth != null
    && (isOwner() && request.resource.data.ownerId == resource.data.ownerId)
    || (isEditor() && request.resource.data.diff(resource.data).affectedKeys()
        .hasOnly(['itemCount', 'updatedAt']));

  allow delete: if request.auth != null && isOwner();
}
```

Actualizar `listItems`:

```text
match /listItems/{docId} {
  allow read: if request.auth != null;

  allow create: if request.auth != null
    && request.resource.data.keys().hasOnly(['listId', 'businessId', 'addedBy', 'createdAt'])
    && request.resource.data.listId is string
    && request.resource.data.listId.size() > 0
    && request.resource.data.businessId is string
    && request.resource.data.createdAt == request.time;

  // Delete: owner of list OR the user who added the item
  allow delete: if request.auth != null;
}
```

**Nota:** La validación de editor en `listItems` create/delete requeriría un `get()` al parent list, lo cual es costoso (1 read extra por operación). Se mantiene el delete abierto a auth users (como está ahora) y se confía en la UI + service layer para enforcement.

---

## S3: Callable `inviteListEditor`

Nuevo archivo `functions/src/callable/inviteListEditor.ts`:

```typescript
export const inviteListEditor = onCall(
  { enforceAppCheck: !IS_EMULATOR },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Must be signed in');

    const { listId, targetEmail } = request.data as { listId: string; targetEmail: string };
    if (!listId || typeof listId !== 'string') throw new HttpsError('invalid-argument', 'listId required');
    if (!targetEmail || typeof targetEmail !== 'string') throw new HttpsError('invalid-argument', 'email required');

    const db = getFirestore();
    const listSnap = await db.doc(`sharedLists/${listId}`).get();
    if (!listSnap.exists) throw new HttpsError('not-found', 'Lista no encontrada');

    const list = listSnap.data()!;
    if (list.ownerId !== request.auth.uid) {
      throw new HttpsError('permission-denied', 'Solo el creador puede invitar editores');
    }

    // Find user by email
    const usersSnap = await db.collection('users')
      .where('email', '==', targetEmail.toLowerCase().trim())
      .limit(1).get();
    if (usersSnap.empty) {
      throw new HttpsError('not-found', 'Usuario no encontrado');
    }

    const targetUid = usersSnap.docs[0].id;
    if (targetUid === request.auth.uid) {
      throw new HttpsError('invalid-argument', 'No podés invitarte a vos mismo');
    }

    const editorIds: string[] = list.editorIds ?? [];
    if (editorIds.includes(targetUid)) {
      throw new HttpsError('already-exists', 'Este usuario ya es editor');
    }
    if (editorIds.length >= 5) {
      throw new HttpsError('resource-exhausted', 'Máximo 5 editores por lista');
    }

    await db.doc(`sharedLists/${listId}`).update({
      editorIds: FieldValue.arrayUnion(targetUid),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return { success: true, targetUid };
  },
);
```

---

## S4: Callable `removeListEditor`

Nuevo archivo `functions/src/callable/removeListEditor.ts`:

```typescript
export const removeListEditor = onCall(
  { enforceAppCheck: !IS_EMULATOR },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Must be signed in');

    const { listId, targetUid } = request.data as { listId: string; targetUid: string };
    if (!listId || !targetUid) throw new HttpsError('invalid-argument', 'listId and targetUid required');

    const db = getFirestore();
    const listSnap = await db.doc(`sharedLists/${listId}`).get();
    if (!listSnap.exists) throw new HttpsError('not-found', 'Lista no encontrada');

    const list = listSnap.data()!;
    if (list.ownerId !== request.auth.uid) {
      throw new HttpsError('permission-denied', 'Solo el creador puede remover editores');
    }

    await db.doc(`sharedLists/${listId}`).update({
      editorIds: FieldValue.arrayRemove(targetUid),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return { success: true };
  },
);
```

---

## S5: Frontend — Service

Agregar a `src/services/sharedLists.ts`:

```typescript
export async function fetchSharedWithMe(userId: string): Promise<SharedList[]> {
  const snap = await getDocs(
    query(
      getSharedListsCollection(),
      where('editorIds', 'array-contains', userId),
      orderBy('updatedAt', 'desc'),
    ),
  );
  return snap.docs.map((d) => d.data());
}
```

Actualizar `addBusinessToList` para incluir `addedBy`:

```typescript
export async function addBusinessToList(listId: string, businessId: string, addedBy?: string): Promise<void> {
  const itemId = `${listId}__${businessId}`;
  await setDoc(doc(db, COLLECTIONS.LIST_ITEMS, itemId), {
    listId,
    businessId,
    ...(addedBy ? { addedBy } : {}),
    createdAt: serverTimestamp(),
  });
  // ... rest unchanged
}
```

---

## S6: UI — Gestión de editores (owner)

Nuevo componente `src/components/menu/EditorsDialog.tsx`:

```typescript
interface Props {
  open: boolean;
  onClose: () => void;
  listId: string;
  editorIds: string[];
  onUpdate: () => void;
}
```

- Input de email + botón "Invitar"
- Lista de editores actuales con displayName (fetch from `users/{uid}`) y botón remover
- Llama callable `inviteListEditor` / `removeListEditor` via `httpsCallable`

---

## S7: UI — Vista "Compartidas conmigo"

En `SharedListsView.tsx`, después de "Mis Listas":

```typescript
const [sharedWithMe, setSharedWithMe] = useState<SharedList[]>([]);

useEffect(() => {
  if (!user) return;
  fetchSharedWithMe(user.uid).then(setSharedWithMe).catch(() => {});
}, [user]);
```

Render como sección separada con título "Compartidas conmigo", similar a Mis Listas pero sin botones de delete/toggle público. Badge "Colaborativa" en cada item.

---

## Archivos a crear

| Archivo | Tamaño estimado |
|---------|----------------|
| `functions/src/callable/inviteListEditor.ts` | ~50 líneas |
| `functions/src/callable/removeListEditor.ts` | ~30 líneas |
| `src/components/menu/EditorsDialog.tsx` | ~120 líneas |

## Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `src/types/index.ts` | `editorIds?: string[]` en SharedList, `addedBy?: string` en ListItem |
| `src/config/converters.ts` | `editorIds` y `addedBy` en converters |
| `src/constants/lists.ts` | `MAX_EDITORS_PER_LIST = 5` |
| `firestore.rules` | Read/update para editores, keys en create |
| `src/services/sharedLists.ts` | `fetchSharedWithMe()`, `addedBy` en `addBusinessToList` |
| `src/components/menu/SharedListsView.tsx` | Sección "Compartidas conmigo", badge colaborativa, botón invitar |
| `functions/src/index.ts` | Registrar callables |

## Tests

| Archivo test | Qué cubre |
|-------------|-----------|
| `functions/src/__tests__/callable/inviteListEditor.test.ts` | Auth, owner check, email lookup, límite 5, self-invite, duplicado |
| `functions/src/__tests__/callable/removeListEditor.test.ts` | Auth, owner check, arrayRemove |
| `src/services/sharedLists.test.ts` | `fetchSharedWithMe`: query `array-contains` |

---

## Dependencias nuevas

Ninguna. `PersonAddIcon`, `PersonRemoveIcon` de `@mui/icons-material`.

---

## Índice de Firestore necesario

La query `where('editorIds', 'array-contains', userId)` requiere un índice compuesto en Firestore:

- Collection: `sharedLists`
- Fields: `editorIds` (Arrays) + `updatedAt` (Descending)

Crear via Firebase Console o agregar a `firestore.indexes.json`.

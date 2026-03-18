# Specs: Mejoras en vista de lista compartida

**PRD:** [prd.md](./prd.md)
**Issue:** #160
**Estado:** Pendiente de aprobación

---

## S1: Persistir lista compartida en estado

**Problema:** Al tocar un comercio desde una shared list view, `handleSelectBusiness` llama `setSelectedBusiness(business)` y `onNavigate()` que cierra el SideMenu. Al cerrar el BusinessSheet, no hay forma de volver a la lista.

**Implementación:**

Agregar `sharedListId` al `SelectionContext` en `MapContext.tsx`:

```typescript
interface SelectionContextType {
  selectedBusiness: Business | null;
  setSelectedBusiness: (business: Business | null) => void;
  activeSharedListId: string | null;                    // NEW
  setActiveSharedListId: (id: string | null) => void;   // NEW
}
```

En `SharedListsView`, al seleccionar un comercio desde una shared list:

```typescript
const handleSelectBusiness = (business: Business) => {
  setActiveSharedListId(sharedListId ?? expandedId);  // persist which list
  setSelectedBusiness(business);
  onNavigate();
};
```

**No se modifica** el componente `BusinessSheet` — la lógica de vuelta va en el parent (`App.tsx` o `SideMenu`).

---

## S2: Navegación de vuelta a la lista

En el componente que maneja el cierre del BusinessSheet (cuando `selectedBusiness` vuelve a `null`):

```typescript
// En SideMenu.tsx o donde se maneja la apertura del drawer
useEffect(() => {
  if (!selectedBusiness && activeSharedListId) {
    // Reabrir SideMenu en la sección de listas
    setActiveSection('lists');
    setMenuOpen(true);
  }
}, [selectedBusiness, activeSharedListId]);
```

El `activeSharedListId` se limpia cuando el usuario cierra la lista explícitamente (botón cerrar o navega a otra sección).

---

## S3: Copiar lista — Service

Nueva función en `src/services/sharedLists.ts`:

```typescript
export async function copyList(sourceListId: string, targetUserId: string): Promise<string> {
  // 1. Check user list count
  const userLists = await getDocs(
    query(collection(db, COLLECTIONS.SHARED_LISTS), where('ownerId', '==', targetUserId)),
  );
  if (userLists.size >= MAX_LISTS) {
    throw new Error('Límite de 10 listas alcanzado');
  }

  // 2. Fetch source list
  const sourceSnap = await getDoc(
    doc(db, COLLECTIONS.SHARED_LISTS, sourceListId).withConverter(sharedListConverter),
  );
  if (!sourceSnap.exists()) throw new Error('Lista no encontrada');
  const source = sourceSnap.data();

  // 3. Verify source is public (or caller is owner)
  if (!source.isPublic && source.ownerId !== targetUserId) {
    throw new Error('No se puede copiar una lista privada');
  }

  // 4. Create new list
  const newListId = await createList(targetUserId, source.name, source.description);

  // 5. Copy items
  const items = await fetchListItems(sourceListId);
  for (const item of items) {
    await addBusinessToList(newListId, item.businessId);
  }

  trackEvent('list_copied', { source_list_id: sourceListId, item_count: items.length });
  return newListId;
}
```

**Constante:** `MAX_LISTS = 10` ya existe en `SharedListsView.tsx` — mover a `src/constants/lists.ts`.

---

## S4: Copiar lista — UI

En la vista de shared list (sección `sharedListId && sharedList` de `SharedListsView.tsx`), agregar botón en el header:

```typescript
{sharedList && user && sharedList.ownerId !== user.uid && (
  <Button
    size="small"
    startIcon={<ContentCopyIcon />}
    onClick={handleCopyList}
    disabled={isCopying}
  >
    {isCopying ? <CircularProgress size={16} /> : 'Copiar lista'}
  </Button>
)}
```

Handler:

```typescript
const handleCopyList = async () => {
  if (!user || !sharedList) return;
  setIsCopying(true);
  try {
    await copyList(sharedList.id, user.uid);
    toast.success('Lista copiada a Mis Listas');
  } catch (err) {
    toast.error(err instanceof Error ? err.message : 'No se pudo copiar');
  }
  setIsCopying(false);
};
```

---

## S5: Favoritos masivos — Service

Nueva función en `src/services/favorites.ts`:

```typescript
export async function addFavoritesBatch(
  userId: string,
  businessIds: string[],
): Promise<number> {
  // Fetch existing favorites to skip duplicates
  const existingSnap = await getDocs(
    query(collection(db, COLLECTIONS.FAVORITES), where('userId', '==', userId)),
  );
  const existingBizIds = new Set(existingSnap.docs.map((d) => d.data().businessId));

  const toAdd = businessIds.filter((id) => !existingBizIds.has(id));
  for (const bizId of toAdd) {
    await setDoc(doc(db, COLLECTIONS.FAVORITES, `${userId}__${bizId}`), {
      userId,
      businessId: bizId,
      createdAt: serverTimestamp(),
    });
  }

  if (toAdd.length > 0) {
    invalidateQueryCache(COLLECTIONS.FAVORITES, userId);
    trackEvent('favorites_batch_add', { count: toAdd.length });
  }
  return toAdd.length;
}
```

---

## S6: Favoritos masivos — UI

Botón en header de shared list view:

```typescript
<Button
  size="small"
  startIcon={<FavoriteIcon />}
  onClick={handleAddAllFavorites}
  disabled={isAddingFavs || sharedItems.length === 0}
>
  Agregar todos a favoritos
</Button>
```

Handler:

```typescript
const handleAddAllFavorites = async () => {
  if (!user) return;
  setIsAddingFavs(true);
  try {
    const bizIds = sharedItems.map((i) => i.businessId);
    const added = await addFavoritesBatch(user.uid, bizIds);
    toast.success(added > 0 ? `${added} favorito${added !== 1 ? 's' : ''} agregado${added !== 1 ? 's' : ''}` : 'Ya tenés todos como favoritos');
  } catch {
    toast.error('Error al agregar favoritos');
  }
  setIsAddingFavs(false);
};
```

---

## Archivos a crear

| Archivo | Tamaño estimado |
|---------|----------------|
| `src/constants/lists.ts` | ~5 líneas |

## Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `src/context/MapContext.tsx` | Agregar `activeSharedListId` + setter al SelectionContext |
| `src/services/sharedLists.ts` | Agregar `copyList()` |
| `src/services/favorites.ts` | Agregar `addFavoritesBatch()` |
| `src/components/menu/SharedListsView.tsx` | Botones copiar + favoritos masivos, persistir listId, navegación de vuelta |

## Tests

| Archivo test | Qué cubre |
|-------------|-----------|
| `src/services/sharedLists.test.ts` (nuevo) | `copyList`: límite 10, lista pública vs privada, copia de items |
| `src/services/favorites.test.ts` (existente) | `addFavoritesBatch`: skip duplicados, cache invalidation, 0 items |

---

## Dependencias nuevas

Ninguna. Solo import de `ContentCopyIcon` y `FavoriteIcon` de `@mui/icons-material` (ya en el proyecto).

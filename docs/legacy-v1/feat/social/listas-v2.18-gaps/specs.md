# Specs: Gaps pendientes en listas v2.18

**Fecha:** 2026-03-19
**PRD:** [prd.md](prd.md)

---

## G1: UI para ver y remover editores

### Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `src/components/menu/SharedListsView.tsx` | Hacer chip de editores clickeable, abrir dialog |
| `src/components/menu/EditorsDialog.tsx` | **NUEVO** — dialog con lista de editores + remover |
| `src/services/sharedLists.ts` | Agregar `removeEditor()` wrapper |

### EditorsDialog.tsx

```typescript
interface Props {
  open: boolean;
  onClose: () => void;
  listId: string;
  editorIds: string[];
  onEditorRemoved: () => void;
}
```

- Recibe `editorIds` del `SharedList`
- Para cada uid, fetch `users/{uid}` doc para obtener `displayName`
- Muestra lista con nombre + botón `RemoveCircleOutline`
- Al remover, llama a `removeEditor(listId, targetUid)` → toast + callback `onEditorRemoved`
- Loading state por editor individual (no bloquea toda la lista)

### Service: removeEditor

```typescript
export async function removeEditor(listId: string, targetUid: string): Promise<void> {
  const { httpsCallable } = await import('firebase/functions');
  const { functions } = await import('../config/firebase');
  const databaseId = import.meta.env.VITE_FIRESTORE_DATABASE_ID || undefined;
  const fn = httpsCallable(functions, 'removeListEditor');
  await fn({ listId, targetUid, databaseId });
}
```

### SharedListsView cambios

- El chip `GroupIcon + count` pasa a ser clickeable: `onClick={() => setEditorsDialogList(list)}`
- Nuevo state: `editorsDialogList: SharedList | null`
- Render `<EditorsDialog>` cuando `editorsDialogList !== null`
- `onEditorRemoved` → reload lists

---

## G2: Editor agrega items desde AddToListDialog

### Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `src/components/business/AddToListDialog.tsx` | Agregar query de listas de editor + merge |

### Query adicional

Dentro del `useEffect` que carga las listas (línea 59-83), después del query de `ownerId`:

```typescript
// Listas donde soy editor
const editorSnap = await getDocs(
  query(getSharedListsCollection(), where('editorIds', 'array-contains', user.uid))
);
const editorLists = editorSnap.docs.map((d) => d.data());
```

Merge: `const allLists = [...userLists, ...editorLists]` (sin duplicados por si el owner es también editor).

### Riesgo: Firestore rules

El query `where('editorIds', 'array-contains', user.uid)` accede a `sharedLists` que tiene rules complejas con ORs. Puede fallar igual que `fetchFeaturedLists`.

**Plan A:** Query directo. Si funciona, listo.
**Plan B:** Si falla por rules, crear Cloud Function `getEditableLists(userId, databaseId)`:
- Busca listas donde `editorIds` contiene `userId`
- Retorna array de `SharedList`
- No requiere `assertAdmin` (cualquier autenticado)

### UI diferenciación

Las listas de editor se muestran con un `Chip` "Colaborativa" al lado del nombre:

```tsx
<ListItemText
  primary={
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
      {list.name}
      {list.ownerId !== user.uid && (
        <Chip label="Colaborativa" size="small" variant="outlined" sx={{ height: 18, fontSize: '0.6rem' }} />
      )}
    </Box>
  }
  secondary={`${list.itemCount} comercios`}
/>
```

### addBusinessToList con addedBy

Cuando un editor agrega un comercio, pasar `addedBy`:

```typescript
await addBusinessToList(listId, businessId, user.uid);
```

La función `addBusinessToList` ya acepta el parámetro opcional `addedBy`.

---

## G3: Favorito individual por comercio en lista compartida

### Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `src/components/menu/SharedListsView.tsx` | Agregar `FavoriteIcon` toggle por item |
| `src/services/favorites.ts` | Reusar `addFavorite` / `removeFavorite` existentes |

### Implementación

En la vista de lista compartida (sección de deep link, líneas 346-360), agregar un `IconButton` con `FavoriteIcon` por cada comercio.

Necesita saber si el comercio ya es favorito:
- Fetch favoritos del usuario al abrir la lista: `getDocs(query(collection(db, 'favorites'), where('userId', '==', user.uid)))`
- Guardar en `Set<string>` de businessIds favoritos
- Toggle: `addFavorite` / `removeFavorite` + actualizar el Set local

```tsx
<IconButton
  size="small"
  onClick={(e) => { e.stopPropagation(); handleToggleFavorite(business.id); }}
  sx={{ color: isFav ? 'error.main' : 'action.disabled' }}
>
  {isFav ? <FavoriteIcon fontSize="small" /> : <FavoriteBorderIcon fontSize="small" />}
</IconButton>
```

---

## G4: Indicador addedBy (Baja prioridad — no bloquea merge)

### Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `src/components/menu/SharedListsView.tsx` | Mostrar "Agregado por X" en items expandidos de listas colaborativas |

### Implementación

En la sección de items expandidos (líneas 478-500), si la lista tiene `editorIds.length > 0` y el item tiene `addedBy`:

```tsx
secondary={
  <>
    {CATEGORY_LABELS[business.category]}
    {list.editorIds.length > 0 && item.addedBy && (
      <Typography component="span" variant="caption" color="text.disabled">
        {' · Agregado por '}{editorNames.get(item.addedBy) ?? 'Desconocido'}
      </Typography>
    )}
  </>
}
```

Requiere un Map de uid → displayName cargado al expandir la lista.

---

## Seguridad

- [ ] `removeEditor` Cloud Function ya valida owner-only
- [ ] `addBusinessToList` Firestore rules ya validan editor permissions
- [ ] `addedBy` se setea desde `request.auth.uid` en el cliente (no manipulable via rules — `addedBy == request.auth.uid` no está enforced en rules, pero es defense in depth desde el service)
- [ ] El query `array-contains` no expone listas privadas donde el user NO es editor (Firestore rules lo previenen)

---

## Tests

| Archivo | Tipo | Qué testear |
|---------|------|-------------|
| `EditorsDialog.tsx` | Component | Render con 0, 1, N editores; remover llama a service; loading states |
| `AddToListDialog.tsx` | Component | Muestra listas propias + de editor; badge "Colaborativa" |
| `sharedLists.ts` | Service | `removeEditor` llama a Cloud Function con databaseId |
| `inviteListEditor` CF | Update mock | Cambiar mock de `users` query a `getAuth().getUserByEmail` |

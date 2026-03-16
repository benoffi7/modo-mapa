# Specs: Listas compartidas

**Feature:** listas-compartidas
**Issue:** #142
**Fecha:** 2026-03-16

---

## Modelo de datos

### Colección `sharedLists`

```typescript
export interface SharedList {
  id: string;
  ownerId: string;
  name: string;
  description: string;
  itemCount: number;
  createdAt: Date;
  updatedAt: Date;
}
```

- Doc ID: auto-generated
- `itemCount` mantenido manualmente (increment/decrement al agregar/quitar items)
- Sin campo `sharedWith` por ahora (v1 = link público, sin lista de usuarios)

### Colección `listItems`

```typescript
export interface ListItem {
  id: string;
  listId: string;
  businessId: string;
  createdAt: Date;
}
```

- Doc ID: `{listId}__{businessId}` (compound, previene duplicados)
- No tiene `userId` — la ownership se verifica via el parent `sharedList`

---

## Firestore Rules

```
match /sharedLists/{docId} {
  allow read: if request.auth != null;
  allow create: if request.auth != null
    && request.resource.data.keys().hasOnly(['ownerId', 'name', 'description', 'itemCount', 'createdAt', 'updatedAt'])
    && request.resource.data.ownerId == request.auth.uid
    && request.resource.data.name is string
    && request.resource.data.name.size() > 0
    && request.resource.data.name.size() <= 50
    && request.resource.data.description is string
    && request.resource.data.description.size() <= 200
    && request.resource.data.itemCount == 0
    && request.resource.data.createdAt == request.time
    && request.resource.data.updatedAt == request.time;
  allow update: if request.auth != null
    && resource.data.ownerId == request.auth.uid
    && request.resource.data.ownerId == resource.data.ownerId;
  allow delete: if request.auth != null
    && resource.data.ownerId == request.auth.uid;
}

match /listItems/{docId} {
  allow read: if request.auth != null;
  allow create: if request.auth != null
    && request.resource.data.keys().hasOnly(['listId', 'businessId', 'createdAt'])
    && request.resource.data.createdAt == request.time;
  allow delete: if request.auth != null;
}
```

Nota: `listItems` read es público para cualquier autenticado (para que funcione el link compartido). Create/delete validado por el servicio (owner check client-side + rules básicas).

---

## Service layer

**Archivo nuevo:** `src/services/sharedLists.ts`

Funciones:
- `getSharedListsCollection()` — referencia con converter
- `getListItemsCollection()` — referencia con converter
- `createList(userId, name, description)` → string (listId)
- `updateList(listId, name, description)` → void
- `deleteList(listId)` → void (+ eliminar todos los listItems)
- `addBusinessToList(listId, businessId)` → void (+ increment itemCount)
- `removeBusinessFromList(listId, businessId)` → void (+ decrement itemCount)
- `fetchListItems(listId)` → ListItem[] (para vista compartida)

---

## Componentes

### 1. SharedListsView (`src/components/menu/SharedListsView.tsx`)

Sección del menú lateral. Muestra las listas del usuario.

- Lista con nombre, descripción, itemCount, fecha
- Botón "Nueva lista" que abre dialog de creación
- Click en lista → expande mostrando los comercios
- Cada comercio: click navega al mapa
- Botón compartir por lista (genera link `?list={listId}`)
- Botón eliminar lista con confirmación
- Pull-to-refresh

### 2. AddToListDialog (`src/components/business/AddToListDialog.tsx`)

Dialog que se abre desde el BusinessSheet para agregar un comercio a una lista.

- Muestra listas del usuario con checkbox
- Permite crear nueva lista inline (campo de texto + botón)
- Marca las listas que ya contienen este comercio
- Toggle: agregar/quitar de cada lista

### 3. Integración en BusinessSheet

- Nuevo botón (BookmarkIcon) junto a FavoriteButton y ShareButton
- Al tocar, abre AddToListDialog

### 4. Integración en SideMenu

- Nuevo item "Mis Listas" con BookmarkIcon
- Nueva sección lazy-loaded
- Agregar a Section type y SECTION_TITLES

### 5. Deep link para listas compartidas

- URL: `?list={listId}`
- En AppShell, detectar param `list` → abrir SharedListView con esa lista
- Mostrar comercios de la lista como markers destacados en el mapa

---

## Converters

Agregar en `src/config/converters.ts`:
- `sharedListConverter`
- `listItemConverter`

---

## Collections

Agregar en `src/config/collections.ts`:
- `SHARED_LISTS: 'sharedLists'`
- `LIST_ITEMS: 'listItems'`

---

## Scope v1

Lo que SÍ incluye:
- CRUD de listas
- Agregar/quitar comercios
- Vista en menú lateral
- Link compartido (read-only para otros usuarios)

Lo que NO incluye (futuras iteraciones):
- Drag & drop para reordenar
- Listas colaborativas (múltiples editores)
- Vista pública sin auth (requiere estar logueado)
- Copiar lista de otro usuario

---

## Decisiones

1. **itemCount manual** — no usar Cloud Function trigger para simplificar (v1)
2. **Sin sharedWith array** — v1 usa link público para cualquier autenticado
3. **listItems sin userId** — la ownership está en sharedList.ownerId
4. **Límite 10 listas por usuario** — verificar client-side
5. **Límite 50 items por lista** — verificar client-side

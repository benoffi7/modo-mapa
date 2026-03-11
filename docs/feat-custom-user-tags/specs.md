# Especificaciones Técnicas: Tags personalizados por usuario

**Issue:** #5
**Fecha:** 2026-03-11

## Modelo de datos

### Colección Firestore: `customTags`

Nueva colección separada de `userTags` (que es para votos en tags predefinidos).

```
customTags/{autoId}
{
  userId: string,       // uid del usuario
  businessId: string,   // id del comercio
  label: string,        // texto del tag (max 30 chars)
  createdAt: Timestamp
}
```

**Decisión**: Se usa `autoId` (no ID compuesto) porque un usuario puede tener múltiples tags personalizados para el mismo comercio. Cada tag es independiente.

### Interface TypeScript (ya existe en `src/types/index.ts`)

```typescript
export interface CustomTag {
  id: string;
  userId: string;
  businessId: string;
  label: string;
  createdAt: Date;
}
```

## Componentes a modificar

### 1. `src/components/business/BusinessTags.tsx`

**Cambios:**
- Agregar estado `customTags: CustomTag[]` para los tags personalizados del usuario actual.
- Agregar `loadCustomTags()` que consulta `customTags` filtrando por `userId` y `businessId`.
- Renderizar un chip "+" (solo si `user` existe) al final de los tags predefinidos.
- Renderizar los tags personalizados después de los predefinidos con estilo diferenciado (outlined, color secundario).
- Agregar estado para modal/input de creación y edición.
- Al hacer click en un tag personalizado: abrir menú con opciones "Editar" y "Eliminar".

### 2. `src/types/index.ts`

**Sin cambios** — la interface `CustomTag` ya existe.

### 3. `firestore.rules`

**Agregar regla** para la colección `customTags`:
```
match /customTags/{docId} {
  allow read: if request.auth != null
    && resource.data.userId == request.auth.uid;
  allow create: if request.auth != null
    && request.resource.data.userId == request.auth.uid
    && request.resource.data.label.size() > 0
    && request.resource.data.label.size() <= 30;
  allow update: if request.auth != null
    && resource.data.userId == request.auth.uid
    && request.resource.data.label.size() > 0
    && request.resource.data.label.size() <= 30;
  allow delete: if request.auth != null
    && resource.data.userId == request.auth.uid;
}
```

**Nota clave**: `read` solo permite leer tags propios (`resource.data.userId == request.auth.uid`), garantizando privacidad server-side.

## Interacciones con Firebase

| Acción | Operación Firestore |
|--------|-------------------|
| Cargar tags propios | `getDocs(query(collection(db, 'customTags'), where('userId', '==', uid), where('businessId', '==', businessId)))` |
| Crear tag | `addDoc(collection(db, 'customTags'), { userId, businessId, label, createdAt: serverTimestamp() })` |
| Editar tag | `updateDoc(doc(db, 'customTags', tagId), { label: newLabel })` |
| Eliminar tag | `deleteDoc(doc(db, 'customTags', tagId))` |

## UX / UI

### Chip "+"
- Chip outlined con ícono `Add`, texto "Agregar"
- Solo visible si `user !== null`
- Al hacer click: abre un `Dialog` simple con un `TextField` para escribir el label

### Tags personalizados
- Chips con `variant="outlined"`, `color="secondary"` para diferenciarlos de los predefinidos
- Ícono: `Label` (de MUI icons) para distinguirlos visualmente
- Al hacer click: abre un `Menu` (popover) con opciones "Editar" y "Eliminar"

### Dialog de creación/edición
- `Dialog` de MUI con `TextField` (max 30 chars)
- Botón "Guardar" deshabilitado si el input está vacío
- Título: "Agregar etiqueta" / "Editar etiqueta"

### Eliminación
- `Dialog` de confirmación: "¿Eliminar etiqueta '{label}'?"
- Botones: "Cancelar" / "Eliminar"

## Consideraciones de seguridad

- Las reglas de Firestore garantizan que solo el dueño puede leer/escribir sus custom tags.
- Validación de largo (1-30 chars) tanto en client como en Firestore rules.
- `label` se sanitiza con `.trim()` antes de guardar.
- No se permite HTML en el label (Chip de MUI escapa texto por defecto).

# Especificaciones Técnicas: Menú lateral con sección Favoritos

**Issue:** #7
**Fecha:** 2026-03-11

## Componentes a crear

### 1. `src/components/layout/SideMenu.tsx`

Drawer lateral que contiene la navegación del menú y el contenido de cada sección.

**Props:**

```typescript
interface Props {
  open: boolean;
  onClose: () => void;
}
```

**Estado interno:**

- `activeSection: 'nav' | 'favorites'` — controla qué vista se muestra dentro del drawer

**Estructura:**

- MUI `Drawer` con `anchor="left"`
- `Box` con `width: min(300px, 80vw)`
- **Vista 'nav'**: header de usuario + lista de navegación
- **Vista 'favorites'**: header con botón atrás + FavoritesList

**Header de usuario (vista nav):**

- `Avatar` con inicial del displayName, bgcolor `#1a73e8`
- `Typography` con displayName o "Anónimo"
- `IconButton` con `EditIcon` → llama a un callback para abrir NameDialog

**Nota sobre NameDialog:** El NameDialog actual solo se abre si `displayName === null`. Para reutilizarlo desde el menú, se necesita un mecanismo para forzar su apertura. Opción: agregar estado `forceNameDialog` en AuthContext, o crear un dialog inline en SideMenu. **Decisión: dialog inline simple** en SideMenu para editar nombre (reutiliza `setDisplayName` de AuthContext), ya que es más simple y no modifica el flujo existente del NameDialog.

**Lista de navegación:**

```text
ListItemButton → Favoritos (FavoriteIcon)
ListItemButton → Comentarios (ChatBubbleOutlineIcon) — disabled, secondary text "Próximamente"
ListItemButton → Feedback (FeedbackOutlinedIcon) — disabled, secondary text "Próximamente"
```

### 2. `src/components/menu/FavoritesList.tsx`

Lista de comercios favoritos del usuario.

**Props:** ninguna (usa hooks internos)

**Lógica:**

- Usa `useAuth()` para obtener `user.uid`
- Query Firestore: `getDocs(query(collection(db, 'favorites'), where('userId', '==', user.uid)))`
- Importa `allBusinesses` desde `useBusinesses.ts` (exportar como constante separada o importar JSON directo)
- Cruza `businessId` de cada favorito con `allBusinesses` para obtener el objeto Business completo
- Ordena por `createdAt` descendente

**Nota sobre useBusinesses:** Actualmente `allBusinesses` se exporta desde el hook `useBusinesses()`. Para usarlo en FavoritesList sin depender de MapContext (que agrega filtros), se importará directamente el JSON:

```typescript
import businessesData from '../../data/businesses.json';
import type { Business } from '../../types';
const allBusinesses: Business[] = businessesData as Business[];
```

**Render:**

- `List` de MUI con items:
  - `ListItemText` primary: nombre del comercio
  - `ListItemText` secondary: dirección
  - `Chip` de categoría (usando `CATEGORY_LABELS`)
  - `IconButton` con `FavoriteIcon` rojo → `deleteDoc` + remove del estado local
- Click en item → `setSelectedBusiness(business)` via MapContext + `onClose()` del drawer
- Estado vacío: `Box` centrado con `FavoriteBorderIcon` grande + texto

## Componentes a modificar

### 3. `src/components/search/SearchBar.tsx`

**Cambio:** Agregar prop `onMenuClick` y conectar al IconButton del MenuIcon.

```typescript
interface Props {
  onMenuClick: () => void;
}
```

Línea 33: agregar `onClick={onMenuClick}` al IconButton.

### 4. `src/components/layout/AppShell.tsx`

**Cambio:** Agregar estado `menuOpen`, pasar `onMenuClick` a SearchBar, renderizar SideMenu.

```typescript
const [menuOpen, setMenuOpen] = useState(false);
```

## Interacciones con Firebase

| Acción | Operación |
|--------|-----------|
| Cargar favoritos | `getDocs(query(collection(db, 'favorites'), where('userId', '==', uid)))` |
| Quitar favorito | ``deleteDoc(doc(db, 'favorites', `${uid}__${businessId}`))`` |

No se crean colecciones nuevas. No se modifican Firestore rules.

## Consideraciones de seguridad

- Las reglas de `favorites` ya permiten `read` y `delete` con `request.auth != null` y validación de `userId`.
- No se expone data de otros usuarios.

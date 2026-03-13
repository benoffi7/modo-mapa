# Specs: Politica de privacidad

## Archivos a crear

### `src/components/menu/PrivacyPolicy.tsx`

Componente estatico con el contenido de la politica de privacidad. Secciones con Typography de MUI, scroll natural dentro del drawer.

Secciones:

1. **Informacion general** — descripcion de la app
2. **Datos que recopilamos** — auth anonimo, contenido generado, analytics
3. **Almacenamiento** — Firestore, Storage, localStorage
4. **Seguridad** — App Check, rules, rate limiting, moderacion
5. **Tus derechos** — desactivar analytics, eliminar contenido, perfil privado
6. **Contacto** — link a seccion Feedback con categorias de datos

```tsx
import { Box, Typography, Divider } from '@mui/material';

export default function PrivacyPolicy() {
  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
        Ultima actualizacion: marzo 2026
      </Typography>
      {/* Sections... */}
    </Box>
  );
}
```

## Archivos a modificar

### `src/types/index.ts`

Agregar nuevas categorias de feedback:

```typescript
export type FeedbackCategory = 'bug' | 'sugerencia' | 'datos_usuario' | 'datos_comercio' | 'otro';
```

### `firestore.rules`

Actualizar whitelist de categorias de feedback:

```text
&& request.resource.data.category in ['bug', 'sugerencia', 'datos_usuario', 'datos_comercio', 'otro']
```

### `src/services/feedback.ts`

Actualizar `VALID_CATEGORIES`:

```typescript
const VALID_CATEGORIES: FeedbackCategory[] = ['bug', 'sugerencia', 'datos_usuario', 'datos_comercio', 'otro'];
```

### `src/components/menu/FeedbackForm.tsx`

Actualizar array de categorias y labels:

```typescript
const CATEGORIES: { value: FeedbackCategory; label: string }[] = [
  { value: 'bug', label: 'Bug' },
  { value: 'sugerencia', label: 'Sugerencia' },
  { value: 'datos_usuario', label: 'Datos de usuario' },
  { value: 'datos_comercio', label: 'Datos de comercio' },
  { value: 'otro', label: 'Otro' },
];
```

Usar `flexWrap: 'wrap'` en el container de chips para que entren en mobile.

### `src/components/admin/FeedbackList.tsx`

Actualizar `categoryColor` para las nuevas categorias:

```typescript
function categoryColor(cat: FeedbackCategory): 'error' | 'primary' | 'info' | 'warning' | 'default' {
  if (cat === 'bug') return 'error';
  if (cat === 'sugerencia') return 'primary';
  if (cat === 'datos_usuario') return 'info';
  if (cat === 'datos_comercio') return 'warning';
  return 'default';
}
```

### `src/components/layout/SideMenu.tsx`

1. Agregar `'privacy'` al tipo `Section`
2. Agregar titulo en `SECTION_TITLES`: `privacy: 'Politica de privacidad'`
3. Importar `PrivacyPolicy` y renderizar en section content
4. Agregar link en footer (entre version y dark mode toggle):

```tsx
import PrivacyTipOutlinedIcon from '@mui/icons-material/PrivacyTipOutlined';
import PrivacyPolicy from '../menu/PrivacyPolicy';
```

Link en footer como Typography clickeable con icono:

```tsx
<Typography
  variant="caption"
  color="text.secondary"
  onClick={() => setActiveSection('privacy')}
  sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5, py: 1, cursor: 'pointer' }}
>
  <PrivacyTipOutlinedIcon sx={{ fontSize: 14 }} />
  Politica de privacidad
</Typography>
```

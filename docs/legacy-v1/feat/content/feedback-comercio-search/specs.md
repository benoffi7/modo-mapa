# Specs: Feedback de comercio — busqueda y PDF

**PRD:** [Feedback de comercio — busqueda y PDF](./prd.md)
**Issue:** #149
**Estado:** Borrador

---

## S1: Search bar de comercio en FeedbackForm

**Componente:** `FeedbackSender` (dentro de `FeedbackForm.tsx`)

### Estado nuevo

```typescript
const [selectedBusiness, setSelectedBusiness] = useState<{ id: string; name: string } | null>(null);
const [businessQuery, setBusinessQuery] = useState('');
```

### Logica de busqueda

Reutilizar `allBusinesses` exportado desde `src/hooks/useBusinesses.ts` (array estatico importado de `businesses.json`). Filtrado local en el cliente, sin queries a Firestore:

```typescript
import { allBusinesses } from '../../hooks/useBusinesses';

const suggestions = useMemo(() => {
  const q = businessQuery.toLowerCase().trim();
  if (!q || q.length < 2) return [];
  return allBusinesses
    .filter((b) => b.name.toLowerCase().includes(q) || b.address.toLowerCase().includes(q))
    .slice(0, 5);
}, [businessQuery]);
```

- Minimo 2 caracteres para mostrar sugerencias.
- Maximo 5 resultados visibles.
- No requiere debounce: el dataset es local (~100 items), filtro con `useMemo` es suficiente.

### UI

El search bar se renderiza **solo cuando `category === 'datos_comercio'`**, entre los chips de categoria y el `TextField` del mensaje.

**Sin comercio seleccionado:** `Autocomplete` de MUI con:
- `freeSolo={false}`
- `options={suggestions}`
- `getOptionLabel={(b) => b.name}`
- `renderOption` mostrando nombre + direccion truncada
- `inputValue={businessQuery}` / `onInputChange` para controlar el texto
- `onChange` para setear `selectedBusiness`
- Placeholder: "Buscar comercio (opcional)"
- `size="small"`

**Con comercio seleccionado:** Reemplazar el Autocomplete por un `Chip` con:
- `label={selectedBusiness.name}`
- `onDelete={() => setSelectedBusiness(null)}`
- `color="primary"` / `size="small"`

### Envio

Modificar la llamada a `sendFeedback` para pasar los campos opcionales:

```typescript
await sendFeedback(
  user.uid,
  message.trim(),
  category,
  mediaFile ?? undefined,
  selectedBusiness ?? undefined,
);
```

Resetear `selectedBusiness` y `businessQuery` junto con el resto del estado tras envio exitoso.

---

## S2: Soporte PDF en adjuntos

### Constantes y tipos de archivo permitidos

**Archivo:** `src/components/menu/FeedbackForm.tsx`

Cambiar la constante local:

```typescript
// Antes
const ALLOWED_ACCEPT = 'image/jpeg,image/png,image/webp';

// Despues
const ALLOWED_ACCEPT = 'image/jpeg,image/png,image/webp,application/pdf';
```

**Archivo:** `src/services/feedback.ts`

Ampliar la constante de validacion del servicio:

```typescript
// Antes
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

// Despues
const ALLOWED_MEDIA_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
```

Actualizar la validacion en `sendFeedback`:

```typescript
if (mediaFile) {
  if (!ALLOWED_MEDIA_TYPES.includes(mediaFile.type)) {
    throw new Error('Formato no soportado. Usa JPG, PNG, WebP o PDF.');
  }
  // ...
}
```

### Determinar mediaType

Al subir el archivo, setear `mediaType` segun el tipo:

```typescript
const mediaType = mediaFile.type === 'application/pdf' ? 'pdf' : 'image';
await updateDoc(docRef, { mediaUrl, mediaType });
```

### Preview en FeedbackForm

En `FeedbackSender`, diferenciar el preview segun tipo de archivo:

```typescript
{mediaFile && mediaFile.type === 'application/pdf' ? (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, position: 'relative' }}>
    <PictureAsPdfIcon color="error" />
    <Typography variant="body2" noWrap sx={{ maxWidth: 200 }}>
      {mediaFile.name}
    </Typography>
    <IconButton size="small" onClick={clearMedia}>
      <CloseIcon fontSize="small" />
    </IconButton>
  </Box>
) : mediaPreview ? (
  // preview de imagen existente (sin cambios)
) : (
  // boton "Adjuntar archivo" (cambiar label de "Adjuntar imagen" a "Adjuntar archivo")
)}
```

Cambiar el label del boton de adjuntar: `"Adjuntar imagen"` -> `"Adjuntar archivo"`.

### Preview en MyFeedbackList

En el detalle expandido, diferenciar imagen vs PDF:

```typescript
{fb.mediaUrl && fb.mediaType === 'pdf' ? (
  <Link href={fb.mediaUrl} target="_blank" rel="noopener" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
    <PictureAsPdfIcon color="error" fontSize="small" />
    <Typography variant="body2">Ver PDF adjunto</Typography>
  </Link>
) : fb.mediaUrl ? (
  // imagen existente (sin cambios)
) : null}
```

### Preview en FeedbackList (admin)

En la columna "Mensaje", diferenciar imagen vs PDF:

```typescript
{f.mediaUrl && f.mediaType === 'pdf' ? (
  <Link href={f.mediaUrl} target="_blank" rel="noopener" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
    <PictureAsPdfIcon color="error" fontSize="small" />
    <Typography variant="caption">PDF adjunto</Typography>
  </Link>
) : f.mediaUrl ? (
  // imagen clickeable existente (sin cambios)
) : null}
```

---

## S3: Cambios en tipos

**Archivo:** `src/types/index.ts`

### Feedback interface

Agregar campos opcionales y extender `mediaType`:

```typescript
export interface Feedback {
  id: string;
  userId: string;
  message: string;
  category: FeedbackCategory;
  status: FeedbackStatus;
  createdAt: Date;
  flagged?: boolean;
  adminResponse?: string;
  respondedAt?: Date;
  respondedBy?: string;
  viewedByUser?: boolean;
  mediaUrl?: string;
  mediaType?: 'image' | 'video' | 'pdf';  // agregar 'pdf'
  githubIssueUrl?: string;
  businessId?: string;      // nuevo
  businessName?: string;    // nuevo
}
```

Cambios:
- `mediaType`: agregar `'pdf'` al union type.
- `businessId`: string opcional, formato `biz_NNN`.
- `businessName`: string opcional, nombre desnormalizado para mostrar sin lookup.

---

## S4: Cambios en servicio feedback

**Archivo:** `src/services/feedback.ts`

### Firma de sendFeedback

```typescript
export async function sendFeedback(
  userId: string,
  message: string,
  category: FeedbackCategory,
  mediaFile?: File,
  business?: { id: string; name: string },
): Promise<void> {
```

### Documento Firestore

Incluir `businessId` y `businessName` condicionalmente al crear el doc:

```typescript
const docData: Record<string, unknown> = {
  userId,
  message: trimmed,
  category,
  createdAt: serverTimestamp(),
};
if (business) {
  docData.businessId = business.id;
  docData.businessName = business.name;
}
const docRef = await addDoc(collection(db, COLLECTIONS.FEEDBACK), docData);
```

### mediaType en updateDoc

```typescript
if (mediaFile) {
  // ... upload ...
  const mediaType = mediaFile.type === 'application/pdf' ? 'pdf' : 'image';
  await updateDoc(docRef, { mediaUrl, mediaType });
}
```

---

## S5: Admin FeedbackList — comercio vinculado

**Archivo:** `src/components/admin/FeedbackList.tsx`

### Chip de comercio en tabla

Agregar una columna nueva "Comercio" despues de "Categoria":

```typescript
{
  label: 'Comercio',
  render: (f) => f.businessName ? (
    <Chip
      label={f.businessName}
      size="small"
      color="warning"
      variant="outlined"
      onClick={() => handleOpenBusiness(f.businessId!)}
      clickable
    />
  ) : (
    <Typography variant="caption" color="text.disabled">—</Typography>
  ),
},
```

### Abrir BusinessSheet

Importar `useFilters` del `MapContext` y usar `onSelectBusiness` para abrir el sheet:

```typescript
import { useFilters } from '../../context/MapContext';

// Dentro del componente:
const { onSelectBusiness } = useFilters();

const handleOpenBusiness = (businessId: string) => {
  onSelectBusiness(businessId);
};
```

Si `onSelectBusiness` no esta disponible en el contexto admin (porque `AdminLayout` no esta dentro del `MapProvider`), usar alternativa: navegar al mapa con query param `?business={businessId}`. Evaluar en implementacion cual es viable.

### Filtro por comercio (prioridad baja)

Agregar un filtro simple: `Autocomplete` arriba de la tabla con `allBusinesses` como options. Estado `businessFilter: string | null`. Filtrar `filtered` adicionalmente:

```typescript
const filtered = feedback?.filter((f) => {
  if (statusFilter !== 'all' && f.status !== statusFilter) return false;
  if (businessFilter && f.businessId !== businessFilter) return false;
  return true;
}) ?? [];
```

---

## S6: Firestore Rules

**Archivo:** `firestore.rules`

### Create rule

Agregar `businessId` y `businessName` como campos opcionales en el `hasOnly`:

```
// Antes
&& request.resource.data.keys().hasOnly(['userId', 'message', 'category', 'createdAt', 'rating', 'mediaUrl', 'mediaType'])

// Despues
&& request.resource.data.keys().hasOnly(['userId', 'message', 'category', 'createdAt', 'rating', 'mediaUrl', 'mediaType', 'businessId', 'businessName'])
```

Agregar validacion de tipos para los campos opcionales:

```
&& (!('businessId' in request.resource.data) || (request.resource.data.businessId is string && request.resource.data.businessId.matches('^biz_[0-9]{3}$')))
&& (!('businessName' in request.resource.data) || (request.resource.data.businessName is string && request.resource.data.businessName.size() > 0 && request.resource.data.businessName.size() <= 100))
```

### Update rule (mediaUrl/mediaType)

Sin cambios. La regla existente ya permite updates de `mediaUrl` y `mediaType` por el owner. El valor `'pdf'` de `mediaType` es un string valido, no necesita validacion adicional en rules.

---

## Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `src/types/index.ts` | Agregar `businessId?`, `businessName?` a `Feedback`; agregar `'pdf'` a `mediaType` |
| `src/services/feedback.ts` | Ampliar tipos aceptados, pasar business a doc, setear `mediaType` correcto |
| `src/components/menu/FeedbackForm.tsx` | Search bar condicional, PDF accept+preview, cambiar label boton |
| `src/components/menu/MyFeedbackList.tsx` | Preview diferenciado imagen vs PDF link |
| `src/components/admin/FeedbackList.tsx` | Columna comercio con chip, preview PDF, filtro por comercio |
| `firestore.rules` | Agregar `businessId`/`businessName` al `hasOnly` + validacion |

**Archivos nuevos:** Ninguno. Todo se resuelve modificando archivos existentes.

---

## Dependencias nuevas

**Imports MUI adicionales:**
- `Autocomplete` (para search bar en FeedbackForm)
- `@mui/icons-material/PictureAsPdf` (para preview de PDF)
- `Link` de MUI (en MyFeedbackList, ya importado en FeedbackList)

No se agregan dependencias npm nuevas.

---

## Tests

No se agregan tests nuevos. La logica de busqueda es un `useMemo` trivial sobre datos locales. La validacion de tipos de archivo se cubre por la validacion existente en `sendFeedback`. Si se extraen helpers (ej: `filterBusinesses`), se testean por separado.

---

## Impacto en performance

- Search bar: `useMemo` sobre ~100 businesses estaticos, filtro por string -> negligible.
- PDF upload: mismo flujo que imagen, sin cambio en performance.
- Columna comercio en admin: un campo adicional por fila -> negligible.
- Filtro por comercio en admin: se agrega al `.filter()` existente -> negligible.

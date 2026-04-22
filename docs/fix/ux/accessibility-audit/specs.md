# Specs: UI/Accessibility Audit — Issues #266-#269

**Issues:** #266 Touch targets, #267 Missing aria-labels, #268 Typography as buttons, #269 Missing error states
**Fecha:** 2026-03-31

---

## Alcance

Fix puro de UI/accesibilidad. Sin cambios en modelo de datos, Firestore, servicios ni hooks.
Cuatro categorias de defectos, todos corregibles con cambios locales en los componentes afectados.

---

## Cambios por componente

### Issue #266: Touch targets menores a 44px

El patron `p: 0.25` en `IconButton size="small"` produce un area de toque de ~28px. La correccion es `minWidth: 44, minHeight: 44` o equivalente `p: 1.25` con icono de 20px.

| Archivo | Linea | Problema actual | Correccion |
|---------|-------|----------------|-----------|
| `src/components/onboarding/VerificationNudge.tsx` | 99 | `IconButton size="small" sx={{ p: 0.25 }}` (CloseIcon 16px) | Remover `p: 0.25`, agregar `sx={{ minWidth: 44, minHeight: 44 }}` |
| `src/components/business/BusinessRating.tsx` | 49 | `IconButton size="small" sx={{ p: 0.25 }}` (CloseIcon 16px) | Remover `p: 0.25`, agregar `sx={{ minWidth: 44, minHeight: 44 }}` |
| `src/components/profile/OnboardingChecklist.tsx` | 139 | `IconButton size="small" sx={{ p: 0.25 }}` (ExpandMoreIcon) | Remover `p: 0.25`, agregar `sx={{ minWidth: 44, minHeight: 44 }}` |
| `src/components/profile/OnboardingChecklist.tsx` | 146 | `IconButton size="small" sx={{ p: 0.25 }}` (CloseIcon 16px) | Remover `p: 0.25`, agregar `sx={{ minWidth: 44, minHeight: 44 }}` |
| `src/components/social/UserScoreCard.tsx` | 170 | `IconButton size="small" sx={{ p: 0.25 }}` (ExpandMoreIcon) | Remover `p: 0.25`, agregar `sx={{ minWidth: 44, minHeight: 44 }}` |
| `src/components/business/InlineReplyForm.tsx` | 80-81 | `IconButton` con `width: 32, height: 32` (SendIcon 14px) | Cambiar a `width: 44, height: 44`, `SendIcon sx={{ fontSize: 20 }}` |
| `src/components/business/InlineReplyForm.tsx` | 92 | `IconButton` con `width: 32, height: 32` (CloseIcon 16px) | Cambiar a `width: 44, height: 44`, `CloseIcon sx={{ fontSize: 20 }}` |
| `src/components/business/BusinessQuestions.tsx` | 327-328 | `IconButton` con `width: 32, height: 32` (SendIcon 14px) | Cambiar a `width: 44, height: 44`, `SendIcon sx={{ fontSize: 20 }}` |
| `src/components/business/BusinessQuestions.tsx` | 339 | `IconButton` con `width: 32, height: 32` (CloseIcon 16px) | Cambiar a `width: 44, height: 44`, `CloseIcon sx={{ fontSize: 20 }}` |
| `src/components/profile/InterestsSection.tsx` | 27 | `IconButton size="small" sx={{ ml: -0.5, p: 0.25 }}` (CloseIcon) | Reemplazar `p: 0.25` con `minWidth: 44, minHeight: 44` |
| `src/components/business/BusinessTags.tsx` | 201 | `IconButton size="small" sx={{ ml: -0.5, p: 0.25 }}` (BookmarkIcon) | Reemplazar `p: 0.25` con `minWidth: 44, minHeight: 44` |
| `src/components/home/TrendingNearYouSection.tsx` | 100-105 | `Chip label="x" sx={{ minWidth: 24, height: 20 }}` usado como boton de dismiss | Reemplazar con `IconButton` que tenga `aria-label` y `minWidth: 44, minHeight: 44` |

**Nota sobre InlineReplyForm y BusinessQuestions:** Los botones Send y Cancel son gemelos identicos — `InlineReplyForm` es el componente extraido, pero `BusinessQuestions` tiene una copia inline del mismo patron. Ambos deben corregirse.

---

### Issue #267: Falta aria-label en IconButtons

| Archivo | Linea | Elemento | aria-label a agregar |
|---------|-------|----------|---------------------|
| `src/components/lists/ListDetailScreen.tsx` | 147 | `IconButton` back (ArrowBackIcon) | `"Volver a listas"` |
| `src/components/lists/ListDetailScreen.tsx` | 153 | `IconButton` icon picker (InsertEmoticonIcon) | `"Cambiar icono de lista"` |
| `src/components/lists/ListDetailScreen.tsx` | 158 | `IconButton` color picker (PaletteIcon) | `"Cambiar color de lista"` |
| `src/components/lists/ListDetailScreen.tsx` | 161 | `IconButton` toggle public (PublicIcon/LockIcon) | `isPublic ? "Hacer lista privada" : "Hacer lista publica"` (dinamico) |
| `src/components/lists/ListDetailScreen.tsx` | 165 | `IconButton` share (ShareIcon) | `"Compartir lista"` |
| `src/components/lists/ListDetailScreen.tsx` | 168 | `IconButton` editors (GroupIcon) | `"Ver editores"` |
| `src/components/lists/ListDetailScreen.tsx` | 172 | `IconButton` invite (PersonAddIcon) | `"Invitar editor"` |
| `src/components/lists/ListDetailScreen.tsx` | 175 | `IconButton` delete (DeleteOutlineIcon) | `"Eliminar lista"` |
| `src/components/onboarding/ActivityReminder.tsx` | 35 | `IconButton` dismiss (CloseIcon) | `"Cerrar recordatorio"` |
| `src/components/onboarding/AccountBanner.tsx` | 77 | `IconButton` dismiss (CloseIcon) | `"Cerrar aviso"` |
| `src/components/home/QuickActions.tsx` | 153 | `IconButton` edit actions (EditIcon) | `"Editar acciones rapidas"` |
| `src/components/home/QuickActions.tsx` | 176 | `IconButton` close dialog (CloseIcon) | `"Cerrar dialogo de edicion"` |
| `src/components/profile/ProfileScreen.tsx` | 72 | `IconButton` back in section (ArrowBackIcon) | `"Volver al perfil"` |
| `src/components/profile/ProfileScreen.tsx` | 121 | `IconButton` edit name (EditIcon) | `"Editar nombre"` |
| `src/components/lists/ListsScreen.tsx` | 44 | `IconButton` create list (AddIcon) | `"Crear nueva lista"` |
| `src/components/search/SearchScreen.tsx` | 49 | `IconButton` dismiss (CloseIcon) | `"Cerrar aviso"` |

**Nota:** `ListDetailScreen` tiene 8 `IconButton` en la toolbar sin `aria-label`. El `IconButton` back de `ProfileScreen` linea 72 esta dentro del `activeSection` conditional render — se agrega `aria-label` en ese bloque.

---

### Issue #268: Typography con onClick — reemplazar con Button o Link

| Archivo | Linea | Problema | Reemplazo |
|---------|-------|---------|----------|
| `src/components/home/RecentSearches.tsx` | 21-26 | `<Typography variant="caption" onClick={clearHistory} sx={{ cursor: 'pointer' }}>Borrar</Typography>` | `<Button variant="text" size="small" onClick={clearHistory} sx={{ minWidth: 0, p: 0, color: 'text.disabled', '&:hover': { color: 'text.secondary', bgcolor: 'transparent' } }}>Borrar</Button>` |
| `src/components/home/ActivityDigestSection.tsx` | 112-119 | `<Typography variant="caption" color="primary" sx={{ cursor: 'pointer' }} onClick={...}>Ver todas</Typography>` | `<Button variant="text" size="small" onClick={...} sx={{ minWidth: 0, p: 0 }}>Ver todas</Button>` |
| `src/components/home/TrendingNearYouSection.tsx` | 92-98 | `<Typography variant="caption" color="primary.main" sx={{ cursor: 'pointer' }} onClick={handleConfigureTap}>Configurá tu localidad...</Typography>` | `<Button variant="text" size="small" onClick={handleConfigureTap} sx={{ minWidth: 0, p: 0, textAlign: 'left', textTransform: 'none', fontSize: 'inherit' }}>Configurá tu localidad para resultados más precisos</Button>` |

**Criterios del reemplazo:** Mantener apariencia visual identica al original, solo cambiar la semantica del elemento. `Button variant="text"` hereda el color correcto sin estilo extra visible. `sx={{ minWidth: 0, p: 0 }}` evita que el Button agregue padding indeseado en estos contextos de texto inline.

---

### Issue #269: Error states faltantes

#### BusinessSheet — skeleton infinito cuando useBusinessData falla

`useBusinessData` ya expone `error: boolean`. La condicion actual en `BusinessSheet` es:

```tsx
const showSkeleton = data.isLoading;
```

Cuando `isLoading` termina pero `error` es `true`, el componente renderiza el contenido vacio (sin datos), no un error. La correccion es detectar `data.error` y mostrar un estado de error con retry.

**Cambio en `BusinessSheet.tsx`:**

```tsx
// Antes:
const showSkeleton = data.isLoading;

// Despues:
const showSkeleton = data.isLoading;
const showError = !data.isLoading && data.error;
```

En el JSX, reemplazar el ternario actual:

```tsx
// Antes:
{showSkeleton ? (
  <BusinessSheetSkeleton />
) : (
  <Box sx={{ pb: 'calc(24px + env(safe-area-inset-bottom))', ... }}>
    ...
  </Box>
)}

// Despues:
{showSkeleton ? (
  <BusinessSheetSkeleton />
) : showError ? (
  <BusinessSheetError onRetry={() => data.refetch()} />
) : (
  <Box sx={{ pb: 'calc(24px + env(safe-area-inset-bottom))', ... }}>
    ...
  </Box>
)}
```

**Nuevo componente `BusinessSheetError`** (puede ser un componente local dentro de `BusinessSheet.tsx` o un archivo separado en `src/components/business/`):

```tsx
function BusinessSheetError({ onRetry }: { onRetry: () => void }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 6, px: 3, gap: 2 }}>
      <ErrorOutlineIcon sx={{ fontSize: 48, color: 'text.secondary' }} />
      <Typography variant="body2" color="text.secondary" textAlign="center">
        No se pudo cargar la informacion del comercio.
      </Typography>
      <Button variant="outlined" size="small" onClick={onRetry} startIcon={<RefreshIcon />}>
        Reintentar
      </Button>
    </Box>
  );
}
```

#### MapView — sin timeout si Google Maps no carga

`MapView` usa el evento `onTilesLoaded` para setear `mapReady = true`. Si la API de Google Maps falla o tarda mas de 10 segundos, `MapSkeleton` permanece visible indefinidamente.

**Cambio en `MapView.tsx`:**

Agregar un timeout de 10 segundos. Si `mapReady` sigue en `false` a los 10s, mostrar un error con retry (que recarga la pagina, unico mecanismo disponible sin reinicializar el Map provider).

```tsx
const [mapError, setMapError] = useState(false);

useEffect(() => {
  if (mapReady) return;
  const timer = setTimeout(() => {
    if (!mapReady) setMapError(true);
  }, 10_000);
  return () => clearTimeout(timer);
}, [mapReady]);
```

En el JSX:

```tsx
// Antes:
{!mapReady && <MapSkeleton />}

// Despues:
{!mapReady && !mapError && <MapSkeleton />}
{mapError && <MapLoadError />}
```

**Nuevo componente `MapLoadError`** (local en `MapView.tsx` o archivo separado en `src/components/map/`):

```tsx
function MapLoadError() {
  return (
    <Box
      sx={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        bgcolor: 'background.default', gap: 2, px: 3,
      }}
    >
      <MapIcon sx={{ fontSize: 56, color: 'text.secondary' }} />
      <Typography variant="body1" color="text.secondary" textAlign="center">
        No se pudo cargar el mapa.
      </Typography>
      <Button variant="outlined" onClick={() => window.location.reload()} startIcon={<RefreshIcon />}>
        Reintentar
      </Button>
    </Box>
  );
}
```

---

## Textos de usuario

| Texto | Donde se usa | Notas |
|-------|-------------|-------|
| `"Volver a listas"` | aria-label ListDetailScreen back button | |
| `"Cambiar icono de lista"` | aria-label ListDetailScreen icon picker | |
| `"Cambiar color de lista"` | aria-label ListDetailScreen color picker | |
| `"Hacer lista privada"` | aria-label ListDetailScreen toggle (dinamico) | tilde en privada |
| `"Hacer lista publica"` | aria-label ListDetailScreen toggle (dinamico) | sin tilde (adjetivo sin acento obligatorio) |
| `"Compartir lista"` | aria-label ListDetailScreen share | |
| `"Ver editores"` | aria-label ListDetailScreen editors | |
| `"Invitar editor"` | aria-label ListDetailScreen invite | |
| `"Eliminar lista"` | aria-label ListDetailScreen delete | |
| `"Cerrar recordatorio"` | aria-label ActivityReminder close | |
| `"Cerrar aviso"` | aria-label AccountBanner + SearchScreen close | |
| `"Editar acciones rapidas"` | aria-label QuickActions edit | |
| `"Cerrar dialogo de edicion"` | aria-label QuickActions dialog close | tilde en diálogo |
| `"Volver al perfil"` | aria-label ProfileScreen back | |
| `"Editar nombre"` | aria-label ProfileScreen edit name | |
| `"Crear nueva lista"` | aria-label ListsScreen add | |
| `"No se pudo cargar la informacion del comercio."` | BusinessSheetError body | tilde en información |
| `"Reintentar"` | BusinessSheetError + MapLoadError button | |
| `"No se pudo cargar el mapa."` | MapLoadError body | |

---

## Estimacion de tamano de archivos resultantes

| Archivo | Lineas actuales (aprox) | Lineas estimadas post-fix | Riesgo |
|---------|------------------------|--------------------------|--------|
| `BusinessSheet.tsx` | ~280 | ~300 (+componente local ~20 lineas) | Sin riesgo |
| `MapView.tsx` | ~115 | ~145 (+componente local ~25 lineas) | Sin riesgo |
| `BusinessRating.tsx` | ~57 | ~57 | Sin riesgo |
| `InlineReplyForm.tsx` | ~100 | ~100 | Sin riesgo |
| `BusinessQuestions.tsx` | ~380 | ~380 | Sin riesgo |
| `ListDetailScreen.tsx` | ~350 | ~355 | Sin riesgo |
| `OnboardingChecklist.tsx` | ~175 | ~175 | Sin riesgo |
| `UserScoreCard.tsx` | ~252 | ~252 | Sin riesgo |
| `InterestsSection.tsx` | ~56 | ~56 | Sin riesgo |
| `BusinessTags.tsx` | ~230 | ~230 | Sin riesgo |
| `TrendingNearYouSection.tsx` | ~130 | ~133 | Sin riesgo |
| `RecentSearches.tsx` | ~48 | ~48 | Sin riesgo |
| `ActivityDigestSection.tsx` | ~130 | ~130 | Sin riesgo |
| `VerificationNudge.tsx` | ~117 | ~117 | Sin riesgo |
| `ActivityReminder.tsx` | ~45 | ~45 | Sin riesgo |
| `AccountBanner.tsx` | ~87 | ~87 | Sin riesgo |
| `QuickActions.tsx` | ~200 | ~200 | Sin riesgo |
| `ProfileScreen.tsx` | ~250 | ~250 | Sin riesgo |
| `ListsScreen.tsx` | ~90 | ~90 | Sin riesgo |
| `SearchScreen.tsx` | ~60 | ~60 | Sin riesgo |

Ningun archivo resultante supera 400 lineas.

---

## Tests

| Archivo test | Que testear | Tipo |
|-------------|-------------|------|
| `src/__tests__/components/business/BusinessSheet.error.test.tsx` | Renderiza `BusinessSheetError` cuando `useBusinessData` devuelve `error: true`. El boton "Reintentar" llama a `data.refetch`. No renderiza skeleton cuando `isLoading: false` y `error: true`. | Unit / render |
| `src/__tests__/components/map/MapView.timeout.test.tsx` | Avanza `jest.useFakeTimers` 10 segundos sin que `onTilesLoaded` dispare → renderiza error. Si `onTilesLoaded` dispara antes de 10s → no renderiza error. | Unit / render |

Los demas cambios (#266, #267, #268) son puramente atributivos — no requieren tests propios. La cobertura existente de los componentes los cubrira al hacer snapshot o render tests.

---

## Decisiones tecnicas

**#269 BusinessSheetError como componente local vs archivo separado:** Se implementa como funcion local dentro de `BusinessSheet.tsx` (no exportada) para mantener la convencion de colocation cuando el componente es pequeño (~20 lineas) y solo tiene un consumidor. Si en el futuro se reutiliza, se extrae.

**#269 MapLoadError como componente local:** Mismo criterio. `window.location.reload()` es el unico mecanismo de retry disponible sin reinicializar `@vis.gl/react-google-maps` `APIProvider`, que vive por encima de `MapView` en el arbol.

**#268 Button en lugar de Link component="button":** `Button variant="text"` es preferible a `<Link component="button">` porque los tres casos son acciones (no navegacion), y Button con `sx={{ p: 0, minWidth: 0 }}` produce el mismo aspecto visual sin agregar semantica de enlace incorrecta.

**#266 Mantener `ml: -0.5` en InterestsSection y BusinessTags:** Los IconButton de follow/unfollow tag estan visualmente adjuntos al Chip. La correccion de touch target (44px) se aplica sin eliminar el margen negativo, usando `minWidth: 44` que expande el area clickeable sin cambiar la posicion visual del icono.

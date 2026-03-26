# Specs: Skeleton Loaders — Mapa y BusinessSheet

**PRD:** [skeleton-loaders](./prd.md)
**Issue:** #143
**Estado:** Pendiente de aprobacion

---

## S1: BusinessSheetSkeleton

**Componente nuevo:** `BusinessSheetSkeleton` en `src/components/business/BusinessSheetSkeleton.tsx`

Skeleton que replica el layout exacto del BusinessSheet (header + secciones con Divider). Se muestra cuando `isLoading === true` y no hay datos cacheados.

**Estructura del skeleton:**

| Zona | Skeleton MUI | Dimensiones |
|------|-------------|-------------|
| Drag handle | Box estático (ya existe, no es skeleton) | 40x4 |
| Nombre (h6) | `<Skeleton variant="text" width="70%" height={28} />` | — |
| Chip categoría | `<Skeleton variant="rounded" width={80} height={24} />` | — |
| Dirección | `<Skeleton variant="text" width="85%" height={20} />` | — |
| Botón Cómo llegar | `<Skeleton variant="rounded" width={120} height={36} />` | — |
| Divider | `<Divider />` real | — |
| Rating promedio | `<Skeleton variant="text" width="50%" height={24} />` | — |
| Tu calificación | `<Skeleton variant="text" width="40%" height={20} />` | — |
| Divider | `<Divider />` real | — |
| Nivel de precio | `<Skeleton variant="text" width="45%" height={24} />` | — |
| Divider | `<Divider />` real | — |
| Tags | 3x `<Skeleton variant="rounded" width={60} height={28} />` en fila | — |
| Divider | `<Divider />` real | — |
| Foto menú | `<Skeleton variant="rectangular" width="100%" height={80} />` | — |
| Divider | `<Divider />` real | — |
| Comentarios | 2x `<Skeleton variant="text" width="90%" height={18} />` | — |

**Patrón:** Idéntico al `ProfileSkeleton` en `UserProfileSheet.tsx` — función local que retorna JSX con `Skeleton` de MUI, sin props ni estado.

**Integración en BusinessSheet.tsx:**

Actualmente el contenido se renderiza condicionalmente con `{selectedBusiness && (...)}`. Se agrega un estado intermedio:

```typescript
// Dentro del SwipeableDrawer, reemplazar:
{selectedBusiness && (
  <Box sx={{ overflow: 'auto', maxHeight: '85dvh' }}>
    {data.isLoading && !hasLoadedOnce ? (
      <BusinessSheetSkeleton />
    ) : (
      // ... contenido actual
    )}
  </Box>
)}
```

**Variable `hasLoadedOnce`:** Se usa un `useRef<string | null>(null)` que guarda el último `businessId` que completó la carga. Si `data.isLoading` es true pero ya se cargó ese business (cache hit), se muestra el contenido real, no el skeleton. Esto evita flash de skeleton en refetches.

**Transición:** Fade simple con `sx={{ animation: 'fadeIn 200ms ease-in' }}` + keyframe CSS-in-JS. Sin `Fade` de MUI para evitar import extra.

---

## S2: MapSkeleton

**Componente nuevo:** `MapSkeleton` en `src/components/map/MapSkeleton.tsx`

Overlay semi-transparente con pulso que se muestra encima del mapa mientras los businesses se cargan por primera vez.

**Contexto importante:** `useBusinesses` lee datos de `businesses.json` (import estático), no de Firestore. Los datos están disponibles de forma síncrona en el primer render. Por lo tanto, **no hay estado de carga real para los markers**. El único escenario de "mapa vacío" es mientras se inicializa el Google Maps SDK.

**Enfoque:** El `<Map>` de `@vis.gl/react-google-maps` ya muestra un tile gris mientras carga. El MapSkeleton se superpone como overlay hasta que el mapa emita el primer `tilesloaded` event.

**Implementación:**

```typescript
// MapSkeleton.tsx
export default function MapSkeleton() {
  return (
    <Box sx={{
      position: 'absolute',
      inset: 0,
      zIndex: 1,
      bgcolor: 'grey.100',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <Skeleton variant="rectangular" width="100%" height="100%"
        animation="pulse" />
    </Box>
  );
}
```

**Integración en MapView.tsx:**

```typescript
const [mapReady, setMapReady] = useState(false);

<Map onTilesLoaded={() => setMapReady(true)} ...>
  ...
</Map>
{!mapReady && <MapSkeleton />}
```

El skeleton se monta sobre el `<Map>` con position absolute, y se desmonta al primer `tilesloaded`. Sin animación de salida (el mapa ya tiene contenido visual).

---

## Archivos a crear

| Archivo | Tamaño estimado |
|---------|----------------|
| `src/components/business/BusinessSheetSkeleton.tsx` | ~60 líneas |
| `src/components/map/MapSkeleton.tsx` | ~25 líneas |

## Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `src/components/business/BusinessSheet.tsx` | Import skeleton, agregar lógica `hasLoadedOnce`, renderizado condicional |
| `src/components/map/MapView.tsx` | Import skeleton, estado `mapReady`, prop `onTilesLoaded`, overlay condicional |

---

## Dependencias nuevas

**Imports MUI adicionales en archivos nuevos:**
- `Skeleton` (ya usado en `UserProfileSheet.tsx`, `SettingsPanel.tsx`, `PaginatedListShell.tsx`)
- `Divider` (ya usado en BusinessSheet)

No se agregan dependencias npm nuevas.

---

## Tests

No se agregan tests nuevos. Los skeleton components son puramente visuales sin lógica condicional. La integración se verifica manualmente throttleando la red en DevTools.

---

## Impacto en performance

- `BusinessSheetSkeleton`: se monta solo durante la carga inicial, se desmonta después. Sin impacto.
- `MapSkeleton`: un Box + Skeleton que se desmonta al primer `tilesloaded`. Sin impacto.
- No se agregan re-renders adicionales al flujo normal (post-carga).

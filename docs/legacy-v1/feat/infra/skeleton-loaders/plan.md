# Plan: Skeleton Loaders — Mapa y BusinessSheet

**Specs:** [specs.md](./specs.md)
**Issue:** #143
**Esfuerzo total:** S

---

## Milestone 1: BusinessSheetSkeleton (S)

### M1.1: Crear BusinessSheetSkeleton component

**Archivo nuevo:** `src/components/business/BusinessSheetSkeleton.tsx`

Tareas:
1. Crear componente funcional sin props que replica el layout del BusinessSheet con `Skeleton` de MUI
2. Incluir drag handle (Box estático), skeleton de nombre, chip categoría, dirección, botón "cómo llegar", y secciones rating/precio/tags/foto/comentarios separadas por `<Divider />`
3. Usar el mismo `px: 2` y `pb` del BusinessSheet para alinear espaciado

**Criterio de aceptación:** El skeleton visualmente coincide con el layout real del BusinessSheet.

### M1.2: Integrar en BusinessSheet

**Archivo:** `src/components/business/BusinessSheet.tsx`

Tareas:
1. Importar `BusinessSheetSkeleton`
2. Agregar `useRef<string | null>(null)` para trackear `lastLoadedId`
3. Actualizar `lastLoadedId` cuando `data.isLoading` pasa a false
4. En el render: si `data.isLoading && lastLoadedId !== businessId`, mostrar `<BusinessSheetSkeleton />` en vez del contenido
5. Agregar fade-in al contenido real con keyframe CSS-in-JS

**Criterio de aceptacion:** Al abrir un business no cacheado, se ve skeleton. Al abrir uno cacheado, se ve contenido directo sin flash.

---

## Milestone 2: MapSkeleton (S)

### M2.1: Crear MapSkeleton component

**Archivo nuevo:** `src/components/map/MapSkeleton.tsx`

Tareas:
1. Crear componente Box con position absolute, inset 0, zIndex 1
2. Dentro: `<Skeleton variant="rectangular" width="100%" height="100%" animation="pulse" />`
3. Respetar dark mode con `bgcolor: theme => theme.palette.mode === 'dark' ? 'grey.900' : 'grey.100'`

**Criterio de aceptacion:** Overlay gris con pulso que cubre el area del mapa.

### M2.2: Integrar en MapView

**Archivo:** `src/components/map/MapView.tsx`

Tareas:
1. Importar `MapSkeleton`
2. Agregar `const [mapReady, setMapReady] = useState(false)`
3. Agregar `onTilesLoaded={() => setMapReady(true)}` al componente `<Map>`
4. Renderizar `{!mapReady && <MapSkeleton />}` despues del `<Map>` (hermano, no hijo)

**Criterio de aceptacion:** Al cargar la app, se ve skeleton gris hasta que los tiles del mapa renderizan. Sin flash en recargas rapidas.

---

## Milestone 3: Verificacion y pulido (XS)

Tareas:
1. Testear con throttling de red (Slow 3G) para confirmar que ambos skeletons son visibles
2. Verificar que no hay layout shift (skeleton y contenido ocupan la misma altura)
3. Verificar dark mode en ambos skeletons
4. Actualizar docs de referencia si aplica

---

## Orden de implementacion

```
M1.1 → M1.2 → M2.1 → M2.2 → M3
```

Todos los milestones son independientes entre si (M1 y M2 podrian paralelizarse), pero el orden secuencial facilita el review incremental.

---

## Riesgos

| Riesgo | Mitigacion |
|--------|-----------|
| `onTilesLoaded` no existe en `@vis.gl/react-google-maps` v1 | Fallback: usar `onIdle` o `useEffect` con timeout de 2s |
| Skeleton height no coincide con contenido real | Hardcodear alturas fijas basadas en medicion del layout actual |
| Flash de skeleton en cache hit | `lastLoadedId` ref evita mostrar skeleton para business ya cargado |

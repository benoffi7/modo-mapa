# Plan: UI/Accessibility Audit — Issues #266-#269

**Specs:** [specs.md](specs.md)
**Fecha:** 2026-03-31

---

## Fase unica: Correcciones de accesibilidad y UI

**Branch:** `fix/accessibility-audit-266-269`

Todos los cambios son independientes entre si. Se agrupan por archivo para minimizar cambios de contexto. El orden dentro de cada categoria es por impacto decreciente.

### Issue #269 primero — cambios estructurales

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/components/business/BusinessSheet.tsx` | Agregar `const showError = !data.isLoading && data.error;`. Agregar componente local `BusinessSheetError({ onRetry })` con `ErrorOutlineIcon`, texto "No se pudo cargar la informacion del comercio." y `Button` "Reintentar". Intercalar `showError ? <BusinessSheetError onRetry={() => data.refetch()} />` entre el ternario de skeleton y el contenido. Importar `ErrorOutlineIcon` de `@mui/icons-material/ErrorOutline` y `RefreshIcon` de `@mui/icons-material/Refresh`. |
| 2 | `src/components/map/MapView.tsx` | Agregar `const [mapError, setMapError] = useState(false)`. Agregar `useEffect` con `setTimeout` de 10 000ms que hace `setMapError(true)` si `mapReady` sigue en `false`. Agregar componente local `MapLoadError` con `MapIcon`, texto "No se pudo cargar el mapa." y `Button` "Reintentar" que llama `window.location.reload()`. Cambiar `{!mapReady && <MapSkeleton />}` a `{!mapReady && !mapError && <MapSkeleton />}{mapError && <MapLoadError />}`. Importar `MapIcon` de `@mui/icons-material/Map` y `RefreshIcon`. |

### Issue #266: Touch targets

| Paso | Archivo | Cambio |
|------|---------|--------|
| 3 | `src/components/business/InlineReplyForm.tsx` | En ambos `IconButton` (Send linea 80, Cancel linea 92): cambiar `width: 32, height: 32` a `width: 44, height: 44`. En el `SendIcon` cambiar `fontSize: 14` a `fontSize: 20`. En el `CloseIcon` cambiar `fontSize: 16` a `fontSize: 20`. Agregar `aria-label="Enviar respuesta"` al boton Send (que actualmente no lo tiene). |
| 4 | `src/components/business/BusinessQuestions.tsx` | Mismo fix que paso 3 para la copia inline del formulario de reply (lineas 319-343): `width: 44, height: 44`, `SendIcon fontSize: 20`, `CloseIcon fontSize: 20`. |
| 5 | `src/components/business/BusinessRating.tsx` | En `IconButton` (linea 49): reemplazar `sx={{ color: 'text.secondary', p: 0.25 }}` por `sx={{ color: 'text.secondary', minWidth: 44, minHeight: 44 }}`. |
| 6 | `src/components/onboarding/VerificationNudge.tsx` | En `IconButton` dismiss (linea 99): reemplazar `sx={{ p: 0.25 }}` por `sx={{ minWidth: 44, minHeight: 44 }}`. |
| 7 | `src/components/profile/OnboardingChecklist.tsx` | En `IconButton` expand (linea 139): reemplazar `sx={{ p: 0.25 }}` por `sx={{ minWidth: 44, minHeight: 44 }}`. En `IconButton` dismiss (linea 146): mismo cambio. |
| 8 | `src/components/social/UserScoreCard.tsx` | En `IconButton` expand (linea 170): reemplazar `p: 0.25` por `minWidth: 44, minHeight: 44` dentro del `sx`. |
| 9 | `src/components/profile/InterestsSection.tsx` | En `IconButton` unfollow (linea 27): reemplazar `sx={{ ml: -0.5, p: 0.25 }}` por `sx={{ ml: -0.5, minWidth: 44, minHeight: 44 }}`. Agregar `aria-label={\`Dejar de seguir ${tag}\`}` (el IconButton actualmente no tiene aria-label). |
| 10 | `src/components/business/BusinessTags.tsx` | En `IconButton` follow/unfollow (linea 201): reemplazar `sx={{ ml: -0.5, p: 0.25 }}` por `sx={{ ml: -0.5, minWidth: 44, minHeight: 44 }}`. El `aria-label` ya esta cubierto por el `Tooltip` exterior, pero agregar `aria-label` explicito al `IconButton` para compatibilidad con screen readers. |
| 11 | `src/components/home/TrendingNearYouSection.tsx` | Reemplazar el `Chip label="×"` de dismiss (lineas 100-107) con `IconButton` con `aria-label="Cerrar sugerencia de localidad"` y `sx={{ minWidth: 44, minHeight: 44 }}` conteniendo `CloseIcon sx={{ fontSize: 16 }}`. Agregar import de `IconButton` y `CloseIcon`. Remover el `Chip` y su import si queda sin uso. |

### Issue #267: aria-labels faltantes

| Paso | Archivo | Cambio |
|------|---------|--------|
| 12 | `src/components/lists/ListDetailScreen.tsx` | Agregar `aria-label` a los 8 `IconButton` del Toolbar: `"Volver a listas"` (back), `"Cambiar icono de lista"` (icon picker), `"Cambiar color de lista"` (color picker), `isPublic ? "Hacer lista privada" : "Hacer lista publica"` (toggle — expresion dinamica), `"Compartir lista"` (share), `"Ver editores"` (editors badge), `"Invitar editor"` (person add), `"Eliminar lista"` (delete). |
| 13 | `src/components/onboarding/ActivityReminder.tsx` | Agregar `aria-label="Cerrar recordatorio"` al `IconButton` dismiss (linea 35). |
| 14 | `src/components/onboarding/AccountBanner.tsx` | Agregar `aria-label="Cerrar aviso"` al `IconButton` dismiss (linea 77). |
| 15 | `src/components/home/QuickActions.tsx` | Agregar `aria-label="Editar acciones rapidas"` al `IconButton` edit (linea 153). Agregar `aria-label="Cerrar dialogo de edicion"` al `IconButton` close dialog (linea 176). |
| 16 | `src/components/profile/ProfileScreen.tsx` | Agregar `aria-label="Volver al perfil"` al `IconButton` back en el bloque `activeSection` (linea 72). Agregar `aria-label="Editar nombre"` al `IconButton` edit name (linea 121). |
| 17 | `src/components/lists/ListsScreen.tsx` | Agregar `aria-label="Crear nueva lista"` al `IconButton` (linea 44). |
| 18 | `src/components/search/SearchScreen.tsx` | Agregar `aria-label="Cerrar aviso"` al `IconButton` dismiss (linea 49). |

### Issue #268: Typography con onClick

| Paso | Archivo | Cambio |
|------|---------|--------|
| 19 | `src/components/home/RecentSearches.tsx` | Reemplazar `<Typography variant="caption" color="text.disabled" onClick={clearHistory} sx={{ cursor: 'pointer', ... }}>Borrar</Typography>` con `<Button variant="text" size="small" onClick={clearHistory} sx={{ minWidth: 0, p: 0, color: 'text.disabled', fontSize: '0.75rem', '&:hover': { color: 'text.secondary', bgcolor: 'transparent' } }}>Borrar</Button>`. Agregar import de `Button` desde `@mui/material`. |
| 20 | `src/components/home/ActivityDigestSection.tsx` | Reemplazar `<Typography variant="caption" color="primary" sx={{ cursor: 'pointer' }} onClick={...}>Ver todas</Typography>` con `<Button variant="text" size="small" onClick={...} sx={{ minWidth: 0, p: 0, fontSize: '0.75rem' }}>Ver todas</Button>`. Agregar import de `Button` si no existe. |
| 21 | `src/components/home/TrendingNearYouSection.tsx` | Reemplazar `<Typography variant="caption" color="primary.main" sx={{ cursor: 'pointer' }} onClick={handleConfigureTap}>Configurá tu localidad para resultados más precisos</Typography>` con `<Button variant="text" size="small" onClick={handleConfigureTap} sx={{ minWidth: 0, p: 0, textAlign: 'left', textTransform: 'none', fontSize: '0.75rem', lineHeight: 'inherit' }}>Configurá tu localidad para resultados más precisos</Button>`. (Este es el mismo archivo del paso 11 — coordinar ambos cambios en el mismo diff.) |

### Tests

| Paso | Archivo | Cambio |
|------|---------|--------|
| 22 | `src/__tests__/components/business/BusinessSheet.error.test.tsx` | Crear test. Mock `useBusinessData` para devolver `{ isLoading: false, error: true, refetch: mockFn }`. Verificar que renderiza el texto "No se pudo cargar". Verificar que click en "Reintentar" llama `refetch`. |
| 23 | `src/__tests__/components/map/MapView.timeout.test.tsx` | Crear test con `jest.useFakeTimers()`. Montar `MapView` sin disparar `onTilesLoaded`. Avanzar 10s. Verificar que renderiza "No se pudo cargar el mapa." |

---

## Orden de implementacion

1. Pasos 1-2 (error states) — son los cambios mas sustanciales, hacerlos primero para validarlos.
2. Pasos 3-11 (touch targets) — cambios de sx, todos independientes.
3. Pasos 12-18 (aria-labels) — agregar atributos, todos independientes.
4. Pasos 19-21 (Typography → Button) — los tres archivos del home, hacer juntos porque son el mismo patron.
5. Pasos 22-23 (tests) — escribir despues de implementar los componentes de error.

**Atencion coordinacion:** Los pasos 11 y 21 tocan el mismo archivo (`TrendingNearYouSection.tsx`). Hacer ambos cambios en un mismo paso.

---

## Riesgos

**Touch target visual regression:** Aumentar `minWidth/minHeight` a 44px en `IconButton` que estan adjuntos a `Chip` (InterestsSection, BusinessTags) puede desplazar el layout. Mitigacion: verificar en emulador mobile que el `ml: -0.5` sigue produciendo el solapamiento visual deseado. Si hay problema, usar `position: 'absolute'` con area extendida invisible.

**Chip → IconButton en TrendingNearYouSection:** Cambiar el componente de dismiss puede alterar levemente el look del hint. Mitigacion: usar `CloseIcon sx={{ fontSize: 16 }}` para mantener el icono pequeno, y `sx={{ p: 0 }}` si el layout es muy ajustado, siempre que el area de toque sea >=44px (usar padding invisible via `::before` pseudo-elemento si es necesario).

**Button en lugar de Typography en RecentSearches:** El `Button variant="text"` por defecto tiene `text-transform: uppercase`. Mitigacion: agregar `textTransform: 'none'` al `sx` o confiar en que MUI Button hereda el texto tal como viene.

---

## Guardrails de modularidad

- [x] Ningun componente nuevo importa `firebase/firestore` directamente — no aplica, son cambios de UI
- [x] Archivos nuevos en carpeta de dominio correcta — `BusinessSheetError` y `MapLoadError` son componentes locales, no archivos separados
- [x] Logica de negocio en hooks/services, no en componentes — no aplica
- [x] Ningun archivo resultante supera 400 lineas — verificado en specs

## Guardrails de accesibilidad y UI

- [x] Todo `<IconButton>` tiene `aria-label` — este fix agrega los faltantes
- [x] No hay `<Typography onClick>` — este fix elimina los existentes
- [x] Touch targets minimo 44x44px — este fix corrige los 12 elementos afectados
- [x] Componentes con fetch tienen error state con retry — BusinessSheet y MapView corregidos
- [x] `<img>` con URL dinamica tienen `onError` fallback — no aplica a este fix

## Guardrails de copy

- [x] Todos los textos nuevos usan voseo donde corresponde (aria-labels son imperativos, no aplica voseo)
- [x] Tildes correctas: "informacion" → "información", "dialogo" → "diálogo" (verificar en implementacion)
- [x] Terminologia consistente: "comercio" en BusinessSheetError

---

## Fase final: Documentacion

| Paso | Archivo | Cambio |
|------|---------|--------|
| 24 | `docs/reference/patterns.md` | Actualizar seccion "Accesibilidad" con el patron de touch targets: `minWidth: 44, minHeight: 44` en lugar de `p: 0.25`. Agregar nota sobre Button variant="text" como reemplazo de Typography onClick. |

---

## Criterios de done

- [ ] Todos los `IconButton` en los archivos listados tienen `aria-label`
- [ ] Ningun `IconButton` tiene `p: 0.25` ni `width: 32 / height: 32`
- [ ] Ningun `<Typography onClick>` en los 3 archivos afectados
- [ ] BusinessSheet muestra error + retry cuando `useBusinessData.error === true`
- [ ] MapView muestra error + retry despues de 10s sin carga
- [ ] Tests en pasos 22-23 pasan
- [ ] No hay lint errors (`npm run lint`)
- [ ] Build succeeds (`npm run build`)

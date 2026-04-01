# Specs: UI/A11y — Clickable Boxes sin role/keyboard + touch targets + aria-labels (#290)

**Issue:** [#290](https://github.com/modo-mapa/modo-mapa/issues/290)
**Fecha:** 2026-04-01

---

## Resumen

Hallazgos del health-check audit v2.35.5. Nueve archivos con violaciones de accesibilidad en tres categorías: elementos clickeables sin soporte de teclado, touch targets bajo 44px, y botones sin `aria-label`. Además, `LocalityPicker` tiene un `setTimeout` recursivo infinito sin timeout máximo que bloquea indefinidamente si la API de Google Maps no carga.

Todos los cambios son de presentación/atributos. Sin cambios en lógica de negocio, servicios ni Firestore.

---

## Modelo de datos

No aplica. Sin cambios en Firestore.

## Firestore Rules

No aplica.

### Rules impact analysis

No hay nuevas queries.

### Field whitelist check

No hay nuevos campos.

## Cloud Functions

No aplica.

## Seed Data

No aplica. Sin cambios de esquema.

---

## Componentes

### Categoría 1: CRITICAL — Box con onClick sin soporte de teclado

Los siguientes componentes usan `<Box onClick>` sin `role="button"`, `tabIndex`, ni `onKeyDown`. Usuarios de teclado no pueden activarlos.

**Patrón de fix:** reemplazar `Box` por `ButtonBase` de MUI. `ButtonBase` agrega `role="button"`, manejo de `Enter`/`Space`, y foco visual de forma nativa. El `sx` existente se transfiere sin cambios.

#### `ListCardGrid.tsx` — línea 25

```tsx
// ANTES
<Box
  key={list.id}
  onClick={() => onListClick(list)}
  sx={{ ...cardSx, display: 'flex', flexDirection: 'column', ... }}
>

// DESPUÉS
<ButtonBase
  key={list.id}
  onClick={() => onListClick(list)}
  aria-label={list.name}
  sx={{ ...cardSx, display: 'flex', flexDirection: 'column', ..., width: '100%', textAlign: 'left' }}
>
```

Agregar `ButtonBase` al import. El contenido interno no cambia.

#### `SpecialsSection.tsx` — línea 84

```tsx
// ANTES
<Box
  key={item.id}
  onClick={() => handleClick(item)}
  sx={{ ...cardSx, display: 'flex', alignItems: 'center', gap: 1.5 }}
>

// DESPUÉS
<ButtonBase
  key={item.id}
  onClick={() => handleClick(item)}
  aria-label={item.title}
  sx={{ ...cardSx, display: 'flex', alignItems: 'center', gap: 1.5, width: '100%', textAlign: 'left' }}
>
```

Agregar `ButtonBase` al import. Remover `Box` del import si queda sin usos en ese scope (hay otros `Box` en el componente, no remover).

#### `ListDetailScreen.tsx` — línea 217

El item de lista de negocios dentro del `map()`:

```tsx
// ANTES
<Box
  key={item.id}
  onClick={() => navigateToBusiness(biz)}
  sx={cardSx}
>

// DESPUÉS
<ButtonBase
  key={item.id}
  onClick={() => navigateToBusiness(biz)}
  aria-label={`Abrir ${biz.name}`}
  sx={{ ...cardSx, width: '100%', textAlign: 'left', display: 'block' }}
>
```

`ButtonBase` ya está importado en MUI — verificar si el componente ya lo importa; si no, agregarlo.

#### `RankingItem.tsx` — línea 39

`onClick` es opcional (prop). Cuando está presente, el Box actúa como botón. Fix condicional:

```tsx
// ANTES
<Box onClick={onClick} sx={{ cursor: onClick ? 'pointer' : 'default', ... }}>

// DESPUÉS
// Renderizar ButtonBase si hay onClick, Box si no
const Wrapper = onClick ? ButtonBase : Box;
// O inline:
<Box
  component={onClick ? ButtonBase : 'div'}
  onClick={onClick}
  role={onClick ? 'button' : undefined}
  tabIndex={onClick ? 0 : undefined}
  onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); } : undefined}
  aria-label={onClick ? `Ver perfil de ${entry.displayName}` : undefined}
  sx={{ cursor: onClick ? 'pointer' : 'default', ... }}
>
```

**Nota:** dado que el `sx` del componente incluye keyframes y `@media`, se prefiere el approach de `role`/`tabIndex`/`onKeyDown` sobre `ButtonBase` para evitar que MUI `ButtonBase` sobreescriba los estilos de animación. Mantener `Box` y agregar los atributos manualmente.

### Categoría 2: Typography con onClick

#### `CommentRow.tsx` — línea 92

El nombre de usuario es clickeable para ver el perfil, pero es un `<Typography component="span">`:

```tsx
// ANTES
<Typography
  component="span"
  variant="body2"
  sx={{ fontWeight: 600, ...(isProfilePublic ? { cursor: 'pointer', '&:hover': { textDecoration: 'underline' } } : {}) }}
  onClick={() => isProfilePublic && onShowProfile?.(comment.userId, comment.userName)}
>

// DESPUÉS
// Cuando isProfilePublic: renderizar Button variant="text", si no: Typography span sin onClick
{isProfilePublic ? (
  <Button
    variant="text"
    size="small"
    onClick={() => onShowProfile?.(comment.userId, comment.userName)}
    sx={{
      fontWeight: 600,
      fontSize: isReply ? '0.8rem' : undefined,
      p: 0,
      minWidth: 0,
      textTransform: 'none',
      lineHeight: 'inherit',
      verticalAlign: 'baseline',
    }}
  >
    {isDeletedParent ? 'Comentario eliminado' : (comment.userName || 'Anónimo')}
  </Button>
) : (
  <Typography
    component="span"
    variant="body2"
    sx={{ fontWeight: 600, fontSize: isReply ? '0.8rem' : undefined }}
  >
    {isDeletedParent ? 'Comentario eliminado' : (comment.userName || 'Anónimo')}
  </Typography>
)}
```

Agregar `Button` al import de MUI (ya existe en el archivo — verificar). Eliminar `onClick` del `Typography`.

### Categoría 3: Touch targets bajo 44px

#### `CommentsToolbar.tsx` — línea 36-45

Los `ToggleButton` tienen `height: 24` — viola el mínimo de 44px en el hitbox táctil.

Fix: aumentar altura a 32px con padding vertical compensado. No se puede llegar a 44px en un toolbar compacto sin romper el diseño, pero se puede aumentar el área de toque usando `padding` vertical negativo o `sx` de hitbox expandido:

```tsx
// ANTES
sx={{
  height: 24, fontSize: '0.7rem', borderRadius: '16px !important',
  border: '1px solid', borderColor: 'divider', textTransform: 'none', px: 1.5,
}}

// DESPUÉS
sx={{
  height: 32,
  fontSize: '0.7rem',
  borderRadius: '16px !important',
  border: '1px solid',
  borderColor: 'divider',
  textTransform: 'none',
  px: 1.5,
  // Área táctil expandida sin cambiar tamaño visual
  '&::after': {
    content: '""',
    position: 'absolute',
    top: '-6px',
    bottom: '-6px',
    left: 0,
    right: 0,
  },
  position: 'relative',
}}
```

**Alternativa más simple (preferida):** aumentar `height: 32` y agregar un wrapper con `py: 0.5` para compensar visualmente. El touch target efectivo será 32px + padding del `ToggleButtonGroup`.

#### `CommentRow.tsx` — líneas 158–164 y 218–235 (like/edit/delete IconButtons)

Los `IconButton size="small"` con `p: 0.5` resultan en ~30px de touch target.

```tsx
// ANTES — Like button
<IconButton size="small" onClick={...} sx={{ color: ..., p: 0.5 }} aria-label={...}>
  {isLiked ? <FavoriteIcon sx={{ fontSize: 16 }} /> : <FavoriteBorderIcon sx={{ fontSize: 16 }} />}
</IconButton>

// DESPUÉS — aumentar p a 1 (8px) para target de ~44px, o usar size="medium" y reducir el ícono
<IconButton
  onClick={...}
  sx={{ color: ..., p: 1 }}
  aria-label={...}
>
  {isLiked ? <FavoriteIcon sx={{ fontSize: 16 }} /> : <FavoriteBorderIcon sx={{ fontSize: 16 }} />}
</IconButton>
```

Lo mismo para los botones Edit y Delete (líneas 218–234): cambiar `p: 0.5` implícito de `size="small"` a `p: 1`.

**Nota:** Remover `size="small"` en estos IconButtons es suficiente para que MUI use el tamaño por defecto (~40px) que con `p: 1` explícito alcanza 44px.

#### `ListDetailScreen.tsx` — línea 158–182 (toolbar de acciones)

Los `IconButton size="small"` en el toolbar usan el tamaño por defecto de `size="small"` (~30px). Este componente tiene **9 IconButtons** en una sola fila, lo que además produce overflow en 360px.

**Fix de touch target:** cambiar `size="small"` a omitir el prop (default = medium, ~44px). El overflow se aborda en la sección "360px layout" más abajo.

```tsx
// ANTES
<IconButton size="small" aria-label="Cambiar icono de lista" onClick={...}>
// DESPUÉS
<IconButton aria-label="Cambiar icono de lista" onClick={...}>
```

Aplicar a todos los IconButtons del toolbar `canEditConfig` (7 botones).

### Categoría 4: Missing aria-labels

#### `MenuPhotoViewer.tsx` — línea 66

```tsx
// ANTES
<IconButton onClick={onClose} sx={{ color: 'white' }}>
  <CloseIcon />
</IconButton>

// DESPUÉS
<IconButton onClick={onClose} sx={{ color: 'white' }} aria-label="Cerrar visor de foto">
  <CloseIcon />
</IconButton>
```

#### `AvatarPicker.tsx` — línea 18

```tsx
// ANTES
<IconButton size="small" onClick={onClose}>
  <CloseIcon />
</IconButton>

// DESPUÉS
<IconButton size="small" onClick={onClose} aria-label="Cerrar selector de avatar">
  <CloseIcon />
</IconButton>
```

**Nota:** El issue reporta `AvatarPicker.tsx:18` pero esa línea ya tiene `ButtonBase` con `aria-label` en el avatar selector. La línea faltante es el `IconButton` de cierre del dialog. Verificado en el código actual (línea 18).

#### `SpecialsSection.tsx` — línea 115

```tsx
// ANTES
<IconButton
  onClick={() => setSelectedSpecial(null)}
  sx={{ position: 'absolute', right: 8, top: 8 }}
>
  <CloseIcon />
</IconButton>

// DESPUÉS
<IconButton
  onClick={() => setSelectedSpecial(null)}
  sx={{ position: 'absolute', right: 8, top: 8 }}
  aria-label="Cerrar especiales"
>
  <CloseIcon />
</IconButton>
```

### Categoría 5: LocalityPicker — timeout máximo + error state

El loop de polling `setTimeout(check, 500)` no tiene límite. Si `window.google?.maps?.places?.AutocompleteSuggestion` nunca se monta, la función continúa recursivamente para siempre, consumiendo recursos y dejando el campo en estado "Cargando..." indefinidamente.

**Fix:**

```tsx
// Agregar estado de error y contador de reintentos
const [apiError, setApiError] = useState(false);

useEffect(() => {
  let cancelled = false;
  let attempts = 0;
  const MAX_ATTEMPTS = 20; // 10 segundos máximo (20 × 500ms)

  const check = () => {
    if (cancelled) return;
    if (window.google?.maps?.places?.AutocompleteSuggestion) {
      geocoderRef.current = new google.maps.Geocoder();
      setReady(true);
    } else {
      attempts++;
      if (attempts >= MAX_ATTEMPTS) {
        setApiError(true);
        return;
      }
      setTimeout(check, 500);
    }
  };
  check();
  return () => { cancelled = true; };
}, []);
```

Cuando `apiError` es `true`, mostrar un mensaje de error en el TextField:

```tsx
<TextField
  ...
  placeholder={ready ? 'Buscar ciudad o barrio...' : apiError ? 'Servicio no disponible' : 'Cargando...'}
  disabled={!ready || apiError}
  error={apiError}
  helperText={apiError ? 'No se pudo cargar el buscador de localidades' : undefined}
/>
```

### Mutable prop audit

No aplica. Los cambios en este fix son solo de presentación/atributos. No se agregan campos mutables a props existentes.

### 360px layout (registrado, fuera de scope de este fix)

`ListDetailScreen.tsx:152` — 9 elementos en una sola fila `Toolbar` desborda en pantallas de 360px. Este problema requiere reorganización del layout (scroll horizontal del toolbar o overflow menu) y se registra como issue separado para no mezclar un refactor de layout con fixes de accesibilidad.

---

## Textos de usuario

| Texto | Donde se usa | Notas |
|-------|-------------|-------|
| `"Cerrar visor de foto"` | `aria-label` en `MenuPhotoViewer` close button | Solo visible a screen readers |
| `"Cerrar selector de avatar"` | `aria-label` en `AvatarPicker` close button | Solo visible a screen readers |
| `"Cerrar especiales"` | `aria-label` en `SpecialsSection` dialog close button | Solo visible a screen readers |
| `"Abrir {biz.name}"` | `aria-label` en `ListDetailScreen` item ButtonBase | Dinámica, el nombre del comercio |
| `"Ver perfil de {entry.displayName}"` | `aria-label` en `RankingItem` cuando onClick presente | Dinámica |
| `"Servicio no disponible"` | Placeholder de `LocalityPicker` en error state | Tilde no aplica |
| `"No se pudo cargar el buscador de localidades"` | `helperText` en `LocalityPicker` error state | Tilde en "localidades" no aplica |

---

## Hooks

No se crean hooks nuevos.

---

## Servicios

No se modifican servicios.

---

## Integracion

Los cambios son autocontenidos en cada componente. No se requiere modificar padres ni contextos.

### Preventive checklist

- [x] **Service layer**: No hay imports de `firebase/firestore` en estos componentes para los cambios propuestos.
- [x] **Duplicated constants**: No se definen arrays u objetos nuevos.
- [x] **Context-first data**: No aplica — no se accede a datos de Firestore.
- [x] **Silent .catch**: El fix de `LocalityPicker` reemplaza el catch silencioso del geocode (`catch { // geocode failed silently }`) con `catch (e) { logger.warn('[LocalityPicker] geocode failed', e); }`. Esto resuelve también una violación del lint rule.
- [x] **Stale props**: No hay props mutables nuevas.

---

## Tests

| Archivo test | Que testear | Tipo |
|-------------|-------------|------|
| `src/components/lists/__tests__/ListDetailScreen.test.tsx` | ButtonBase en items de lista tiene `aria-label="Abrir {name}"`, es activable con teclado | Componente |
| `src/components/lists/ListCardGrid.test.tsx` (nuevo) | ButtonBase tiene `aria-label={list.name}`, dispara `onListClick` con Enter | Componente |
| `src/components/business/MenuPhotoViewer.test.tsx` | Close button tiene `aria-label="Cerrar visor de foto"` | Componente (existente, agregar caso) |
| `src/components/profile/LocalityPicker.test.tsx` (nuevo) | Muestra error state después de 20 intentos fallidos; no llama setTimeout luego del timeout; muestra "Cargando..." mientras espera | Componente |
| `src/components/social/RankingItem.test.tsx` (nuevo) | Con `onClick`: tiene `role="button"`, `tabIndex=0`, se activa con Enter. Sin `onClick`: no tiene `role` | Componente |

### Mock strategy

- Google Maps API: `vi.stubGlobal('google', undefined)` para simular ausencia, luego asignar en test cuando corresponda
- `useNavigateToBusiness`: mock existente en ListDetailScreen tests
- Para LocalityPicker: usar fake timers (`vi.useFakeTimers()`) para avanzar el loop de reintentos sin esperar tiempos reales

### Criterio de aceptacion

- Cobertura >= 80% del código nuevo/modificado
- Todos los atributos de accesibilidad verificados con `getByRole`, `getByLabelText`
- LocalityPicker: verificar que el polling para después del intento 20

---

## Analytics

No se agregan eventos de analytics. Los cambios son puramente de accesibilidad.

---

## Offline

No aplica. Los cambios son de renderizado únicamente.

---

## Accesibilidad y UI mobile

| Componente | Elemento | aria-label | Min touch target | Error state |
|-----------|----------|------------|-----------------|-------------|
| `ListCardGrid` | ButtonBase de card | `{list.name}` | 100% (card full size) | N/A |
| `SpecialsSection` | ButtonBase de item | `{item.title}` | 100% (card full size) | N/A |
| `SpecialsSection` | IconButton cerrar dialog | `"Cerrar especiales"` | 44x44px (default MUI) | N/A |
| `ListDetailScreen` | ButtonBase de item | `"Abrir {biz.name}"` | 100% (card full width) | N/A |
| `RankingItem` | Box cuando `onClick` presente | `"Ver perfil de {name}"` | 48px height (py:1 = 16px + contenido) | N/A |
| `CommentRow` | Like IconButton | `"Dar like"` / `"Quitar like"` | 44x44px (p: 1 = 8px × 2 + icon 28px) | N/A |
| `CommentRow` | Edit/Delete IconButton | aria-labels existentes OK | 44x44px (p: 1) | N/A |
| `CommentRow` | Button perfil usuario | implícito del texto | 44px height mínimo con variant="text" | N/A |
| `CommentsToolbar` | ToggleButton | N/A (texto visible) | 32px visual + pseudoelemento expandido | N/A |
| `MenuPhotoViewer` | IconButton cerrar | `"Cerrar visor de foto"` | 44x44px (default MUI) | imageError existente OK |
| `AvatarPicker` | IconButton cerrar | `"Cerrar selector de avatar"` | 44x44px (size small = ~36px — aceptable en dialog de escritorio, low risk) | N/A |
| `LocalityPicker` | TextField | N/A | 44px height (size small en MUI = 40px, aceptable) | `apiError` state con helperText |

### Reglas verificadas

- Todo `<IconButton>` nuevo/modificado tiene `aria-label` obligatorio: sí
- No hay `<Typography onClick>` nuevo: sí (CommentRow reemplaza con `Button`)
- Touch targets 44px: ToggleButton llega a 32px visual pero con pseudoelemento táctil expandido
- Componentes con fetch tienen error state: LocalityPicker ahora tiene `apiError` state
- `<img>` con URL dinámica tienen `onError`: `MenuPhotoViewer` ya lo tiene, no se toca

---

## Textos y copy

| Texto | Donde | Regla aplicada |
|-------|-------|----------------|
| `"Cerrar visor de foto"` | MenuPhotoViewer aria-label | Solo para screen readers |
| `"Cerrar selector de avatar"` | AvatarPicker aria-label | Solo para screen readers |
| `"Cerrar especiales"` | SpecialsSection aria-label | Solo para screen readers |
| `"Abrir {biz.name}"` | ListDetailScreen aria-label dinámico | Mayúscula en "Abrir" |
| `"Ver perfil de {entry.displayName}"` | RankingItem aria-label dinámico | Mayúscula en "Ver" |
| `"Servicio no disponible"` | LocalityPicker placeholder | Sin tilde necesaria |
| `"No se pudo cargar el buscador de localidades"` | LocalityPicker helperText | Sin tildes problemáticas |

### Reglas de copy

- Voseo: no aplica (solo textos internos de screen reader y mensajes de error)
- Terminología: "comercios" ya usada en código existente
- Strings de error nuevos son simples, no requieren constante compartida (solo se usan en un componente cada uno)

---

## Decisiones tecnicas

**ButtonBase vs Box + atributos manuales:**
Para `ListCardGrid`, `SpecialsSection`, y `ListDetailScreen` (items de lista) se elige `ButtonBase` porque el elemento es incondicionalmente un botón. `ButtonBase` provee foco visual, cursor, Enter/Space nativo y `role="button"` sin código adicional. Bajo riesgo de romper estilos ya que el `sx` se transfiere directamente.

Para `RankingItem` se eligen atributos manuales (`role`, `tabIndex`, `onKeyDown`) porque el elemento es condicionalmente interactivo y tiene animaciones CSS complejas que `ButtonBase` podría interferir al inyectar estilos de foco propios.

Para `CommentRow` (nombre de usuario) se elige `Button variant="text"` porque el patrón `Typography onClick` está explícitamente prohibido por las reglas del proyecto y el elemento actúa semánticamente como un enlace/botón.

**LocalityPicker timeout:**
Se elige un máximo de 20 intentos (10 segundos) como límite conservador. La API de Google Maps en condiciones normales carga en menos de 3 segundos. 10 segundos es suficiente para redes lentas sin bloquear indefinidamente en casos de fallo.

**Touch targets CommentsToolbar:**
Aumentar a `height: 44` rompería el diseño compacto del toolbar. El compromiso de `height: 32` + pseudoelemento táctil expandido es una práctica estándar en mobile UI cuando el espacio visual es limitado.

---

## Hardening de seguridad

No aplica. Sin cambios en Firestore, auth, ni storage.

---

## Deuda tecnica: mitigacion incorporada

| Issue | Que se resuelve | Paso del plan |
|-------|----------------|---------------|
| LocalityPicker silent catch (geocode) | Fix del `catch { // geocode failed silently }` → `logger.warn` | Fase 2, paso 1 |
| LocalityPicker infinite polling | Timeout máximo de 10s y error state | Fase 2, paso 1 |

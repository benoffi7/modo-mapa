# Specs: Accessibility Fixes #281

**Issue:** #281 — Typography-as-button + missing aria-labels/roles in profile/lists/home
**Fecha:** 2026-03-31

---

## Resumen

9 archivos con violaciones de accesibilidad categorizadas en tres niveles de severidad. Todos los cambios son atributos o sustituciones de componentes — sin cambios en lógica, servicios, ni Firestore.

---

## Cambios por archivo

### CRITICAL

| Archivo | Linea | Problema | Fix |
|---------|-------|---------|-----|
| `src/components/profile/AchievementsSection.tsx` | 53-60 | `<Typography onClick>` para "Ver todos" | Reemplazar con `<Button variant="text" size="small">` |
| `src/components/profile/LocalityPicker.tsx` | 96-103 | `<Typography onClick>` para "Cambiar" | Reemplazar con `<Button variant="text" size="small">` |

### MODERATE

| Archivo | Linea | Problema | Fix |
|---------|-------|---------|-----|
| `src/components/home/ActivityDigestSection.tsx` | 39-57 | `<Box onClick>` en `DigestItem` sin `role="button"` | Reemplazar `Box` por `ButtonBase` |
| `src/components/profile/ProfileScreen.tsx` | 114-118 | `<Avatar onClick>` sin `role="button"` ni `aria-label` | Agregar `role="button"` + `aria-label="Cambiar avatar"` + `tabIndex={0}` |
| `src/components/lists/ListDetailScreen.tsx` | 229-234 | `<IconButton>` de borrar sin `aria-label` | Agregar `aria-label="Eliminar de lista"` |
| `src/components/home/QuickActions.tsx` | 160-165 | `<IconButton>` de slot sin `aria-label` | Agregar `aria-label={slot.label}` |
| `src/components/profile/AvatarPicker.tsx` | 25-42 | `<Box onClick>` por cada avatar sin `role` | Reemplazar `Box` por `ButtonBase` |

### LOW

| Archivo | Linea | Problema | Fix |
|---------|-------|---------|-----|
| `src/components/profile/OnboardingChecklist.tsx` | 126-129 | `<Box onClick>` de header sin `role` | Agregar `role="button"` + `tabIndex={0}` + `aria-expanded` + `aria-label` |
| `src/components/business/MenuPhotoUpload.tsx` | 87-104 | Upload zone `<Box onClick>` sin `role="button"` | Agregar `role="button"` + `tabIndex={0}` + `aria-label="Seleccionar imagen"` |

---

## Detalle de cada cambio

### AchievementsSection.tsx

**Estado actual:** `<Typography variant="caption" color="primary" onClick={onViewAll} sx={{ cursor: 'pointer', ... }}>Ver todos</Typography>`

**Fix:** reemplazar por `<Button variant="text" size="small" onClick={onViewAll} sx={{ minWidth: 0, p: 0, fontSize: '0.75rem', textTransform: 'none' }}>Ver todos</Button>`

Agregar `Button` al import de MUI. Eliminar `Typography` de ese slot (el que tiene `onClick` — el subtítulo "Logros" permanece).

---

### LocalityPicker.tsx

**Estado actual:** `<Typography variant="caption" color="primary" sx={{ cursor: 'pointer', textDecoration: 'underline' }} onClick={() => setIsEditing(true)}>Cambiar</Typography>`

**Fix:** reemplazar por `<Button variant="text" size="small" onClick={() => setIsEditing(true)} sx={{ minWidth: 0, p: 0, fontSize: '0.75rem', textTransform: 'none' }}>Cambiar</Button>`

Agregar `Button` al import de MUI. Eliminar `Typography` del import si queda sin usos — verificar antes de remover (Typography sí se usa en otras líneas del componente, no remover).

---

### ActivityDigestSection.tsx — DigestItem

**Estado actual:** `<Box onClick={handleTap} sx={{ ... cursor: 'pointer', ... }}>`

**Fix:** reemplazar `Box` por `ButtonBase` de MUI. El `ButtonBase` nativizará el rol de button y el foco via teclado.

```tsx
<ButtonBase
  onClick={handleTap}
  sx={{
    display: 'flex',
    alignItems: 'center',
    gap: 1.5,
    py: 0.75,
    width: '100%',
    borderRadius: 1,
    px: 1,
    textAlign: 'left',
    '&:hover': { bgcolor: 'action.hover' },
  }}
>
```

Agregar `ButtonBase` al import de `@mui/material`. No remover `Box` del import (se usa en el resto del componente).

---

### ProfileScreen.tsx — Avatar clickable

**Estado actual:** `<Avatar onClick={() => setAvatarPickerOpen(true)} sx={{ ..., cursor: 'pointer' }}>`

**Fix:** agregar `role="button"` + `tabIndex={0}` + `aria-label="Cambiar avatar"` al componente `Avatar`.

```tsx
<Avatar
  role="button"
  tabIndex={0}
  aria-label="Cambiar avatar"
  onClick={() => setAvatarPickerOpen(true)}
  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setAvatarPickerOpen(true); }}
  sx={{ width: 64, height: 64, bgcolor: 'primary.main', fontSize: avatar ? 32 : 28, mb: 1, cursor: 'pointer' }}
>
```

---

### ListDetailScreen.tsx — Delete IconButton

**Estado actual:** `<IconButton size="small" onClick={(e) => { e.stopPropagation(); handleRemoveItem(item); }}>`

**Fix:** agregar `aria-label="Eliminar de lista"`.

```tsx
<IconButton
  size="small"
  aria-label="Eliminar de lista"
  onClick={(e) => { e.stopPropagation(); handleRemoveItem(item); }}
>
```

---

### QuickActions.tsx — Slot IconButtons

**Estado actual:** `<IconButton onClick={() => handleTap(slot)} sx={{ ... }}>`

**Fix:** agregar `aria-label={slot.label}`.

```tsx
<IconButton
  aria-label={slot.label}
  onClick={() => handleTap(slot)}
  sx={{ ...iconCircleSx(getSlotColor(slot), 48) }}
>
```

---

### AvatarPicker.tsx — Avatar items

**Estado actual:** `<Box key={avatar.id} onClick={() => { onSelect(avatar); onClose(); }} sx={{ cursor: 'pointer', ... }}>`

**Fix:** reemplazar `Box` por `ButtonBase`. Agregar `aria-label={avatar.label}` y `aria-pressed={selectedId === avatar.id}`.

```tsx
<ButtonBase
  key={avatar.id}
  aria-label={avatar.label}
  aria-pressed={selectedId === avatar.id}
  onClick={() => { onSelect(avatar); onClose(); }}
  sx={{
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    p: 1,
    borderRadius: 2,
    border: selectedId === avatar.id ? 2 : 1,
    borderColor: selectedId === avatar.id ? 'primary.main' : 'divider',
    width: '100%',
    '&:hover': { bgcolor: 'action.hover' },
  }}
>
```

Agregar `ButtonBase` al import de MUI.

---

### OnboardingChecklist.tsx — Header Box

**Estado actual:** `<Box sx={{ ..., cursor: 'pointer' }} onClick={toggleExpanded}>`

**Fix:** agregar `role="button"` + `tabIndex={0}` + `aria-expanded={expanded}` + `aria-label={expanded ? 'Colapsar primeros pasos' : 'Expandir primeros pasos'}` + handler de teclado.

```tsx
<Box
  role="button"
  tabIndex={0}
  aria-expanded={expanded}
  aria-label={expanded ? 'Colapsar primeros pasos' : 'Expandir primeros pasos'}
  sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
  onClick={toggleExpanded}
  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') toggleExpanded(); }}
>
```

---

### MenuPhotoUpload.tsx — Upload zone

**Estado actual:** `<Box sx={{ border: '2px dashed', ..., cursor: 'pointer' }} onClick={() => fileInputRef.current?.click()}>`

**Fix:** agregar `role="button"` + `tabIndex={0}` + `aria-label="Seleccionar imagen"` + handler de teclado.

```tsx
<Box
  role="button"
  tabIndex={0}
  aria-label="Seleccionar imagen"
  sx={{ border: '2px dashed', borderColor: 'divider', borderRadius: 2, p: 4, textAlign: 'center', cursor: 'pointer' }}
  onClick={() => fileInputRef.current?.click()}
  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click(); }}
>
```

---

## Accesibilidad y UI mobile

| Componente | Elemento | aria-label / role | Min touch target |
|-----------|----------|-------------------|-----------------|
| AchievementsSection | Button "Ver todos" | implícito (button nativo) | MUI Button default |
| LocalityPicker | Button "Cambiar" | implícito (button nativo) | MUI Button default |
| ActivityDigestSection / DigestItem | ButtonBase | role="button" implícito | full-width row |
| ProfileScreen | Avatar clickable | `aria-label="Cambiar avatar"` | 64x64px (ya cumple) |
| ListDetailScreen | IconButton delete | `aria-label="Eliminar de lista"` | size="small" MUI |
| QuickActions | Slot IconButton | `aria-label={slot.label}` | 48x48px (ya cumple por iconCircleSx) |
| AvatarPicker | ButtonBase avatar item | `aria-label={avatar.label}`, `aria-pressed` | grid cell, p:1 |
| OnboardingChecklist | Box header | `role="button"`, `aria-expanded` | full-width row |
| MenuPhotoUpload | Upload zone Box | `role="button"`, `aria-label="Seleccionar imagen"` | full-width zone |

---

## Textos de usuario

| Texto | Donde se usa | Notas |
|-------|-------------|-------|
| "Ver todos" | AchievementsSection Button | sin tilde, correcto |
| "Cambiar" | LocalityPicker Button | sin tilde, correcto |
| "Cambiar avatar" | ProfileScreen aria-label | sin tilde, correcto |
| "Eliminar de lista" | ListDetailScreen aria-label | sin tilde, correcto |
| "Seleccionar imagen" | MenuPhotoUpload aria-label | sin tilde, correcto |
| "Colapsar primeros pasos" | OnboardingChecklist aria-label | sin tilde, correcto |
| "Expandir primeros pasos" | OnboardingChecklist aria-label | sin tilde, correcto |

---

## Modelo de datos

Sin cambios.

## Firestore Rules

Sin cambios.

## Cloud Functions

Sin cambios.

## Seed Data

Sin cambios.

## Hooks

Sin cambios.

## Servicios

Sin cambios.

## Tests

Sin tests nuevos requeridos — los cambios son puramente de atributos HTML/ARIA y sustitución de primitivos MUI. Los componentes no exponen lógica nueva testeable.

---

## Decisiones tecnicas

- **ButtonBase vs Box+role**: Para elementos que el usuario activa (DigestItem, AvatarPicker items), se usa `ButtonBase` porque gestiona foco, ripple, y `role="button"` automáticamente — es la solución MUI canónica para elementos interactivos sin estilo de botón visible. Para `Box` contenedores que solo necesitan semántica (OnboardingChecklist header, MenuPhotoUpload zone), se agrega `role="button"` + `tabIndex` + `onKeyDown` porque reemplazar por `ButtonBase` alteraría el layout con más esfuerzo sin beneficio adicional.
- **Typography → Button**: Se mantiene `variant="text"` con `sx` para igualar la apariencia visual actual (caption-size, sin padding). Alternativa descartada: `Link` component — semánticamente incorrecto para acciones.
- **Avatar + role="button"**: MUI `Avatar` no es un ButtonBase; agregar `role` y `tabIndex` directamente es el approach correcto. Se agrega `onKeyDown` para soporte de teclado completo.

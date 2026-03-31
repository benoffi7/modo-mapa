# Specs: Dark mode — fix hardcoded colors

**PRD:** [prd.md](prd.md)
**Fecha:** 2026-03-29

---

## Modelo de datos

No aplica. Este feature es puramente visual (estilos CSS-in-JS). No hay cambios en Firestore.

## Firestore Rules

No aplica.

### Rules impact analysis

No hay queries nuevas ni modificadas.

### Field whitelist check

No hay campos nuevos ni modificados.

## Cloud Functions

No aplica.

## Componentes

### OfficeMarker.tsx (modificacion)

**Ruta:** `src/components/map/OfficeMarker.tsx`
**Cambios:** Reemplazar 4 colores hardcodeados por tokens del tema MUI.

El componente actualmente usa un `<div>` nativo con `style={}` (no `sx`). Para usar tokens del tema, hay dos opciones:

1. Convertir a `Box` con `sx` prop (permite shorthand como `'primary.dark'`)
2. Usar `useTheme()` hook y acceder a `theme.palette.*`

**Decision:** Usar `Box` con `sx` prop. Razon: es el patron estandar del proyecto para estilos adaptativos, y permite shorthand strings como `'primary.dark'`. El `<div>` con `style={}` no tiene acceso al tema.

| Propiedad actual | Valor hardcodeado | Valor nuevo (token) |
|-----------------|-------------------|---------------------|
| `backgroundColor` | `'#1565c0'` | `'primary.dark'` |
| `border` | `'3px solid #fff'` | `(theme) => \`3px solid ${theme.palette.background.paper}\`` |
| `boxShadow` | `'0 2px 6px rgba(0,0,0,0.3)'` | `(theme) => \`0 2px 6px ${alpha(theme.palette.common.black, 0.3)}\`` |
| `color` (icono) | `'#fff'` | `'common.white'` |

Nota: `alpha` se importa de `@mui/material/styles` (ya usado en `ScoreSparkline.tsx`).

### MenuPhotoSection.tsx (modificacion)

**Ruta:** `src/components/business/MenuPhotoSection.tsx`
**Cambios:** Reemplazar 2 overlays rgba hardcodeados por valores adaptativos del tema.

| Propiedad actual | Valor hardcodeado | Valor nuevo (token) |
|-----------------|-------------------|---------------------|
| `bgcolor` (L91) | `'rgba(0,0,0,0.55)'` | `(theme) => alpha(theme.palette.common.black, 0.55)` |
| `'&:hover' bgcolor` (L93) | `'rgba(0,0,0,0.75)'` | `(theme) => alpha(theme.palette.common.black, 0.75)` |

Nota: en dark mode, el overlay negro sobre fondo oscuro no genera suficiente contraste. Se agrega una variante que use `alpha(common.white, 0.15)` en dark mode. Esto se logra con el callback `(theme) =>` que inspecciona `theme.palette.mode`.

**Decision final sobre overlay:** Usar `alpha(common.black, 0.55)` para light y `alpha(common.white, 0.15)` para dark. Razon: el overlay sobre una foto necesita ser visible sin ocultar la imagen. En dark mode, un overlay negro es invisible sobre un fondo ya oscuro.

### QuickActions.tsx (modificacion)

**Ruta:** `src/components/home/QuickActions.tsx`
**Cambios:** Reemplazar 2 usos de `color: '#fff'` por `color: 'common.white'`.

| Linea | Valor hardcodeado | Valor nuevo |
|-------|-------------------|-------------|
| L164 | `color: '#fff'` | `color: 'common.white'` |
| L193 | `color: '#fff'` | `color: 'common.white'` |

Nota: `'common.white'` es el shorthand de MUI para `theme.palette.common.white`, que siempre es `#fff` en ambos modos. El cambio es de consistencia, no de comportamiento visual. Usar tokens del tema en vez de hex literales es la convencion del proyecto.

### Mutable prop audit

No aplica. Los tres componentes no reciben datos editables como props.

## Textos de usuario

No hay textos nuevos. Los componentes modificados no agregan ni cambian textos visibles.

## Hooks

No aplica.

## Servicios

No aplica.

## Integracion

Los tres componentes son independientes entre si. No requieren cambios en otros archivos.

### Preventive checklist

- [x] **Service layer**: Los componentes no importan `firebase/firestore` para writes. (Nota: `MenuPhotoSection.tsx` importa de `firebase/storage` para reads, pero es deuda tecnica pre-existente de #243, fuera de scope de este issue.)
- [x] **Duplicated constants**: No se introducen constantes nuevas.
- [x] **Context-first data**: No aplica.
- [x] **Silent .catch**: No aplica — no se tocan las llamadas existentes.
- [x] **Stale props**: No aplica.

## Tests

Estos cambios son puramente visuales (estilos CSS-in-JS). Segun la politica de testing (`docs/reference/tests.md`), componentes puramente visuales sin logica no requieren tests unitarios.

El test existente `OfficeMarker.test.tsx` valida coordenadas y aria-label. Esos tests siguen pasando sin cambios, ya que no verifican estilos.

| Archivo test | Que testear | Tipo |
|-------------|-------------|------|
| `src/components/map/OfficeMarker.test.tsx` | Verificar que no se rompe (ya existe) | Existente, sin cambios |

**Verificacion manual:** Usar el toggle de dark mode en SettingsPanel (seccion "Apariencia") para validar visualmente en ambos modos.

## Analytics

No aplica. No se agregan eventos nuevos.

---

## Offline

No aplica. Los cambios son estilos CSS-in-JS que no dependen de datos remotos. El dark mode toggle persiste en localStorage y funciona offline.

### Cache strategy

N/A.

### Writes offline

N/A.

### Fallback UI

N/A.

---

## Decisiones tecnicas

### OfficeMarker: `<div style>` a `<Box sx>`

**Decision:** Convertir el `<div>` con `style={}` a `<Box>` con `sx={}`.

**Razon:** El `style` prop de React no tiene acceso al tema de MUI. Para usar tokens como `'primary.dark'` y callbacks como `(theme) =>`, se necesita `sx`. El componente `Box` de MUI es el patron estandar del proyecto para esto.

**Alternativa rechazada:** `useTheme()` + `style={}`. Funcionaria, pero agrega un hook innecesario cuando `sx` resuelve lo mismo de forma mas declarativa y alineada con el resto del proyecto.

### MenuPhotoSection: overlay adaptativo por modo

**Decision:** Usar `theme.palette.mode` dentro del callback de `sx` para elegir entre overlay negro (light) y overlay blanco semi-transparente (dark).

**Razon:** Un overlay `rgba(0,0,0,0.55)` sobre una foto en dark mode es invisible porque la UI envolvente ya es oscura. Usando `alpha(common.white, 0.15)` en dark mode se logra un contraste sutil que hace visible el boton sin ocultar la foto.

**Alternativa rechazada:** Usar el mismo color en ambos modos. El overlay negro funciona sobre fotos claras pero es invisible sobre fotos oscuras en dark mode.

### QuickActions: `'common.white'` vs `'#fff'`

**Decision:** Reemplazar `'#fff'` por `'common.white'`.

**Razon:** Consistencia con la convencion del proyecto. Ambos producen el mismo resultado visual, pero el token permite auditabilidad (grep por hex hardcodeados) y adaptacion futura si se cambia el valor de `common.white` en el tema.

---

## Hardening de seguridad

No aplica. Los cambios son puramente visuales y no introducen superficies de ataque.

### Firestore rules requeridas

N/A.

### Rate limiting

N/A.

### Vectores de ataque mitigados

N/A.

---

## Deuda tecnica: mitigacion incorporada

No hay issues abiertos de seguridad ni tech debt que se puedan resolver en este feature.

Nota: `MenuPhotoSection.tsx` tiene una violacion de service layer (importa `firebase/storage` directamente) documentada en #243. Ese fix esta fuera de scope de este issue que es solo sobre colores hardcodeados.

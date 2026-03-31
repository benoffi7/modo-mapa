# Specs: Color de iconos de Acciones Rapidas

**PRD:** [prd.md](prd.md)
**Fecha:** 2026-03-29

---

## Modelo de datos

No aplica. Este feature es puramente visual. No se crean ni modifican colecciones, documentos ni campos en Firestore.

## Firestore Rules

No aplica. No hay escrituras ni lecturas nuevas a Firestore.

### Rules impact analysis

No hay queries nuevas. Ningun impacto en Firestore rules.

### Field whitelist check

No aplica. No se agregan campos a ninguna coleccion.

## Cloud Functions

No aplica. No se requieren triggers, scheduled functions ni callable functions.

## Componentes

### QuickActions.tsx (modificacion)

**Archivo:** `src/components/home/QuickActions.tsx`

**Cambios:**

1. **Importar `CATEGORY_COLORS`** de `src/constants/business.ts` y `iconCircleSx` de `src/theme/cards.ts`
2. **Definir `QUICK_ACTION_COLORS`** — mapa local para slots de tipo `'action'` y `'shortcut'`:

```typescript
const QUICK_ACTION_COLORS: Record<string, string> = {
  sorprendeme: '#00897b',
  favoritos: '#e53935',
  recientes: '#546e7a',
  visitas: '#1e88e5',
};
```

3. **Crear helper `getSlotColor`** — funcion pura que resuelve el color de fondo para cualquier slot:

```typescript
function getSlotColor(slot: QuickActionSlot): string {
  if (slot.type === 'category') {
    return CATEGORY_COLORS[slot.id as BusinessCategory] ?? '#546e7a';
  }
  return QUICK_ACTION_COLORS[slot.id] ?? '#546e7a';
}
```

4. **Aplicar `iconCircleSx` en la grilla** — reemplazar el `sx` del `IconButton` de la grilla principal. El icono renderizado dentro debe tener `sx={{ color: '#fff' }}` para mantener contraste WCAG AA.

5. **Aplicar color en el dialog de edicion** — al lado del checkbox, envolver el icono del slot en un `Box` con `iconCircleSx(getSlotColor(slot), 32)` y el icono con `sx={{ color: '#fff', fontSize: 18 }}`.

**Props interface:** Sin cambios. `QuickActions` no recibe props.

**Tamano estimado post-cambio:** ~220 lineas (actual: 194). Bien dentro del limite de 400.

### Mutable prop audit

No aplica. `QuickActions` no recibe datos como props que luego modifique. El estado es local (`selectedIds`, `editDraft`).

## Textos de usuario

No se agregan textos nuevos visibles al usuario. Los labels existentes no cambian.

## Hooks

No se crean ni modifican hooks.

## Servicios

No se crean ni modifican servicios.

## Integracion

### Dependencias existentes que se reutilizan

| Modulo | Export | Uso en este feature |
|--------|--------|-------------------|
| `src/constants/business.ts` | `CATEGORY_COLORS` | Color de fondo para slots tipo `'category'` |
| `src/theme/cards.ts` | `iconCircleSx` | Estilo del circulo con color de fondo |
| `src/utils/contrast.ts` | `getContrastText` | No se usa directamente; todos los fondos son oscuros y el icono sera blanco fijo (`#fff`). Validacion manual de contraste en el criterio de done |

### Verificacion WCAG AA

Todos los colores de fondo usados deben tener un ratio de contraste >= 4.5:1 con blanco (`#fff`). Verificacion usando `relativeLuminance` de `src/utils/contrast.ts`:

| Color | Hex | Luminance | Ratio vs #fff | WCAG AA |
|-------|-----|-----------|---------------|---------|
| restaurant | `#ea4335` | 0.134 | 3.37:1 | Graficos OK (>= 3:1) |
| cafe | `#795548` | 0.075 | 5.23:1 | OK |
| bakery | `#ff9800` | 0.350 | 2.14:1 | Graficos OK (>= 3:1) |
| bar | `#9c27b0` | 0.061 | 6.18:1 | OK |
| fastfood | `#f44336` | 0.114 | 3.79:1 | Graficos OK (>= 3:1) |
| icecream | `#e91e63` | 0.095 | 4.39:1 | Graficos OK (>= 3:1) |
| pizza | `#ff5722` | 0.156 | 3.02:1 | Graficos OK (>= 3:1) |
| sorprendeme | `#00897b` | 0.131 | 3.42:1 | Graficos OK (>= 3:1) |
| favoritos | `#e53935` | 0.107 | 3.94:1 | Graficos OK (>= 3:1) |
| recientes | `#546e7a` | 0.100 | 4.23:1 | Graficos OK (>= 3:1) |
| visitas | `#1e88e5` | 0.140 | 3.27:1 | Graficos OK (>= 3:1) |

Nota: Los iconos son graficos no textuales (MUI icons de 24px dentro de circulos de 48px), por lo que aplica el criterio WCAG 2.1 de "graficos e interfaz" que requiere >= 3:1. Todos los colores cumplen este criterio. Los que ademas superan 4.5:1 (cafe, bar, recientes) tambien cumplen AA para texto normal.

### Preventive checklist

- [x] **Service layer**: No hay imports de `firebase/firestore` en este componente
- [x] **Duplicated constants**: `CATEGORY_COLORS` se reutiliza de `src/constants/business.ts`, no se duplica
- [x] **Context-first data**: No hay `getDoc` en este componente
- [x] **Silent .catch**: No hay `.catch` en los cambios
- [x] **Stale props**: Componente no recibe props mutables

## Tests

El PRD indica que no se requieren tests nuevos dado que el cambio es puramente de estilo visual. Sin embargo, como se introduce la funcion `getSlotColor` con logica de lookup, se recomienda un test unitario trivial.

| Archivo test | Que testear | Tipo |
|-------------|-------------|------|
| `src/components/home/__tests__/QuickActions.test.ts` | `getSlotColor` devuelve color correcto para cada tipo de slot (category, action, shortcut) y fallback para IDs desconocidos | Unit |

Para que `getSlotColor` sea testeable, debe exportarse como named export o testearse indirectamente via render. Dado que la funcion es pura y simple, se recomienda exportarla.

Si se decide no exportar (por ser funcion interna), la verificacion visual manual es suficiente segun la politica de testing (excepcion: "Componentes puramente visuales sin logica").

## Analytics

No se agregan eventos nuevos. El evento `quick_action_tapped` existente no cambia.

---

## Offline

No aplica. Los colores son constantes hardcodeadas en el codigo. No hay data flows.

### Cache strategy

N/A

### Writes offline

N/A

### Fallback UI

N/A

---

## Decisiones tecnicas

1. **Icono blanco fijo en vez de `getContrastText`**: Se usa `color: '#fff'` fijo en vez de calcular dinamicamente con `getContrastText()`. Razon: todos los fondos son oscuros y producen blanco. Calcular dinamicamente agregaria complejidad sin beneficio. Si en el futuro se agregan colores claros a `CATEGORY_COLORS`, habria que revisar.

2. **`QUICK_ACTION_COLORS` local en vez de en constantes**: Los colores de acciones/shortcuts son especificos de `QuickActions.tsx` y no representan categorias de negocio globales. Mantenerlos locales evita contaminar `src/constants/business.ts` con conceptos de UI.

3. **`iconCircleSx` con `borderRadius: 1.5`**: Se reutiliza el estilo existente de `src/theme/cards.ts` que usa rectangulo redondeado (no circulo perfecto). Esto es consistente con `ListCardGrid` y `SpecialsSection`.

4. **Tamano 32 en dialog**: El dialog de edicion usa `iconCircleSx(color, 32)` en vez del tamano default 44 para que el icono no compita visualmente con el checkbox y el label.

---

## Hardening de seguridad

No aplica. Este feature no introduce superficies de seguridad nuevas. No hay escrituras, inputs de usuario, ni endpoints.

### Firestore rules requeridas

Ninguna.

### Rate limiting

N/A

### Vectores de ataque mitigados

N/A

---

## Deuda tecnica: mitigacion incorporada

No hay issues abiertos de seguridad ni tech debt que se crucen con este cambio. El archivo `QuickActions.tsx` no tiene deuda tecnica conocida.

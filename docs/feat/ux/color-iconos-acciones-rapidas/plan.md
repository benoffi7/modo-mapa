# Plan: Color de iconos de Acciones Rapidas

**Specs:** [specs.md](specs.md)
**Fecha:** 2026-03-29

---

## Fases de implementacion

### Fase 1: Colorear iconos en grilla y dialog

**Branch:** `feat/235-color-quick-actions`

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/components/home/QuickActions.tsx` | Agregar imports: `CATEGORY_COLORS` de `../../constants/business`, `iconCircleSx` de `../../theme/cards` |
| 2 | `src/components/home/QuickActions.tsx` | Definir `QUICK_ACTION_COLORS` record local con los 4 colores para `sorprendeme`, `favoritos`, `recientes`, `visitas` |
| 3 | `src/components/home/QuickActions.tsx` | Crear funcion `getSlotColor(slot: QuickActionSlot): string` que resuelva color segun `slot.type` y `slot.id`. Exportar como named export para testabilidad |
| 4 | `src/components/home/QuickActions.tsx` | En la grilla principal: reemplazar `sx={{ bgcolor: 'action.hover', width: 48, height: 48 }}` del `IconButton` por `sx={{ ...iconCircleSx(getSlotColor(slot), 48) }}`. Agregar `sx={{ color: '#fff' }}` al `{slot.icon}` clonandolo con `React.cloneElement` o wrappando en un `Box` con `sx={{ color: '#fff', display: 'flex' }}` |
| 5 | `src/components/home/QuickActions.tsx` | En el dialog de edicion: dentro del `label` del `FormControlLabel`, envolver `{slot.icon}` en un `Box` con `sx={{ ...iconCircleSx(getSlotColor(slot), 32), color: '#fff' }}` y ajustar el icono a `fontSize: 18` |

### Fase 2: Test unitario (opcional pero recomendado)

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/components/home/__tests__/QuickActions.test.ts` | Crear test file. Importar `getSlotColor` y `ALL_AVAILABLE_SLOTS` (si se exporta) o crear slots de prueba inline. Testear: (a) slots de categoria devuelven `CATEGORY_COLORS[id]`, (b) slots de action/shortcut devuelven `QUICK_ACTION_COLORS[id]`, (c) ID desconocido devuelve fallback `#546e7a` |

### Fase 3: Documentacion

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `docs/reference/design-system.md` | Agregar nota sobre uso de `iconCircleSx` + `CATEGORY_COLORS` en QuickActions, consistente con ForYouSection |

---

## Orden de implementacion

1. `src/components/home/QuickActions.tsx` — todos los cambios estan en un solo archivo
2. `src/components/home/__tests__/QuickActions.test.ts` — test de la funcion exportada (depende del paso anterior)
3. `docs/reference/design-system.md` — documentacion (independiente)

---

## Estimacion de tamano de archivos

| Archivo | Lineas actuales | Lineas estimadas | Dentro de limite |
|---------|----------------|-----------------|-----------------|
| `src/components/home/QuickActions.tsx` | 194 | ~220 | Si (< 400) |
| `src/components/home/__tests__/QuickActions.test.ts` | nuevo | ~30 | Si (< 400) |

## Riesgos

1. **Iconos sin `sx` prop directa**: Los iconos en `CATEGORY_ICONS` y los de action/shortcut se renderizan como `<RestaurantIcon />` sin `sx`. Para aplicar `color: '#fff'`, hay dos opciones: (a) usar `React.cloneElement(slot.icon, { sx: { color: '#fff' } })` o (b) envolver en un `Box` con `color: '#fff'` que se hereda via CSS. Opcion (b) es mas simple y no depende de merge de sx. **Mitigacion:** usar `Box` wrapper con `sx={{ color: '#fff', display: 'flex' }}`.

2. **Colores claros con bajo contraste**: `bakery` (`#ff9800`) tiene ratio 2.14:1 con blanco, que esta por debajo del 3:1 para graficos. Sin embargo, es el mismo color usado en `ForYouSection` actualmente sin quejas. **Mitigacion:** aceptar por consistencia con `ForYouSection`; si se decide mejorar, ajustar en `CATEGORY_COLORS` global (fuera de scope de este issue).

3. **`iconCircleSx` devuelve `borderRadius: 1.5`** (rectangulo redondeado): El estado actual usa `IconButton` con fondo circular implicito. Cambiar a `iconCircleSx` cambia la forma a rectangulo redondeado. **Mitigacion:** esto es intencional para consistencia con el design system (`ListCardGrid`, `SpecialsSection`, `ForYouSection`).

## Guardrails de modularidad

- [x] Ningun componente nuevo importa `firebase/firestore` directamente
- [x] Archivos nuevos en carpeta de dominio correcta (`components/home/`)
- [x] Logica de negocio en hooks/services, no en componentes (no hay logica de negocio nueva)
- [x] Si se toca un archivo con deuda tecnica, se incluye el fix en el plan (no hay deuda conocida)
- [x] Ningun archivo resultante supera 400 lineas

## Fase final: Documentacion (OBLIGATORIA)

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `docs/reference/design-system.md` | Documentar uso de `iconCircleSx` + `CATEGORY_COLORS` en QuickActions para consistencia con ForYouSection |

Los demas archivos de referencia no requieren actualizacion:

- `security.md` — no se modificaron rules, rate limits, auth ni storage rules
- `firestore.md` — no se agregaron/modificaron colecciones ni campos
- `features.md` — mejora visual menor, no funcionalidad nueva
- `patterns.md` — no se agrego un patron nuevo

## Criterios de done

- [ ] Cada icono de categoria en la grilla usa `CATEGORY_COLORS` como fondo
- [ ] Iconos de accion/shortcut usan `QUICK_ACTION_COLORS` como fondo
- [ ] Todos los iconos se renderizan en blanco sobre el fondo de color
- [ ] El dialog de edicion muestra iconos con su color correspondiente (tamano 32)
- [ ] La apariencia es consistente con `ForYouSection` en la misma pantalla Home
- [ ] `getSlotColor` tiene test unitario (o se documenta la excepcion)
- [ ] No hay lint errors
- [ ] Build succeeds
- [ ] `docs/reference/design-system.md` actualizado

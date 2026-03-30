# PRD: Agregar color a iconos de Acciones Rapidas en Home

**Feature:** color-iconos-acciones-rapidas
**Categoria:** ux
**Fecha:** 2026-03-29
**Issue:** #235
**Prioridad:** Media

---

## Contexto

La app Modo Mapa necesita mas color en su interfaz. Los iconos de acciones rapidas en el Home screen (`QuickActions.tsx`) actualmente usan `bgcolor: 'action.hover'` (gris del tema) para todos los iconos, sin diferenciacion visual entre categorias. Mientras tanto, `ForYouSection` ya usa `CATEGORY_COLORS` de `src/constants/business.ts` para colorear los fondos de iconos de sugerencias, creando una inconsistencia visual en la misma pantalla.

## Problema

- Los iconos de acciones rapidas se ven monocromaticos y poco atractivos, todos con el mismo fondo gris `action.hover`
- No hay diferenciacion visual entre categorias (restaurant, cafe, bar, etc.) en la grilla de acciones rapidas, dificultando la identificacion rapida
- Existe inconsistencia con `ForYouSection` que ya usa colores por categoria en la misma pantalla Home

## Solucion

### S1. Colorear iconos de categoria

Usar `CATEGORY_COLORS` de `src/constants/business.ts` para asignar un color de fondo a cada icono de tipo `'category'` en la grilla de acciones rapidas. El patron ya existe en `ForYouSection` (linea 47: `const bgColor = CATEGORY_COLORS[cat] ?? '#546e7a'`).

Reutilizar `iconCircleSx` de `src/theme/cards.ts` para el estilo del circulo coloreado, que ya esta documentado como usado en QuickActions.

El icono dentro del circulo debe renderizarse en blanco (`color: '#fff'`) para mantener contraste WCAG AA sobre los fondos de color.

### S2. Colorear iconos de accion y shortcut

Para los slots de tipo `'action'` y `'shortcut'` (Sorpresa, Favoritos, Recientes, Visitas), definir un mapa `QUICK_ACTION_COLORS` dentro de `QuickActions.tsx` con colores apropiados:

- `sorprendeme`: un color que transmita aleatoriedad/diversión (ej: `#00897b` teal)
- `favoritos`: rojo corazon (`#e53935`)
- `recientes`: azul grisaceo (`#546e7a`)
- `visitas`: azul (`#1e88e5`)

Estos colores son locales al componente porque no representan categorias de negocio globales.

### S3. Propagar color al dialog de edicion

En el dialog de edicion de acciones rapidas, mostrar el icono con su color de fondo al lado del checkbox para que el usuario vea como se vera cada opcion. Usar una version mas pequena del `iconCircleSx` (size 32 en vez de 48).

---

## Scope

| Item | Prioridad | Esfuerzo |
|------|-----------|----------|
| S1. Aplicar `CATEGORY_COLORS` + `iconCircleSx` a iconos de categoria | Must | S |
| S2. Definir y aplicar colores para acciones/shortcuts | Must | S |
| S3. Colorear iconos en dialog de edicion | Should | S |

**Esfuerzo total estimado:** S

---

## Out of Scope

- Cambiar los colores definidos en `CATEGORY_COLORS` (son globales y usados en otros componentes)
- Agregar animaciones o transiciones a los iconos
- Modificar el layout de la grilla de acciones rapidas (4 columnas, 8 slots)
- Tema dark mode custom para estos colores (deben funcionar con la opacidad/alpha que ya maneja `iconCircleSx`)

---

## Tests

Este feature es predominantemente visual (cambio de estilos CSS). No introduce logica condicional nueva, validaciones de input ni side effects. La unica logica nueva es el mapeo de slot ID a color, que es un lookup trivial en un Record.

### Archivos que necesitaran tests

| Archivo | Tipo | Que testear |
|---------|------|-------------|
| `src/components/home/QuickActions.tsx` | Componente | No requiere tests nuevos — el cambio es puramente de `sx` props. La logica de `handleTap`, `loadConfig`, `saveConfig` ya existe y no cambia. |

### Criterios de testing

- No se requieren tests nuevos. El cambio es de estilo visual sin logica condicional nueva.
- Si se extrae una funcion `getSlotColor(slot: QuickActionSlot): string`, esa funcion si necesitaria un test unitario trivial (lookup en map).
- Los tests existentes del componente (si hubiera) no deberian romperse.
- Verificacion manual: confirmar contraste WCAG AA de iconos blancos sobre cada color de fondo usando `contrast.ts` existente.

---

## Seguridad

Este feature no introduce superficies de seguridad nuevas. No hay escrituras a Firestore, no hay inputs de usuario, no hay endpoints nuevos.

- [x] No aplica — feature puramente visual (CSS/styling)

### Vectores de ataque automatizado

No aplica. El feature no expone superficies nuevas (no hay endpoints, no hay escrituras, no hay datos de usuario involucrados).

---

## Deuda tecnica y seguridad

No hay issues abiertos de seguridad ni tech debt en el repositorio.

### Issues relacionados

| Issue | Relacion | Accion |
|-------|----------|--------|
| N/A | — | No hay issues de deuda tecnica que se crucen con este cambio |

### Mitigacion incorporada

Ninguna necesaria. El cambio es autocontenido en un solo componente visual.

---

## Offline

### Data flows

| Operacion | Tipo (read/write) | Estrategia offline | Fallback UI |
|-----------|-------------------|-------------------|-------------|
| N/A | — | — | — |

Este feature no tiene data flows. Los colores son constantes hardcodeadas en el codigo, no vienen de Firestore ni de APIs externas.

### Checklist offline

- [x] No aplica — feature puramente visual sin data flows

### Esfuerzo offline adicional: N/A

---

## Modularizacion y % monolitico

### Checklist modularizacion

- [x] Logica de negocio en hooks/services — no hay logica de negocio nueva
- [x] Componentes nuevos son reutilizables — no se crean componentes nuevos
- [x] No se agregan useState de logica de negocio a AppShell o SideMenu
- [x] Props explicitas en vez de dependencias implicitas a contextos de layout
- [x] Ningun componente nuevo importa directamente de `firebase/firestore`
- [x] Archivos nuevos van en carpeta de dominio correcta — no se crean archivos nuevos
- [x] Ningun archivo nuevo supera 400 lineas

### Impacto en % monolitico

| Aspecto | Impacto | Justificacion |
|---------|---------|---------------|
| Acoplamiento de componentes | = | Cambio contenido en QuickActions.tsx, no agrega imports cruzados |
| Estado global | = | No toca estado global |
| Firebase coupling | = | No toca Firebase |
| Organizacion por dominio | = | Archivo ya esta en `components/home/` |

---

## Success Criteria

1. Cada icono de categoria en la grilla de acciones rapidas tiene un color de fondo distintivo que coincide con `CATEGORY_COLORS`
2. Los iconos de accion (Sorpresa) y shortcut (Favoritos, Recientes, Visitas) tienen colores de fondo distintivos y apropiados
3. Todos los iconos mantienen contraste WCAG AA (iconos blancos sobre fondo de color)
4. El dialog de edicion de acciones muestra los iconos con su color correspondiente
5. La apariencia es visualmente consistente con `ForYouSection` en la misma pantalla Home

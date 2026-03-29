# Design System v2

Tokens y estilos reutilizables para la app con navegacion por tabs.

## Archivos

| Archivo | Contenido |
|---------|-----------|
| `src/theme/cards.ts` | Estilos de cards, iconos, botones |
| `src/constants/ui.ts` | NAV_CHIP_SX, colores de charts, link add business |
| `src/constants/avatars.ts` | Biblioteca de 20 avatares (emojis animales) |
| `src/constants/listIcons.ts` | Biblioteca de 30 iconos para listas (emojis) |
| `src/components/lists/ColorPicker.tsx` | 8 colores + sanitizeListColor() |

## Tokens de cards (`theme/cards.ts`)

### `cardSx`
Card con borde estandar. Usado en: FavoritesList, FollowedList, ReceivedRecommendations, SpecialsSection, SettingsMenu, ListCardGrid.

```typescript
import { cardSx } from '../../theme/cards';
<Box sx={cardSx}>...</Box>
// o con overrides:
<Box sx={{ ...cardSx, display: 'flex', gap: 1 }}>...</Box>
```

### `iconCircleSx(color, size?)`
Circulo con color de fondo para iconos. Usado en: ListCardGrid, SpecialsSection.

```typescript
import { iconCircleSx } from '../../theme/cards';
<Box sx={iconCircleSx('#1e88e5')}>icon</Box>
<Box sx={iconCircleSx('#fb8c00', 40)}>icon</Box> // custom size
```

### `dashedButtonSx`
Boton con borde dashed. Usado en: ListCardGrid ("Crear nueva lista").

```typescript
import { dashedButtonSx } from '../../theme/cards';
<Button sx={{ ...dashedButtonSx, mt: 2 }}>+ Crear</Button>
```

## Tokens de chips (`constants/ui.ts`)

### `NAV_CHIP_SX`
Estilo compartido para chips de navegacion (sub-tabs). Usado en: ListsScreen, SocialScreen, RankingsView.

```typescript
import { NAV_CHIP_SX } from '../../constants/ui';
<Chip sx={{ ...NAV_CHIP_SX, fontWeight: isActive ? 600 : 400 }} />
```

## Colores de listas

### `LIST_COLORS` + `sanitizeListColor()`
8 colores seguros para fondos de iconos de listas. Validados contra whitelist.

```typescript
import { sanitizeListColor, LIST_COLORS } from '../lists/ColorPicker';
const safeColor = sanitizeListColor(list.color); // returns default if invalid
```

## Iconos de listas

### `getListIconById(id)`
Busca icono por ID validando contra whitelist.

```typescript
import { getListIconById } from '../../constants/listIcons';
const icon = getListIconById('coffee'); // { id, label, emoji } or undefined
```

## Avatares

### `getAvatarById(id)`
Busca avatar por ID.

```typescript
import { getAvatarById } from '../../constants/avatars';
const avatar = getAvatarById('cat'); // { id, label, emoji } or undefined
```

## Modularizacion completada

Los archivos >400 lineas fueron modularizados:

| Archivo original | Accion | Resultado |
|------------------|--------|-----------|
| CommentsList.tsx (592) | Extraido `CommentsListItem.tsx` (renombrado de CommentItem) | 378 + 226 lineas |
| BusinessComments.tsx (523) | Extraido `InlineReplyForm.tsx` compartido (activo, usado por Comments y Questions) | 467 lineas |
| BusinessQuestions.tsx (507) | Usa `InlineReplyForm.tsx` compartido | 459 lineas |
| admin.ts (517) | Split en `admin/counters`, `activity`, `users`, `social`, `content` | 5 modulos (26-199 lineas) |
| converters.ts (497) | Data layer, sin cambios | pendiente |

## Cobertura de tests

| Metrica | Valor |
|---------|-------|
| Statements | 88.69% |
| Branches | 80.43% |
| Functions | 78.43% |
| Lines | 90.69% |

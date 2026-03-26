# PRD #158d — Refactor SharedListsView: grilla de cards + detalle

## Contexto

SharedListsView es el componente mas complejo del SideMenu legacy. Actualmente usa lista expandible (click expande inline). El mockup v2 muestra grilla de 2 columnas con cards visuales. Al tocar una card se navega a una pantalla de detalle (no expand inline).

## Requisitos

### Grilla de listas (vista principal)

- Grilla 2 columnas
- Cada card:
  - Icono de la lista (del IconPicker) sobre fondo de color (paleta simple de ~8 colores)
  - Titulo de la lista
  - "X lugares" en texto secundario
- Boton "+ Crear nueva lista" full-width sticky abajo con borde dashed
- Sin expand/collapse: click en card navega a detalle

### Detalle de lista (sub-pantalla)

- Header con flecha atras + titulo de la lista
- Acciones: cambiar nombre, cambiar privacidad (publico/privado), compartir, invitar editores, eliminar
- Lista de comercios con opcion de quitar
- Boton agregar comercio (navega a Buscar)

### Icono + Color

- Al crear o editar lista, mostrar IconPicker (ya existe) + selector de color (8 colores basicos)
- Nuevos campos en Firestore: `icon: string` (ya en specs), `color: string` (nuevo)
- Default: icono "bookmark", color azul

### Modelo de datos

Agregar a `sharedLists/{listId}`:
```typescript
icon?: string;   // ID del icono (de LIST_ICON_OPTIONS)
color?: string;  // hex color del fondo del icono
```

## Archivos a crear

| Archivo | Descripcion |
|---------|-------------|
| `src/components/lists/ListCardGrid.tsx` | Grilla 2 columnas de cards |
| `src/components/lists/ListDetailScreen.tsx` | Pantalla de detalle con CRUD |
| `src/components/lists/ColorPicker.tsx` | Selector simple de 8 colores |

## Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `src/components/menu/SharedListsView.tsx` | Refactor completo: reemplazar expand por grid + detail navigation |
| `src/components/menu/CreateListDialog.tsx` | Agregar IconPicker + ColorPicker |
| `src/services/sharedLists.ts` | Agregar updateListIcon, updateListColor |
| `firestore.rules` | Permitir icon/color en sharedLists update |

### Tab Colaborativas (CollaborativeTab)

- Misma grilla 2 columnas que Listas propias
- Cards con icono + color + titulo + "X lugares"
- Al tocar, misma pantalla de detalle pero sin opciones de edicion (solo ver comercios)
- Renombrar tab de "Colab." a "Social" (para evitar texto cortado)

## Fuera de scope

- Featured lists (se mantienen como scroll horizontal arriba)
- Drag-and-drop reorder de comercios dentro de la lista

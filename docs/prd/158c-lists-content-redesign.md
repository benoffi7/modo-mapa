# PRD #158c — Rediseno visual del contenido de Listas

## Contexto

La navegacion por tabs esta implementada (issue #158). Los componentes internos de Listas (FavoritesList, SharedListsView) mantienen el diseno visual de la v1. Los mockups muestran cards con mas informacion visual, grilla de listas con iconos de color, y un boton de crear lista sticky.

## Requisitos

### Sub-tab: Favoritos (FavoritesList)

Cada item debe ser una card (no list item) con:
- Nombre del comercio en bold + corazon rojo al lado
- Categoria en cyan debajo
- Separador
- Estrella + rating + icono pin + distancia + "X visitas"
- Menu "..." a la derecha (opciones: quitar favorito, ver en mapa)

### Sub-tab: Listas (SharedListsView)

Vista grilla 2 columnas:
- Cada card vertical con:
  - Icono de color (del IconPicker) sobre fondo de color
  - Titulo de la lista
  - "X lugares"
  - Icono candado/mundo para privacidad
- Boton "Crear nueva lista" full-width sticky abajo con icono +
- El boton + del header abre el mismo dialog de crear lista

### Sub-tab: Recientes (RecentsUnifiedTab)

Cada item como card con:
- Nombre del comercio
- Tipo de actividad (visita/check-in) con icono
- Tiempo relativo
- Categoria

## Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `src/components/menu/FavoritesList.tsx` | Rediseno a cards con rating, distancia, visitas |
| `src/components/menu/SharedListsView.tsx` | Grilla 2 columnas con cards de icono + boton sticky |
| `src/components/lists/RecentsUnifiedTab.tsx` | Cards en vez de list items |
| `src/components/lists/ListsScreen.tsx` | Conectar boton + del header a crear lista |

## Fuera de scope

- IconPicker ya existe, solo falta wiring a SharedListsView/CreateListDialog
- Logica de CRUD de listas (ya funciona)

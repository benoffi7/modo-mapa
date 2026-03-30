# PRD #158b — Rediseno visual del contenido de Social

## Contexto

La navegacion por tabs esta implementada (issue #158). Los componentes internos de Social (ActivityFeedView, FollowedList, ReceivedRecommendations) mantienen el diseno visual de la v1 (lista plana). Los mockups muestran un diseno mas rico con cards, avatares, interacciones y datos adicionales.

## Requisitos

### Sub-tab: Actividad (ActivityFeedView)

Cada item del feed debe ser una card con:
- Avatar del usuario (iniciales en circulo de color) a la izquierda
- Texto: **[Nombre]** [accion] **[Comercio]** (nombre comercio en cyan/primary)
- Estrella + rating + "hace Xh"
- Placeholder de mapa/imagen del comercio (area gris con icono pin)
- Footer: corazon + count, comentario + count, compartir

### Sub-tab: Seguidos (FollowedList)

Cada item debe ser una card con:
- Avatar del usuario (iniciales en circulo de color) a la izquierda
- Nombre del usuario en bold
- Subtexto: "X lugares - Y seguidores"
- Boton "Siguiendo" a la derecha (outlined, toggle a "Seguir" al dejar de seguir)

### Sub-tab: Recomendaciones (ReceivedRecommendations)

Cada item debe ser una card con:
- Nombre del comercio en bold + estrella + rating a la derecha
- Categoria en cyan debajo del nombre
- Separador
- Icono pin + distancia + "Recomendado por X personas"

## Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `src/components/menu/ActivityFeedView.tsx` | Rediseno visual de cada item del feed |
| `src/components/menu/FollowedList.tsx` | Rediseno visual de cada item de seguidos |
| `src/components/menu/ReceivedRecommendations.tsx` | Rediseno visual de cada recomendacion |

## Fuera de scope

- Logica de datos (ya funciona)
- Navegacion (ya funciona con useNavigateToBusiness)
- Like/comment/share en feed (funcionalidad nueva, otro issue)
- Foto real del comercio (no tenemos imagenes de portada)

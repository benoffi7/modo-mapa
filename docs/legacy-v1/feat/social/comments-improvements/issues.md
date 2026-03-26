# Comentarios (Menú Lateral) - Issues de Mejora

Fecha: 2026-03-14

## Lista de Issues

| # | Issue | Descripcion | Complejidad |
|---|-------|-------------|-------------|
| #101 | [Filtrar por comercio](https://github.com/benoffi7/modo-mapa/issues/101) | Autocomplete para filtrar comentarios por comercio especifico | Media |
| #102 | [Busqueda de texto](https://github.com/benoffi7/modo-mapa/issues/102) | Campo de busqueda con debounce para encontrar comentarios por texto | Baja |
| #103 | [Ordenamiento multiple](https://github.com/benoffi7/modo-mapa/issues/103) | Chips para ordenar: Recientes, Antiguos, Mas likes | Baja |
| #104 | [Mostrar likes recibidos](https://github.com/benoffi7/modo-mapa/issues/104) | Badge con cantidad de likes en cada comentario de la lista | Baja |
| #105 | [Indicador de respuestas](https://github.com/benoffi7/modo-mapa/issues/105) | Badge de replies + indicador de respuestas nuevas no leidas | Media |
| #106 | [Editar inline](https://github.com/benoffi7/modo-mapa/issues/106) | Editar comentarios directamente desde el menu sin navegar al comercio | Media |
| #107 | [Stats resumen](https://github.com/benoffi7/modo-mapa/issues/107) | Card con total comentarios, likes recibidos, promedio, mas popular | Media |
| #108 | [Preview mejorado](https://github.com/benoffi7/modo-mapa/issues/108) | Mas contexto: categoria, replies, fecha relativa, indicador editado | Baja |
| #109 | [Swipe actions (mobile)](https://github.com/benoffi7/modo-mapa/issues/109) | Gestos swipe left/right para eliminar/editar en mobile | Media |
| #110 | [Skeleton loader](https://github.com/benoffi7/modo-mapa/issues/110) | Loading state con skeletons MUI consistente con el resto de la app | Baja |
| #111 | [Empty state mejorado](https://github.com/benoffi7/modo-mapa/issues/111) | Empty state motivacional con CTA para dejar primer comentario | Baja |
| #112 | [Virtualizacion](https://github.com/benoffi7/modo-mapa/issues/112) | react-window/tanstack-virtual para listas largas (50+ items) | Media |

## Orden sugerido de implementacion

### Quick wins (baja complejidad)

1. #110 - Skeleton loader
2. #111 - Empty state mejorado
3. #108 - Preview mejorado
4. #102 - Busqueda de texto
5. #103 - Ordenamiento multiple
6. #104 - Mostrar likes recibidos

### Mejoras core (media complejidad)

1. #106 - Editar inline
2. #105 - Indicador de respuestas
3. #101 - Filtrar por comercio
4. #107 - Stats resumen
5. #112 - Virtualizacion

### UX avanzada (media complejidad, mas riesgo)

1. #109 - Swipe actions (mobile)

## Archivo principal afectado

Todos los issues impactan `src/components/menu/CommentsList.tsx` como archivo central.

## Relacion con otros features

- **comments-2.0** (#45, #46): Editar/likes/orden ya implementados en BusinessComments. Estos issues extienden esas capacidades al menu lateral.
- **Usability report** (2026-03-14): Issues #110, #111, #112 salen directamente del reporte de usabilidad.

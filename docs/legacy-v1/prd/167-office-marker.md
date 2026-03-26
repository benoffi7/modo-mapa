# PRD #167 — Marker fijo de oficina + FAB ir a oficina

## Contexto

Los usuarios son empleados que trabajan en una oficina fija. Tener la oficina marcada en el mapa y un acceso rapido para centrar ahi ayuda a planificar almuerzos/salidas cercanas.

## Requisitos

### Marker de oficina
- Marker fijo en -34.5591511, -58.4473681
- Icono diferenciado: usar `BusinessIcon` (edificio) o `ApartmentIcon` en color azul corporativo
- Siempre visible, no confundir con markers de comercios
- Al hacer click muestra tooltip "Oficina"
- No abre BusinessSheet (no es un comercio)

### FAB "Ir a oficina"
- Boton flotante en el mapa, posicionado a la izquierda del FAB de geolocalizacion existente
- Icono: `BusinessIcon` o `ApartmentIcon`
- Al hacer click: centra mapa en coordenadas de oficina con zoom 15
- Estilo consistente con LocationFAB (mismo tamano, background paper)

## Archivos a crear/modificar

| Archivo | Accion |
|---------|--------|
| `src/constants/map.ts` | Agregar `OFFICE_LOCATION` |
| `src/components/map/OfficeMarker.tsx` | Nuevo — marker con AdvancedMarker + icono custom |
| `src/components/map/OfficeFAB.tsx` | Nuevo — FAB para centrar en oficina |
| `src/components/map/MapView.tsx` | Renderizar OfficeMarker |
| `src/components/layout/AppShell.tsx` | Renderizar OfficeFAB |

## Patron a seguir

- OfficeMarker: similar a BusinessMarker pero con icono fijo, sin props dinamicos
- OfficeFAB: similar a LocationFAB pero sin estado de loading, solo panea el mapa

## Tests

- OfficeMarker renderiza sin errores
- OfficeFAB click llama a map.panTo con coordenadas correctas
- Constante OFFICE_LOCATION tiene valores correctos

## Fuera de scope

- Configurar ubicacion de oficina por usuario (hardcoded por ahora)
- Multiples oficinas

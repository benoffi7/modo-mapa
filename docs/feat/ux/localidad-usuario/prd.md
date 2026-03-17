# PRD: Localidad del usuario — ubicación por defecto

**Feature:** localidad-usuario
**Categoria:** ux / geo
**Fecha:** 2026-03-17
**Issue:** [#154](https://github.com/benoffi7/modo-mapa/issues/154)
**Prioridad:** Media

---

## Contexto

Los empleados están distribuidos en distintas ciudades de Argentina. Sin GPS activado, el mapa se centra en Buenos Aires y el Sorpréndeme devuelve comercios random sin considerar proximidad. Un campo de localidad opcional resolvería esto.

## Problema

- Sin GPS, el mapa siempre se centra en CABA (-34.6037, -58.3816).
- El Sorpréndeme sin GPS no tiene criterio de proximidad.
- Las sugerencias personalizadas no pueden considerar cercanía sin ubicación.
- No hay forma de saber la distribución geográfica de los usuarios.

## Solución

### S1: Campo de localidad en perfil

- Campo opcional al crear cuenta o en Configuración: "¿En qué zona estás?"
- Autocomplete con ciudades/barrios de Argentina (lista estática o Google Places Autocomplete).
- Guardar `locality: string` y `localityCoords: { lat: number, lng: number }` en `userSettings`.

### S2: Prioridad de ubicación

Orden de fallback para centrar el mapa y filtrar por cercanía:
1. GPS (si disponible y permitido)
2. Localidad elegida por el usuario
3. Buenos Aires (default)

### S3: Integración con features existentes

- **Mapa**: centrar en localidad del usuario al abrir si no hay GPS.
- **Sorpréndeme**: usar localidad como centro de radio si no hay GPS.
- **Sugerencias**: usar localidad para scoring de cercanía.
- **Distancia al usuario**: mostrar distancia desde localidad si no hay GPS.

### S4: Almacenamiento

- Campos en `userSettings`: `locality?: string`, `localityCoords?: { lat: number; lng: number }`.
- Coordenadas resueltas con geocoding al seleccionar la localidad.
- Cache local en `MapContext` para no re-leer en cada render.

---

## Scope

| Item | Prioridad | Esfuerzo |
|------|-----------|----------|
| Campo localidad en Configuración | Alta | S |
| Autocomplete de ciudades argentinas | Alta | M |
| Guardar en userSettings | Alta | S |
| Fallback de ubicación en MapContext | Alta | S |
| Integración Sorpréndeme | Media | S |
| Integración Sugerencias | Media | S |
| Geocoding de localidad → coordenadas | Alta | S |

**Esfuerzo total estimado:** M

---

## Out of Scope

- Detección automática de localidad por IP.
- Múltiples localidades por usuario.
- Localidades fuera de Argentina.
- Mapa de calor de distribución geográfica (se puede hacer después con los datos).

---

## Success Criteria

1. El usuario puede elegir su localidad desde Configuración.
2. Sin GPS, el mapa se centra en la localidad elegida.
3. El Sorpréndeme usa la localidad como centro de radio cuando no hay GPS.
4. Las sugerencias consideran la localidad para el scoring de cercanía.
5. El campo es opcional y no bloquea ningún flujo existente.

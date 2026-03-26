# PRD: Fotos del local — galería colaborativa

**Feature:** fotos-local
**Categoria:** content
**Fecha:** 2026-03-16
**Issue:** #141
**Prioridad:** Media

---

## Contexto

Actualmente existe la funcionalidad de fotos de menú (menu-photos-history) que permite subir fotos del menú del comercio. Sin embargo, no hay una galería general para fotos del local (fachada, interior, ambiente, platos).

## Problema

- Los usuarios solo pueden subir fotos del menú, no del local en general.
- No hay forma visual de conocer el ambiente de un lugar antes de visitarlo.
- Fotos del local son uno de los factores principales en la decisión de visita.

## Solución

### S1: Galería de fotos en BusinessSheet

- Sección "Fotos" en el BusinessSheet que muestra fotos del local subidas por usuarios.
- Carrusel horizontal con preview y vista fullscreen al tocar.
- Separar de fotos de menú (tabs: "Local" | "Menú").

### S2: Subir fotos

- Botón "Agregar foto" en la galería.
- Selección desde cámara o galería del dispositivo.
- Compresión client-side antes de upload a Firebase Storage.
- Rate limit: máx 3 fotos por usuario por comercio por día.

### S3: Moderación

- Las fotos pasan por revisión (flag manual o auto-moderación futura).
- Los admins pueden eliminar fotos inapropiadas.
- Reportar foto (usuarios pueden flaggear contenido).

---

## Scope

| Item | Prioridad | Esfuerzo |
|------|-----------|----------|
| Modelo de datos (colección businessPhotos) | Alta | S |
| UI galería en BusinessSheet | Alta | M |
| Upload de fotos con compresión | Alta | M |
| Vista fullscreen | Media | S |
| Moderación y reportes | Media | M |
| Rate limit de uploads | Alta | S |

**Esfuerzo total estimado:** L

---

## Out of Scope

- Reconocimiento automático de contenido (IA/ML).
- Fotos geolocalizadas con validación de ubicación.
- Videos del local.
- Fotos 360°.
- Edición/filtros de fotos dentro de la app.

---

## Success Criteria

1. Los usuarios pueden subir fotos del local desde el BusinessSheet.
2. La galería muestra fotos separadas de las fotos de menú.
3. Las fotos se comprimen antes del upload.
4. Rate limit funciona correctamente (3/usuario/comercio/día).
5. Los admins pueden moderar y eliminar fotos.

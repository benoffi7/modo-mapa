# PRD: Listas sugeridas por la plataforma

**Feature:** listas-sugeridas
**Categoria:** social
**Fecha:** 2026-03-17
**Issue:** [#156](https://github.com/benoffi7/modo-mapa/issues/156)
**Prioridad:** Media

---

## Contexto

Las listas compartidas (v2.13.0) son creadas por usuarios. No existen listas curadas por la plataforma que ayuden a descubrir comercios organizados por temática.

## Problema

- Los usuarios nuevos no tienen listas para explorar.
- No hay contenido curado que facilite el descubrimiento de comercios.
- Las listas de otros usuarios no son visibles a menos que compartan el link.

## Solución

### S1: Listas curadas por admin

- El admin puede marcar listas como "sugeridas" desde el panel admin.
- Campo `featured: boolean` en el documento de lista.
- Las listas sugeridas aparecen en una sección destacada en Mis Listas para todos los usuarios.

### S2: Listas generadas automáticamente

- Generar listas basadas en datos existentes:
  - "Top 10 más calificados" (por promedio de rating)
  - "Más comentados" (por cantidad de comentarios)
  - "Favoritos de la comunidad" (por cantidad de favoritos)
- Generación via Cloud Function scheduled (semanal).
- Se distinguen visualmente de las listas de usuario (badge "Destacada").

### S3: UI en sección de listas

- Sección "Destacadas" arriba de "Mis Listas" en el SideMenu.
- Cards horizontales scrolleables con nombre, descripción corta y cantidad de comercios.
- Click abre la lista en formato similar a lista compartida (read-only para el usuario).

---

## Scope

| Item | Prioridad | Esfuerzo |
|------|-----------|----------|
| Campo featured en listas | Alta | XS |
| Sección destacadas en UI | Alta | S |
| Admin toggle para marcar lista como sugerida | Alta | S |
| Cloud Function para generar listas automáticas | Media | M |
| Cards horizontales con scroll | Media | S |

**Esfuerzo total estimado:** M

---

## Out of Scope

- Listas personalizadas basadas en preferencias del usuario (requiere recomendación engine).
- Listas por localidad/zona.
- Votar o calificar listas.
- Listas patrocinadas o promocionadas.

---

## Success Criteria

1. Existen al menos 3 listas sugeridas visibles para todos los usuarios.
2. El admin puede marcar/desmarcar listas como sugeridas.
3. Las listas automáticas se regeneran semanalmente.
4. Las listas sugeridas aparecen en la sección destacada del menú.
5. Los usuarios pueden copiar una lista sugerida a sus propias listas.

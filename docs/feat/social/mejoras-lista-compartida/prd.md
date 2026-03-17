# PRD: Mejoras en vista de lista compartida

**Feature:** mejoras-lista-compartida
**Categoria:** social
**Fecha:** 2026-03-17
**Issue:** [#160](https://github.com/benoffi7/modo-mapa/issues/160)
**Prioridad:** Media

---

## Contexto

Las listas compartidas (v2.13.0, #142) permiten compartir comercios via deep link. Sin embargo, la interacción del receptor es limitada: al tocar un comercio se pierde la vista de la lista y no hay forma de copiar la lista o marcar favoritos en bloque.

## Problema

- Al tocar un comercio desde una lista compartida, el BusinessSheet se abre y la lista desaparece — hay que volver a usar el link.
- No se puede copiar una lista ajena a las propias listas del usuario.
- No se pueden marcar favoritos masivamente desde la vista de lista compartida.

## Solución

### S1: Persistir la lista compartida

- Guardar el `listId` en estado de la app para que al cerrar el BusinessSheet se vuelva a mostrar la lista.
- Al volver al menú lateral, la lista compartida sigue visible hasta que el usuario la cierre explícitamente.

### S2: Botón "Copiar lista"

- Botón en el header de la vista de lista compartida.
- Crea una copia de la lista en las listas del usuario (nuevo documento en Firestore).
- Toast de éxito: "Lista copiada a Mis Listas".

### S3: Favoritos masivos

- Botón "Agregar todos a favoritos" en el header de la lista.
- Marca todos los comercios de la lista como favoritos en una operación batch.
- Ícono de corazón por comercio individual para agregar/quitar favorito inline.

### S4: Navegación de vuelta

- Al cerrar el BusinessSheet, si el usuario venía de una lista compartida, reabrir el SideMenu en la sección de listas con la lista compartida visible.

---

## Scope

| Item | Prioridad | Esfuerzo |
|------|-----------|----------|
| Persistir listId en estado | Alta | S |
| Volver a lista al cerrar BusinessSheet | Alta | S |
| Botón copiar lista | Alta | S |
| Favoritos masivos (batch) | Media | M |
| Favorito individual por comercio | Media | S |

**Esfuerzo total estimado:** M

---

## Out of Scope

- Notificar al creador de la lista cuando alguien la copia.
- Editar la lista copiada inline (se edita desde Mis Listas).
- Sincronización en tiempo real de cambios en la lista original.
- Compartir la copia (el usuario puede compartir su propia lista).

---

## Success Criteria

1. Al abrir un comercio desde una lista compartida y cerrar el BusinessSheet, la lista sigue visible.
2. El botón "Copiar lista" crea una copia funcional en Mis Listas.
3. "Agregar todos a favoritos" marca todos los comercios como favoritos en una operación.
4. Cada comercio en la lista tiene un ícono de favorito para toggle individual.

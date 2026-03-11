# PRD: Feedback, Ratings, Agregar comercio y versión en menú lateral

**Issue:** #11
**Fecha:** 2026-03-11

## Descripción

Completar el menú lateral con las secciones restantes y mejoras:
1. **Feedback**: formulario para enviar feedback sobre la app
2. **Ratings**: historial de calificaciones del usuario
3. **Agregar comercio**: link a Google Form externo
4. **Versión**: footer con número de versión

## Contexto del proyecto

- **SideMenu** (`src/components/layout/SideMenu.tsx`): drawer lateral con tipo `Section = 'nav' | 'favorites' | 'comments'`. Feedback está como placeholder disabled.
- **BusinessRating** (`src/components/business/BusinessRating.tsx`): ratings 1-5 estrellas por comercio. Colección `ratings` con doc ID `{uid}__{businessId}`, campos `userId`, `businessId`, `score`, `createdAt`, `updatedAt`.
- **Firestore `ratings`**: regla permite `read` (auth) y `create/update` (owner + score 1-5).
- **businesses.json**: datos locales para resolver businessId → Business.

## Requisitos funcionales

### 1. Feedback
- Click en "Feedback" en la navegación → muestra formulario inline en el drawer.
- TextField multiline para escribir mensaje libre.
- Opcionalmente: selector de categoría (Bug, Sugerencia, Otro).
- Botón "Enviar" → guarda en Firestore colección `feedback`.
- Confirmación visual: "Gracias por tu feedback" con ícono de check.
- Es unidireccional: el usuario no ve feedback previo.

### 2. Ratings
- Click en "Ratings" en la navegación → muestra lista de comercios calificados por el usuario.
- Cada item: nombre del comercio, estrellas (score), fecha.
- Click en un rating → cierra drawer, centra mapa, abre BusinessSheet.
- Ordenados por fecha (más reciente primero).
- Estado vacío: "No calificaste comercios todavía".

### 3. Agregar comercio
- Item en la navegación del drawer con ícono `AddBusiness` o `StorefrontOutlined`.
- Click → abre link externo: `https://docs.google.com/forms/d/e/1FAIpQLSdCclz8fH1OQj-McD_xEsXAwP6umIcNVsudS3ZiYBXqBqoaRg/viewform`
- Se abre en nueva pestaña (`window.open` con `_blank`).

### 4. Versión
- En la parte inferior del drawer (footer), una línea divisoria y debajo texto: "Versión 1.1.0".
- Color gris claro, centrado, tipografía caption.
- La versión se toma de `package.json` o se define como constante.

## Requisitos no funcionales
- Feedback: máximo 1000 caracteres.
- Ratings: cruzar con JSON local para resolver comercio.
- El formulario de feedback se resetea después de enviar.

## Consideraciones UX
- Feedback: después de enviar, mostrar mensaje de agradecimiento por 2-3 segundos y volver a la nav.
- Ratings: misma estructura visual que FavoritesList/CommentsList.
- "Agregar comercio" no abre sección inline, abre link externo directo.
- Versión siempre visible en el footer de la vista de navegación.

## Buenas prácticas
- Nueva colección Firestore `feedback` con reglas de solo create (no read/update/delete por el usuario).
- Agregar regla en `firestore.rules` para `feedback`.
- Versión como constante en `package.json` (ya existe campo `version`).

## Versionado
- Versión actual: 1.1.0
- Cada 10 iteraciones (PRs mergeados) se incrementa el segundo número.
- Cada 10 incrementos del segundo número se incrementa el primero y se reinicia.

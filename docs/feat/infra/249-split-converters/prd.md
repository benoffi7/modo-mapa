# PRD: Refactor: splitear converters.ts (505 lineas, sobre limite 400)

**Feature:** 249-split-converters
**Categoria:** infra
**Fecha:** 2026-03-30
**Issue:** #249
**Prioridad:** Media

---

## Contexto

`src/config/converters.ts` esta en 505 lineas, superando el limite de 400 del proyecto (file-size-directive). El archivo contiene 18 converters de Firestore para todas las colecciones de la app. Fue agravado por #203 (notificationDigest) y #205 (followedTags) que agregaron campos al `userSettingsConverter`. Cada feature que agrega colecciones o campos lo hace crecer. La solucion propuesta en el issue es splitear por dominio en un directorio `converters/` con barrel re-export.

## Problema

- El archivo de 505 lineas viola la directiva de 400 lineas maximas del proyecto, dificultando la navegacion y revision de codigo.
- Todos los 23 archivos consumidores importan desde un unico `config/converters`, creando un punto de acoplamiento innecesario donde cambiar un converter de un dominio toca un archivo que afecta a todos.
- Cada feature nueva que agrega una coleccion o campos a un converter existente agranda el monolito.

## Solucion

### S1. Crear directorio `src/config/converters/` con archivos por dominio

Splitear el archivo monolitico en archivos por dominio semantico, siguiendo la estructura propuesta en el issue:

```
src/config/converters/
  index.ts              (barrel re-export de todos los converters)
  userConverters.ts     (userProfileConverter, userSettingsConverter)
  businessConverters.ts (ratingConverter, commentConverter, commentLikeConverter,
                         userTagConverter, customTagConverter, favoriteConverter,
                         menuPhotoConverter, priceLevelConverter)
  socialConverters.ts   (followConverter, activityFeedItemConverter,
                         recommendationConverter, checkinConverter)
  listConverters.ts     (sharedListConverter, listItemConverter)
  rankingConverters.ts  (userRankingConverter, notificationConverter,
                         trendingDataConverter)
  feedbackConverters.ts (feedbackConverter)
```

El `index.ts` re-exporta todo para que los 23 consumidores existentes sigan importando desde `config/converters` sin cambios:

```typescript
export { userProfileConverter, userSettingsConverter } from './userConverters';
export { ratingConverter, commentConverter, ... } from './businessConverters';
// ...
```

### S2. Actualizar imports en consumidores

Los 23 archivos que importan desde `../config/converters` o `../../config/converters` no necesitan cambios gracias al barrel re-export. Sin embargo, si algun archivo importa directamente desde `config/converters.ts` (con extension), se actualiza al directorio.

### S3. Mover y actualizar tests

El archivo de test existente `src/config/converters.test.ts` (42 test cases, 100% cobertura) se splitea en archivos correspondientes a cada modulo nuevo, manteniendo la cobertura completa. Alternativa: mantener un unico test file que importa desde el barrel.

### S4. Eliminar archivo original

Una vez migrado, eliminar `src/config/converters.ts` y verificar que el barrel `index.ts` lo reemplaza en todos los import paths.

---

## Scope

| Item | Prioridad | Esfuerzo |
|------|-----------|----------|
| S1: Crear directorio converters/ con 6 archivos + barrel | Alta | S |
| S2: Verificar imports en 23 consumidores (sin cambios esperados) | Alta | S |
| S3: Mover tests existentes o re-apuntar imports | Media | S |
| S4: Eliminar converters.ts original | Alta | S |

**Esfuerzo total estimado:** S

---

## Out of Scope

- Cambiar la logica de ningun converter (solo mover codigo)
- Agregar nuevos converters
- Cambiar la API publica (barrel re-exporta todo)
- Resolver exhaustive-deps en useFollowedTags o split de useVerificationBadges (cubierto por #247)

---

## Tests

### Archivos que necesitaran tests

| Archivo | Tipo | Que testear |
|---------|------|-------------|
| `src/config/converters/userConverters.ts` | Converter | toFirestore/fromFirestore de userProfile y userSettings (migrar de converters.test.ts) |
| `src/config/converters/businessConverters.ts` | Converter | toFirestore/fromFirestore de rating, comment, commentLike, userTag, customTag, favorite, menuPhoto, priceLevel |
| `src/config/converters/socialConverters.ts` | Converter | toFirestore/fromFirestore de follow, activityFeedItem, recommendation, checkin |
| `src/config/converters/listConverters.ts` | Converter | toFirestore/fromFirestore de sharedList, listItem |
| `src/config/converters/rankingConverters.ts` | Converter | toFirestore/fromFirestore de userRanking, notification, trendingData |
| `src/config/converters/feedbackConverters.ts` | Converter | toFirestore/fromFirestore de feedback |

### Criterios de testing

- Cobertura >= 80% del codigo nuevo (los 42 test cases existentes se redistribuyen)
- Los tests existentes pasan sin modificacion de assertions (solo cambian imports)
- Todos los paths condicionales cubiertos (spreads condicionales en fromFirestore)
- Side effects verificados (cache, analytics, notifications): no aplica, converters son puros

---

## Seguridad

Este feature es un refactor de organizacion de archivos sin cambios de logica. No se agregan superficies de ataque.

- [ ] No se modifica la logica de ningun converter
- [ ] Los tipos TypeScript siguen siendo los mismos
- [ ] El barrel re-export mantiene la API publica intacta

### Vectores de ataque automatizado

No aplica. Este feature no agrega superficies nuevas. Los converters son funciones puras de transformacion de datos que no interactuan con la red ni reciben input de usuario.

---

## Deuda tecnica y seguridad

### Issues relacionados

| Issue | Relacion | Accion |
|-------|----------|--------|
| #247 converters + exhaustive-deps + badges | relacionado | Se complementan; este resuelve converters.ts, #247 resuelve los otros items |
| #248 parallel barrel split | patron similar | Ambos usan barrel re-export como estrategia de split |

### Mitigacion incorporada

- Eliminacion de un archivo de 505 lineas que viola la directiva de tamano
- Establece el patron de directorio con barrel para futuros converters (cada feature nueva agrega al archivo de su dominio, no a un monolito)

---

## Offline

### Data flows

| Operacion | Tipo (read/write) | Estrategia offline | Fallback UI |
|-----------|-------------------|-------------------|-------------|
| N/A | N/A | N/A | N/A |

Los converters son funciones puras de transformacion. No tienen interaccion directa con la red ni con cache. El comportamiento offline de los consumidores no cambia.

### Checklist offline

- [x] Reads de Firestore: no aplica (converters no hacen reads)
- [x] Writes: no aplica
- [x] APIs externas: no aplica
- [x] UI: no aplica
- [x] Datos criticos: no aplica

### Esfuerzo offline adicional: Ninguno

---

## Modularizacion y % monolitico

### Checklist modularizacion

- [x] Logica de negocio en hooks/services (converters en config/, correcto)
- [x] Componentes nuevos son reutilizables fuera del contexto actual de layout
- [x] No se agregan useState de logica de negocio a AppShell o SideMenu
- [x] Props explicitas en vez de dependencias implicitas a contextos de layout
- [x] Cada prop de accion tiene un handler real especificado
- [x] Ningun componente nuevo importa directamente de `firebase/firestore` (converters importan tipos con `import type`)
- [x] Archivos nuevos van en carpeta de dominio correcta (`src/config/converters/`)
- [x] Si el feature necesita estado global: no necesita
- [x] Ningun archivo nuevo supera 400 lineas (el mas grande sera ~150 lineas)

### Impacto en % monolitico

| Aspecto | Impacto | Justificacion |
|---------|---------|---------------|
| Acoplamiento de componentes | - | 23 consumidores siguen importando del barrel, pero el codigo fuente esta modularizado por dominio |
| Estado global | = | No modifica estado global |
| Firebase coupling | = | Los imports de tipos de Firebase se distribuyen en 6 archivos en vez de 1, sin cambio funcional |
| Organizacion por dominio | - | Converters organizados por dominio semantico (user, business, social, list, ranking, feedback) |

---

## Success Criteria

1. `src/config/converters.ts` ya no existe; reemplazado por `src/config/converters/index.ts` + 6 archivos de dominio
2. Ningun archivo del directorio `converters/` supera 200 lineas
3. Los 42 test cases existentes pasan sin modificacion de assertions
4. Los 23 archivos consumidores no requieren cambios de import (barrel re-export transparente)
5. `npm run lint` y `npm run build` pasan sin errores

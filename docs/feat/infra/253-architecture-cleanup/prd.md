# PRD: mover useBusinessDataCache a services + centralizar dragHandleSeen

**Feature:** 253-architecture-cleanup
**Categoria:** infra
**Fecha:** 2026-03-30
**Issue:** #253
**Prioridad:** Media

---

## Contexto

La auditoria de arquitectura detecto 3 problemas: `useBusinessDataCache.ts` esta ubicado en `src/hooks/` pero no contiene hooks de React y es importado por 2 servicios (dependencia upward services -> hooks), una magic string de localStorage no esta centralizada en constantes, y una interface exportada no es usada en ningun lugar. Estos problemas violan las convenciones de service layer y constantes centralizadas documentadas en `patterns.md`.

## Problema

- **P2**: `useBusinessDataCache.ts` en `src/hooks/` no usa hooks de React (useState, useEffect, etc.). Dos servicios (`menuPhotos`, `emailAuth`) lo importan, creando una dependencia upward (services -> hooks) que viola la convencion de service layer.
- **P3**: La key de localStorage `dragHandleSeen` esta hardcodeada como magic string en `BusinessSheet.tsx` (lineas 62 y 91). Deberia estar en `constants/storage.ts` junto con las demas keys de storage.
- **P3**: `BusinessDataResult` es una interface exportada en `businessData.ts` (linea 9) que no es importada en ningun archivo.

## Solucion

### S1: Mover useBusinessDataCache a services

Renombrar y mover `src/hooks/useBusinessDataCache.ts` a `src/services/businessDataCache.ts`. Actualizar los 4 archivos que lo importan:

- Los 2 servicios que lo importan (dependencia corregida: services -> services).
- Los componentes/hooks que lo usen (mantienen dependencia correcta: components -> services).

Nota: si el archivo tiene un default export nombrado `useBusinessDataCache`, renombrar a `businessDataCache` (sin prefijo `use` ya que no es un hook).

### S2: Centralizar dragHandleSeen

Agregar `STORAGE_KEY_DRAG_HANDLE_SEEN` a `src/constants/storage.ts`. Reemplazar las 2 ocurrencias de la magic string en `BusinessSheet.tsx`.

### S3: Eliminar BusinessDataResult dead export

Eliminar la interface `BusinessDataResult` de `businessData.ts` si no tiene consumidores.

---

## Scope

| Item | Prioridad | Esfuerzo |
|------|-----------|----------|
| Mover useBusinessDataCache a services/ | P2 | S |
| Centralizar dragHandleSeen en constants/storage.ts | P3 | S |
| Eliminar BusinessDataResult dead export | P3 | S |

**Esfuerzo total estimado:** S

---

## Out of Scope

- Refactorizar la logica interna de businessDataCache.
- Mover otros archivos que podrian estar mal ubicados.
- Agregar tests para businessDataCache (ya tiene tests en `useBusinessDataCache.test.ts`).
- Renombrar el test file (se renombra junto con el source).

---

## Tests

### Archivos que necesitaran tests

| Archivo | Tipo | Que testear |
|---------|------|-------------|
| `src/services/businessDataCache.ts` | Service | Los tests existentes de `useBusinessDataCache.test.ts` se mueven y adaptan imports |

### Criterios de testing

- Los tests existentes deben pasar tras el rename/move.
- No se requieren tests nuevos (la logica no cambia).
- Verificar que `npm run test:run` pasa sin errores.

---

## Seguridad

No aplica. Este feature es un refactor de organizacion sin cambios funcionales.

---

## Deuda tecnica y seguridad

### Issues relacionados

| Issue | Relacion | Accion |
|-------|----------|--------|
| #254 dead code cleanup | complementario | BusinessDataResult dead export podria incluirse en #254 tambien; resolver en el que se implemente primero |

### Mitigacion incorporada

- Corregir la dependencia upward (services -> hooks) alinea con la convencion de service layer.
- Centralizar la magic string previene inconsistencias futuras.
- Eliminar dead exports reduce ruido en el codebase.

---

## Offline

No aplica. Este feature es un refactor de organizacion sin cambios funcionales.

---

## Modularizacion y % monolitico

### Checklist modularizacion

- [x] Logica de negocio en hooks/services (moviendo cache a services donde pertenece)
- [x] No se agregan componentes nuevos
- [x] No se agregan useState de logica de negocio a AppShell o SideMenu
- [x] Ningun archivo nuevo importa directamente de `firebase/firestore`
- [x] Archivos van en carpeta de dominio correcta (services/)

### Impacto en % monolitico

| Aspecto | Impacto | Justificacion |
|---------|---------|---------------|
| Acoplamiento de componentes | - | Elimina dependencia upward services -> hooks |
| Estado global | = | No hay cambios de estado |
| Firebase coupling | = | Cache sigue en service layer |
| Organizacion por dominio | - | Archivo movido a carpeta correcta |

---

## Success Criteria

1. `useBusinessDataCache.ts` ya no existe en `src/hooks/`.
2. `src/services/businessDataCache.ts` existe y exporta la misma API.
3. No hay imports de `hooks/useBusinessDataCache` en ningun archivo de `services/`.
4. La magic string `dragHandleSeen` no aparece en ningun archivo fuera de `constants/storage.ts`.
5. `BusinessDataResult` ya no existe como export.
6. `npm run test:run` pasa sin errores.

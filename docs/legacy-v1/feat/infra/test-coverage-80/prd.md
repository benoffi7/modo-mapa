# PRD — Subir cobertura de tests al 80% en todas las secciones

**Fecha:** 2026-03-18

---

## Objetivo

Llevar la cobertura de tests (statements, branches, functions, lines) al minimo 80% tanto en el frontend (`src/`) como en Cloud Functions (`functions/src/`), estableciendo un umbral minimo obligatorio para futuros PRs.

---

## Contexto

### Estado actual de cobertura

**Frontend (src/) — 248 tests passing:**

| Metrica | Actual | Target |
|---------|--------|--------|
| Statements | 67.9% | 80% |
| Branches | 56.19% | 80% |
| Functions | 55.36% | 80% |
| Lines | 68.95% | 80% |

**Cloud Functions (functions/) — 90 tests passing:**

| Metrica | Actual | Target |
|---------|--------|--------|
| Statements | 96.24% | 80% (ya cumple) |
| Branches | 85.10% | 80% (ya cumple) |
| Functions | 96.77% | 80% (ya cumple) |
| Lines | 96.45% | 80% (ya cumple) |

### Archivos criticos bajo 80%

**Frontend — prioridad alta (< 40% lines):**

| Archivo | Lines | Statements |
|---------|-------|------------|
| `hooks/usePriceLevelFilter.ts` | 14.7% | 13.88% |
| `utils/perfMetrics.ts` | 14.6% | 14.7% |
| `utils/analytics.ts` | 19.2% | 23.33% |
| `config/converters.ts` | 25% | 25% |
| `services/rankings.ts` | 35.8% | 34.48% |

**Frontend — prioridad media (40-80% lines):**

| Archivo | Lines | Notas |
|---------|-------|-------|
| `services/comments.ts` | 76.9% | Cerca del umbral |
| `context/AuthContext.tsx` | 80.7% | Branches al 61.9% |
| `context/MapContext.tsx` | 80% | Branches al 50% |
| `hooks/useBusinessDataCache.ts` | 75% | Faltan edge cases |
| `utils/formatDate.ts` | 86.3% | Functions al 60% |

**Functions — unico archivo bajo 80%:**

| Archivo | Lines | Branches |
|---------|-------|----------|
| `utils/perfTracker.ts` | 66.6% | 25% |

### Cobertura por archivos

Solo 36 de 216 archivos fuente (~17%) tienen algun test asociado. Si bien no es necesario testear cada archivo (componentes UI puros, tipos, constantes), hay modulos con logica de negocio importante que no tienen tests.

---

## Requisitos funcionales

| ID | Requisito | Prioridad |
|----|-----------|-----------|
| RF-1 | Subir coverage de frontend a 80%+ en las 4 metricas (stmts, branches, funcs, lines) | Alta |
| RF-2 | Subir archivo `perfTracker.ts` de functions a 80%+ en todas las metricas | Alta |
| RF-3 | Agregar tests para los 5 archivos de frontend con < 40% coverage | Alta |
| RF-4 | Completar branches de `AuthContext` y `MapContext` (actualmente 50-62%) | Media |
| RF-5 | Configurar umbral minimo de coverage en CI para bloquear PRs que bajen del 80% | Media |
| RF-6 | Agregar script `test:coverage` en package.json de ambos proyectos | Baja |

---

## Requisitos no funcionales

- Los tests deben ser deterministas (sin dependencia de red, timers reales, o estado compartido).
- Tiempo de ejecucion del suite completo de tests < 60 segundos.
- No mockear Firestore en tests de integracion de functions (usar emuladores cuando aplique).
- Cada test debe tener un nombre descriptivo que indique que comportamiento valida.

---

## Plan de implementacion por fases

### Fase 1 — Frontend: archivos criticos (< 40% coverage)

**Scope:** 5 archivos, estimado ~15 tests nuevos

| Archivo | Que testear |
|---------|-------------|
| `hooks/usePriceLevelFilter.ts` | Filtrado por nivel de precio, edge cases con arrays vacios, integracion con el estado del filtro |
| `utils/perfMetrics.ts` | Registro de metricas, flush, formateo, edge cases con metricas vacias |
| `utils/analytics.ts` | Tracking de eventos, inicializacion condicional, modo desarrollo |
| `config/converters.ts` | Conversion ida y vuelta Firestore <-> modelo, campos opcionales, timestamps |
| `services/rankings.ts` | Queries de rankings, cache, paginacion, manejo de errores |

### Fase 2 — Frontend: archivos medio-bajos (40-80% coverage)

**Scope:** 5 archivos, estimado ~10 tests nuevos

| Archivo | Que testear |
|---------|-------------|
| `services/comments.ts` | Operaciones CRUD restantes, validacion |
| `context/AuthContext.tsx` | Branches de login/logout, estados de error, token refresh |
| `context/MapContext.tsx` | Branches de zoom, bounds, marker selection |
| `hooks/useBusinessDataCache.ts` | Cache miss, invalidacion, TTL |
| `utils/formatDate.ts` | Funciones no cubiertas, edge cases de locale |

### Fase 3 — Functions: perfTracker

**Scope:** 1 archivo, estimado ~4 tests nuevos

| Archivo | Que testear |
|---------|-------------|
| `utils/perfTracker.ts` | Lines 18-23 (uncovered), branches de inicializacion, edge cases |

### Fase 4 — CI enforcement

| Tarea | Detalle |
|-------|---------|
| Script `test:coverage` | Agregar a ambos `package.json` con flags de coverage |
| Threshold en vitest.config | `coverage.thresholds.statements: 80` etc. |
| GitHub Action | Step que corra coverage y falle si baja del 80% |

---

## Criterios de aceptacion

- [ ] Frontend: 4 metricas de coverage >= 80%
- [ ] Functions: mantiene >= 80% (ya cumple, no debe bajar)
- [ ] `perfTracker.ts` de functions >= 80% en todas las metricas
- [ ] Los 5 archivos criticos de frontend pasan de < 40% a >= 80%
- [ ] Branches de `AuthContext` y `MapContext` >= 80%
- [ ] Script `test:coverage` disponible en ambos `package.json`
- [ ] CI bloquea PRs que bajen la cobertura del 80%
- [ ] Todos los tests son deterministas y corren en < 60s

---

## Tests

Cada fase debe validarse corriendo:

```bash
# Frontend
npm run test:coverage

# Functions
cd functions && npm run test:coverage
```

El output debe mostrar todas las metricas >= 80% en el resumen global y en cada archivo individual que fue modificado.

---

## Riesgos

| Riesgo | Mitigacion |
|--------|-----------|
| Tests fragiles por mocking excesivo | Preferir tests de integracion con datos reales; mockear solo boundaries externos |
| Subir coverage con tests triviales (assert true) | Review obligatorio; cada test debe validar comportamiento real |
| Tiempo de CI crece mucho | Paralelizar suites de frontend y functions; establecer limite de 60s |
| Converters de Firestore dificiles de testear sin emulador | Testear la logica de conversion pura, sin necesidad de Firestore real |

---

## Fuera de scope

- Tests E2E (Cypress/Playwright) — eso es otro PRD.
- Tests de componentes React visuales (Storybook/testing-library para UI pura).
- Subir coverage de archivos que son tipos, constantes, o configuracion pura.
- Refactorizar codigo existente para hacerlo mas testeable (si surge, se trackea aparte).

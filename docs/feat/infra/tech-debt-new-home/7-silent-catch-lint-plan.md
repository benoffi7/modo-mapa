# Plan: Lint rule for silent .catch(() => {})

**Specs:** [7-silent-catch-lint-specs.md](7-silent-catch-lint-specs.md)
**Fecha:** 2026-03-27

---

## Fases de implementacion

### Fase 1: Agregar regla ESLint

**Branch:** `fix/silent-catch-lint`

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `eslint.config.js` | Agregar `'@typescript-eslint/no-empty-function': 'error'` al objeto `rules` existente |
| 2 | terminal | Ejecutar `npx eslint src/ --quiet` para verificar que no hay violaciones existentes |
| 3 | terminal | Ejecutar `npm run lint` para verificar que el build de lint pasa limpio |

### Fase 2: Verificacion funcional

| Paso | Archivo | Cambio |
|------|---------|--------|
| 4 | terminal | Crear archivo temporal `src/__test-lint.ts` con `.catch(() => {})` y verificar que `npx eslint src/__test-lint.ts` reporta error |
| 5 | terminal | Verificar que `.catch((e) => logger.warn('ctx', e))` NO marca error |
| 6 | terminal | Verificar que `.catch((_e) => { /* intentional */ })` NO marca error |
| 7 | terminal | Eliminar archivo temporal `src/__test-lint.ts` |

### Fase 3: Commit y lint final

| Paso | Archivo | Cambio |
|------|---------|--------|
| 8 | terminal | `npm run lint` -- verificar que pasa limpio |
| 9 | terminal | `npm run build` -- verificar que compila |
| 10 | terminal | Commit: `fix: add ESLint rule to block silent .catch(() => {})` |

---

## Orden de implementacion

1. `eslint.config.js` -- unico archivo a modificar
2. Verificacion de lint limpio en codebase existente
3. Verificacion funcional (la regla detecta el patron)
4. Commit

---

## Riesgos

| Riesgo | Probabilidad | Mitigacion |
|--------|-------------|-----------|
| La regla marca false positives en funciones vacias legitimas (ej: noop callbacks en tests) | Baja | Los tests estan excluidos del lint de `src/`. Si aparecen en production code, agregar comentario dentro del body (`/* intentional */`) es suficiente para satisfacer la regla. |
| `@typescript-eslint/no-empty-function` ya esta activa como `warn` en la preset heredada | Baja | Verificado: la regla puede estar en `tseslint.configs.recommended` pero con nivel variable. Establecerla explicitamente como `error` en el config del proyecto garantiza el nivel correcto independientemente de la preset. |

---

## Criterios de done

- [ ] `eslint.config.js` tiene `'@typescript-eslint/no-empty-function': 'error'`
- [ ] `npm run lint` pasa limpio (sin violaciones existentes)
- [ ] `.catch(() => {})` es detectado como error por ESLint
- [ ] `.catch((e) => logger.warn('x', e))` no marca error
- [ ] Pre-commit hook bloquea archivos con el patron (verificar o confirmar via lint-staged)
- [ ] `npm run build` pasa
- [ ] No lint errors

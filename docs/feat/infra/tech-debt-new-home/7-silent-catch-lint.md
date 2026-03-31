# PRD: Lint rule for silent .catch(() => {})

**Issue:** #206 item 7
**Priority:** Medium
**Effort:** Small (<1h)

## Problema

El patron `.catch(() => {})` sigue apareciendo en codigo nuevo. El CI lo detecta con `pre-staging-check.sh` pero solo en el paso de deploy — no en el IDE ni en pre-commit. En esta sesion causo 2 CI failures que requirieron fix + re-deploy.

## Solucion propuesta

1. Agregar regla ESLint `no-empty-function` o custom rule que detecte `.catch(() => {})` y `.catch(() => { })`
2. Alternativa: agregar al pre-commit hook de lint-staged un grep que falle si encuentra el patron en archivos staged
3. Permitir `.catch((e) => logger.warn(...))` como alternativa valida

## Criterios de aceptacion

- [ ] `.catch(() => {})` se detecta en el IDE (lint error/warning)
- [ ] Pre-commit hook lo bloquea antes de que llegue a CI
- [ ] Existe una guia clara de que usar en su lugar (`logger.warn`)

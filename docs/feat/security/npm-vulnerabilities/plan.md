# Plan: Vulnerabilidades en dependencias npm

**Specs:** [specs.md](specs.md)
**Fecha:** 2026-03-28

---

## Fases de implementacion

### Fase 1: Audit fix sin breaking changes

**Branch:** `fix/npm-vulnerabilities`

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `package-lock.json` | Ejecutar `npm audit fix` en la raiz del proyecto. Resuelve las 2 vulnerabilidades de `yaml` (moderate). |
| 2 | `functions/package-lock.json` | Ejecutar `cd functions && npm audit fix`. Resuelve las 13 vulnerabilidades: `node-forge` (4 high), `path-to-regexp` (1 high), `picomatch` (2 high), y 6 low/moderate. |

### Fase 2: Verificacion post-fix

| Paso | Archivo | Cambio |
|------|---------|--------|
| 3 | -- | Ejecutar `npm audit` en la raiz. Verificar que las vulnerabilidades de `yaml` desaparecieron. Documentar las 5 restantes (serialize-javascript/picomatch chain via vite-plugin-pwa) como riesgo aceptado. |
| 4 | -- | Ejecutar `cd functions && npm audit`. Verificar 0 vulnerabilidades high y 0 moderate. |
| 5 | -- | Ejecutar `npm run test:run` (839 tests del frontend). Todos deben pasar. |
| 6 | -- | Ejecutar `cd functions && npx vitest run` (292 tests de Cloud Functions). Todos deben pasar. |
| 7 | -- | Ejecutar `npm run build`. El build de produccion debe completar sin errores. |
| 8 | -- | Ejecutar `cd functions && npm run build`. La compilacion de functions debe completar sin errores. |
| 9 | -- | Ejecutar `npm run lint` y `cd functions && npm run lint`. Sin errores nuevos de lint. |

### Fase 3: Commit y PR

| Paso | Archivo | Cambio |
|------|---------|--------|
| 10 | -- | Commit con los cambios en `package-lock.json` y `functions/package-lock.json`. Mensaje: `fix: resolve npm audit vulnerabilities in main project and Cloud Functions`. |
| 11 | -- | Crear PR referenciando issue #215. Body debe incluir resumen de vulnerabilidades resueltas y las que quedan documentadas. |

---

## Orden de implementacion

1. `npm audit fix` en raiz (paso 1)
2. `npm audit fix` en functions/ (paso 2)
3. Verificacion de audit limpio (pasos 3-4) -- en paralelo
4. Tests del frontend (paso 5) y functions (paso 6) -- en paralelo
5. Build frontend (paso 7) y build functions (paso 8) -- en paralelo
6. Lint (paso 9)
7. Commit y PR (pasos 10-11)

## Estimacion de tamano de archivos

| Archivo | Tamano estimado | Notas |
|---------|----------------|-------|
| `package-lock.json` | ~10000 lineas (sin cambios de tamano) | Solo cambios en hashes/versions de transitivas |
| `functions/package-lock.json` | ~5000 lineas (sin cambios de tamano) | Solo cambios en hashes/versions de transitivas |

No hay archivos de codigo fuente afectados. No aplica la regla de 400 lineas.

## Riesgos

1. **Regresion en tests por actualizacion de transitivas:** Las dependencias actualizadas son transitivas (no directas), pero podrian cambiar comportamiento sutil. **Mitigacion:** El test suite completo (1131 tests) se ejecuta como parte de la verificacion. Si algun test falla, investigar la causa antes de mergear.

2. **Vulnerabilidades restantes en proyecto principal no reconocidas por audit:** El `overrides` de `serialize-javascript` podria no ser reconocido por `npm audit` para resolver las vulnerabilidades en la cadena de vite-plugin-pwa. **Mitigacion:** Documentar las vulnerabilidades restantes en el PR como riesgo aceptado (solo build chain, no runtime).

3. **Lock file conflicts con branch `new-home`:** El branch actual `new-home` tiene cambios en progreso. Si se mergea el fix de vulnerabilidades antes, el lock file podria generar conflictos. **Mitigacion:** Ejecutar `npm install` tras rebase para regenerar el lock file.

## Criterios de done

- [ ] `npm audit` en proyecto principal reporta 0 vulnerabilidades high; las moderate restantes son solo build-chain (serialize-javascript via vite-plugin-pwa) y estan documentadas
- [ ] `npm audit` en functions/ reporta 0 vulnerabilidades high y 0 moderate
- [ ] Los 1131 tests existentes pasan sin regresiones (839 frontend + 292 functions)
- [ ] `npm run build` completa exitosamente
- [ ] `cd functions && npm run build` completa exitosamente
- [ ] No hay errores de lint nuevos
- [ ] PR creado referenciando issue #215 con resumen de vulnerabilidades resueltas

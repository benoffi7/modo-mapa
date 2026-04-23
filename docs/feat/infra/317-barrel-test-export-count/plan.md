# Plan: barrel.test.ts — Eliminar hardcoded export count

**Specs:** [specs.md](specs.md)
**Fecha:** 2026-04-23

---

## Fases de implementacion

### Fase 1: Modificar el test y generar el snapshot

**Branch:** `feat/317-barrel-test-export-count`

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/constants/analyticsEvents/__tests__/barrel.test.ts` | Eliminar el bloque `it('exports exactly the expected number of events', ...)` y agregar `it('snapshot of exported event keys', () => { expect(Object.keys(events).sort()).toMatchSnapshot(); })` |
| 2 | Terminal | Correr `npx vitest run --update-snapshots` para generar `src/constants/analyticsEvents/__tests__/__snapshots__/barrel.test.ts.snap` |
| 3 | `src/constants/analyticsEvents/__tests__/__snapshots__/barrel.test.ts.snap` | Revisar el snapshot generado: verificar que contiene todos los exports actuales del barrel ordenados alfabeticamente |
| 4 | Terminal | Correr `npm run test:run` para confirmar que el suite pasa sin errores |
| 5 | Terminal | Verificacion manual: agregar temporalmente `export const EVT_TEST = 'test'` a cualquier archivo de dominio, correr `npm run test:run`, confirmar que el fallo es `snapshot mismatch` con diff visible, revertir |

### Fase 2: Commit

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/constants/analyticsEvents/__tests__/barrel.test.ts` | Stagear el archivo modificado |
| 2 | `src/constants/analyticsEvents/__tests__/__snapshots__/barrel.test.ts.snap` | Stagear el snapshot generado (archivo nuevo) |
| 3 | Terminal | Commit: `fix(test): replace hardcoded export count with snapshot in barrel.test.ts` |

---

## Orden de implementacion

1. Modificar `barrel.test.ts` (eliminar count, agregar snapshot test).
2. Correr `vitest --update-snapshots` para generar el `.snap`.
3. Verificar que `npm run test:run` pasa.
4. Verificar manualmente el comportamiento del fallo con un export temporario.
5. Commitear ambos archivos juntos.

No hay dependencias entre fases — todo se hace en una sola iteracion.

---

## Estimacion de tamano de archivos resultantes

| Archivo | Estado actual | Estado post-cambio | Variacion |
|---------|--------------|-------------------|-----------|
| `barrel.test.ts` | ~87 lineas | ~85 lineas | -2 lineas (reemplaza bloque de 4 lineas por bloque de 3 lineas) |
| `barrel.test.ts.snap` | No existe | ~65 lineas aprox | Nuevo (autogenerado) |

Ninguno de los archivos resultantes supera 400 lineas. No hay estrategia de decomposicion necesaria.

---

## Riesgos

1. **Snapshot desactualizado tras merge de otra feature**: Si entre la generacion del snapshot y el merge se agrega un evento nuevo al barrel (ej: otra feature en paralelo), el CI fallara con snapshot mismatch. Mitigacion: generar el snapshot inmediatamente antes del merge, no al inicio de la branch.

2. **Snapshot commiteado con exports extras no declarados en `expectedExports`**: Si el barrel tiene exports que no estan en `expectedExports`, el snapshot los captura de todas formas — lo que es correcto, ya que el snapshot cubre el estado real del barrel. El desarrollador debe revisar el snapshot antes de commitear y decidir si los exports extras son intencionales.

3. **Vitest no encuentra la configuracion de snapshots**: El directorio `__snapshots__/` es creado automaticamente por Vitest junto al archivo de test. No requiere configuracion adicional en `vitest.config.ts`. Si Vitest usa una configuracion custom de `snapshotOptions`, verificar que no haya conflicto.

---

## Guardrails de modularidad

- [x] Ningun componente nuevo importa `firebase/firestore` directamente — no aplica (cambio de test)
- [x] Archivos nuevos en carpeta de dominio correcta — el snapshot va en `__snapshots__/` adyacente al test, convencion estandar de Vitest
- [x] Logica de negocio en hooks/services, no en componentes — no aplica
- [x] Si se toca un archivo con deuda tecnica, se incluye el fix en el plan — el archivo `barrel.test.ts` no tiene deuda tecnica conocida mas alla del magic number que este issue resuelve
- [x] Ningun archivo resultante supera 400 lineas — verificado en tabla de estimacion

## Guardrails de seguridad

No aplica. Cambio puramente de test infra.

## Guardrails de observabilidad

No aplica. No hay CF triggers, services con queries, ni trackEvent calls nuevos.

## Guardrails de accesibilidad y UI

No aplica.

## Guardrails de copy

No aplica.

---

## Fase final: Documentacion

Este issue no requiere actualizacion de docs de referencia. Checklist explicito:

| Doc | Aplica | Razon |
|-----|--------|-------|
| `docs/reference/security.md` | No | Sin cambios en rules, auth, storage |
| `docs/reference/firestore.md` | No | Sin cambios en colecciones ni campos |
| `docs/reference/features.md` | No | No es feature visible al usuario |
| `docs/reference/patterns.md` | No | No introduce patron nuevo — el uso de snapshots en Vitest es convencion estandar |
| `docs/reference/project-reference.md` | No | Sin cambio de version ni feature nueva |
| `src/components/menu/HelpSection.tsx` | No | Sin cambio de comportamiento visible |

---

## Criterios de done

- [x] `barrel.test.ts` modificado: count test eliminado, snapshot test agregado
- [x] `barrel.test.ts.snap` generado y comiteado con el estado actual del barrel
- [x] `npm run test:run` pasa sin errores
- [x] Verificacion manual del fallo snapshot mismatch realizada
- [x] Cobertura global no baja del 80%
- [x] El PR no toca ningun archivo fuera de `src/constants/analyticsEvents/__tests__/`
- [x] No hay lint errors (el cambio no introduce codigo nuevo que el linter pueda objetar)
- [x] Build succeeds (cambio de test no afecta build)

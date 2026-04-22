# Guard: Architecture invariants (#306)

Regression guard para preservar las invariantes arquitectonicas
introducidas por el issue #306 (prop-drilling, sabanas, bypass de
`console.error`). Cada vez que se agreguen componentes nuevos al
dominio Business, paneles de admin o features que toquen la capa de
UI, el auditor debe verificar estas reglas antes de aprobar el merge.

## Contexto

El health-check sobre `new-home` del 2026-04-18 detecto tres patrones
de deuda arquitectonica que se pagaron en #306:

- Un ultimo `console.error` directo en `ModerationActions.tsx` que
  rompia la captura Sentry.
- Prop-drilling de `{ businessId, businessName }` a traves de 11
  componentes del subarbol de `BusinessSheetContent`.
- `InfoTab` absorbiendo 11 props planas para 3 features independientes.
- Tres archivos (`AbuseAlerts`, `FeedbackList`, `BusinessQuestions`)
  cerca del threshold de 400 LOC.

El refactor dejo un `BusinessScopeContext` local al subarbol, agrupo la
API de `InfoTab` en objetos por feature, y descompuso los archivos
grandes. Estas reglas preservan ese estado.

## Reglas

1. **Logger obligatorio**: no debe haber `console.error`,
   `console.log` ni `console.warn` fuera de `src/utils/logger.ts` y
   `src/config/sentry.ts`. Todo error va por `logger.error` para
   preservar la captura Sentry en produccion.
2. **File size directive**: archivos en `src/` no deben exceder 400
   LOC sin exencion explicita. Exenciones actuales (DEV-only tools):
   `ConstantsDashboard`, `ThemePlayground`.
3. **BusinessScope via contexto**: los consumidores del subarbol de
   la Business tab deben leer `businessId` / `businessName` /
   `location` via `useBusinessScope()`. Nunca hay que prop-drillear
   estos datos a traves de 2 o mas niveles de componente.
4. **InfoTab data surface agrupada**: la API de `InfoTab` se mantiene
   como objetos agrupados (`priceLevelData`, `tagsData`, `photoData`)
   y NO como lista plana de props. Nuevas features se suman como un
   objeto data-by-feature, no como props sueltas.
5. **Service layer boundary**: componentes en `src/components/` NO
   deben importar `firebase/firestore` directamente. Todas las
   lecturas y escrituras pasan por `src/services/`.

## Patrones de deteccion

Comandos que el auditor ejecuta para verificar el estado actual:

```bash
# Regla 1: no debe haber bypass del logger en src/.
# Output esperado: vacio (o solo coincidencias dentro de tests).
grep -rn "console\.\(error\|log\|warn\)(" src/ \
  --include="*.ts" --include="*.tsx" \
  | grep -v logger.ts \
  | grep -v sentry.ts \
  | grep -v test
```

```bash
# Regla 2: ningun archivo en src/ excede 400 LOC (excepto exenciones
# DEV-only ConstantsDashboard y ThemePlayground). Output esperado:
# vacio o solo los dos archivos exentos.
find src/ -name "*.tsx" -exec wc -l {} \; | awk '$1 > 400 {print}'
```

```bash
# Regla 5: componentes no importan firebase/firestore directamente.
# Output esperado: vacio.
grep -rn "from 'firebase/firestore'" src/components/
```

```bash
# Regla 3: trend check — cantidad de componentes en business/ que
# siguen declarando `businessId:` como prop. Debe tender a 0 a medida
# que crece la adopcion de useBusinessScope. Cualquier aumento entre
# auditorias es un red flag.
grep -rn "businessId:" src/components/business/ | wc -l
```

Si la regla 1, 2 o 5 falla, el auditor reporta **ARCHITECTURE
VIOLATION** y bloquea el merge. Si la regla 3 muestra un incremento
sin justificacion, se abre un follow-up y se evalua si el nuevo
componente debia consumir el contexto.

## Relacionados

- PRD: [`docs/feat/infra/306-architecture-prop-drilling-sabanas/prd.md`](../../feat/infra/306-architecture-prop-drilling-sabanas/prd.md)
- Contexto: `src/context/BusinessScopeContext.tsx`
  (`BusinessScopeProvider`, `useBusinessScope`)
- Logger: `src/utils/logger.ts` y `src/config/sentry.ts`
- File size directive: `docs/reference/file-size-directive.md`
- Patrones generales: `docs/reference/patterns.md`
  (seccion "Datos y estado" — `BusinessScopeContext`)

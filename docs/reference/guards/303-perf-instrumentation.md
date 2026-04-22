# Guard: Firestore instrumentation (#303)

Regression guard para asegurar que la infraestructura de observabilidad
client-side y server-side introducida en el issue #303 no sufra drift en
iteraciones futuras. Cada vez que se agregue un service, trigger o query
nueva, el auditor debe verificar estas reglas.

## Contexto

Antes de #303 solo 4 de aproximadamente 30 sitios de query en
`src/services/` estaban envueltos con `measureAsync`, dejando ciegos los
hot paths (BusinessSheet, perfil publico). El PRD introdujo helpers
`measuredGetDocs` / `measuredGetDoc` en `src/utils/perfMetrics.ts` y una
convencion de naming. Estas reglas preservan esa cobertura.

## Reglas

1. Toda llamada a `getDocs` / `getDoc` en `src/services/` (excepto
   `src/services/admin/`) DEBE pasar por `measuredGetDocs` /
   `measuredGetDoc` con un nombre `<service>_<operation>`.
2. Todo trigger de Cloud Functions en `functions/src/triggers/` DEBE
   invocar `trackFunctionTiming` — exceptuando los auth blocking hooks
   (`beforeCreate`, `beforeSignIn`) donde el timing no es soportado por
   el runtime de blocking functions.
3. Convencion de naming: `<service>_<operation>` en snake_case. Cuatro
   nombres legacy (`notifications`, `unreadCount`, `userSettings`,
   `paginatedQuery`) quedan grandfathered para preservar continuidad de
   series historicas en `dailyMetrics`.
4. El documento seed `config/perfCounters` debe tener contenido
   non-empty para que `FunctionTimingTable` renderice datos tras
   `npm run seed-admin`. Un doc vacio o ausente rompe el panel admin en
   local/staging.

## Patrones de deteccion

Comandos que el auditor ejecuta para verificar el estado actual:

```bash
# Regla 1: no debe haber getDocs/getDoc crudos en src/services/
# (excluyendo admin, tests y el wrapper mismo). Output esperado: vacio.
grep -rn "getDocs\|getDoc(" src/services/ --include="*.ts" \
  | grep -v admin \
  | grep -v test \
  | grep -v measuredGet
```

```bash
# Regla 2: cada trigger (menos authBlocking) debe tener trackFunctionTiming.
# El count de matches debe igualar la cantidad de archivos trigger menos
# los blocking hooks.
grep -rn "trackFunctionTiming" functions/src/triggers/
```

Si cualquiera de las dos invariantes falla, el auditor debe reportar
**MISSING INSTRUMENTATION** o **MISSING TIMING** y abrir un follow-up.

## Relacionados

- PRD: [`docs/feat/infra/303-perf-instrumentation-hot-paths/prd.md`](../../feat/infra/303-perf-instrumentation-hot-paths/prd.md)
- Helpers: `src/utils/perfMetrics.ts` (`measureAsync`,
  `measuredGetDocs`, `measuredGetDoc`)
- Server-side timing: `functions/src/utils/perfTracker.ts`
  (`trackFunctionTiming`)
- Convencion documentada: `docs/reference/patterns.md` capitulo
  "Queries y cache"

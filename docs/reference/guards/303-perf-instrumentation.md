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
5. Toda Cloud Function `scheduled` (en `functions/src/scheduled/`) DEBE
   invocar `trackFunctionTiming` con un nombre estable. Estos jobs son
   los mas costosos (aggregations, cleanups) y son invisibles al panel
   admin sin instrumentacion.
6. Toda Cloud Function `callable` user-invocada (en `functions/src/callable/`)
   DEBE invocar `trackFunctionTiming`. La latencia es directamente
   visible al usuario y es el primer indicador de regresiones.
7. El seed de `scripts/seed-admin-data.mjs` debe mantener paridad con
   los nombres reales emitidos en runtime: cualquier `<service>_<operation>`
   nuevo registrado en `measureAsync` o `trackFunctionTiming` debe
   aparecer al menos una vez en `perfMetrics.queries` (snake_case)
   y `config/perfCounters` (function names) del seed. Sin este vinculo,
   el dashboard admin "Function timings" sub-reporta.

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

```bash
# Regla 5: todo scheduled function debe usar trackFunctionTiming.
for f in functions/src/scheduled/*.ts; do
  if ! grep -q "trackFunctionTiming" "$f"; then
    echo "MISSING TIMING: $f"
  fi
done
```

```bash
# Regla 6: todo callable function debe usar trackFunctionTiming.
for f in functions/src/callable/*.ts; do
  case "$f" in *.test.ts) continue ;; esac
  if ! grep -q "trackFunctionTiming" "$f"; then
    echo "MISSING TIMING: $f"
  fi
done
```

```bash
# Regla 7: nombres registrados en runtime que no estan en seed.
# Lista nombres del seed:
grep -oE "'[a-z_]+'" scripts/seed-admin-data.mjs | sort -u > /tmp/seed-names.txt
# Lista nombres registrados en services:
grep -rEoh "measuredGet(Doc|Docs)\([^,]*,\s*'[^']+'" src/services/ --include="*.ts" \
  | sed -E "s/.*'([^']+)'$/\1/" | sort -u > /tmp/runtime-names.txt
# Diff:
comm -23 /tmp/runtime-names.txt /tmp/seed-names.txt
```

Esperado: output vacio. Si hay nombres en runtime sin seed, el dashboard renderea series vacias.

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

# Specs: barrel.test.ts — Eliminar hardcoded export count

**PRD:** [prd.md](prd.md)
**Fecha:** 2026-04-23

---

## Contexto tecnico

Este issue es un cambio puro de test infra. No hay modelo de datos, Firestore rules, Cloud Functions, componentes, hooks, ni servicios involucrados.

El archivo afectado es `src/constants/analyticsEvents/__tests__/barrel.test.ts`. El barrel que testea es `src/constants/analyticsEvents/index.ts`, que re-exporta 10 archivos de dominio (`onboarding`, `trending`, `offline`, `social`, `navigation`, `system`, `business`, `digest`, `interests`, `admin`).

---

## Problema concreto en el codigo existente

El test actual tiene dos secciones:

1. **`it.each(expectedExports)`** — verifica que cada nombre en `expectedExports` exista en el barrel y sea string. Esta cobertura es correcta y se mantiene sin cambios.

2. **`it('exports exactly the expected number of events', ...)`** — compara `Object.keys(events).length` con `expectedExports.length`. Esta assertion falla en silencio cuando se agrega un evento al barrel *sin* agregarlo a `expectedExports`: el desarrollador actualiza solo el hardcoded count, y el `it.each` loop no detecta el nuevo export porque no esta en `expectedExports`. La friction real es que el count hay que buscarlo y editarlo manualmente en cada feature que suma eventos.

---

## Solucion tecnica

### Cambio en `barrel.test.ts`

Eliminar el bloque:

```ts
it('exports exactly the expected number of events', () => {
  const exportedKeys = Object.keys(events);
  expect(exportedKeys).toHaveLength(expectedExports.length);
});
```

Reemplazarlo por:

```ts
it('snapshot of exported event keys', () => {
  expect(Object.keys(events).sort()).toMatchSnapshot();
});
```

El snapshot captura el conjunto completo de claves exportadas por el barrel, ordenadas alfabeticamente, y lo congela en un archivo `.snap`. Cualquier cambio al barrel (agregar, renombrar o eliminar un export) produce un fallo de tipo `snapshot mismatch` con un diff claro que muestra exactamente que cambio.

### Archivo snapshot generado

Al correr `vitest --update-snapshots` (o `npx vitest run --update-snapshots`), Vitest genera automaticamente:

```
src/constants/analyticsEvents/__tests__/__snapshots__/barrel.test.ts.snap
```

Con contenido similar a:

```
// Vitest Snapshot v1, https://vitest.dev/guide/snapshot.html

exports[`analyticsEvents barrel snapshot of exported event keys 1`] = `
[
  "ADMIN_ACTIVITY_FEED_DIAG",
  "ADMIN_CONFIG_VIEWED",
  "ADMIN_MODERATION_UPDATED",
  "EVT_ACCOUNT_DELETED",
  "EVT_ACTIVITY_REMINDER_CLICKED",
  "EVT_ACTIVITY_REMINDER_SHOWN",
  "EVT_APP_VERSION_ACTIVE",
  "EVT_BENEFITS_SCREEN_CONTINUE",
  "EVT_BENEFITS_SCREEN_SHOWN",
  "EVT_BUSINESS_DETAIL_CTA_CLICKED",
  "EVT_BUSINESS_DETAIL_OPENED",
  "EVT_BUSINESS_DETAIL_TAB_CHANGED",
  "EVT_BUSINESS_SHEET_CACHE_HIT",
  "EVT_BUSINESS_SHEET_PHASE1_MS",
  "EVT_BUSINESS_SHEET_PHASE2_MS",
  "EVT_BUSINESS_SHEET_TAB_CHANGED",
  "EVT_DIGEST_CTA_TAPPED",
  "EVT_DIGEST_FREQUENCY_CHANGED",
  "EVT_DIGEST_ITEM_TAPPED",
  "EVT_DIGEST_SECTION_VIEWED",
  "EVT_FEED_ITEM_CLICKED",
  "EVT_FEED_VIEWED",
  "EVT_FOLLOW",
  "EVT_FORCE_UPDATE_LIMIT_REACHED",
  "EVT_FORCE_UPDATE_TRIGGERED",
  "EVT_INTERESTS_BUSINESS_TAPPED",
  "EVT_INTERESTS_CTA_TAPPED",
  "EVT_INTERESTS_SECTION_VIEWED",
  "EVT_INTERESTS_SUGGESTED_TAPPED",
  "EVT_LIST_ICON_CHANGED",
  "EVT_MAP_LOAD_FAILED",
  "EVT_OFFLINE_ACTION_DISCARDED",
  "EVT_OFFLINE_ACTION_QUEUED",
  "EVT_OFFLINE_SYNC_COMPLETED",
  "EVT_OFFLINE_SYNC_FAILED",
  "EVT_ONBOARDING_BANNER_CLICKED",
  "EVT_ONBOARDING_BANNER_DISMISSED",
  "EVT_ONBOARDING_BANNER_SHOWN",
  "EVT_RANKING_ZONE_FILTER",
  "EVT_RANKINGS_ZONE_FILTER",
  "EVT_RATING_PROMPT_CLICKED",
  "EVT_RATING_PROMPT_CONVERTED",
  "EVT_RATING_PROMPT_DISMISSED",
  "EVT_RATING_PROMPT_SHOWN",
  "EVT_RECOMMENDATION_LIST_VIEWED",
  "EVT_RECOMMENDATION_OPENED",
  "EVT_RECOMMENDATION_SENT",
  "EVT_SUB_TAB_SWITCHED",
  "EVT_TAB_SWITCHED",
  "EVT_TAG_FOLLOWED",
  "EVT_TAG_UNFOLLOWED",
  "EVT_TRENDING_BUSINESS_CLICKED",
  "EVT_TRENDING_NEAR_CONFIGURE_TAPPED",
  "EVT_TRENDING_NEAR_TAPPED",
  "EVT_TRENDING_NEAR_VIEWED",
  "EVT_TRENDING_VIEWED",
  "EVT_UNFOLLOW",
  "EVT_VERIFICATION_NUDGE_DISMISSED",
  "EVT_VERIFICATION_NUDGE_RESEND",
  "EVT_VERIFICATION_NUDGE_SHOWN",
]
`;
```

El snapshot exacto lo genera Vitest al correr `--update-snapshots` contra el estado actual del barrel. La lista anterior es aproximada y puede diferir segun el estado real del barrel en el momento de implementar.

---

## Modelo de datos

No aplica. No hay cambios en Firestore.

## Firestore Rules

No aplica.

## Cloud Functions

No aplica.

## Seed Data

No aplica. No hay cambios en colecciones ni campos.

## Componentes

No aplica. Cambio exclusivamente en archivos de test.

## Hooks

No aplica.

## Servicios

No aplica.

---

## Tests

Este issue es el cambio de test. Los archivos involucrados son:

| Archivo test | Que testear | Tipo |
|-------------|-------------|------|
| `src/constants/analyticsEvents/__tests__/barrel.test.ts` | Reemplazar count assertion por snapshot assertion | Modificar |
| `src/constants/analyticsEvents/__tests__/__snapshots__/barrel.test.ts.snap` | Estado actual del barrel (57 eventos, generado por vitest) | Nuevo (autogenerado) |

### Criterios de aceptacion

- `npm run test:run` pasa sin errores tras el cambio.
- El directorio `__snapshots__/` y el archivo `barrel.test.ts.snap` existen y estan comiteados.
- El snapshot contiene exactamente los eventos exportados por el barrel en orden alfabetico.
- Agregar un evento al barrel sin actualizar el snapshot produce un fallo `snapshot mismatch` con diff visible, no un fallo `toHaveLength`.
- La cobertura global no baja del 80% (el cambio reemplaza una assertion por otra equivalente, no elimina cobertura).

### Verificacion manual recomendada

Tras implementar, agregar temporalmente un export falso al barrel (`export const EVT_TEST = 'test'`), correr `npm run test:run`, verificar que el fallo sea de tipo snapshot mismatch con diff claro, y luego revertir.

---

## Integracion

No se modifica ningun componente, hook, servicio, ni contexto existente. El unico archivo modificado es el test, y el unico archivo nuevo es el snapshot autogenerado.

### Preventive checklist

- [x] **Service layer**: No aplica — no hay writes ni queries.
- [x] **Duplicated constants**: No aplica — no se crean constantes.
- [x] **Context-first data**: No aplica.
- [x] **Silent .catch**: No aplica.
- [x] **Stale props**: No aplica.

---

## Analytics

No aplica. No hay nuevos eventos ni `logEvent` calls.

---

## Offline

No aplica.

---

## Accesibilidad y UI mobile

No aplica. Cambio de test infra puro.

---

## Textos y copy

No aplica. No hay textos user-facing.

---

## Decisiones tecnicas

### Por que snapshot en vez de count

El count hardcodeado viola el patron del proyecto de evitar magic numbers (ver `patterns.md` — "Constantes en `src/constants/`"). Ademas, el count da un mensaje de error poco informativo (`Expected: 57, Received: 58`) sin indicar que exports cambiaron. El snapshot muestra el diff exacto de claves, lo que acelera el review en PRs.

### Por que `Object.keys(events).sort()` y no `expectedExports`

`Object.keys(events).sort()` captura el estado *real* del barrel, incluyendo exports que no esten en `expectedExports`. Esto cubre el caso donde un desarrollador agrega un evento al barrel pero olvida agregarlo a `expectedExports` — el snapshot lo detecta.

### Por que mantener el `it.each` loop

El `it.each(expectedExports)` sigue siendo util para garantizar que los eventos en `expectedExports` existen *y son strings*. Si un export se renombra a un non-string por error, el snapshot no lo detectaria (solo detectaria el cambio de clave). Los dos tests son complementarios.

### Ubicacion del snapshot

Vitest coloca snapshots en `__snapshots__/` adyacente al archivo de test, siguiendo la convencion de Jest/Vitest. No se necesita configuracion adicional.

---

## Hardening de seguridad

No aplica. Cambio puramente de test infra sin superficie de datos.

---

## Deuda tecnica: mitigacion incorporada

No hay issues de deuda tecnica o seguridad que este cambio resuelva directamente. El magic number eliminado no esta trackeado como issue separado — es el problema que este issue mismo resuelve.

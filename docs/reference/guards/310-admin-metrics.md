# Guard: Admin metrics coverage (#310)

Regression-guard para garantizar que el dashboard admin (`/admin`) mantenga
cobertura completa sobre colecciones Firestore, eventos analytics y servicios
admin-only. Este guard nace del reporte `/health-check` del 2026-04-18 que
identifico gaps de observabilidad (`listItems` sin inspector, `_rateLimits`
sin acceso, 3 eventos `admin_*` no registrados en GA4).

## Contexto

El PRD que origina este guard propone 3 callables nuevas
(`adminListRateLimits`, `adminResetRateLimit`, `adminDeleteListItem`) y una
categoria `admin_tools` en GA4. El guard protege contra regresiones que
reintroduzcan gaps equivalentes.

Ver PRD: [`docs/feat/admin/310-admin-metrics-gaps/prd.md`](../../feat/admin/310-admin-metrics-gaps/prd.md)

## Reglas

1. **Cobertura de colecciones.** Toda coleccion Firestore escrita por la app
   (declarada en `src/config/collections.ts` o referenciada en `functions/`)
   debe tener un inspector admin (panel, seccion o tabla) **o** una excepcion
   documentada explicita ("no admin needed") en `docs/reference/admin-panel.md`.
2. **Eventos analytics en GA4.** Todo nombre de evento usado en produccion via
   `logEvent(...)` o `trackEvent(...)` debe aparecer en:
   - `GA4_EVENT_NAMES` en `functions/src/admin/analyticsReport.ts`, y
   - `ga4FeatureDefinitions.ts` (alguna categoria + feature).
   Un evento que no figura en ambos lados es invisible al dashboard
   Funcionalidades y cuenta como gap.
3. **Sin servicios huerfanos.** Cada `export` (function o const callable) en
   `src/services/admin/*.ts` debe ser consumido por al menos un componente
   bajo `src/components/admin/`. Si un servicio existe pero nadie lo usa, se
   eliminara o se conectara antes del merge.
4. **Seguridad de callables admin.** Cualquier callable nueva que toque
   colecciones sensibles (`_rateLimits`, acciones destructivas sobre
   `listItems`, moderacion, etc.) DEBE cumplir todas estas condiciones:
   - Llamar `assertAdmin(request.auth)` como primera linea del handler.
   - Declarar `enforceAppCheck: ENFORCE_APP_CHECK_ADMIN` en la definicion.
   - Aplicar `checkCallableRateLimit` con clave por-admin (ej:
     `rate_limits_list_{uid}`, 5-10/min).
   - Registrar el efecto en `moderationLogs` o `abuseLogs` con un `type`
     accionable (`config_edit`, `moderation_action`, etc.) y detalle minimo
     (sin snapshots completos).

## Patrones de deteccion

Usar estos comandos durante auditoria (post-merge o antes de abrir PR) para
detectar violaciones:

### Eventos analytics sin registrar

```bash
grep -rEn "trackEvent\(['\"]" src/ \
  | sed -E "s/.*trackEvent\(['\"]([^'\"]+)['\"].*/\1/" \
  | sort -u
```

Cruzar cada nombre con:

```bash
grep -n "GA4_EVENT_NAMES" -A 200 functions/src/admin/analyticsReport.ts
grep -rEn "id: ['\"]" src/**/ga4FeatureDefinitions.ts
```

Cualquier evento presente en el primer listado pero ausente en los dos
ultimos es un gap.

### Servicios admin huerfanos

```bash
grep -rn "^export \(async \)\?function\|^export const" src/services/admin/
```

Para cada export, buscar un consumidor:

```bash
grep -rln "<nombre-del-export>" src/components/admin/
```

Cero matches => servicio huerfano.

### Colecciones sin inspector

Listar colecciones declaradas:

```bash
grep -n "COLLECTION\|collection(" src/config/collections.ts
```

Cruzar con paneles admin:

```bash
grep -rln "<nombre-coleccion>" src/components/admin/ functions/src/admin/
```

## Contrato minimo de callable admin destructiva

Toda callable admin que escribe debe tener esta forma (ejemplo
simplificado):

```ts
export const adminResetRateLimit = onCall(
  {
    enforceAppCheck: ENFORCE_APP_CHECK_ADMIN,
    region: "southamerica-east1",
  },
  async (request) => {
    await assertAdmin(request.auth);
    await checkCallableRateLimit(`rate_limits_reset_${request.auth!.uid}`, 10);

    // ... logica ...

    await db.collection("abuseLogs").add({
      type: "config_edit",
      adminUid: request.auth!.uid,
      detail: { docId },
      createdAt: FieldValue.serverTimestamp(),
    });
  }
);
```

## Relacionados

- PRD: [`docs/feat/admin/310-admin-metrics-gaps/prd.md`](../../feat/admin/310-admin-metrics-gaps/prd.md)
- Referencia admin: [`docs/reference/admin-panel.md`](../admin-panel.md)
- Seguridad: [`docs/reference/security.md`](../security.md)
- Agente auditor: [`.claude/agents/admin-metrics-auditor.md`](../../../.claude/agents/admin-metrics-auditor.md)

# Performance Baselines

Registro de métricas de performance para detectar regresiones a lo largo del
tiempo. Cubre dos dimensiones:

1. **Web Vitals** (LCP / INP / CLS / TTFB) — medidos en campo/lab post-deploy.
2. **Bundle size** — tamaño de los chunks JS del build de producción.

Las mediciones de referencia se toman alrededor de los issues de performance
(#324 plan deferrals, #334). Los valores de campo (Web Vitals) requieren un
deploy a producción y una ventana de recolección, por eso quedan marcados como
**TBD (pendiente de medición post-deploy)** hasta tener datos reales.

> Cómo regenerar los tamaños de bundle:
>
> ```bash
> npm run build          # genera dist/
> npm run bundle:check   # gate de tamaño (ver más abajo)
> npm run analyze        # opcional: dist/stats.html con desglose visual
> ```

---

## Web Vitals

Umbrales objetivo (Google "good" thresholds):

| Métrica | Bueno | Necesita mejora | Pobre |
|---------|-------|-----------------|-------|
| LCP (Largest Contentful Paint) | ≤ 2.5 s | ≤ 4.0 s | > 4.0 s |
| INP (Interaction to Next Paint) | ≤ 200 ms | ≤ 500 ms | > 500 ms |
| CLS (Cumulative Layout Shift) | ≤ 0.1 | ≤ 0.25 | > 0.25 |
| TTFB (Time To First Byte) | ≤ 800 ms | ≤ 1800 ms | > 1800 ms |

### Comparación pre / post #324

Medir en la misma ruta (home / mapa) y mismo dispositivo de referencia
(mid-tier mobile, throttling 4G) para que sea comparable.

| Métrica | Pre #324 | Post #324 | Delta | Notas |
|---------|----------|-----------|-------|-------|
| LCP | TBD | TBD | TBD | pendiente de medición post-deploy |
| INP | TBD | TBD | TBD | pendiente de medición post-deploy |
| CLS | TBD | TBD | TBD | pendiente de medición post-deploy |
| TTFB | TBD | TBD | TBD | pendiente de medición post-deploy |

> Fuente sugerida para los valores reales: Sentry Performance / Web Vitals,
> o Lighthouse en CI sobre el deploy de producción. Registrar fecha y commit
> de cada medición.

---

## Bundle size

Tamaño **raw** (sin comprimir) y **gzip** de los chunks principales del build de
producción. El gate de tamaño (`npm run bundle:check`) vigila `mui-core`,
`firebase` e `index` (el chunk de entrada cargado desde `index.html`).

### Baseline actual (post #334 / F5 — firebase/storage lazy)

Medido con `npm run build` sobre `2.51.0`.

| Chunk | Raw | Gzip | Contenido |
|-------|-----|------|-----------|
| `index-*.js` (entry) | 298.6 KB | ~99 KB | react, react-dom, react-router-dom, app code |
| `mui-core-*.js` | 439.6 KB | ~135 KB | @mui/material, @mui/system (tree-shaken) |
| `firebase-*.js` | 417.4 KB | ~131 KB | firebase/app, firebase/auth, firebase/firestore |
| `recharts-*.js` | 366.0 KB | ~110 KB | recharts (admin + stats, lazy) |
| `mui-icons-*.js` | 34.5 KB | ~12 KB | @mui/icons-material usados |
| `index.esm-*.js` (storage, lazy) | 34.7 KB | ~12 KB | firebase/storage — solo al subir/ver media |

### Comparación pre / post

`firebase` antes incluía `firebase/storage` en el primer load. Tras F5 (#334)
storage se carga on-demand vía `getStorageInstance()` (`src/config/firebase.ts`)
y queda fuera del chunk `firebase`.

| Chunk | Pre #334 (raw) | Post #334 (raw) | Delta | Notas |
|-------|----------------|-----------------|-------|-------|
| `firebase-*.js` | ~459 KB | 417.4 KB | −~42 KB | storage movido a chunk lazy `index.esm-*` |
| `index-*.js` (entry) | ~298 KB | 298.6 KB | ~0 | sin cambios |
| `mui-core-*.js` | ~450 KB | 439.6 KB | ~0 | sin cambios materiales |

> El chunk lazy de storage (~35 KB raw / ~12 KB gzip) solo se descarga cuando el
> usuario sube una foto de menú, adjunta media en feedback, o un admin abre la
> cola de revisión de fotos. No impacta el primer load.

### Thresholds del gate

Definidos en `scripts/guards/bundle-size.mjs` (raw bytes). Mantener en sync con
esta tabla.

| Chunk | Threshold | Margen actual |
|-------|-----------|---------------|
| `mui-core` | ≤ 500 KB | 439.6 KB (OK) |
| `firebase` | ≤ 460 KB | 417.4 KB (OK) |
| `index` (entry) | ≤ 320 KB | 298.6 KB (OK) |

El gate corre en modo **warning-only** por defecto (siempre `exit 0`). Para
convertirlo en blocker (CI / pre-push), ejecutar con
`BUNDLE_SIZE_BLOCKING=true`. Ver `scripts/guards/README.md`.

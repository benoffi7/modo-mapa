# Specs: Vulnerabilidades en dependencias npm

**PRD:** [prd.md](prd.md)
**Fecha:** 2026-03-28

---

## Modelo de datos

No hay cambios en el modelo de datos. Este feature es exclusivamente sobre actualizacion de dependencias npm.

## Firestore Rules

No hay cambios en Firestore Rules.

### Rules impact analysis

No aplica. No hay queries nuevas ni modificadas.

### Field whitelist check

No aplica. No hay campos nuevos ni modificados.

## Cloud Functions

No hay cambios en Cloud Functions. Las funciones existentes seguiran funcionando con las dependencias actualizadas ya que los updates son patch/minor versions de dependencias transitivas.

## Componentes

No hay componentes nuevos ni modificados.

### Mutable prop audit

No aplica.

## Textos de usuario

No aplica. No hay textos nuevos.

## Hooks

No hay hooks nuevos ni modificados.

## Servicios

No hay servicios nuevos ni modificados.

## Integracion

No hay cambios de integracion. Los archivos afectados son exclusivamente:

| Archivo | Tipo de cambio |
|---------|---------------|
| `package-lock.json` | Actualizado por `npm audit fix` (yaml transitiva) |
| `functions/package-lock.json` | Actualizado por `npm audit fix` (node-forge, path-to-regexp, picomatch transitivas) |
| `package.json` | Sin cambios (ya tiene `overrides` para serialize-javascript) |
| `functions/package.json` | Sin cambios (fixes son en transitivas) |

### Preventive checklist

- [x] **Service layer**: No aplica, no hay componentes modificados.
- [x] **Duplicated constants**: No aplica.
- [x] **Context-first data**: No aplica.
- [x] **Silent .catch**: No aplica.
- [x] **Stale props**: No aplica.

## Tests

No se requieren tests nuevos. La verificacion consiste en ejecutar los test suites existentes para confirmar que no hay regresiones.

| Archivo test | Que testear | Tipo |
|-------------|-------------|------|
| Todos (1131 tests existentes) | Sin regresiones post-update | Regresion |

### Verificacion manual

1. `npm run test:run` -- 839 tests del frontend pasan
2. `cd functions && npx vitest run` -- 292 tests de Cloud Functions pasan
3. `npm run build` -- build de produccion completa sin errores
4. `cd functions && npm run build` -- compilacion de functions completa sin errores

## Analytics

No hay eventos de analytics nuevos.

---

## Offline

No hay impacto en funcionalidad offline.

### Cache strategy

No aplica.

### Writes offline

No aplica.

### Fallback UI

No aplica.

---

## Vulnerabilidades -- Analisis detallado

### Proyecto principal (7 vulnerabilidades actuales)

| Vulnerabilidad | Severidad | Paquete | Cadena de deps | Fix via `npm audit fix` | Riesgo real en Modo Mapa |
|---------------|-----------|---------|---------------|------------------------|--------------------------|
| Stack Overflow via nested YAML (x2) | Moderate | `yaml` 2.x | cosmiconfig > yaml | SI | Bajo: solo en build config parsing |
| ReDoS via extglob | High | `picomatch` 4.x | vite > picomatch | NO (requiere breaking change) | Bajo: solo build tooling, no runtime |
| CPU Exhaustion (x4) | Moderate | `serialize-javascript` | vite-plugin-pwa > workbox-build > @rollup/plugin-terser > serialize-javascript | NO (requiere vite-plugin-pwa downgrade) | Bajo: solo build chain. NOTA: ya hay `overrides` en package.json pero no resuelve la cadena completa |

**Post audit fix:** 5 vulnerabilidades restantes (4 moderate + 1 high), todas en la cadena `vite-plugin-pwa > workbox-build > @rollup/plugin-terser > serialize-javascript` y `picomatch`. Requieren breaking changes para resolver.

### Cloud Functions (13 vulnerabilidades actuales)

| Vulnerabilidad | Severidad | Paquete | Fix via `npm audit fix` | Riesgo real en Modo Mapa |
|---------------|-----------|---------|------------------------|--------------------------|
| basicConstraints bypass | High | `node-forge` <=1.3.3 | SI | Medio: en cadena de deps de SDKs |
| Ed25519 signature forgery | High | `node-forge` <=1.3.3 | SI | Medio: idem |
| RSA-PKCS signature forgery | High | `node-forge` <=1.3.3 | SI | Medio: idem |
| BigInteger DoS | High | `node-forge` <=1.3.3 | SI | Medio: idem |
| ReDoS via route parameters | High | `path-to-regexp` <0.1.13 | SI | Bajo: no usado directamente |
| ReDoS via extglob | High | `picomatch` 4.0.0-4.0.3 | SI | Bajo: build tooling |
| Method injection POSIX | High | `picomatch` 4.0.0-4.0.3 | SI | Bajo: build tooling |
| Otras 6 low/moderate | Low-Moderate | varios | SI | Bajo |

**Post audit fix esperado:** 0 vulnerabilidades high, 0 moderate. Todas resolubles sin breaking changes.

### Vulnerabilidades restantes post-fix (proyecto principal)

Las 5 vulnerabilidades restantes en el proyecto principal estan en la cadena:

```
vite-plugin-pwa@1.2.0 > workbox-build > @rollup/plugin-terser > serialize-javascript
```

**Opcion A: Downgrade a vite-plugin-pwa@0.19.8** -- Breaking change. La version 0.19.x usa APIs diferentes de la 1.x. No recomendado.

**Opcion B: Esperar a vite-plugin-pwa >= 1.3** -- Cuando actualicen la cadena de deps. Monitorear.

**Opcion C: Override de serialize-javascript (ya existente)** -- El `overrides` en `package.json` ya fuerza `serialize-javascript >= 7.0.3`. Verificar si npm audit lo reconoce post-fix. Si no lo reconoce, estas vulnerabilidades quedan documentadas como aceptadas con justificacion (solo afectan build chain, no runtime).

**Recomendacion:** Mantener el override existente y documentar las vulnerabilidades restantes como riesgo aceptado. No afectan runtime ni datos de usuario.

---

## Decisiones tecnicas

1. **Ejecutar `npm audit fix` sin `--force`:** Solo aplicar fixes que no requieren breaking changes. Las 5 vulnerabilidades restantes del proyecto principal son todas en build tooling (no runtime), y el riesgo real es negligible para una app que no expone su build process a input de usuario.

2. **No downgrade de vite-plugin-pwa:** La version 1.x tiene mejoras significativas y el downgrade a 0.19.8 seria un breaking change que requiere reconfigurar el service worker. El riesgo de las vulnerabilidades en build tooling no justifica esta regresion.

3. **Verificar override existente:** El `package.json` ya tiene `"overrides": { "serialize-javascript": ">=7.0.3" }`. Post-fix, verificar si npm audit reconoce este override. Si las vulnerabilidades de serialize-javascript persisten en el reporte de audit, documentarlas como riesgo aceptado.

4. **Cloud Functions: fix completo esperado:** Todas las 13 vulnerabilidades de functions tienen fix disponible via `npm audit fix` sin breaking changes.

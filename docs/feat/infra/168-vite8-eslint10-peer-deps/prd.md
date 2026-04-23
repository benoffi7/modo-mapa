# PRD: Vite 8 y ESLint 10 — Desbloqueo por peer deps

**Feature:** 168-vite8-eslint10-peer-deps
**Categoria:** infra
**Fecha:** 2026-04-23
**Issue:** #168
**Prioridad:** Baja (bloqueado por upstream — sin accion posible hoy)

---

## Contexto

Durante la actualizacion de dependencias del 2026-03-20 se intentó subir a Vite 8 y ESLint 10. Ambas actualizaciones quedaron bloqueadas por limitaciones de peer deps en plugins críticos: `vite-plugin-pwa` no soporta Vite 8, y `eslint-plugin-react-hooks` no soporta ESLint 10. El proyecto corre actualmente Vite 7.3 y ESLint 9.39, versiones estables y funcionales.

## Problema

- `vite-plugin-pwa` (v1.2) requiere Vite ≤7 como peer dep; subir a Vite 8 rompe la dependencia y la PWA/Service Worker dejaría de funcionar.
- `eslint-plugin-react-hooks` no publicó soporte para ESLint 10 al momento de la actualizacion; forzar la instalacion generaría warnings de peer deps y potencial comportamiento indefinido en lint.
- Sin ambos plugins actualizados, la actualizacion conjunta no puede realizarse de forma segura — hacerla en partes podria introducir inconsistencias temporales en el toolchain.

## Solucion

Este issue no requiere implementacion de codigo. Define el proceso de monitoreo y el criterio de desbloqueamiento.

### S1 — Monitoreo de releases upstream

Monitorear los changelogs y releases de:

- `vite-plugin-pwa`: `https://github.com/vite-pwa/vite-plugin-pwa/releases`
- `eslint-plugin-react-hooks`: `https://github.com/facebook/react/releases` (paquete `eslint-plugin-react-hooks` dentro del monorepo react)

Criterio de desbloqueo: ambos plugins publican soporte para sus respectivas versiones mayores. No es necesario que salgan simultaneamente; se puede actualizar Vite 8 y ESLint 10 de forma independiente siempre que el plugin correspondiente lo soporte.

### S2 — Plan de actualizacion cuando se desbloquee

Cuando uno o ambos plugins publiquen soporte:

1. Actualizar la dependencia bloqueante (`vite-plugin-pwa` o `eslint-plugin-react-hooks`) a la version con soporte.
2. Actualizar `vite` o `eslint` segun corresponda.
3. Correr `npm run build` y `npm run lint` para verificar compatibilidad.
4. Correr suite de tests completa (`npm run test:coverage` + `cd functions && npm run test:coverage`).
5. Verificar que el Service Worker se genera correctamente (build prod, revisar `dist/sw.js`).
6. Deploy a staging y verificar PWA install flow.
7. Abrir PR, referenciar este issue, cerrar #168.

### S3 — Aislamiento de riesgo

- Actualizar Vite y ESLint en commits separados para facilitar bisect si algo falla.
- No combinar esta actualizacion con features de producto en la misma rama.
- Si `vite-plugin-pwa` tarda mas que `eslint-plugin-react-hooks`, proceder con ESLint 10 primero (riesgo bajo, solo afecta DX).
- Si `vite-plugin-pwa` publica soporte para Vite 8 como beta/rc, evaluar si el estado del proyecto justifica adoptarla o esperar a la version estable.

---

## Scope

| Item | Prioridad | Esfuerzo |
|------|-----------|----------|
| Monitorear `vite-plugin-pwa` para soporte Vite 8 | Alta (cuando se desbloquee) | XS |
| Monitorear `eslint-plugin-react-hooks` para soporte ESLint 10 | Alta (cuando se desbloquee) | XS |
| Actualizar Vite 7 → 8 | Media | S |
| Actualizar ESLint 9 → 10 | Media | S |
| Verificar build + PWA + lint + tests | Alta | S |
| Deploy a staging y validacion | Alta | S |

**Esfuerzo total estimado:** S (cuando se desbloquee; actualmente 0 porque no hay accion posible)

---

## Out of Scope

- Reemplazar `vite-plugin-pwa` por otra solucion PWA para eludir el bloqueo — el plugin es maduro y la PWA es funcional.
- Actualizar otras dependencias mayores en el mismo PR (ej: React 20, MUI 8) — hacerlo en PRs separados.
- Migrar a Biome u otro linter para eludir el bloqueo de `eslint-plugin-react-hooks` — el cambio de toolchain no justifica el costo.
- Configurar GitHub Dependabot alerts especificos para estos plugins — ya existe monitoreo manual via backlog.

---

## Tests

Este issue no genera codigo nuevo. No requiere tests adicionales.

Cuando se ejecute la actualizacion (S2), los tests existentes son el gate:

### Criterios de testing al desbloquear

- `npm run test:coverage` pasa con >=80% en statements/branches/functions/lines (frontend).
- `cd functions && npm run test:coverage` pasa con >=80% (Cloud Functions).
- `npm run build` completa sin errores.
- `npm run lint` sin errores (warnings aceptables si son de upgrade de reglas).
- `dist/sw.js` existe y tiene contenido despues del build (Service Worker generado por `vite-plugin-pwa`).

### Archivos que necesitaran atencion (no tests nuevos, si verificacion)

| Archivo | Tipo | Que verificar |
|---------|------|---------------|
| `vite.config.ts` | Config | API de `vite-plugin-pwa` compatible con nueva version |
| `eslint.config.js` | Config | API de `eslint-plugin-react-hooks` compatible con ESLint 10 |
| `package.json` | Deps | Peer deps resueltos sin warnings |

---

## Seguridad

Este issue no modifica surfaces de la aplicacion. No aplican vectores de ataque nuevos.

- [ ] No se agregan endpoints ni colecciones nuevas.
- [ ] Las versiones objetivo (Vite 8, ESLint 10) no tienen CVEs conocidos al momento de redaccion — verificar antes de hacer el upgrade.
- [ ] `vite-plugin-pwa` genera Service Workers: revisar el changelog de la version que se adopte por cambios en estrategias de cache de Workbox que puedan afectar el comportamiento offline.

### Vectores de ataque automatizado

No aplica — este PRD es de toolchain, sin superficie de usuario nueva.

---

## Deuda tecnica y seguridad

```bash
gh issue list --label security --state open --json number,title
gh issue list --label "tech debt" --state open --json number,title
```

Al momento de redaccion: ningun issue de seguridad o tech debt abierto relacionado con Vite o ESLint.

### Issues relacionados

| Issue | Relacion | Accion |
|-------|----------|--------|
| #312 fanOut N+1 dedup reads | Independiente | No agravar — no tocar Cloud Functions en este PR |

### Mitigacion incorporada

No aplica — este issue es un tracking item, no una implementacion.

---

## Robustez del codigo

No aplica para un upgrade de toolchain sin codigo de aplicacion nuevo.

Al hacer el upgrade (S2), verificar:

- [ ] `vite.config.ts` no usa APIs deprecadas en Vite 8 (revisar migration guide).
- [ ] `eslint.config.js` no usa reglas removidas en ESLint 10 (revisar migration guide).
- [ ] El build de produccion genera el mismo conjunto de chunks que antes (comparar `dist/` antes y despues).

---

## Offline

No aplica — no hay cambios a la logica de la aplicacion.

Al hacer el upgrade, verificar especificamente:

- [ ] `dist/sw.js` generado por `vite-plugin-pwa`/Workbox tiene la lista de assets precacheados correcta.
- [ ] El PWA install prompt sigue funcionando en Chrome mobile (staging).
- [ ] La estrategia de cache de Workbox no cambio de forma incompatible con `navigateFallback: 'index.html'`.

### Esfuerzo offline adicional: XS (solo verificacion)

---

## Modularizacion y % monolitico

No aplica — no se agrega codigo de aplicacion. El % monolitico no cambia.

---

## Accesibilidad y UI mobile

No aplica.

---

## Success Criteria

1. `vite-plugin-pwa` publica soporte para Vite 8 y `eslint-plugin-react-hooks` publica soporte para ESLint 10 (evento externo que desbloquea el issue).
2. `npm run build` completa sin errores con Vite 8 y el plugin actualizado.
3. `npm run lint` completa sin errores con ESLint 10 y el plugin actualizado.
4. Suite completa de tests pasa con >=80% de cobertura en frontend y Cloud Functions.
5. Deploy en staging verifica que el Service Worker se genera y el flujo PWA funciona end-to-end.

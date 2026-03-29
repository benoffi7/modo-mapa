# PRD: Vulnerabilidades en dependencias npm

**Feature:** npm-vulnerabilities
**Categoria:** security
**Fecha:** 2026-03-28
**Issue:** #215
**Prioridad:** Media

---

## Contexto

El proyecto Modo Mapa (v2.30.0) tiene vulnerabilidades conocidas en dependencias npm tanto en el proyecto principal (7 vulnerabilidades: 6 moderate, 1 high) como en Cloud Functions (13 vulnerabilidades: 9 low, 1 moderate, 3 high). El repositorio es publico desde 2026-03-15, lo cual hace que las dependencias vulnerables sean visibles para cualquiera. Ademas, el issue #168 (Vite 8 y ESLint 10) esta bloqueado por peer dependency conflicts que se solapan con algunas de estas vulnerabilidades.

## Problema

- **Proyecto principal:** picomatch ReDoS (high) podria explotarse si input del usuario llega a glob matching; serialize-javascript CPU exhaustion en la build chain; yaml stack overflow en configuracion via cosmiconfig. 7 vulnerabilidades totales.
- **Cloud Functions:** node-forge tiene 4 vulnerabilidades high (basicConstraints bypass, signature forgery en Ed25519 y RSA-PKCS, DoS via BigInteger); path-to-regexp ReDoS via route parameters; picomatch ReDoS e inyeccion de metodos. 13 vulnerabilidades totales.
- **Deuda tecnica acumulada:** Estas vulnerabilidades bloquean o complican futuras actualizaciones de Vite y ESLint (issue #168), creando un efecto cascada en la deuda tecnica del build tooling.

## Solucion

### S1. Audit fix seguro (sin breaking changes)

Ejecutar `npm audit fix` en ambos proyectos para resolver las vulnerabilidades que tienen fix disponible sin breaking changes.

**Proyecto principal:**
- `yaml` (2 moderate) — fix disponible via `npm audit fix`

**Cloud Functions:**
- `node-forge` (4 high) — fix disponible via `npm audit fix`
- `path-to-regexp` (1 high) — fix disponible via `npm audit fix`
- `picomatch` (2 high) — fix disponible via `npm audit fix`

### S2. Evaluar upgrades con breaking changes

**Proyecto principal:**
- `serialize-javascript` / `@rollup/plugin-terser` / `workbox-build` / `vite-plugin-pwa` — fix requiere downgrade a `vite-plugin-pwa@0.19.8` (breaking change). Evaluar si el downgrade es viable o si conviene esperar a que workbox-build actualice su dependencia de `@rollup/plugin-terser`.
- Alternativa: verificar si `vite-plugin-pwa` >= 1.3 (cuando salga) resuelve la cadena de dependencias.

### S3. Verificacion post-fix

Tras aplicar los fixes:
1. Ejecutar `npm audit` en ambos proyectos para confirmar 0 vulnerabilidades (o solo las que requieren breaking changes)
2. Ejecutar el test suite completo (`npm run test:run` + `cd functions && npx vitest run`)
3. Ejecutar `npm run build` para verificar que el build no se rompe
4. Verificar que los emuladores funcionan correctamente (`npm run dev:full`)

---

## Scope

| Item | Prioridad | Esfuerzo |
|------|-----------|----------|
| S1. `npm audit fix` en proyecto principal | Alta | S |
| S1. `npm audit fix` en functions/ | Alta | S |
| S2. Evaluar upgrade vite-plugin-pwa (breaking change) | Media | S |
| S3. Verificacion post-fix (tests + build + emuladores) | Alta | S |

**Esfuerzo total estimado:** S

---

## Out of Scope

- Upgrade de Vite a v8 (issue #168 — requiere resolucion de peer deps mas amplia)
- Upgrade de ESLint a v10 (issue #168)
- Migracion de vite-plugin-pwa a otra solucion de PWA
- Cambios en codigo de la aplicacion (esto es puramente un update de dependencias)

---

## Tests

### Archivos que necesitaran tests

| Archivo | Tipo | Que testear |
|---------|------|-------------|
| N/A — no hay codigo nuevo | — | — |

### Criterios de testing

- Ejecutar el test suite existente completo (1131 tests) para verificar que no hay regresiones
- Verificar que el build de produccion (`npm run build`) completa sin errores
- Verificar que Cloud Functions compilan correctamente (`cd functions && npm run build`)
- No se requieren tests nuevos ya que no hay cambios de codigo

---

## Seguridad

- [x] **picomatch ReDoS (high):** Evaluar si algun input de usuario pasa por glob matching. En Modo Mapa, picomatch se usa solo en el build tooling (Vite/Rollup), no en runtime con input de usuario, por lo que el riesgo real es bajo. Sin embargo, en functions/ picomatch podria estar en el runtime path.
- [x] **node-forge signature forgery (high):** Afecta Cloud Functions. Si bien Firebase SDK maneja su propia capa de auth, node-forge podria estar en la cadena de dependencias de algun SDK. El fix via `npm audit fix` es directo.
- [x] **serialize-javascript CPU exhaustion (moderate):** Solo afecta el build chain (terser plugin), no el runtime. Riesgo real: solo si un atacante puede inyectar datos en el proceso de build.
- [ ] Verificar que no se exponen nuevas dependencias con vulnerabilidades post-fix
- [ ] Confirmar que `npm audit` reporta 0 vulnerabilidades (o solo las que requieren breaking changes documentadas)

---

## Offline

### Data flows

| Operacion | Tipo (read/write) | Estrategia offline | Fallback UI |
|-----------|-------------------|-------------------|-------------|
| N/A | — | — | — |

No hay impacto en funcionalidad offline. Este issue es exclusivamente sobre actualizacion de dependencias.

### Checklist offline

- [x] No aplica — no hay cambios en data flows

### Esfuerzo offline adicional: N/A

---

## Modularizacion

No aplica — no hay cambios de codigo, solo actualizacion de dependencias en `package.json` y `package-lock.json`.

### Checklist modularizacion

- [x] No aplica — sin cambios de codigo

---

## Success Criteria

1. `npm audit` en el proyecto principal reporta 0 vulnerabilidades high, y las moderate restantes (si las hay) estan documentadas con justificacion
2. `npm audit` en functions/ reporta 0 vulnerabilidades high y 0 moderate
3. Los 1131 tests existentes pasan sin regresiones
4. El build de produccion completa exitosamente
5. Los emuladores de Firebase funcionan correctamente con las dependencias actualizadas

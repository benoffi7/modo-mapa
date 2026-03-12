# Plan — Integrar Sentry para error tracking

**Fecha:** 2026-03-12

---

## Paso 1: Crear proyecto en Sentry (manual)

- Crear cuenta/org en [sentry.io](https://sentry.io) si no existe.
- Crear proyecto de tipo **React** (para frontend).
- Crear proyecto de tipo **Node.js** (para Cloud Functions), o usar el mismo proyecto con distintos environments.
- Obtener el DSN de cada proyecto.
- Generar un auth token con permisos `project:releases` y `org:read`.
- Anotar org slug y project slug.

---

## Paso 2: Instalar dependencias frontend

```bash
npm install @sentry/react @sentry/vite-plugin
```

---

## Paso 3: Crear `src/config/sentry.ts` e inicializar en `main.tsx`

- Crear el helper `initSentry()` que lee `VITE_SENTRY_DSN` y llama `Sentry.init()`.
- Importar y llamar `initSentry()` en `main.tsx` antes de `createRoot`.
- Agregar `VITE_SENTRY_DSN` a `.env.example`.

---

## Paso 4: Actualizar `ErrorBoundary.tsx`

- Importar `@sentry/react`.
- En `componentDidCatch`, llamar `Sentry.captureException(error)` con el component stack como contexto.
- Mantener `console.error` solo en DEV.

---

## Paso 5: Actualizar service layer

- Buscar todos los `console.error` en `src/services/`.
- En produccion, reemplazar con `Sentry.captureException(error)`.
- Mantener `console.error` en DEV para debug local.

---

## Paso 6: Configurar source maps en `vite.config.ts`

- Agregar `build.sourcemap: true`.
- Agregar `sentryVitePlugin` condicionado a `SENTRY_AUTH_TOKEN`.
- Configurar `filesToDeleteAfterUpload` para no servir `.map` publicamente.

---

## Paso 7: Instalar dependencias Cloud Functions

```bash
cd functions && npm install @sentry/node
```

---

## Paso 8: Crear `functions/src/utils/sentry.ts` e inicializar en `index.ts`

- Crear el helper con `initSentry()` y `captureException()`.
- Importar y llamar `initSentry()` al inicio de `functions/src/index.ts`.
- Agregar `SENTRY_DSN` a `functions/.env`.

---

## Paso 9: Actualizar `handleError` en `backups.ts`

- Importar `captureException` desde `../utils/sentry`.
- Llamar `captureException(error)` dentro de `handleError` antes de retornar el `HttpsError`.

---

## Paso 10: Agregar secrets de CI

- Agregar en GitHub Secrets del repositorio:
  - `SENTRY_AUTH_TOKEN`
  - `SENTRY_ORG`
  - `SENTRY_PROJECT`
  - `VITE_SENTRY_DSN`
- Actualizar `.github/workflows/deploy.yml` para inyectar estas variables en el paso de build.

---

## Paso 11: Verificar integracion

- En DEV: provocar un error y verificar que se loguea en consola (no a Sentry).
- En produccion (o con DSN de test): provocar un error y verificar que aparece en el dashboard de Sentry.
- Verificar que los source maps se subieron correctamente (stack traces legibles en Sentry).
- Verificar que los `.map` no se sirven publicamente en Firebase Hosting.

---

## Estimacion

**Complejidad:** Media (~0.5 dia)

| Paso | Estimacion |
|------|------------|
| Paso 1 (manual) | 15 min |
| Pasos 2-6 (frontend) | 1.5 h |
| Pasos 7-9 (functions) | 45 min |
| Paso 10 (CI) | 15 min |
| Paso 11 (verificacion) | 30 min |
| **Total** | **~3 h** |

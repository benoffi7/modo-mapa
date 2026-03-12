# Specs — Integrar Sentry para error tracking

**Fecha:** 2026-03-12

---

## Arquitectura general

```text
Frontend (React)                    Cloud Functions (Node 22)
┌─────────────────────┐             ┌─────────────────────────┐
│ @sentry/react       │             │ @sentry/node             │
│ @sentry/vite-plugin │             │                          │
│                     │             │                          │
│ main.tsx            │             │ functions/src/index.ts   │
│   └─ Sentry.init()  │             │   └─ Sentry.init()       │
│                     │             │                          │
│ ErrorBoundary.tsx   │             │ backups.ts               │
│   └─ captureException│            │   └─ captureException    │
│                     │             │                          │
│ services/*.ts       │             │ triggers/*.ts            │
│   └─ captureException│            │   └─ captureException    │
└─────────────────────┘             └─────────────────────────┘
         │                                     │
         └──────────── Sentry.io ──────────────┘
```

---

## Frontend

### Dependencias

```bash
npm install @sentry/react @sentry/vite-plugin
```

### Archivo nuevo: `src/config/sentry.ts`

Helper de inicializacion de Sentry para el frontend:

```typescript
import * as Sentry from '@sentry/react';

export function initSentry(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN;

  if (!dsn) {
    if (import.meta.env.DEV) {
      console.warn('[Sentry] DSN no configurado, Sentry deshabilitado');
    }
    return;
  }

  Sentry.init({
    dsn,
    environment: import.meta.env.DEV ? 'development' : 'production',
    release: `modo-mapa@${__APP_VERSION__}`,
    // No habilitar performance monitoring (fuera de alcance)
    tracesSampleRate: 0,
  });
}
```

### Modificacion: `src/main.tsx`

Llamar `initSentry()` antes del render:

```typescript
import { initSentry } from './config/sentry';

initSentry();

createRoot(document.getElementById('root')!).render(/* ... */);
```

### Modificacion: `src/components/layout/ErrorBoundary.tsx`

Agregar `Sentry.captureException` en `componentDidCatch`:

```typescript
import * as Sentry from '@sentry/react';

componentDidCatch(error: Error, info: ErrorInfo) {
  Sentry.captureException(error, {
    contexts: { react: { componentStack: info.componentStack ?? '' } },
  });

  if (import.meta.env.DEV) {
    console.error('ErrorBoundary caught:', error, info.componentStack);
  }
}
```

### Modificacion: service layer (`src/services/*.ts`)

Reemplazar patrones de `console.error` condicionados a DEV:

**Antes:**

```typescript
if (import.meta.env.DEV) {
  console.error('Error en operacion:', error);
}
```

**Despues:**

```typescript
import * as Sentry from '@sentry/react';

if (import.meta.env.DEV) {
  console.error('Error en operacion:', error);
} else {
  Sentry.captureException(error);
}
```

### Modificacion: `vite.config.ts`

Agregar `sentryVitePlugin` para subir source maps en build de CI:

```typescript
import { sentryVitePlugin } from '@sentry/vite-plugin';

export default defineConfig({
  build: {
    sourcemap: true, // Necesario para que Sentry procese los source maps
  },
  plugins: [
    react(),
    // Solo subir source maps cuando hay auth token (CI)
    process.env.SENTRY_AUTH_TOKEN
      ? sentryVitePlugin({
          org: process.env.SENTRY_ORG,
          project: process.env.SENTRY_PROJECT,
          authToken: process.env.SENTRY_AUTH_TOKEN,
          release: {
            name: `modo-mapa@${pkg.version}`,
          },
          sourcemaps: {
            filesToDeleteAfterUpload: ['./dist/**/*.map'],
          },
        })
      : null,
    // ... resto de plugins
  ],
});
```

### Variable de entorno nueva

| Variable | Donde | Descripcion |
|----------|-------|-------------|
| `VITE_SENTRY_DSN` | `.env` / CI secrets | DSN del proyecto Sentry (frontend) |

---

## Cloud Functions

### Dependencias

```bash
cd functions && npm install @sentry/node
```

### Archivo nuevo: `functions/src/utils/sentry.ts`

Helper de inicializacion de Sentry para Cloud Functions:

```typescript
import * as Sentry from '@sentry/node';

let initialized = false;

export function initSentry(): void {
  if (initialized) return;

  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV === 'production' ? 'production' : 'development',
    tracesSampleRate: 0,
  });

  initialized = true;
}

export function captureException(error: unknown): void {
  Sentry.captureException(error);
}
```

### Modificacion: `functions/src/index.ts`

Llamar `initSentry()` al inicio del modulo:

```typescript
import { initSentry } from './utils/sentry';

initSentry();

// ... exports existentes
```

### Modificacion: `functions/src/admin/backups.ts`

Agregar `captureException` en `handleError`:

```typescript
import { captureException } from '../utils/sentry';

function handleError(error: unknown, context: string): HttpsError {
  captureException(error);
  // ... logica existente
}
```

### Variable de entorno nueva

| Variable | Donde | Descripcion |
|----------|-------|-------------|
| `SENTRY_DSN` | `functions/.env` / CI env | DSN del proyecto Sentry (Cloud Functions) |

---

## CI/CD

### Secrets nuevos en GitHub

| Secret | Descripcion |
|--------|-------------|
| `SENTRY_AUTH_TOKEN` | Token de autenticacion de Sentry (para subir source maps) |
| `SENTRY_ORG` | Slug de la organizacion en Sentry |
| `SENTRY_PROJECT` | Slug del proyecto en Sentry |
| `VITE_SENTRY_DSN` | DSN del proyecto Sentry (se inyecta en el build) |

### Modificacion: `.github/workflows/deploy.yml`

Agregar variables de entorno al paso de build:

```yaml
- run: npm run build
  env:
    # ... variables existentes
    VITE_SENTRY_DSN: ${{ secrets.VITE_SENTRY_DSN }}
    SENTRY_AUTH_TOKEN: ${{ secrets.SENTRY_AUTH_TOKEN }}
    SENTRY_ORG: ${{ secrets.SENTRY_ORG }}
    SENTRY_PROJECT: ${{ secrets.SENTRY_PROJECT }}
```

---

## Archivos afectados

### Archivos a crear

| Archivo | Descripcion |
|---------|-------------|
| `src/config/sentry.ts` | Helper de inicializacion Sentry (frontend) |
| `functions/src/utils/sentry.ts` | Helper de inicializacion Sentry (Cloud Functions) |

### Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `src/main.tsx` | Agregar llamada a `initSentry()` |
| `src/components/layout/ErrorBoundary.tsx` | Agregar `Sentry.captureException` en `componentDidCatch` |
| `src/services/*.ts` | Reemplazar `console.error` DEV-only con `Sentry.captureException` en produccion |
| `vite.config.ts` | Agregar `sentryVitePlugin` + `sourcemap: true` |
| `functions/src/index.ts` | Agregar llamada a `initSentry()` |
| `functions/src/admin/backups.ts` | Agregar `captureException` en `handleError` |
| `.github/workflows/deploy.yml` | Agregar secrets de Sentry al paso de build |
| `.env.example` | Agregar `VITE_SENTRY_DSN` |
| `functions/.env` | Agregar `SENTRY_DSN` |

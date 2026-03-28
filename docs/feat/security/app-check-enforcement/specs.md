# Specs: App Check Enforcement

**PRD:** [prd.md](prd.md)
**Fecha:** 2026-03-28

---

## Modelo de datos

No hay cambios en colecciones de Firestore ni en tipos de TypeScript. Este feature es puramente configuracion de Cloud Functions y documentacion.

## Firestore Rules

No requiere cambios. Las Firestore rules no se ven afectadas por App Check enforcement en Cloud Functions.

### Rules impact analysis

No hay queries nuevas en servicios/hooks. Todos los cambios son server-side en la capa de Cloud Functions callable options.

| Query (service file) | Collection | Auth context | Rule that allows it | Change needed? |
|---------------------|------------|-------------|-------------------|----------------|
| N/A | N/A | N/A | N/A | No |

### Field whitelist check

No se agregan ni modifican campos en ninguna coleccion.

| Collection | New/modified field | In create `hasOnly()`? | In update `affectedKeys().hasOnly()`? | Rule change needed? |
|-----------|-------------------|----------------------|--------------------------------------|-------------------|
| N/A | N/A | N/A | N/A | No |

## Cloud Functions

### Cambio 1: `ENFORCE_APP_CHECK_ADMIN` — restaurar a `!IS_EMULATOR`

**Archivo:** `functions/src/helpers/env.ts`

Cambiar de `false` a `!IS_EMULATOR`. Esto habilita App Check enforcement en produccion para todas las admin callables, y lo mantiene deshabilitado en emuladores.

**Callables afectadas (14 admin):**

- `backupFirestore`, `listBackups`, `restoreBackup`, `deleteBackup` (`admin/backups.ts`)
- `setAdminClaim`, `removeAdminClaim` (`admin/claims.ts`)
- `respondToFeedback`, `resolveFeedback`, `createGithubIssueFromFeedback` (`admin/feedback.ts`)
- `approveMenuPhoto`, `rejectMenuPhoto`, `deleteMenuPhoto` (`admin/menuPhotos.ts`)
- `getAuthStats` (`admin/authStats.ts`)
- `toggleFeaturedList`, `getPublicLists` (`admin/featuredLists.ts`)
- `getStorageStats` (`admin/storageStats.ts`)
- `getAnalyticsReport` (`admin/analyticsReport.ts`)

**Nota sobre `getFeaturedLists`:** Esta callable en `admin/featuredLists.ts` usa `ENFORCE_APP_CHECK_ADMIN` pero es publica (any auth, no admin). Dado que es de lectura y se llama desde produccion (donde App Check esta activo), no hay problema con habilitarla. Sin embargo, se documenta como anomalia para futura reorganizacion.

### Cambio 2: `ENFORCE_APP_CHECK` — runtime config via env var

**Archivo:** `functions/src/helpers/env.ts`

Reemplazar `export const ENFORCE_APP_CHECK = false` por lectura de variable de entorno:

```typescript
/**
 * App Check enforcement for user-facing callables.
 * Controlled via APP_CHECK_ENFORCEMENT env var per Firebase project.
 * - Production: APP_CHECK_ENFORCEMENT=enabled
 * - Staging: APP_CHECK_ENFORCEMENT=disabled (no reCAPTCHA key)
 * - Emulators: always disabled (IS_EMULATOR override)
 */
export const ENFORCE_APP_CHECK = !IS_EMULATOR
  && process.env.APP_CHECK_ENFORCEMENT === 'enabled';
```

**Callables afectadas (6 user-facing):**

- `inviteListEditor` (`callable/inviteListEditor.ts`)
- `removeListEditor` (`callable/removeListEditor.ts`)
- `reportMenuPhoto` (`admin/menuPhotos.ts`)
- `writePerfMetrics` (`admin/perfMetrics.ts`)
- `deleteUserAccount` (`callable/deleteUserAccount.ts`)
- `cleanAnonymousData` (`callable/cleanAnonymousData.ts`)

### Configuracion de env var

**Produccion:** Configurar via Firebase Functions `.env` file o `firebase functions:config:set`.

```bash
# En functions/.env (o functions/.env.production):
APP_CHECK_ENFORCEMENT=enabled
```

Firebase Functions v2 soporta `.env` files nativamente. La variable se lee via `process.env.APP_CHECK_ENFORCEMENT`.

**Staging:** No configurar la variable (default undefined), o configurar explicitamente:

```bash
# En functions/.env.staging (si existe):
APP_CHECK_ENFORCEMENT=disabled
```

**Emuladores:** No requiere configuracion. `IS_EMULATOR` short-circuits a `false`.

## Componentes

No hay componentes nuevos ni modificados. Este feature es puramente server-side.

### Mutable prop audit

No aplica.

## Textos de usuario

No hay textos nuevos visibles al usuario.

## Hooks

No hay hooks nuevos ni modificados.

## Servicios

No hay servicios nuevos ni modificados.

## Integracion

### Verificaciones de produccion

1. **Frontend App Check init:** Verificar que `src/config/firebase.ts` inicializa App Check correctamente en produccion. Ya lo hace: usa `ReCaptchaEnterpriseProvider` con `VITE_RECAPTCHA_ENTERPRISE_SITE_KEY`, y lanza error si la key no esta configurada en produccion (excluyendo staging).

2. **Firebase Console:** Verificar que App Check enforcement esta activado para Cloud Functions en Firebase Console. Esto es un check manual, no un cambio de codigo.

3. **reCAPTCHA Enterprise site key:** Verificar que la site key esta configurada en Google Cloud Console para el dominio de produccion.

### Preventive checklist

- [x] **Service layer**: No aplica -- no hay componentes con imports de firebase/firestore
- [x] **Duplicated constants**: No aplica -- no se agregan constantes nuevas
- [x] **Context-first data**: No aplica -- no hay componentes
- [x] **Silent .catch**: No aplica -- no hay .catch en los cambios
- [x] **Stale props**: No aplica -- no hay componentes

## Tests

### Archivos a testear

| Archivo test | Que testear | Tipo |
|-------------|-------------|------|
| `functions/src/__tests__/helpers/env.test.ts` (nuevo) | `ENFORCE_APP_CHECK` refleja env var, `ENFORCE_APP_CHECK_ADMIN` es `!IS_EMULATOR`, `IS_EMULATOR` lee `FUNCTIONS_EMULATOR`, `getDb` maneja database IDs | Unit |

### Casos a cubrir

1. **`ENFORCE_APP_CHECK`:**
   - Cuando `APP_CHECK_ENFORCEMENT=enabled` y no es emulador: `true`
   - Cuando `APP_CHECK_ENFORCEMENT=disabled` y no es emulador: `false`
   - Cuando `APP_CHECK_ENFORCEMENT` no esta definida y no es emulador: `false`
   - Cuando `APP_CHECK_ENFORCEMENT=enabled` pero es emulador: `false` (IS_EMULATOR override)

2. **`ENFORCE_APP_CHECK_ADMIN`:**
   - Cuando no es emulador: `true`
   - Cuando es emulador: `false`

3. **`IS_EMULATOR`:**
   - Cuando `FUNCTIONS_EMULATOR=true`: `true`
   - Cuando `FUNCTIONS_EMULATOR` no esta definida: `false`

4. **`getDb`:**
   - Sin argumento: devuelve default Firestore
   - Con `'staging'`: devuelve Firestore con database ID
   - Con database ID no permitido: devuelve default Firestore

### Mock strategy

- Usar `vi.resetModules()` + dynamic `import()` para cada test (el modulo tiene constantes a nivel de modulo que se evaluan en import time)
- Mock `firebase-admin/firestore` para `getFirestore`
- Manipular `process.env` directamente antes de cada import

### Criterio de aceptacion

- Cobertura >= 80% del codigo en `env.ts`
- Todos los paths condicionales cubiertos (emulador, enabled, disabled, undefined)

## Analytics

No se agregan nuevos eventos de analytics.

---

## Offline

No aplica. Este feature es configuracion server-side de Cloud Functions. No afecta comportamiento offline del cliente.

### Cache strategy

| Dato | Estrategia | TTL | Storage |
|------|-----------|-----|---------|
| N/A | N/A | N/A | N/A |

### Writes offline

| Operacion | Mecanismo | Conflict resolution |
|-----------|-----------|-------------------|
| N/A | N/A | N/A |

### Fallback UI

No aplica.

---

## Decisiones tecnicas

### DT1: `!IS_EMULATOR` para admin vs env var para user-facing

**Decision:** Usar `!IS_EMULATOR` directo para admin callables, y env var para user-facing callables.

**Razon:** Admin siempre accede desde produccion (Google Sign-In), nunca desde staging. No necesita la flexibilidad de una env var. Para user-facing, staging necesita poder deshabilitar App Check porque no tiene reCAPTCHA key, pero produccion debe tenerlo habilitado.

### DT2: `process.env` en vez de Firebase Runtime Config

**Decision:** Usar `process.env.APP_CHECK_ENFORCEMENT` (via `.env` file) en vez de `functions.config()`.

**Razon:** Firebase Functions v2 soporta `.env` files nativamente y es el metodo recomendado. `functions.config()` es legacy (v1). Ademas, `process.env` es mas simple de testear y no requiere setup adicional.

### DT3: String comparison `=== 'enabled'` en vez de boolean

**Decision:** Comparar contra el string `'enabled'` en vez de checkear truthiness.

**Razon:** Previene activacion accidental si alguien configura la variable con un valor inesperado (ej: `APP_CHECK_ENFORCEMENT=1` o `APP_CHECK_ENFORCEMENT=true`). Solo el valor explicito `'enabled'` activa enforcement.

### DT4: `getFeaturedLists` mantiene `ENFORCE_APP_CHECK_ADMIN`

**Decision:** No mover `getFeaturedLists` a `ENFORCE_APP_CHECK` a pesar de ser una callable publica.

**Razon:** Esta callable se invoca desde produccion (SharedListsView en la app principal), donde App Check siempre esta activo. Moverla a `ENFORCE_APP_CHECK` requeriria que staging tambien la pueda invocar, lo cual no es el caso actual. Documentar como anomalia para futura reorganizacion.

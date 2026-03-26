# Cloud Functions + Staging: Procedimientos

## Arquitectura

- **Proyecto Firebase:** `modo-mapa-app` (compartido entre prod y staging)
- **DB produccion:** `(default)` — usada por Cloud Functions sin parametro
- **DB staging:** `staging` — usada por el frontend cuando `VITE_FIRESTORE_DATABASE_ID=staging`
- **Cloud Functions:** un solo deployment compartido entre prod y staging

## Patron: getDb() centralizado

Todas las Cloud Functions usan `getDb()` de `helpers/env.ts` en vez de `getFirestore()` directo.

```typescript
// helpers/env.ts
export function getDb(databaseId?: string) {
  return databaseId ? getFirestore(databaseId) : getFirestore();
}
```

- **Triggers y scheduled:** usan `getDb()` sin parametro (siempre DB default)
- **Callables:** aceptan `databaseId` opcional del cliente para staging

## Patron: ENFORCE_APP_CHECK

```typescript
export const ENFORCE_APP_CHECK = !IS_EMULATOR;
```

Staging NO inicializa App Check en el cliente (no tiene reCAPTCHA key).
Las callable functions admin usan `enforceAppCheck: ENFORCE_APP_CHECK` para
deshabilitarlo en el emulador. En staging, el cliente no envia token de App Check
pero la funcion lo acepta si `assertAdmin()` valida la autenticacion.

**Nota:** Las funciones de listas usan `enforceAppCheck: ENFORCE_APP_CHECK`
pero dependen de `assertAdmin()` para seguridad. Si App Check falla en staging,
la autenticacion admin sigue protegiendo el endpoint.

## Patron: Queries admin vs queries de usuario

### Colecciones con Firestore rules simples (1-2 condiciones)
→ Query directo desde el frontend. Ejemplos: `feedback`, `ratings`, `comments`.

### Colecciones con Firestore rules complejas (3+ condiciones OR)
→ **Obligatorio usar Cloud Function con Admin SDK.**
Las rules con multiples ORs que dependen de `resource.data` bloquean collection queries.

Ejemplo: `sharedLists` tiene 5 condiciones OR en read:
```
isAdmin() || isListOwner() || isListEditor() || isPublic == true || featured == true
```
Esto hace que queries como `where('isPublic', '==', true)` fallen para usuarios
que no son owner. Solucion: `getPublicLists` y `getFeaturedLists` Cloud Functions.

## Deploy a staging

### Automatico (CI)
El workflow `deploy-staging.yml` detecta cambios en `functions/src/` y despliega
automaticamente. Tambien corre `scripts/pre-staging-check.sh` que valida:
- Compilacion TypeScript de functions
- No usar `enforceAppCheck: !IS_EMULATOR` (usar `ENFORCE_APP_CHECK`)
- No usar `getFirestore()` directo (usar `getDb()`)
- No tener `.catch(() => {})` silenciosos
- No usar `as never` en codigo de produccion

### Manual (para iterar rapido)
```bash
# Deploy una funcion especifica
npx firebase-tools deploy --only functions:<nombre> --project modo-mapa-app

# Deploy todas las functions
npx firebase-tools deploy --only functions --project modo-mapa-app
```

**Importante:** Las functions se comparten entre prod y staging. Un deploy
de functions afecta ambos entornos. Los cambios deben ser backwards-compatible.

## Checklist nueva Cloud Function

1. Usar `getDb(databaseId)` para Firestore, no `getFirestore()`
2. Usar `enforceAppCheck: ENFORCE_APP_CHECK`, no `!IS_EMULATOR`
3. Si es admin-only: usar `assertAdmin(request.auth)`
4. Si el frontend necesita staging: pasar `databaseId` como parametro
5. Exportar en `functions/src/index.ts`
6. Agregar tests con mock de `getDb` en `helpers/env`
7. Correr `scripts/pre-staging-check.sh` antes de pushear

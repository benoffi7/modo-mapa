# Post-mortem: Friccion en deploy de Cloud Functions a staging

**Fecha:** 2026-03-19
**Features afectadas:** #160, #156, #155 (Listas compartidas, sugeridas, colaborativas)
**Duracion de la sesion de debug:** ~2 horas
**Commits de fix:** 6 (de 20 totales en la rama)

---

## Resumen ejecutivo

Al probar las features de listas en staging, se encontraron **5 problemas encadenados** que requirieron 6 commits de fix y 4 deploys manuales de Cloud Functions. La causa raiz es que **no existe un procedimiento unificado para desplegar features que incluyan Cloud Functions a staging**, y hay incompatibilidades arquitecturales entre staging y produccion que no estaban documentadas.

---

## Timeline de problemas encontrados

### 1. Toggle "Destacada" en admin da error de autenticacion
- **Causa:** `assertAdmin(request.auth as never)` — un cast de TypeScript que rompia la validacion en runtime
- **Fix:** Cambiar a `assertAdmin(request.auth)` como todas las demas funciones
- **Leccion:** Los casts `as never` son un code smell que debe detectarse en code review
- **Commit:** `e42d78e`

### 2. Listas no se expanden en el panel admin
- **Causa:** `FeaturedListsPanel` solo mostraba nombre y toggle, sin logica de expansion
- **Fix:** Agregar `Collapse` + `fetchListItems` + render de comercios
- **Leccion:** Feature incompleta en la implementacion original
- **Commit:** `e42d78e`

### 3. Cloud Functions no desplegadas a staging
- **Causa:** `deploy-staging.yml` solo despliega `hosting:staging` + Firestore rules. **No despliega Cloud Functions.**
- **Fix:** Deploy manual: `npx firebase-tools deploy --only functions:toggleFeaturedList`
- **Leccion:** El workflow de staging esta incompleto. Cada feature con functions nuevas requiere deploy manual.
- **Commit:** N/A (deploy manual)

### 4. Lista publica no aparece en admin — Firestore rules bloquean queries
- **Causa:** Las Firestore rules de `sharedLists` tienen ORs complejos (`isListOwner() || isListEditor() || isPublic || featured`). Firestore no puede evaluar queries con `where('isPublic', '==', true)` contra rules con ORs que dependen de `resource.data` de formas distintas.
- **Fix temporal:** Agregar `isAdmin()` a las rules (no funciono)
- **Fix definitivo:** Crear Cloud Function `getPublicLists` con Admin SDK que bypasea las rules
- **Leccion:** **Queries directos a Firestore con rules complejas NO funcionan.** Cualquier coleccion con rules multi-OR necesita Cloud Functions para queries admin.
- **Commits:** `0bf0ca7`, `f4d7c22`

### 5. App Check bloquea staging
- **Causa:** Las Cloud Functions tienen `enforceAppCheck: !IS_EMULATOR` (= `true` en staging). Pero el frontend de staging **no inicializa App Check** (linea 67 de `firebase.ts`: `if (recaptchaKey && !isStaging)`). Sin token de App Check, toda callable function retorna 401.
- **Fix:** Setear `enforceAppCheck: false` en las funciones de listas
- **Leccion:** **App Check es incompatible con staging en la arquitectura actual.** Todas las Cloud Functions admin con `enforceAppCheck: true` fallan en staging. Las que "funcionan" (backups, fotos, etc.) probablemente tambien fallan pero nunca se probaron desde staging.
- **Commit:** `85898ae`

### 6. Cloud Functions leen de la DB equivocada
- **Causa:** Staging usa `VITE_FIRESTORE_DATABASE_ID=staging` (una Firestore DB separada). Pero las Cloud Functions usan `getFirestore()` sin parametro, que siempre retorna la DB `(default)`. Las listas creadas en staging estan en la DB `staging`, pero las functions buscaban en `(default)`.
- **Fix:** Agregar parametro `databaseId` a las Cloud Functions; el frontend pasa la env var
- **Leccion:** **Ningun Cloud Function existente es compatible con staging.** Todos los triggers, callables, y scheduled functions operan sobre `(default)`. Esto significa que:
  - Las listas se crean en staging DB (via cliente)
  - Los triggers se ejecutan sobre default DB (via functions)
  - Los admin callables leen de default DB
  - Los counters, aggregates, y metricas son de default DB
- **Commit:** `7001024`

### 7. Listas destacadas no aparecen en el cliente
- **Causa:** Mismo problema que #4 — `fetchFeaturedLists()` hace query directo con `where('featured', '==', true)` que falla por las rules complejas. Error tragado por `.catch(() => {})`.
- **Fix:** Crear Cloud Function `getFeaturedLists` (sin `assertAdmin`, cualquier autenticado puede llamarla)
- **Leccion:** Los `.catch(() => {})` silenciosos ocultan bugs criticos.
- **Commit:** `434caa7`

---

## Causas raiz estructurales

### 1. Staging y produccion son arquitecturalmente incompatibles para Cloud Functions
- El cliente de staging escribe en la DB `staging`
- Las Cloud Functions siempre operan sobre la DB `(default)`
- Los triggers de Firestore solo se ejecutan sobre la DB `(default)`
- No existe mecanismo para que los triggers operen sobre la DB `staging`

### 2. No hay deploy de Cloud Functions en el workflow de staging
- `deploy-staging.yml` solo despliega hosting + rules
- Cada function nueva requiere deploy manual
- Las functions se comparten entre staging y produccion (mismo proyecto Firebase)

### 3. App Check no tiene estrategia para staging
- Produccion requiere App Check (reCAPTCHA Enterprise)
- Staging lo deshabilita en el cliente
- Las functions lo siguen exigiendo
- Resultado: toda callable function nueva falla en staging

### 4. Firestore rules con ORs complejos no soportan queries
- Las rules de `sharedLists` tienen 5 condiciones OR
- Los queries directos de Firestore no funcionan con rules asi
- Requiere Cloud Functions con Admin SDK para cualquier query no-trivial

### 5. Errores silenciosos ocultan problemas
- `.catch(() => {})` en multiples lugares
- `try/catch` sin logging
- El usuario ve "No hay listas" cuando en realidad hay un error de permisos

---

## Impacto

- **Tiempo perdido:** ~2 horas de debug iterativo
- **Deploys manuales:** 4 deploys de Cloud Functions fuera de CI
- **Riesgo:** Los `enforceAppCheck: false` en las funciones de listas debilitan la seguridad vs las demas funciones admin que siguen con `enforceAppCheck: true`
- **Deuda tecnica:** El patron `databaseId` como parametro se aplico solo a las funciones de listas, no a todas las functions

---

## Accionables

### A1. Actualizar `deploy-staging.yml` para incluir Cloud Functions
**Prioridad:** Alta
**Accion:** Agregar step de deploy de functions cuando hay cambios en `functions/src/`
```yaml
- name: Deploy Cloud Functions (if changed)
  run: |
    if git diff origin/main -- functions/src/ | grep -q .; then
      cd functions && npm ci
      npx firebase-tools deploy --only functions --project modo-mapa-app
    fi
```
**Riesgo:** Las functions se comparten con produccion. Necesita revision.

### A2. Resolver incompatibilidad App Check + staging
**Prioridad:** Alta
**Opciones:**
1. Usar App Check debug tokens en staging (requiere config en Firebase Console)
2. Cambiar `enforceAppCheck` a `false` en TODAS las admin functions (ya protegidas por `assertAdmin`)
3. Crear variable de entorno `ENFORCE_APP_CHECK` que sea `false` en staging

### A3. Resolver incompatibilidad DB staging + Cloud Functions
**Prioridad:** Alta
**Opciones:**
1. Eliminar la DB separada `staging` y usar la DB `(default)` para staging (con datos de prueba)
2. Pasar `databaseId` como parametro a TODAS las functions que lo necesiten
3. Usar una env var en las Cloud Functions para determinar la DB

### A4. Patron obligatorio: Cloud Functions para queries admin
**Prioridad:** Media
**Accion:** Documentar que cualquier coleccion con rules multi-OR debe usar Cloud Functions (Admin SDK) para queries. No hacer queries directos desde el frontend admin.

### A5. Eliminar `.catch(() => {})` silenciosos
**Prioridad:** Media
**Accion:** Reemplazar todos los `.catch(() => {})` con logging minimo: `.catch((err) => console.error('[Component] action failed:', err))`

### A6. Checklist pre-staging para features con Cloud Functions
**Prioridad:** Alta
**Accion:** Antes de pushear a staging, verificar:
- [ ] Functions compilar: `cd functions && npx tsc --noEmit`
- [ ] Deploy functions: `npx firebase-tools deploy --only functions:<name> --project modo-mapa-app`
- [ ] Verificar que las functions nuevas no usen `enforceAppCheck: !IS_EMULATOR`
- [ ] Si la function lee/escribe Firestore, verificar que acepte `databaseId`
- [ ] Verificar que el frontend pase `databaseId` a las functions nuevas
- [ ] NO usar queries directos a Firestore desde el admin si las rules tienen ORs complejos

### A7. Agregar lint rule o test para detectar patrones problematicos
**Prioridad:** Baja
**Accion:**
- Detectar `as never` en codigo de produccion (no tests)
- Detectar `.catch(() => {})` o `.catch(() => { })` sin logging
- Detectar `getFirestore()` sin `databaseId` en functions nuevas

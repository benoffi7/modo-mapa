# Plan: Anti-scraping — Restringir lectura masiva via anonymous auth

**Specs:** [specs.md](specs.md)
**Fecha:** 2026-03-28

---

## Fases de implementacion

### Fase 1: Firestore Rules — Ownership en reads

**Branch:** `feat/anti-scraping`

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `firestore.rules` | Cambiar read de `favorites`: `allow read: if request.auth != null` a `allow read: if request.auth != null && resource.data.userId == request.auth.uid` |
| 2 | `firestore.rules` | Cambiar read de `commentLikes`: `allow read: if request.auth != null` a `allow read: if request.auth != null && (resource.data.userId == request.auth.uid \|\| isAdmin())` |
| 3 | N/A | Ejecutar tests existentes de services (`npm run test:run`) para verificar que no hay breakage en mocks |

### Fase 2: Audit de queries del cliente

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/hooks/useBusinessData.ts` | Verificar (read-only audit): `getDoc(favorites, uid__bizId)` — OK, doc tiene userId == caller |
| 2 | `src/hooks/useBusinessData.ts` | Verificar (read-only audit): `fetchUserLikes` usa `documentId('in', [uid__cId])` — OK, todos los docs tienen userId == caller |
| 3 | `src/services/favorites.ts` | Verificar (read-only audit): `addFavoritesBatch` usa `where('userId', '==', userId)` — OK |
| 4 | `src/services/favorites.ts` | Verificar (read-only audit): `fetchUserFavoriteIds` usa `where('userId', '==', userId)` — OK |
| 5 | `src/services/admin.ts` | Verificar: `fetchCommentLikeStats` hace query sin userId filter. Confirmar que la regla con `isAdmin()` lo cubre |

### Fase 3: Extension de abuseLogger

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `functions/src/utils/abuseLogger.ts` | Agregar `'scraping_suspect'` al union type `AbuseLogEntry['type']` |
| 2 | `functions/src/utils/abuseLogger.ts` | Agregar `scraping_suspect: 'high'` al `SEVERITY_MAP` |
| 3 | `functions/src/__tests__/utils/abuseLogger.test.ts` | Agregar test case para el nuevo tipo `scraping_suspect` |

### Fase 4: App Check enforcement en Firestore

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | Firebase Console | Verificar si App Check enforcement es configurable per-database (default vs staging) |
| 2 | Firebase Console | Activar App Check enforcement en Firestore para la database default (produccion) |
| 3 | Si enforcement es global: `src/config/firebase.ts` | Agregar `DebugProvider` para staging: importar `ReCaptchaEnterpriseProvider` + `DebugProvider` de `firebase/app-check`. Cuando `isStaging && VITE_APPCHECK_DEBUG_TOKEN`, usar `new DebugProvider(token)` en vez de skip |
| 4 | Si enforcement es global: `.env.staging` | Agregar `VITE_APPCHECK_DEBUG_TOKEN=<token de Firebase Console>` |
| 5 | N/A | Verificar que staging sigue funcionando despues del cambio (manual test) |
| 6 | N/A | Verificar que produccion sigue funcionando (manual test + monitoring) |

### Fase 5: Documentacion y monitoreo

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `docs/reference/security.md` | Actualizar seccion "Reglas por coleccion": cambiar `favorites` read de "auth" a "owner" y `commentLikes` read de "auth" a "owner + admin" |
| 2 | `docs/reference/security.md` | Actualizar seccion "App Check": documentar que enforcement esta activo en Firestore para produccion |
| 3 | `docs/reference/security.md` | Agregar seccion "Anti-scraping" con descripcion de las protecciones implementadas |
| 4 | `docs/reference/firestore.md` | Actualizar tabla de colecciones: cambiar reglas de `favorites` y `commentLikes` |
| 5 | Google Cloud Console | Configurar alerta en Cloud Monitoring: metrica `firestore.googleapis.com/document/read_count`, threshold TBD basado en baseline actual |

### Fase 6: Lint y commit

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | N/A | Ejecutar `npm run lint` para verificar que no hay errores |
| 2 | N/A | Ejecutar `npm run test:run` para verificar que todos los tests pasan |
| 3 | N/A | Ejecutar `cd functions && npx vitest run` para verificar tests de Cloud Functions |
| 4 | N/A | Commit con mensaje descriptivo |

---

## Orden de implementacion

1. `firestore.rules` — Cambios de ownership en favorites y commentLikes (Fase 1, pasos 1-2)
2. Audit de queries del cliente (Fase 2) — verificar que no hay queries que se rompan
3. `functions/src/utils/abuseLogger.ts` — Extension del tipo de abuse log (Fase 3, pasos 1-2)
4. `functions/src/__tests__/utils/abuseLogger.test.ts` — Test del nuevo tipo (Fase 3, paso 3)
5. Tests existentes — ejecutar suite completa para verificar regresion (Fase 1, paso 3)
6. Firebase Console — Activar App Check enforcement (Fase 4, pasos 1-2)
7. `src/config/firebase.ts` — Debug token para staging si es necesario (Fase 4, pasos 3-4)
8. `docs/reference/security.md` y `docs/reference/firestore.md` — Documentacion (Fase 5, pasos 1-4)
9. Google Cloud Monitoring — Alerta de scraping (Fase 5, paso 5)

---

## Riesgos

### R1: App Check enforcement rompe staging

**Probabilidad:** Media. Depende de si Firebase permite enforcement per-database.

**Mitigacion:** Verificar en Firebase Console antes de activar. Si es global, implementar debug token para staging (Fase 4, pasos 3-4). Tener rollback plan: desactivar enforcement en Firebase Console si staging se rompe.

### R2: Admin queries a commentLikes fallan

**Probabilidad:** Baja. La regla actualizada incluye `isAdmin()`.

**Mitigacion:** Verificar que `fetchCommentLikeStats` funciona con el custom claim de admin. Verificar que `isAdmin()` usa `request.auth.token.admin == true` (ya validado en el helper function de rules).

### R3: Queries existentes del cliente fallan por ownership check

**Probabilidad:** Muy baja. El audit (Fase 2) confirma que todas las queries ya filtran por userId o usan doc IDs que contienen el userId.

**Mitigacion:** Ejecutar la app localmente contra emuladores con las nuevas rules antes de deployar. Las rules del emulador se leen del archivo `firestore.rules` local.

---

## Criterios de done

- [x] All items from PRD scope implemented
- [ ] `favorites` read rule restringido a ownership
- [ ] `commentLikes` read rule restringido a ownership + admin
- [ ] App Check enforcement activo en Firestore (produccion)
- [ ] Staging funciona post-enforcement (debug token o per-database enforcement)
- [ ] `abuseLogger.ts` soporta tipo `scraping_suspect`
- [ ] Audit completo de queries del cliente (no hay queries que lean datos de otros usuarios en favorites/commentLikes)
- [ ] `security.md` actualizado con nuevas reglas y estado de App Check
- [ ] `firestore.md` actualizado con reglas de lectura corregidas
- [ ] Tests pasan con >= 80% coverage
- [ ] No lint errors
- [ ] Build succeeds
- [ ] Google Cloud Monitoring alerta configurada

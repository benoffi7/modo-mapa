# Plan: Security — sharedLists rate limit + Firestore rules field gaps + admin email

**Specs:** [specs.md](specs.md)
**Fecha:** 2026-04-01

---

## Fases de implementacion

### Fase 1: Trigger `onSharedListCreated` con rate limit

**Branch:** `fix/289-firestore-rules-gaps`

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `functions/src/triggers/sharedLists.ts` | Crear archivo nuevo. Trigger `onSharedListCreated` con rate limit 10/dia usando patron de `listItems.ts`: `incrementCounter`, `trackWrite`, query por `ownerId` + `createdAt >= startOfDay`, `snap.ref.delete()` + `logAbuse` si `count > 10` |
| 2 | `functions/src/index.ts` | Agregar `export { onSharedListCreated } from './triggers/sharedLists';` junto al bloque de triggers existentes |
| 3 | `functions/src/__tests__/triggers/sharedLists.test.ts` | Crear archivo de tests. 6 escenarios siguiendo patron de `listItems.test.ts`: null snap, ownerId missing, no exceed, exceed (delete + logAbuse), not delete when under limit, correct detail message |

### Fase 2: Admin email a Secret Manager

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `functions/src/admin/claims.ts` | Cambiar `import { defineString }` por `import { defineSecret }`. Reemplazar `const ADMIN_EMAIL_PARAM = defineString('ADMIN_EMAIL', {...})` por `const ADMIN_EMAIL_SECRET = defineSecret('ADMIN_EMAIL')`. Agregar `secrets: [ADMIN_EMAIL_SECRET]` a las opciones de `setAdminClaim`. Reemplazar `ADMIN_EMAIL_PARAM.value()` por `ADMIN_EMAIL_SECRET.value()` |
| 2 | `functions/.env` | Eliminar la linea `ADMIN_EMAIL=benoffi11@gmail.com`. Agregar comentario: `# ADMIN_EMAIL moved to Secret Manager (gh #289)` |
| 3 | `functions/src/__tests__/admin/claims.test.ts` | Actualizar el mock de `firebase-functions/params`: agregar `defineSecret: vi.fn().mockReturnValue({ value: () => 'admin@test.com' })` junto al `defineString` existente |

**Prerequisito manual (ejecutar antes del deploy, no es un cambio de codigo):**
```bash
firebase functions:secrets:set ADMIN_EMAIL
# Ingresar el email cuando se solicite
```
Documentar en el PR que este comando debe ejecutarse antes de deploy a produccion.

### Fase 3: Firestore rules — field gaps

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `firestore.rules` | Agregar funcion `isValidFollowedTags(tags)` antes del bloque `match /userSettings/`. Reemplazar las dos apariciones de `(request.resource.data.followedTags is list && request.resource.data.followedTags.size() <= 20)` (en `create` y en `update`) por llamadas a `isValidFollowedTags(request.resource.data.followedTags)` |
| 2 | `firestore.rules` | En `listItems` create: reemplazar `&& request.resource.data.businessId is string` por `&& isValidBusinessId(request.resource.data.businessId)` |
| 3 | `firestore.rules` | En `follows` create: agregar `&& request.resource.data.followedId.size() <= 128` despues de la linea `&& request.resource.data.followedId.size() > 0` |
| 4 | `firestore.rules` | En `listItems` create: agregar `&& request.resource.data.listId.size() <= 128` despues de la linea `&& request.resource.data.listId.size() > 0` |

### Fase 4: Documentacion (OBLIGATORIA)

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `docs/reference/security.md` | Actualizar seccion de Firestore rules: documentar que `followedTags` valida `size() <= 50` por elemento, `listItems.businessId` pasa `isValidBusinessId()`, `follows.followedId` y `listItems.listId` tienen `size() <= 128`. Actualizar referencia a `ADMIN_EMAIL` indicando que esta en Secret Manager |
| 2 | `docs/reference/firestore.md` | Agregar nota en las colecciones `sharedLists`, `listItems`, y `follows` sobre las validaciones nuevas. Agregar `onSharedListCreated` en la seccion de triggers si existe |

---

## Orden de implementacion

1. Fase 1 completa (trigger + test) — independiente de reglas y email
2. Fase 3 completa (rules) — independiente del trigger
3. Fase 2 completa (admin email) — independiente de rules y trigger
4. Fase 4 (docs) — al final, una vez que las fases 1-3 estan completas

Las fases 1, 2, y 3 son independientes entre si y pueden implementarse en cualquier orden. Se recomienda el orden listado porque el trigger (Fase 1) es el cambio mas testeable y sirve como validacion del setup del PR.

---

## Riesgos

1. **`isValidFollowedTags` rompe clients existentes con tags > 50 chars**: Riesgo bajo. Los tags de `followedTags` son IDs de categorias internas, no texto libre del usuario. Los IDs actuales son del estilo `restaurantes`, `cafes`, `heladerias` — todos bien debajo de 50 chars. Validar contra produccion antes de mergear.

2. **`defineSecret` require re-deploy manual con el secret ya creado**: Si se hace deploy del codigo antes de ejecutar `firebase functions:secrets:set ADMIN_EMAIL`, la funcion falla en runtime al intentar acceder al secret. El PR debe incluir instrucciones claras en el cuerpo para ejecutar el comando antes del deploy. En el emulador, el valor se puede seguir mockeando en tests.

3. **`onSharedListCreated` es un trigger nuevo — cold start en primera invocacion**: Riesgo operacional menor. El trigger se activa en cada creacion de lista, lo cual es infrecuente comparado con listItems. No hay impacto de performance significativo.

---

## Estimacion de tamano de archivos resultantes

| Archivo | Lineas actuales | Lineas estimadas post-cambio | Accion |
|---------|----------------|------------------------------|--------|
| `firestore.rules` | ~675 | ~720 (+45 para isValidFollowedTags) | OK, bien bajo 400 para una funcion de rules |
| `functions/src/triggers/sharedLists.ts` | 0 | ~43 | Nuevo, modelo de listItems.ts |
| `functions/src/__tests__/triggers/sharedLists.test.ts` | 0 | ~160 | Nuevo, modelo de listItems.test.ts |
| `functions/src/admin/claims.ts` | 74 | ~74 | Cambio de import + declaracion |
| `functions/src/index.ts` | 54 | 55 | +1 linea de export |

Ningun archivo resultante supera 400 lineas.

---

## Guardrails de modularidad

- [x] Ningun componente nuevo importa `firebase/firestore` directamente — cambios son en `functions/` y `firestore.rules`
- [x] Archivos nuevos van en carpeta de dominio correcta (`functions/src/triggers/`)
- [x] Logica de negocio en triggers/utils, no en componentes
- [x] Los archivos tocados no tienen deuda tecnica conocida que se agrave
- [x] Ningun archivo resultante supera 400 lineas

---

## Guardrails de seguridad

- [x] `sharedLists` es write-only desde el cliente (create/update/delete). Tiene `hasOnly()` en create y `affectedKeys().hasOnly()` en update — sin cambio necesario
- [x] Todos los campos string en los cambios tienen `.size() <= N` (followedTags items: 50, listId: 128, followedId: 128)
- [x] `onSharedListCreated` llama `snap.ref.delete()` cuando excede — no log-only
- [x] `ADMIN_EMAIL` movido a Secret Manager — no mas en archivos commiteados
- [x] No hay secrets ni credenciales en archivos commiteados despues de este fix

---

## Guardrails de accesibilidad y UI

No aplica. No hay cambios de UI.

---

## Guardrails de copy

No aplica. No hay textos visibles al usuario.

---

## Criterios de done

- [ ] `onSharedListCreated` trigger deployado con rate limit 10/dia y `snap.ref.delete()` en exceso
- [ ] Tests de `sharedLists.test.ts` pasan (6 escenarios)
- [ ] `claims.test.ts` actualizado y pasa con mock de `defineSecret`
- [ ] `ADMIN_EMAIL` eliminado de `functions/.env`
- [ ] Secret `ADMIN_EMAIL` creado en Secret Manager (paso manual documentado en PR)
- [ ] `isValidFollowedTags` en `firestore.rules` con validacion por elemento
- [ ] `listItems.businessId` pasa `isValidBusinessId()`
- [ ] `follows.followedId` tiene `size() <= 128`
- [ ] `listItems.listId` tiene `size() <= 128`
- [ ] `docs/reference/security.md` actualizado
- [ ] `docs/reference/firestore.md` actualizado
- [ ] Build de functions pasa sin errores TypeScript
- [ ] No lint errors
- [ ] Tests de functions pasan con >= 80% coverage en codigo nuevo

# Plan de implementación: Offline support para custom tags y profile mutations (#344)

**Specs:** [specs.md](specs.md) — VALIDADO por Diego (Arquitecto, 2026-06-10)
**PRD:** [prd.md](prd.md) — VALIDADO CON OBSERVACIONES por Sofia (2026-06-10)
**Fecha:** 2026-06-12
**Branch:** `feat/344-offline-custom-tags-profile-mutations`

---

## Estrategia y staging de riesgo

El orden sube de "núcleo de datos sin UI" (tipos + service) hacia "wiring de componentes" y cierra con tests + rules + docs. El riesgo está concentrado en F2 (cambio `addDoc`→`setDoc` del service, que toca la ruta crítica de creación de tags) y se aísla en su propia fase con tests antes de cablear UI. La exhaustividad compile-time del `Record<OfflineActionType, OfflineHandler>` obliga a hacer F1 (tipos) y F3 (handlers) juntas o el build queda roto entre fases — ver "Orden e invariante de build".

| Fase | Contenido | Riesgo | Por qué |
|------|-----------|--------|---------|
| F1 | 3 variantes `OfflineActionType` + payloads (`types/offline.ts`) | Bajo | Solo tipos; pero rompe build hasta que F3 agregue handlers (ver invariante) |
| F2 | `generateCustomTagId()` + `createCustomTag(tagId?)` + fix trim (`services/tags.ts`) | **Medio** | Cambia el mecanismo de escritura de tags (ruta crítica); cubierto por tests en la misma fase |
| F3 | 3 handlers en `registerOfflineHandlers.ts` | Bajo | Cierra la exhaustividad del Record abierta en F1 |
| F4 | Wrap `withOfflineSupport` en `BusinessTags` | Medio | Toca un componente de uso frecuente; patrón ya presente (`handleToggleTag`) |
| F5 | Gate offline profile (`EditDisplayNameDialog`, `AvatarPicker`, `ProfileScreen`, `AuthContext`) | Bajo | Gate UI + guard defensivo; sin nueva superficie de escritura |
| F6 | Rules test `customTags` + tests de componentes restantes | Bajo | Cierra checkbox de inventario tests.md; no toca código de producción |
| F7 | Documentación (obligatoria) | Bajo | patterns.md / features.md / firestore.md / security.md |

### Orden e invariante de build

Agregar las 3 variantes a la union `OfflineActionType` (F1) **rompe la compilación** del `Record<OfflineActionType, OfflineHandler>` en `registerOfflineHandlers.ts` hasta que F3 agregue los 3 handlers (esto es deseado — es el guardrail de exhaustividad). Por lo tanto **F1, F2 y F3 deben mergearse en el mismo commit/PR-state compilable**, o ejecutarse en secuencia inmediata sin commitear un estado intermedio que no buildea. Decisión: **commits atómicos por fase, pero F1→F2→F3 se implementan en bloque y el primer commit "verde" es al cerrar F3.** No commitear F1 sola.

---

## File ownership por agente

| Fase | Archivos | Agente | Tipo de trabajo |
|------|----------|--------|-----------------|
| F1 | `src/types/offline.ts` | nico | Tipos / dominio offline |
| F2 | `src/services/tags.ts`, `src/services/__tests__/tags.test.ts` | nico | Service + tests de service |
| F3 | `src/services/registerOfflineHandlers.ts`, `src/services/__tests__/registerOfflineHandlers.test.ts` | nico | Registry + tests |
| F4 | `src/components/business/BusinessTags.tsx`, `src/components/business/__tests__/BusinessTags.test.tsx`, `src/services/__tests__/offlineInterceptor.test.ts`, `src/services/__tests__/syncEngine.test.ts` | luna | Componente + tests de integración offline |
| F5 | `src/components/profile/EditDisplayNameDialog.tsx`, `src/components/profile/AvatarPicker.tsx`, `src/components/profile/ProfileScreen.tsx`, `src/context/AuthContext.tsx` | luna | UI profile + guard context |
| F6 | `tests/rules/customTags.rules.test.ts`, `src/components/profile/__tests__/EditDisplayNameDialog.test.tsx`, `src/components/profile/__tests__/AvatarPicker.test.tsx`, `src/context/AuthContext.test.tsx` | luna | Tests de UI + rules |
| F7 | `docs/reference/*` | nico | Documentación |

Sin conflicto de ownership: nico es dueño exclusivo de F1–F3 + F7 (capa de datos/tipos/docs), luna de F4–F6 (componentes y su testing). El único punto de contacto cruzado es la firma de `createCustomTag(tagId?)` y la union `OfflineActionType` — ambos quedan congelados al cerrar F3 antes de que luna empiece F4.

---

## Fase 1 — Variantes y payloads de `OfflineActionType` (S1)

- **Archivo:** `src/types/offline.ts`. **Agente:** nico.
- **Cambio:**
  - Agregar a la union `OfflineActionType`: `'custom_tag_create' | 'custom_tag_update' | 'custom_tag_delete'`.
  - Agregar payloads: `CustomTagCreatePayload { label: string }`, `CustomTagUpdatePayload { label: string }`, `CustomTagDeletePayload { _type: 'custom_tag_delete' }` (marker, alineado con `RatingDeletePayload`/`ListDeletePayload`).
  - Sumar los 3 payloads a la union `OfflineActionPayload`.
  - El `tagId` NO entra al payload: viaja en el campo genérico existente `OfflineAction.referenceId` (sin tocar el shape de `OfflineAction`).
- **Test:** ninguno propio (tipos). El compilador valida en F3.
- **Commit (NO verde aislado — ver invariante de build):** se incluye junto a F2/F3. Mensaje del bloque en F3.
- **Rollback:** revert de la union + payloads (revierte build a estado previo).

## Fase 2 — `generateCustomTagId()` + `createCustomTag(tagId?)` + fix trim (S1)

- **Archivos:** `src/services/tags.ts`, `src/services/__tests__/tags.test.ts`. **Agente:** nico.
- **Cambio en `tags.ts`:**
  - Agregar `generateCustomTagId(): string` → `doc(collection(db, COLLECTIONS.CUSTOM_TAGS)).id` (espejo exacto de `generateListId()` en `sharedLists.ts`).
  - Migrar `createCustomTag(userId, businessId, label, tagId?)`: si `tagId` viene → `setDoc(doc(db, COLLECTIONS.CUSTOM_TAGS, tagId), docData)`; si no → `addDoc(...)` (fallback online, mismo branch que `createList(listId?)`).
  - **Fix de hardening:** enviar `label: trimmed` en AMBOS paths (hoy el `addDoc` manda `label` crudo aunque valida `trimmed`). Conservar el throw si `!trimmed || trimmed.length > MAX_CUSTOM_TAG_LENGTH`.
  - `setDoc` no agrega campos extra: solo los 4 del whitelist (`userId`, `businessId`, `label`, `createdAt`). El `tagId` es el doc ID, NO un field.
  - `updateCustomTag`/`deleteCustomTag`: sin cambio de firma.
- **Test (misma fase, no diferida):** `tags.test.ts` — `generateCustomTagId` devuelve ID no vacío; `createCustomTag` con `tagId` llama `setDoc(doc(..., tagId))`; sin `tagId` llama `addDoc`; ambos paths envían `label` con trim; validación 1-30 sigue lanzando.
- **Commit (NO verde aislado — la union de F1 rompe el Record hasta F3):** incluido en el bloque F1–F3.
- **Rollback:** revert de `tags.ts` a `addDoc`-only + revert del test.

## Fase 3 — Handlers de replay (S1) — cierra el build

- **Archivos:** `src/services/registerOfflineHandlers.ts`, `src/services/__tests__/registerOfflineHandlers.test.ts`. **Agente:** nico.
- **Cambio:** agregar 3 entradas al `Record<OfflineActionType, OfflineHandler>`:
  - `custom_tag_create`: `{ userId, businessId, referenceId, payload }` → `createCustomTag(userId, businessId, payload.label, referenceId)` (referenceId = tagId client-side, lazy `import('./tags')`).
  - `custom_tag_update`: `{ referenceId, payload }` → throw si falta `referenceId`; `updateCustomTag(referenceId, payload.label)`.
  - `custom_tag_delete`: `{ referenceId }` → throw si falta `referenceId`; `deleteCustomTag(referenceId)`.
  - Imports de tipo: `CustomTagCreatePayload`, `CustomTagUpdatePayload` (delete usa solo `referenceId`).
- **Test:** `registerOfflineHandlers.test.ts` — los 3 handlers invocan el service con payload deserializado; update/delete lanzan si falta `referenceId`; create pasa `referenceId` como `tagId`.
- **Commit (PRIMER commit verde del bloque F1–F3):** `feat(#344): custom tag offline action types, client-side id y handlers de replay`
- **Rollback:** revert del bloque completo F1+F2+F3 (son interdependientes por exhaustividad).

## Fase 4 — Wrap `withOfflineSupport` en `BusinessTags` (S1)

- **Archivos:** `src/components/business/BusinessTags.tsx` (+ tests de integración). **Agente:** luna.
- **Cambio:** modificar `handleSaveCustomTag` (create + update) y `handleDelete`, alineado con `handleToggleTag` (L84-105):
  - **create:** `const tagId = generateCustomTagId()` ANTES de wrappear; `withOfflineSupport(isOffline, 'custom_tag_create', { userId, businessId, businessName, referenceId: tagId }, { label }, () => createCustomTag(user.uid, businessId, label, tagId), toast)`.
  - **update:** `withOfflineSupport(isOffline, 'custom_tag_update', { userId, businessId, businessName, referenceId: editingTag.id }, { label }, () => updateCustomTag(editingTag.id, label), toast)`.
  - **delete:** `withOfflineSupport(isOffline, 'custom_tag_delete', { userId, businessId, businessName, referenceId: menuTag.id }, { _type: 'custom_tag_delete' }, () => deleteCustomTag(menuTag.id), toast)`.
  - Custom tags NO se deshabilitan offline — se encolan; el toast `OFFLINE_ENQUEUED_MSG` lo emite `withOfflineSupport`.
  - Cada handler en `try/catch` con `logger.error`.
  - Generar `tagId` client-side tanto online como offline (mismo doc referenciado por un update/delete posterior).
- **Tamaño:** componente pasa de 271 a ~283 (< 300 warn). Si supera 300 en implementación → extraer los 3 handlers a `src/hooks/useCustomTagActions.ts` (riesgo bajo, ver Estimación de tamaño).
- **Tests (misma fase):**
  - `BusinessTags.test.tsx`: create/update/delete online ejecutan el service; offline encolan + toast `OFFLINE_ENQUEUED_MSG`; el `tagId` generado en create es el encolado (estable create→delete offline).
  - `offlineInterceptor.test.ts` (extender): `withOfflineSupport` encola `custom_tag_*` con `referenceId` en meta y dispara `EVT_OFFLINE_ACTION_QUEUED` con `action_type` correcto.
  - `syncEngine.test.ts` (extender): crear+editar mismo tag offline (mismo `referenceId`) → drenado FIFO aplica ambos en orden y `updateCustomTag` recibe el `tagId` del create; **delete de tag cuyo create falló permanentemente: `deleteCustomTag` de doc inexistente resuelve limpio → `executeAction` NO falla → NO reintenta → NO llega a `OFFLINE_MAX_RETRIES`** (observación Sofia).
- **Commit:** `feat(#344): encolar custom tag create/update/delete con withOfflineSupport`
- **Rollback:** revert del componente a writes directos + revert de los tests añadidos. No afecta F1–F3 (los handlers quedan inertes si nadie encola).

## Fase 5 — Gate offline en profile mutations (S2)

- **Archivos:** `EditDisplayNameDialog.tsx`, `AvatarPicker.tsx`, `ProfileScreen.tsx`, `src/context/AuthContext.tsx`. **Agente:** luna.
- **Cambio:**
  - `EditDisplayNameDialog`: importar `useConnectivity` (dialog de feature, aceptable); `disabled={... || isOffline}` en botón Guardar + `title={isOffline ? MSG_OFFLINE.requiresConnection : undefined}` nativo sobre el `<Button>` (sin `<Tooltip>`/`<span>` — patrón del proyecto, confirmado por Sofia); `handleSave` retorna early si `isOffline`.
  - `AvatarPicker`: nueva prop `isOffline: boolean` (props-driven puro, NO importa `useConnectivity`); cada `<ButtonBase>` con `disabled={isOffline}` + `aria-disabled={isOffline}`.
  - `ProfileScreen`: pasar `isOffline={isOffline}` a `<AvatarPicker>` (ya tiene `useConnectivity()`/`isOffline` en scope, L57 verificado). Handler `onSelect` real ya existente, no se toca.
  - `AuthContext.setDisplayName` (L126-132) y `setAvatarId` (L134-145): **guard defense-in-depth** — early-return silencioso si `navigator.onLine === false`. Se lee `navigator.onLine` **directo** (NO `useConnectivity`, que es un hook React no usable dentro de los callbacks ya definidos del context), mismo criterio que `gateServiceWrite`/`getCountOfflineSafe`. NO encola, NO toast (la UI ya comunica vía disabled+title).
- **Test:** diferidos a F6 (junto con el rules test) para mantener este commit acotado a cambios de UI/context.
- **Commit:** `feat(#344): gate offline en profile mutations (dialog, avatar picker, authcontext guard)`
- **Rollback:** revert de los 4 archivos. Independiente de custom tags (F1–F4).

## Fase 6 — Tests de UI + rules test de `customTags` (S1/S2)

- **Archivos:** `EditDisplayNameDialog.test.tsx`, `AvatarPicker.test.tsx`, `AuthContext.test.tsx` (extender), `tests/rules/customTags.rules.test.ts` (nuevo). **Agente:** luna.
- **Cambio / qué testear:**
  - `EditDisplayNameDialog.test.tsx`: botón `disabled` cuando `isOffline`; `title` == "Requiere conexión" offline, `undefined` online; `handleSave` no llama `setDisplayName` offline.
  - `AvatarPicker.test.tsx`: `ButtonBase` `disabled`+`aria-disabled` cuando `isOffline=true`; `onSelect` NO se dispara offline, SÍ online.
  - `AuthContext.test.tsx` (extender): `setDisplayName`/`setAvatarId` no llaman al service cuando `navigator.onLine === false`.
  - `customTags.rules.test.ts` (nuevo, espejo de `users.rules.test.ts`, `@firebase/rules-unit-testing` v5): ALLOW create con ID client-side + label válido + owner; DENY label > 30; DENY campo extra fuera del whitelist; DENY update fuera de `label`; DENY delete de otro owner; **delete de doc inexistente resuelve sin error** (confirma el no-op tolerable del replay; documentar comportamiento si la rule deniega sobre `resource.data` ausente, observación Sofia) — marca el checkbox `customTags` en inventario tests.md.
- **Commit:** `test(#344): rules test customTags + tests de gate offline profile`
- **Rollback:** revert de los archivos de test (no afecta producción).

## Fase 7 — Documentación (OBLIGATORIA)

- **Agente:** nico.

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `docs/reference/patterns.md` | "Offline action types" 26 → 29; nota de `generateCustomTagId()` como espejo de `generateListId()`; patrón `referenceId` para transportar doc IDs client-side |
| 2 | `docs/reference/features.md` | Custom tags ahora soportan create/update/delete offline (encolado tipado); profile mutations gateadas offline |
| 3 | `docs/reference/firestore.md` | Sin colección nueva; nota de doc ID client-side en `customTags` (`setDoc` vs `addDoc`) |
| 4 | `docs/reference/security.md` | Marcar rules test de `customTags` cubierto; nota del vector overwrite-via-setDoc mitigado por ownership |
| 5 | `docs/reference/tests.md` | Marcar checkbox `customTags` en inventario; registrar `customTags.rules.test.ts`, `EditDisplayNameDialog.test.tsx`, `AvatarPicker.test.tsx` |

- **Commit:** `docs(#344): offline custom tags + profile gate (patterns, features, firestore, security, tests)`
- **Rollback:** revert de docs.

---

## Orden de implementacion

1. `src/types/offline.ts` (F1) — sin dependencias; rompe build hasta paso 3.
2. `src/services/tags.ts` + `tags.test.ts` (F2) — depende de `COLLECTIONS.CUSTOM_TAGS` (existente).
3. `src/services/registerOfflineHandlers.ts` + test (F3) — cierra exhaustividad del Record; **primer estado verde**.
4. `src/components/business/BusinessTags.tsx` + tests integración (F4) — depende de F2 (`generateCustomTagId`, `createCustomTag(tagId?)`) y F1 (action types).
5. Profile: `EditDisplayNameDialog`, `AvatarPicker`, `ProfileScreen`, `AuthContext` (F5) — independiente de custom tags.
6. Tests UI + rules (F6) — depende de F5 (componentes) y de las rules existentes.
7. Docs (F7) — al final.

Pasos 1-3 en bloque atómico (invariante de build). Paso 5 puede correr en paralelo a 1-4 (sin overlap de archivos). Paso 6 tras 5. Paso 7 al cierre.

---

## Test plan global

- **Unit/service:** `tags.test.ts` (F2), `registerOfflineHandlers.test.ts` (F3), `offlineInterceptor.test.ts` + `syncEngine.test.ts` (F4).
- **Componente:** `BusinessTags.test.tsx` (F4), `EditDisplayNameDialog.test.tsx` + `AvatarPicker.test.tsx` (F6).
- **Context:** `AuthContext.test.tsx` (F6).
- **Rules:** `customTags.rules.test.ts` contra emulador (F6).
- **Cobertura:** >= 80% del código nuevo; branches global no baja de 81.86%.
- **Compile-time:** `tsc` valida exhaustividad del `Record<OfflineActionType, OfflineHandler>` (los 3 handlers obligatorios).
- **Gate:** `npm run lint` + `npm run build` + suite completa verde antes de merge.

---

## Riesgos

1. **Build roto entre F1 y F3** (medio): agregar la union sin handlers rompe el `Record` exhaustivo. **Mitigación:** F1–F3 se mergean como bloque atómico; el primer commit verde es al cerrar F3 (ver invariante de build). No commitear F1 aislada.
2. **`createCustomTag` con parámetro posicional `tagId?` al final** (bajo): los call sites existentes que pasan 3 args (`userId, businessId, label`) siguen funcionando (`tagId` queda `undefined` → branch `addDoc`). Solo `BusinessTags` pasará el 4º arg. **Mitigación:** firma append-only, no reordena parámetros.
3. **Rate limit server-side borra tags al drenar cola grande** (tech debt aceptado, observación Sofia): el `setDoc` resuelve OK (rule pasa), `syncEngine` marca `synced`, pero `onCustomTagCreated` puede hacer `snap.ref.delete()` al exceder 10/business o 50/día. El toast "Guardado offline" no distingue ese caso. **Mitigación:** documentado como tech debt conocido en specs (Cloud Functions); NO se mitiga acá (fuera de scope: no se tocan rules ni trigger). Telemetría futura registrada como followup.
4. **`BusinessTags.tsx` cruza 300 líneas** (bajo): los wraps suman ~12 líneas (271 → ~283). **Mitigación:** si supera 300, extraer los 3 handlers a `src/hooks/useCustomTagActions.ts`.

---

## Estimacion de tamano de archivos

| Archivo | Lineas actuales | Estimadas post-cambio | Dentro del limite? |
|---------|----------------|----------------------|--------------------|
| `src/types/offline.ts` | (union + payloads) | +~10 | Si (< 400) |
| `src/services/tags.ts` | ~70 | ~90 | Si (< 400) |
| `src/services/registerOfflineHandlers.ts` | (Record) | +~20 | Si (< 400) |
| `src/components/business/BusinessTags.tsx` | 271 | ~283 | Si (< 300 warn; vigilar) |
| `src/components/profile/EditDisplayNameDialog.tsx` | — | +~6 | Si (< 400) |
| `src/components/profile/AvatarPicker.tsx` | — | +~6 | Si (< 400) |
| `src/context/AuthContext.tsx` | — | +~6 | Si (< 400) |
| `tests/rules/customTags.rules.test.ts` | 0 (nuevo) | ~130 | Si (< 400) |

---

## Guardrails de modularidad

- [x] Ningún componente importa `firebase/firestore` — writes vía `services/tags.ts`; guard usa `navigator.onLine` (no Firebase)
- [x] Archivos en carpeta de dominio correcta (`business/`, `profile/`, `services/`, `types/`) — no `menu/`
- [x] Lógica de negocio (gen ID, persistencia) en `services/`, no en componentes
- [x] `AvatarPicker` sigue props-driven puro (recibe `isOffline` por prop, no importa contexto)
- [x] Action type strings en la union de `types/offline.ts` (no magic strings)
- [x] Se toca un archivo con deuda menor conocida (`createCustomTag` sin trim) e incluye el fix
- [x] Ningún archivo resultante supera 400 líneas (BusinessTags vigilado a 300)

## Guardrails de seguridad

- [x] `customTags` create conserva `hasOnly(['userId','businessId','label','createdAt'])` — `setDoc` no agrega campos
- [x] `label` valida `is string` + `size() <= 30` (rule existente); service envía `label: trimmed`
- [x] Update conserva `affectedKeys().hasOnly(['label'])`; immutables fuera de la lista
- [x] ID client-side no abre vector: ownership server-side (create `userId == auth.uid`, update/delete `resource.data.userId == auth.uid`) bloquea overwrite
- [x] Rate limit server-side existente (10/business + 50/día con delete on exceed) — no se introduce colección nueva
- [x] `getCountFromServer` → N/A (no hay count queries nuevas)
- [x] No hay secrets ni credenciales en archivos commiteados

## Guardrails de observabilidad

- [x] No hay CF nueva (trigger `customTags.ts` existente, sin tocar)
- [x] `generateCustomTagId`/`createCustomTag` son writes, no queries nuevas → no requieren `measureAsync`
- [x] `EVT_OFFLINE_ACTION_QUEUED` reusado (ya registrado); `custom_tag_*` aparecen como `action_type` libre, sin registro adicional
- [x] `logger.error` en handlers de `BusinessTags`, nunca dentro de `if (import.meta.env.DEV)`

## Guardrails de accesibilidad y UI

- [x] `AvatarPicker` ButtonBase con `disabled` + `aria-disabled` (no solo visual) offline
- [x] Botón Guardar con `title` nativo offline (sin `<Tooltip>`/`<span>` wrapper)
- [x] Custom tags NO se deshabilitan (encolables) — feedback vía toast
- [x] Touch targets >= 44x44 (IconButtons ya cumplen)
- [x] `<IconButton>` existentes conservan `aria-label`

## Guardrails de copy

- [x] No se crean textos nuevos — `OFFLINE_ENQUEUED_MSG` y `MSG_OFFLINE.requiresConnection` reusados
- [x] Tildes correctas ("sincronizará", "conexión")
- [x] Terminología "etiquetas"/"comercios" en copy auxiliar

---

## Rollback global

Fases mayormente independientes. **F1–F3 son un bloque atómico** (interdependencia por exhaustividad del Record): revertir requiere revertir las tres juntas. F4 (BusinessTags) depende de F1–F3 pero su revert deja los handlers inertes (nadie encola) sin romper el build. F5 (profile) es totalmente independiente y revertible por sí sola. F6/F7 son tests + docs, revertibles sin impacto de producción.

---

## Criterios de done

- [ ] Crear/editar/eliminar custom tags offline encola `custom_tag_*` tipado, replay correcto al reconectar, toast "Guardado offline"
- [ ] Custom tag creado offline tiene ID client-side estable (editar/eliminar offline referencia el mismo doc; replay no falla)
- [ ] Botón Guardar de `EditDisplayNameDialog` y avatares de `AvatarPicker` deshabilitados con "Requiere conexión" offline; guard `navigator.onLine` en `AuthContext`
- [ ] Rules de `customTags`/`users` sin cambios; rules test allow+deny de `customTags` agregado (cierra checkbox tests.md)
- [ ] Cobertura >= 80% del código nuevo; branches global >= 81.86%; exhaustividad de los 3 handlers en compile-time
- [ ] No lint errors; build verde
- [ ] Seed data: N/A (sin schema change)
- [ ] Reference docs actualizados (patterns, features, firestore, security, tests)

---

## Validacion de Plan

**Validador:** Pablo (Delivery Lead — Modo Mapa)
**Estado:** VALIDADO CON OBSERVACIONES
**Fecha:** 2026-06-12
**Ciclo:** 1

**Observaciones para el implementador:**

1. **Invariante de build F1–F3 (punto sensible) — bien resuelto, blindar en los prompts de agente.** El plan secuencia F1→F2→F3 como bloque atómico con un solo commit verde al cerrar F3, lo cual es correcto: agregar las 3 variantes a la union sin los 3 handlers rompe la exhaustividad del `Record<OfflineActionType, OfflineHandler>` (verificado en `registerOfflineHandlers.ts:36`). Riesgo de delivery: nico es dueño de las 3 fases pero el pre-push hook corre `tsc + vite build`; si por algún motivo intenta pushear un estado intermedio (F1 o F2 sin F3) el push FALLA. Asegurar que el prompt de nico diga explícitamente "no commitear/pushear hasta cerrar F3; el primer estado compilable es con los 3 handlers registrados".

2. **F4 y F5 pueden correr en paralelo (ambas de luna) sin overlap, pero F4 depende de F1–F3 cerrado.** F5 (profile) es independiente de custom tags y puede arrancar en paralelo a F1–F3 de nico. F4 (BusinessTags) NO: consume `generateCustomTagId` y `createCustomTag(tagId?)` (F2) y las action types (F1). Secuenciar F4 después del commit verde de F3. El plan ya lo dice en "Orden de implementacion" (paso 4 tras paso 3); mantenerlo al delegar.

3. **F4 toca `offlineInterceptor.test.ts` y `syncEngine.test.ts` (extensión, no creación).** Son archivos de test compartidos del dominio offline. Asignados a luna en F4 — ownership exclusivo correcto, sin overlap con nico (que no toca tests de interceptor/syncEngine). Solo confirmar que nico en F3 NO extienda esos dos archivos: su scope de test es `registerOfflineHandlers.test.ts` exclusivamente.

4. **Límite de archivo: el blocker del merge skill es 400 líneas, no 300** (verificado en `merge/SKILL.md:228`). BusinessTags proyectado a ~283 está holgado bajo el blocker. El umbral de 300 es un warn interno con plan de mitigación (extraer a `useCustomTagActions.ts`). No bloquea entrega; vigilar en implementación como dice el plan.

5. **Estimación coherente con el PRD (esfuerzo total M).** 7 fases, mayoría S, F4 es la única M. Suma razonable para M. Sin pasos "triviales" que escondan 20 archivos.

6. **Rate limit server-side en replay = tech debt aceptado, correctamente fuera de scope.** El plan no agenda mitigación (no toca trigger ni rules) y lo documenta como followup de telemetría. Alineado con specs y observación de Sofia. No es un gap de delivery.

**Listo para pasar a implementacion:** Sí. Sin bloqueantes. El punto sensible (invariante F1–F3) está correctamente staged. Delegar nico→F1-F3 (bloque) + F7; luna→F5 en paralelo, luego F4 (tras commit verde de F3) + F6.

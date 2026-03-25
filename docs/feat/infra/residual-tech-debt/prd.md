# PRD: Hallazgos residuales post-audit

**Feature:** residual-tech-debt
**Categoria:** infra
**Fecha:** 2026-03-25
**Issue:** #181
**Prioridad:** Media

---

## Contexto

Después de resolver los issues #175-#179 (SharedListsView refactor, security hardening, performance, offline, UI/UX), un health check completo detectó 11 hallazgos residuales de menor severidad que no justificaron issues individuales pero sí un pase consolidado.

## Problema

- 2 componentes siguen importando `firebase/firestore` directamente, violando el service layer pattern
- 60 `console.error/log/warn` dispersos en 34 archivos sin centralizar ni gate por environment
- Shared lists tiene 12+ operaciones de escritura sin soporte offline ni feedback al usuario
- `httpsCallable` en componentes user-facing sin guard offline (invite, report photo)
- Dos chunks index de ~450KB cada uno sin análisis de qué módulos los componen
- UI frágil: FilterChips `top:72` hardcodeado, z-index compartido OfflineIndicator/SearchBar

## Solución

### S1: Service layer cleanup (Architecture)

Mover queries inline de `AddToListDialog.tsx` y `EditorsDialog.tsx` a `services/sharedLists.ts`:
- `fetchUserListsWithItemStatus(userId, businessId)` — reemplaza getDocs inline en AddToListDialog
- Reusar `fetchEditorName(uid)` ya existente en sharedLists.ts — EditorsDialog ya lo importa de ahí post-#175, verificar

### S2: Logger centralizado (Architecture)

Crear `src/utils/logger.ts`:
- `logger.error()`, `logger.warn()`, `logger.log()` — gate en `import.meta.env.DEV`
- En prod, route errors a Sentry via `Sentry.captureException()`
- Reemplazar los 60 `console.*` calls con `logger.*`

### S3: Shared lists offline feedback (Offline)

No agregar al offline queue (complejidad alta, bajo impacto). En cambio:
- Deshabilitar botones de mutación (create, delete, invite, toggle) cuando `isOffline`
- Mostrar tooltip "Requiere conexión" en botones deshabilitados
- Aplicar el mismo patrón a `MenuPhotoViewer` (report) y `FeedbackForm` (media upload)

### S4: Bundle analysis (Performance)

- Correr `npx vite-bundle-visualizer` para identificar qué hay en los dos chunks index
- Evaluar code-split de `@vis.gl/react-google-maps`, Sentry, o react-router
- No implementar splits en este PR — solo documentar hallazgos para futuro

### S5: UI fixes (UI/UX)

- FilterChips: reemplazar `top: 72` con CSS custom property `--search-bar-height` definida en SearchBar
- OfflineIndicator: subir z-index a 1200 para evitar solapamiento con SearchBar en 360px

### S6: Security minor (Security)

- Agregar comment warning en `functions/.env` indicando que el archivo está committed
- No requiere cambio funcional

---

## Scope

| Item | Prioridad | Esfuerzo |
|------|-----------|----------|
| S1: Service layer cleanup (2 componentes) | Alta | S |
| S2: Logger centralizado + reemplazo 60 calls | Media | M |
| S3: Offline feedback shared lists + httpsCallable | Alta | S |
| S4: Bundle analysis (solo diagnóstico) | Media | S |
| S5: UI fixes (FilterChips + z-index) | Baja | S |
| S6: Security comment en functions/.env | Baja | XS |

**Esfuerzo total estimado:** M

---

## Out of Scope

- Agregar shared lists writes al offline queue (complejidad alta, issue separado si se decide)
- Code-splitting de chunks index (este PR solo diagnostica, no implementa)
- Migrar `functions/.env` a Firebase environment config (cambio de infra mayor)
- Extraer SharedListsView a hook `useSharedLists` (ya se redujo a 398 líneas en #175)

---

## Tests

### Archivos que necesitarán tests

| Archivo | Tipo | Qué testear |
|---------|------|-------------|
| `src/utils/logger.ts` | Utility | Gate DEV/PROD, Sentry integration |
| `src/services/sharedLists.ts` | Service | Nuevas funciones de fetch (si se agregan) |

### Criterios de testing

- Cobertura ≥ 80% del código nuevo
- Logger: verificar que en PROD no llama console.*, sí Sentry
- Logger: verificar que en DEV llama console.*
- No romper coverage existente (actualmente en 80.1% branches)

---

## Seguridad

- [ ] `functions/.env` tiene comment warning sobre estar committed
- [ ] Logger no expone stack traces ni datos de usuario en producción
- [ ] No se introducen nuevos patterns inseguros

---

## Offline

### Data flows

| Operacion | Tipo | Estrategia offline | Fallback UI |
|-----------|------|-------------------|-------------|
| Shared lists CRUD | write | No queue — deshabilitar UI | Botones disabled + tooltip |
| inviteEditor | write (callable) | No queue — deshabilitar UI | Botón disabled + tooltip |
| reportMenuPhoto | write (callable) | No queue — deshabilitar UI | Botón disabled + tooltip |
| sendFeedback + media | write | No queue — deshabilitar submit | Alert "Requiere conexión" |

### Checklist offline

- [x] Reads de Firestore: usan persistencia offline (ya implementado)
- [ ] Writes: deshabilitar UI cuando offline (S3)
- [ ] APIs externas (httpsCallable): deshabilitar botones (S3)
- [x] UI: OfflineIndicator ya existe
- [x] Datos criticos: disponibles en cache

### Esfuerzo offline adicional: S

---

## Modularizacion

### Checklist modularizacion

- [x] Logger es utility puro, sin dependencia a componentes
- [x] S1 mueve lógica de componentes a service layer (mejora separación)
- [x] S3 usa `useConnectivity()` hook existente, no agrega estado a AppShell
- [x] No se crean nuevos componentes de layout

---

## Success Criteria

1. 0 imports de `firebase/firestore` en `src/components/` (excepto hooks justificados)
2. 0 `console.error/log/warn` directos — todos via `logger.*`
3. Botones de shared lists, invite, report y feedback+media deshabilitados offline con tooltip
4. Bundle analysis documentado en `docs/reports/tech-debt.md`
5. FilterChips y OfflineIndicator no se solapan en 360px
6. Coverage ≥ 80% branches mantenido

# Plan: Performance Improvements

**Specs:** [specs.md](specs.md)
**Fecha:** 2026-03-29

---

## Fases de implementacion

### Fase 1: Dead code + dynamic import + parallelization

**Branch:** `feat/245-performance`

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/services/achievements.ts` | Eliminar export `deleteAchievement` (linea 37-40) |
| 2 | `src/services/favorites.ts` | Eliminar exports `addFavoritesBatch` (linea 44-72) y `fetchUserFavoriteIds` (linea 74-77) |
| 3 | `src/services/favorites.test.ts` | Eliminar bloque `describe('addFavoritesBatch', ...)` y su import |
| 4 | `src/services/follows.ts` | Eliminar export `fetchFollowers` (linea 86-102) |
| 5 | `src/services/sharedLists.ts` | Eliminar export `copyList` (buscar linea 125 y funcion completa) |
| 6 | `src/services/specials.ts` | Eliminar export `deleteSpecial` (linea 45 y funcion completa) |
| 7 | `src/hooks/usePriceLevelFilter.ts` | Eliminar export `invalidatePriceLevelCache` (linea 78-81) |
| 8 | `src/utils/formatDate.ts` | Eliminar export `formatDateFull` (linea 53-67) |
| 9 | `src/utils/formatDate.test.ts` | Eliminar tests de `formatDateFull` |
| 10 | `src/components/business/MenuPhotoUpload.tsx` | Reemplazar `import imageCompression from 'browser-image-compression'` por dynamic import dentro de `handleSubmit`: `const { default: imageCompression } = await import('browser-image-compression')`. Opcionalmente agregar `import type` si se necesita el tipo |
| 11 | `src/services/businessData.ts` | En `fetchUserLikes`: reemplazar `for` loop secuencial (lineas 28-37) por `Promise.all(batches.map(...))`. Crear array de batches, ejecutar en paralelo, iterar resultados |
| 12 | `src/services/businessData.test.ts` | Agregar/actualizar tests: verificar que `fetchUserLikes` con 0 IDs retorna Set vacio, con <30 IDs hace 1 query, con 90+ IDs ejecuta multiples queries via Promise.all |

### Fase 2: Split AuthContext

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/context/AuthContext.tsx` | Crear `AuthStateContext` con interface `AuthStateContextType` (user, displayName, avatarId, isLoading, authError, authMethod, emailVerified) |
| 2 | `src/context/AuthContext.tsx` | Crear `AuthActionsContext` con interface `AuthActionsContextType` (setDisplayName, setAvatarId, clearAuthError, signInWithGoogle, signOut, linkEmailPassword, signInWithEmail, resendVerification, refreshEmailVerified, changePassword) |
| 3 | `src/context/AuthContext.tsx` | Modificar `AuthProvider` para renderizar ambos providers anidados. `useMemo` separado para state (depende de valores reactivos) y actions (depende de callbacks estables) |
| 4 | `src/context/AuthContext.tsx` | Agregar hooks `useAuthState()` y `useAuthActions()` que consumen sus respectivos contextos |
| 5 | `src/context/AuthContext.tsx` | Refactorear `useAuth()` como wrapper: `return { ...useAuthState(), ...useAuthActions() }` |
| 6 | `src/context/AuthContext.tsx` | Exportar `useAuthState`, `useAuthActions`, y los tipos `AuthStateContextType`, `AuthActionsContextType` |
| 7 | `src/context/AuthContext.test.tsx` | Agregar tests para `useAuthState` (retorna solo estado), `useAuthActions` (retorna solo funciones), y verificar que los 35 tests existentes de `useAuth` siguen pasando |

### Fase 3: Verificacion y lint

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | N/A | Ejecutar `npm run lint` — verificar sin errores nuevos |
| 2 | N/A | Ejecutar `npm run test:run` — verificar que todos los tests pasan |
| 3 | N/A | Ejecutar `npm run build` — verificar que el build compila. Opcionalmente verificar con `npx vite-bundle-visualizer` que `browser-image-compression` no esta en el chunk principal |

### Fase 4: Documentacion (OBLIGATORIA)

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `docs/reference/patterns.md` | Actualizar seccion "Datos y estado" o agregar nota en AuthContext sobre el split State/Actions. Agregar patron "Dynamic import for heavy deps" referenciando MenuPhotoUpload y Sentry como ejemplos |
| 2 | `docs/reference/data-layer.md` | Eliminar menciones a `deleteAchievement`, `addFavoritesBatch`, `fetchUserFavoriteIds`, `fetchFollowers`, `copyList`, `deleteSpecial` de las tablas de operaciones por servicio |
| 3 | `docs/reference/files.md` | Verificar que no hay menciones a las funciones eliminadas |

---

## Estimacion de tamano de archivos

| Archivo | Lineas actuales | Lineas estimadas post-cambio | Dentro de limite? |
|---------|----------------|------------------------------|-------------------|
| `src/context/AuthContext.tsx` | 259 | ~285 (+26 boilerplate de 2 contextos) | Si (< 400) |
| `src/services/businessData.ts` | 151 | ~155 (cambio menor) | Si (< 400) |
| `src/components/business/MenuPhotoUpload.tsx` | 146 | ~145 (remueve 1 import, agrega 1 linea en funcion) | Si (< 400) |
| `src/services/favorites.ts` | 78 | ~40 (elimina 2 funciones) | Si (< 400) |
| `src/services/follows.ts` | 104 | ~85 (elimina 1 funcion) | Si (< 400) |
| `src/hooks/usePriceLevelFilter.ts` | 81 | ~76 (elimina 1 funcion) | Si (< 400) |
| `src/utils/formatDate.ts` | 67 | ~52 (elimina 1 funcion) | Si (< 400) |

---

## Orden de implementacion

1. **Fase 1, pasos 1-9:** Eliminar dead code (independiente, sin dependencias)
2. **Fase 1, paso 10:** Dynamic import en MenuPhotoUpload (independiente)
3. **Fase 1, paso 11-12:** Paralelizar fetchUserLikes + tests (independiente)
4. **Fase 2, pasos 1-7:** Split AuthContext (depende de que Fase 1 este completa para correr tests juntos)
5. **Fase 3:** Verificacion global
6. **Fase 4:** Documentacion

Los pasos 1-3 del orden son independientes entre si y pueden implementarse en paralelo.

---

## Riesgos

| Riesgo | Probabilidad | Mitigacion |
|--------|-------------|-----------|
| Alguna funcion "dead" se usa indirectamente (dynamic import, string-based) | Baja | Verificado con grep exhaustivo. Ninguna funcion se importa fuera de sus tests |
| Split de AuthContext rompe tests existentes | Media | Los 35 tests usan `useAuth()` que se mantiene como wrapper. Se ejecutan sin cambios. Nuevos tests verifican los hooks granulares |
| Dynamic import de `browser-image-compression` falla en algun browser viejo | Baja | Dynamic `import()` esta soportado desde ES2020 y el proyecto ya usa el patron (Sentry, SyncEngine). El target de Vite lo soporta |

---

## Guardrails de modularidad

- [x] Ningun componente nuevo importa `firebase/firestore` directamente
- [x] Archivos nuevos en carpeta de dominio correcta (N/A, no hay archivos nuevos)
- [x] Logica de negocio en hooks/services, no en componentes
- [x] Si se toca un archivo con deuda tecnica, se documenta (AuthContext + #243)
- [x] Ningun archivo resultante supera 400 lineas

---

## Criterios de done

- [ ] `browser-image-compression` no aparece en el main chunk de Vite (verificar con `npm run build` y revisar output de chunks)
- [ ] `fetchUserLikes` usa `Promise.all` para batches paralelos
- [ ] AuthContext splitado en `AuthStateContext` + `AuthActionsContext` con `useAuth()` wrapper
- [ ] 8 funciones dead code eliminadas
- [ ] S5 (recharts lazy) confirmado como ya implementado, sin cambios necesarios
- [ ] Tests pasan con >= 80% coverage en codigo nuevo
- [ ] Sin errores de lint
- [ ] Build exitoso
- [ ] Documentacion de referencia actualizada (patterns.md, data-layer.md)

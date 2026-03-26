# PRD: Performance — AuthContext re-renders, lazy loading, bundle size

**Feature:** performance-tech-debt
**Categoria:** infra
**Fecha:** 2026-03-24
**Issue:** #177
**Prioridad:** Alta

---

## Contexto

Una auditoria de performance completa (2026-03-24) identifico problemas de re-renders innecesarios, lazy loading faltante y bundle size excesivo que impactan LCP y la experiencia en mobile.

## Problema

- AuthContext re-renderiza toda la app en cada cambio de ruta por usar `useLocation()` como dependencia reactiva
- SideMenu se importa eager (~50-80KB en critical path) aunque solo se muestra al abrir el hamburger menu
- recharts (375KB) se precachea en service worker para todos los usuarios aunque solo lo usan admin y stats
- `useVisitHistory` recomputa un array en cada render sin memoizar

## Solucion

### S1: AuthContext location ref

Reemplazar `useLocation()` en AuthContext por un ref que almacene el pathname. El pathname solo se usa dentro del callback de `onAuthStateChanged` para decidir si hacer sign-in anonimo — no necesita ser reactivo.

- Cambiar `useLocation()` por `useRef` + update en effect
- Eliminar `[location.pathname]` del dependency array del effect

### S2: Lazy-load SideMenu

Aplicar `React.lazy()` + `Suspense` a SideMenu en AppShell. El drawer ya tiene estado open/close que es un boundary natural para code-split.

- `const SideMenu = lazy(() => import('./SideMenu'))`
- Wrap con `<Suspense fallback={null}>` (el drawer ya tiene animacion de apertura)

### S3: Excluir recharts del precache

Agregar `globIgnores` en la config de workbox en `vite.config.ts` para excluir el chunk de recharts del service worker precache.

### S4: useMemo en useVisitHistory

Wrap `visitsWithBusiness` en `useMemo` con dependencia `[visits]`.

### S5: Analizar bundle (investigacion)

Correr `npm run analyze` para entender por que hay dos chunks index de ~450KB. Identificar modulos que se pueden code-split. No implementar — solo documentar hallazgos.

---

## Scope

| Item | Prioridad | Esfuerzo |
|------|-----------|----------|
| S1: AuthContext location ref | P0 | S |
| S2: Lazy-load SideMenu | P0 | S |
| S3: Excluir recharts del precache | P1 | S |
| S4: useMemo en useVisitHistory | P1 | S |
| S5: Analizar bundle | P2 | S |

**Esfuerzo total estimado:** S

---

## Out of Scope

- Lazy-load BusinessSheet (tradeoff UX — es la interaccion primaria)
- Refactor de module-level caches para agregar size limits (dataset pequeno)
- Code-splitting adicional basado en analisis de bundle (issue separado)
- Migracion a React Server Components

---

## Tests

### Archivos que necesitaran tests

| Archivo | Tipo | Que testear |
|---------|------|-------------|
| `src/context/AuthContext.tsx` | Unit (existente) | Verificar que no re-renderiza en route change |
| `src/hooks/useVisitHistory.ts` | Unit | Memoizacion de visitsWithBusiness |

### Criterios de testing

- Cobertura >= 80% del codigo modificado
- AuthContext tests existentes siguen pasando
- Build output muestra SideMenu en chunk separado

---

## Seguridad

- [x] Sin impacto en seguridad — cambios son de performance pura

---

## Offline

### Esfuerzo offline adicional: Ninguno

---

## Modularizacion

### Checklist modularizacion

- [x] Logica en hooks/services — solo se mueven imports y agregan memos
- [x] No se agregan componentes nuevos
- [x] No se agregan useState a AppShell o SideMenu

---

## Success Criteria

1. AuthContext no re-renderiza en navegacion entre rutas
2. SideMenu esta en un chunk separado en el build output
3. recharts no aparece en el precache manifest del service worker
4. `visitsWithBusiness` tiene referencia estable entre renders
5. Todos los tests pasan, build exitoso

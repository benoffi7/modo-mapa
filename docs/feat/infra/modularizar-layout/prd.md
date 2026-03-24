# PRD: Modularizar AppShell y SideMenu para desacoplar UI de logica

**Feature:** modularizar-layout
**Categoria:** infra
**Fecha:** 2026-03-24
**Issue:** #174
**Prioridad:** Alta

---

## Contexto

La app necesita flexibilidad para cambiar la UI (home, navegacion, layout general) sin tocar la logica de features. Actualmente AppShell y SideMenu concentran logica de negocio (onboarding, deep links, "sorprendeme", edit name) mezclada con layout, lo que acopla toda reestructuracion visual a esos dos archivos.

## Problema

- **AppShell.tsx** es un god component de orquestacion: 5 useState + 2 useRef + 4 useEffect para onboarding, deep links, y returnToListId. Importa MapView/LocationFAB/OfficeFAB directamente sin slot abstracto
- **SideMenu.tsx** tiene 450 lineas mezclando layout de drawer con logica de negocio: "sorprendeme" (geoloc + filtrado), edit display name dialog inline, feedbackDirty, listsBackHandler
- **9 componentes de menu/** reciben `onNavigate: () => void` que siempre significa "cerrar drawer", acoplando la semantica de navegacion al mecanismo visual
- **Flujo de onboarding** partido entre AppShell (owns state) y SideMenu (renders dialogs) sin hook propio
- **`useOnboardingHint`** definido inline en AppShell en vez de en `src/hooks/`
- **`formatRelativeTime`** duplicado en RecentVisits.tsx (ya existe en `src/utils/formatDate.ts`)

## Solucion

### S1. Extraer hooks de coordinacion de AppShell

Crear hooks que encapsulen la logica que hoy vive en AppShell:

- **`useOnboardingFlow`**: estado de benefitsOpen, benefitsSource, emailDialogOpen, emailDialogTab, handleCreateAccount, handleLogin, handleBenefitsContinue. AppShell solo consume el hook y pasa props
- **`useOnboardingHint`**: mover el hook inline (lineas 24-58 de AppShell) a `src/hooks/useOnboardingHint.ts`

### S2. Extraer logica de negocio de SideMenu

- **`useSurpriseMe`**: hook en `src/hooks/` que encapsula filtrado por distancia, random pick, y toast. SideMenu solo llama la funcion retornada
- **`EditDisplayNameDialog`**: componente independiente en `src/components/menu/`. Hoy su estado + handlers + JSX estan inline en SideMenu (lineas 176-205 + 416-445)

### S3. Desacoplar navegacion del mecanismo de drawer

- Cambiar la firma de `onNavigate: () => void` a `onSelectBusiness: (business: Business) => void` en los 9 componentes de menu/. El componente padre (hoy SideMenu) decide que hacer con la seleccion (cerrar drawer, navegar, etc.)
- Esto permite que los mismos componentes funcionen en un panel lateral fijo, un bottom nav, o cualquier otro layout

### S4. Unificar utilidades duplicadas

- Mover `formatRelativeTime` de RecentVisits.tsx a `src/utils/formatDate.ts` y eliminar la duplicacion

---

## Scope

| Item | Prioridad | Esfuerzo |
|------|-----------|----------|
| S1. `useOnboardingFlow` hook | Must | M |
| S1. Mover `useOnboardingHint` a src/hooks/ | Must | S |
| S2. `useSurpriseMe` hook | Must | S |
| S2. Extraer `EditDisplayNameDialog` | Must | S |
| S3. Cambiar `onNavigate` a `onSelectBusiness` en 9 componentes | Should | M |
| S4. Unificar `formatRelativeTime` | Should | S |

**Esfuerzo total estimado:** M

---

## Out of Scope

- Cambiar la estructura de routing de la app (eso viene despues)
- Crear un layout responsive/desktop (este refactor lo habilita, no lo implementa)
- Refactorear MapContext o renombrar sus contextos internos
- Modificar la logica de negocio de ninguna feature (solo mover donde vive)
- Cambiar la UI visual actual (el refactor es transparente para el usuario)

---

## Tests

### Archivos que necesitaran tests

| Archivo | Tipo | Que testear |
|---------|------|-------------|
| `src/hooks/useOnboardingFlow.ts` | Hook | State transitions: create account flow, login flow, benefits dialog open/close, source tracking |
| `src/hooks/useOnboardingHint.ts` | Hook | localStorage read/write, timing logic (4h threshold), dismiss |
| `src/hooks/useSurpriseMe.ts` | Hook | Filtrado por distancia, fallback cuando todos visitados, caso sin GPS |
| `src/components/menu/EditDisplayNameDialog.tsx` | Component | Open/close, validacion nombre (max 30), submit, cancel |

### Criterios de testing

- Cobertura >= 80% del codigo nuevo
- Tests de validacion para todos los inputs del usuario (displayName)
- Todos los paths condicionales cubiertos (GPS on/off, all visited, onboarding states)
- Side effects verificados (localStorage, toast, analytics)

---

## Seguridad

- [ ] No se introducen nuevos inputs de usuario (solo se mueve codigo existente)
- [ ] `EditDisplayNameDialog` mantiene validacion de longitud <= 30 chars (ya existente)
- [ ] No se exponen nuevas rutas ni endpoints
- [ ] Los hooks extraidos no alteran el flujo de auth existente

---

## Offline

### Data flows

| Operacion | Tipo (read/write) | Estrategia offline | Fallback UI |
|-----------|-------------------|-------------------|-------------|
| Sorprendeme | read (local) | Funciona offline (usa allBusinesses JSON + localStorage) | N/A |
| Edit display name | write | Ya usa withOfflineSupport si implementado, sino falla con toast | Toast error |
| Onboarding flow | read (localStorage) | Funciona offline (estado en localStorage) | N/A |

### Checklist offline

- [x] Reads de Firestore: no aplica (este refactor no agrega queries)
- [x] Writes: no se modifican los servicios subyacentes
- [x] APIs externas: no aplica
- [x] UI: no cambia comportamiento visible
- [x] Datos criticos: no aplica

### Esfuerzo offline adicional: S (ninguno, es refactor interno)

---

## Success Criteria

1. AppShell tiene <= 3 useState propios (los demas delegados a hooks)
2. SideMenu tiene <= 300 lineas (vs 450 actuales)
3. Ningun componente de `menu/` importa ni asume SwipeableDrawer
4. Todos los tests existentes pasan sin modificacion
5. Cobertura >= 80% en los hooks nuevos extraidos

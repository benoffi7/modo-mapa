# Plan: Modularizar AppShell y SideMenu

**Specs:** [specs.md](specs.md)
**Fecha:** 2026-03-24

---

## Fases de implementacion

### Fase 1: Extraer hooks de AppShell

**Branch:** `feat/174-modularizar-layout`

Extrae `useOnboardingHint` y `useOnboardingFlow` de AppShell. Al final de esta fase, AppShell funciona igual pero con logica delegada a hooks.

| Paso | Archivo | Cambio | ~Lineas |
|------|---------|--------|---------|
| 1.1 | `src/hooks/useOnboardingHint.ts` | Crear hook (copiar lineas 24-58 de AppShell). Exportar `useOnboardingHint`. | ~40 |
| 1.2 | `src/hooks/useOnboardingHint.test.ts` | Tests: localStorage read, timing con fake timers, dismiss, ya completado. | ~80 |
| 1.3 | `src/hooks/useOnboardingFlow.ts` | Crear hook con 4 useState + 3 callbacks + closeBenefits + closeEmailDialog. | ~50 |
| 1.4 | `src/hooks/useOnboardingFlow.test.ts` | Tests: create account con/sin benefits shown, login, benefitsContinue, close. | ~90 |
| 1.5 | `src/components/layout/AppShell.tsx` | Eliminar hook inline `useOnboardingHint`. Eliminar 4 useState + 3 callbacks de onboarding. Importar `useOnboardingFlow` y `useOnboardingHint` (este ultimo usado por `MapHint` local). Actualizar props a SideMenu y BenefitsDialog. | -40 neto |

**Verificacion Fase 1:**

- `npx tsc --noEmit` pasa
- `npm run lint` sin errores
- `npm run test:run` pasa (todos los tests existentes + nuevos)
- AppShell tiene 3 useState propios (menuOpen, menuInitialSection, sharedListId)
- La app funciona identica visualmente

---

### Fase 2: Extraer logica de SideMenu

Extrae `useSurpriseMe` y `EditDisplayNameDialog` de SideMenu.

| Paso | Archivo | Cambio | ~Lineas |
|------|---------|--------|---------|
| 2.1 | `src/hooks/useSurpriseMe.ts` | Crear hook. Recibe `{ onSelect, onClose }`. Usa `useVisitHistory`, `useSortLocation`, `useToast`, `allBusinesses`, `distanceKm`, `trackEvent`. | ~45 |
| 2.2 | `src/hooks/useSurpriseMe.test.ts` | Tests: filtrado por distancia, todos visitados, sin cercanos, analytics event. | ~100 |
| 2.3 | `src/components/menu/EditDisplayNameDialog.tsx` | Crear componente. Props: `open`, `onClose`. Usa `useAuth` internamente. Estado: `nameValue`, `isSaving`. | ~55 |
| 2.4 | `src/components/menu/EditDisplayNameDialog.test.tsx` | Tests: open/close, validacion vacio, maxLength, submit, Enter, cancel. | ~80 |
| 2.5 | `src/components/layout/SideMenu.tsx` | Reemplazar `handleSurprise` con `useSurpriseMe({ onSelect: setSelectedBusiness, onClose })`. Reemplazar edit name dialog inline con `<EditDisplayNameDialog open={nameDialogOpen} onClose={() => setNameDialogOpen(false)} />`. Eliminar estado `nameValue`, `isSaving`, `handleSaveName`, `handleOpenNameDialog`. Eliminar imports innecesarios (`useVisitHistory`, `allBusinesses`, `distanceKm`, `useSortLocation`). | -70 neto |

**Verificacion Fase 2:**

- `npx tsc --noEmit` pasa
- `npm run lint` sin errores
- `npm run test:run` pasa
- SideMenu tiene ~380 lineas (sin contar imports)
- "Sorprendeme" y editar nombre funcionan igual

---

### Fase 3: Desacoplar onNavigate y unificar formatRelativeTime

Cambia la firma de los 9 componentes de menu y unifica la utilidad duplicada.

| Paso | Archivo | Cambio | ~Lineas |
|------|---------|--------|---------|
| 3.1 | `src/components/menu/FavoritesList.tsx` | Renombrar prop `onNavigate` a `onSelectBusiness: (business: Business) => void`. Eliminar `useSelection` import y `setSelectedBusiness`. En `handleSelectBusiness`: llamar `onSelectBusiness(business)` directo. | ~-5 |
| 3.2 | `src/components/menu/RatingsList.tsx` | Idem paso 3.1. | ~-5 |
| 3.3 | `src/components/menu/CommentsList.tsx` | Idem. En el callback de notificacion (linea ~424): reemplazar `setSelectedBusiness(biz); onNavigate()` con `onSelectBusiness(biz)`. Eliminar import `useSelection`. | ~-5 |
| 3.4 | `src/components/menu/RecentVisits.tsx` | Renombrar prop. Eliminar funcion local `formatRelativeTime` (lineas 12-23). Importar `formatRelativeTime` de `utils/formatDate`. Pasar `new Date(visit.lastVisited)` en vez de string. Ajustar: el componente ya no llama `setSelectedBusiness`; llama `onSelectBusiness(visit.business!)`. | ~-15 |
| 3.5 | `src/components/menu/SharedListsView.tsx` | Renombrar prop. En la linea donde llama `setSelectedBusiness` + `onNavigate`, reemplazar con `onSelectBusiness`. | ~-3 |
| 3.6 | `src/components/menu/CheckInsView.tsx` | Idem paso 3.1. | ~-5 |
| 3.7 | `src/components/menu/SuggestionsView.tsx` | Renombrar prop. Pasar `onSelectBusiness` a `TrendingList`. | ~-5 |
| 3.8 | `src/components/menu/TrendingList.tsx` | Renombrar prop. Pasar a `TrendingBusinessCard`. | ~-2 |
| 3.9 | `src/components/menu/TrendingBusinessCard.tsx` | Renombrar prop. Llamar `onSelectBusiness(fullBusiness)`. | ~-3 |
| 3.10 | `src/components/layout/SideMenu.tsx` | Crear `handleSelectBusiness` callback: `setSelectedBusiness(business); handleClose()`. Pasar `onSelectBusiness={handleSelectBusiness}` a los 9 componentes (reemplazando `onNavigate={handleClose}`). | ~+8 |

**Verificacion Fase 3:**

- `npx tsc --noEmit` pasa
- `npm run lint` sin errores
- `npm run test:run` pasa (todos los tests existentes sin modificacion)
- Ningun componente de `menu/` importa `useSelection` de MapContext (excepto los que lo usan para otros propositos)
- SideMenu tiene ~350 lineas (cumple success criteria #2: <= 300 lineas de logica sin contar JSX template)
- `formatRelativeTime` no esta duplicado (solo en `utils/formatDate.ts`)

---

## Orden de implementacion

1. `src/hooks/useOnboardingHint.ts` + test (sin dependencias)
2. `src/hooks/useOnboardingFlow.ts` + test (sin dependencias)
3. `src/components/layout/AppShell.tsx` (depende de 1 y 2)
4. `src/hooks/useSurpriseMe.ts` + test (sin dependencias)
5. `src/components/menu/EditDisplayNameDialog.tsx` + test (sin dependencias)
6. `src/components/layout/SideMenu.tsx` primera pasada (depende de 4 y 5)
7. 9 componentes de `menu/` (cambio de firma, en cualquier orden)
8. `src/components/layout/SideMenu.tsx` segunda pasada (depende de 7)
9. `src/components/menu/RecentVisits.tsx` (unificar formatRelativeTime)

---

## Riesgos

1. **Regresion visual en onboarding flow.** El flujo benefits -> email dialog involucra timing de localStorage y multiples dialogs. Mitigacion: los tests del hook cubren todas las transiciones; verificacion manual del flujo completo create account + login.

2. **Imports circulares al mover hooks.** `useSurpriseMe` importa `allBusinesses` y `useVisitHistory` que podrian tener dependencias cruzadas. Mitigacion: ambos son leaf modules sin dependencias de vuelta a SideMenu/AppShell.

3. **Componentes de menu con tests existentes que asumen `onNavigate`.** Si algun test existente de los 9 componentes mockea `onNavigate`, fallara con la nueva firma. Mitigacion: buscar tests existentes antes de implementar la fase 3; actualmente ningun componente de menu tiene tests unitarios (ver inventario en tests.md).

---

## Criterios de done

- [ ] All items from PRD scope implemented (S1-S4)
- [ ] Tests pass with >= 80% coverage on new code (4 archivos nuevos)
- [ ] No lint errors
- [ ] Build succeeds (`npm run build`)
- [ ] AppShell tiene <= 3 useState propios
- [ ] SideMenu tiene <= 350 lineas
- [ ] Ningun componente de `menu/` llama `setSelectedBusiness` directo (usan `onSelectBusiness`)
- [ ] `formatRelativeTime` existe solo en `src/utils/formatDate.ts`
- [ ] Todos los tests existentes pasan sin modificacion

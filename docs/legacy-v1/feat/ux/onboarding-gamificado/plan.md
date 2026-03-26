# Plan: Onboarding gamificado — Primeros pasos

**Feature:** onboarding-gamificado
**Issue:** #145

---

## Paso 1: Crear OnboardingChecklist component

- Card con LinearProgress, lista de 5 tareas, botón dismiss.
- Leer stats de `useUserProfile()`.
- Leer/escribir flags de localStorage.

## Paso 2: Integrar en SideMenu

- Renderizar OnboardingChecklist entre header y navigation.
- Condicionar a usuario autenticado + no dismissed + tareas pendientes.

## Paso 3: Flag de ranking viewed

- En RankingsView, al montar, setear localStorage flag.

## Paso 4: Celebración al completar

- Toast "¡Completaste todos los primeros pasos!" via useToast.

## Paso 5: Tests

- Test del componente con diferentes combinaciones de stats.

---

## Criterios de merge

- [ ] Checklist visible en SideMenu para usuarios con tareas pendientes
- [ ] Cada tarea se marca al cumplir la condición
- [ ] Dismiss permanente funciona
- [ ] No se muestra si todas completadas
- [ ] No se muestra para usuarios anónimos
- [ ] Toast de celebración al completar todas
- [ ] Lint y tests pasan

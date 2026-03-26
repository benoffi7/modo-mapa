# Plan: Seccion Ayuda en Menu Lateral

## Paso 1: Crear componente HelpSection

1. Crear `src/components/menu/HelpSection.tsx`
2. Definir array `HELP_ITEMS` con 7 secciones (mapa, comercio, menu lateral, notificaciones, perfil, configuracion, feedback)
3. Renderizar con `Accordion` de MUI, un solo accordion expandido a la vez
4. Exportar como default para lazy loading

## Paso 2: Integrar en SideMenu

1. Agregar `'help'` al type `Section`
2. Agregar `help: 'Ayuda'` a `SECTION_TITLES`
3. Agregar `const HelpSection = lazy(() => import('../menu/HelpSection'))`
4. Agregar `ListItemButton` con `HelpOutlineIcon` despues de Configuracion
5. Agregar renderizado condicional `{activeSection === 'help' && <HelpSection />}`

## Paso 3: Crear agente help-docs-reviewer

1. Crear `.claude/agents/help-docs-reviewer.md` con instrucciones para:
   - Leer HelpSection.tsx
   - Leer features.md
   - Comparar y reportar discrepancias
2. Registrar en `MEMORY.md` como agente disponible

## Paso 4: Verificar

1. `npx tsc --noEmit` — sin errores
2. `npm run lint` — sin errores nuevos
3. `npx vite build` — HelpSection en chunk lazy separado
4. Test visual en dev server

## Paso 5: Commit, push, PR, merge

1. Commit con mensaje descriptivo
2. Push a branch
3. Crear PR
4. Esperar CI
5. Merge a main
6. Verificar CI en main

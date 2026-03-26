# Plan: Gesto swipe para cerrar menu lateral

**Specs:** [Specs](./specs.md)
**Branch:** `feat/swipe-cerrar-menu`

---

## Pasos de implementacion

### Paso 1: Actualizar SideMenu.tsx

1. Cambiar import de `Drawer` a `SwipeableDrawer` en la linea de imports de MUI
2. Agregar `onOpen` a la interfaz `Props`
3. Reemplazar `<Drawer>` por `<SwipeableDrawer>` con las props:
   - `onOpen={onOpen}`
   - `swipeAreaWidth={20}`
   - `disableSwipeToOpen={false}`
   - `disableBackdropTransition`
   - `disableDiscovery`
4. Reemplazar `</Drawer>` por `</SwipeableDrawer>`

### Paso 2: Actualizar componente padre

1. Localizar donde se renderiza `<SideMenu>` y pasar la prop `onOpen` con la funcion que setea `open = true`

### Paso 3: Verificacion

1. `npx tsc --noEmit` — sin errores de tipos
2. `npm run lint` — sin warnings nuevos
3. Test manual en mobile/emulador:
   - Swipe izquierda cierra el menu
   - Swipe desde borde izquierdo abre el menu
   - Boton hamburguesa sigue abriendo
   - Click en backdrop sigue cerrando
   - Fluido en iOS Safari

---

## Criterios de completitud

- [ ] `Drawer` reemplazado por `SwipeableDrawer`
- [ ] Prop `onOpen` conectada al padre
- [ ] Swipe para cerrar funciona
- [ ] Swipe desde borde para abrir funciona
- [ ] Optimizaciones iOS aplicadas (`disableBackdropTransition`, `disableDiscovery`)
- [ ] Sin regresion en comportamiento existente
- [ ] Compilacion limpia (tsc + lint)

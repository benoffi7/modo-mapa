# Plan de Implementacion — Migrar a React Router

**Issue:** [#37](https://github.com/benoffi7/modo-mapa/issues/37)
**Fecha:** 2026-03-12

---

## Paso 1: Instalar react-router-dom

```bash
npm install react-router-dom
```

Verificar que se instala v7.x y que el build sigue pasando:

```bash
npm run build
```

---

## Paso 2: Agregar BrowserRouter en main.tsx

Envolver `<App />` con `<BrowserRouter>` en `src/main.tsx`.

El router debe estar fuera de `<App>` para que todos los componentes internos puedan usar `useLocation`, `useNavigate`, etc.

**Archivo:** `src/main.tsx`

---

## Paso 3: Refactorizar App.tsx con Routes y Route

Reemplazar el chequeo manual de `window.location.pathname` por componentes declarativos de React Router.

Cambios:

- Eliminar `const isAdmin = window.location.pathname.startsWith('/admin')`
- Eliminar el bloque `if (isAdmin) { ... }`
- Agregar `<Routes>` con 2 `<Route>`:
  - `/admin/*` renderiza `AdminDashboard` (con `Suspense`)
  - `/*` renderiza `MapProvider > APIProvider > AppShell`
- Unificar el arbol de providers (ya no se duplica `ThemeProvider`, `CssBaseline`, etc.)

**Archivo:** `src/App.tsx`

---

## Paso 4: Actualizar AuthContext.tsx con useLocation

Reemplazar `window.location.pathname` por el hook `useLocation()` de React Router.

Cambios:

- Importar `useLocation` de `react-router-dom`
- Usar `location.pathname` en vez de `window.location.pathname`
- Agregar `location.pathname` al array de dependencias del `useEffect`

**Archivo:** `src/context/AuthContext.tsx`

---

## Paso 5: Testing manual

Verificar los siguientes escenarios:

- [ ] `/` renderiza el mapa correctamente
- [ ] `/admin` renderiza el dashboard de administracion
- [ ] Back/forward del navegador funciona entre `/` y `/admin`
- [ ] Rutas invalidas (ej: `/xyz`) muestran el mapa (catch-all)
- [ ] Lazy loading de AdminDashboard sigue funcionando
- [ ] Sign-in anonimo solo ocurre en rutas no-admin
- [ ] Google Sign-In en `/admin` sigue funcionando

---

## Paso 6: Actualizar tests si es necesario

Revisar si hay tests existentes que dependan del routing actual. Si los hay, actualizarlos para usar `MemoryRouter` de React Router en vez de mockear `window.location`.

Actualmente no hay tests de routing, asi que este paso probablemente no requiera cambios.

---

## Resumen de archivos

| Archivo | Cambio |
|---------|--------|
| `package.json` | Nueva dependencia: `react-router-dom` |
| `src/main.tsx` | Agregar `BrowserRouter` |
| `src/App.tsx` | Reemplazar `window.location` por `Routes`/`Route` |
| `src/context/AuthContext.tsx` | Reemplazar `window.location` por `useLocation()` |

**Complejidad estimada:** Baja (3 archivos, ~30 min)

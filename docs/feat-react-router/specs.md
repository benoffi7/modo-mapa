# Especificacion Tecnica — Migrar a React Router

**Issue:** [#37](https://github.com/benoffi7/modo-mapa/issues/37)
**Fecha:** 2026-03-12

---

## Resumen

Se agrega `react-router-dom` v7 para manejar las 2 rutas existentes (`/` y `/admin`) de forma declarativa, reemplazando los chequeos manuales de `window.location.pathname` en `App.tsx` y `AuthContext.tsx`.

---

## Dependencia

```bash
npm install react-router-dom
```

Version: `^7.x` (compatible con React 19).

---

## Archivos a modificar

### `src/main.tsx`

Envolver `<App />` con `<BrowserRouter>`:

```tsx
import { BrowserRouter } from 'react-router-dom';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
```

El `BrowserRouter` se coloca en `main.tsx` (fuera de `App`) para que todos los componentes dentro de `App` puedan usar hooks de React Router (`useLocation`, `useNavigate`, etc.).

### `src/App.tsx`

Reemplazar el chequeo manual por `<Routes>` y `<Route>`:

```tsx
import { Routes, Route, Navigate } from 'react-router-dom';

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <ErrorBoundary>
        <AuthProvider>
          <Routes>
            <Route
              path="/admin/*"
              element={
                <Suspense fallback={<AdminFallback />}>
                  <AdminDashboard />
                </Suspense>
              }
            />
            <Route
              path="/*"
              element={
                <MapProvider>
                  <APIProvider apiKey={GOOGLE_MAPS_API_KEY}>
                    <AppShell />
                  </APIProvider>
                </MapProvider>
              }
            />
          </Routes>
        </AuthProvider>
      </ErrorBoundary>
    </ThemeProvider>
  );
}
```

Cambios clave:

- Se elimina `const isAdmin = window.location.pathname.startsWith('/admin')`
- Se elimina el `if (isAdmin)` condicional
- Se unifica el arbol de providers (`ThemeProvider`, `CssBaseline`, `ErrorBoundary`, `AuthProvider` son compartidos)
- `/admin/*` matchea `/admin` y cualquier sub-ruta futura
- `/*` es el catch-all para el mapa

### `src/context/AuthContext.tsx`

Reemplazar `window.location.pathname` con `useLocation()`:

```tsx
import { useLocation } from 'react-router-dom';

export function AuthProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  // ...

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // ... (sin cambios)
      } else {
        const isAdminRoute = location.pathname.startsWith('/admin');
        if (isAdminRoute) {
          setUser(null);
        } else {
          // sign-in anonimo
        }
      }
      setIsLoading(false);
    });
    return unsubscribe;
  }, [location.pathname]);

  // ...
}
```

Cambios clave:

- Se agrega `useLocation()` hook
- Se reemplaza `window.location.pathname` por `location.pathname`
- Se agrega `location.pathname` al array de dependencias del `useEffect`
- Esto hace que el efecto se re-ejecute si la ruta cambia (ej: navegacion de `/admin` a `/`)

---

## Comportamiento esperado

| Ruta | Render | Auth |
|------|--------|------|
| `/` | `AppShell` (mapa) | Sign-in anonimo automatico |
| `/cualquier-cosa` | `AppShell` (mapa) | Sign-in anonimo automatico |
| `/admin` | `AdminDashboard` (lazy) | Sin sign-in automatico (espera Google Sign-In) |
| `/admin/algo` | `AdminDashboard` (lazy) | Sin sign-in automatico |

---

## Lo que NO cambia

- Firebase Hosting config (el SPA rewrite ya funciona)
- Lazy loading de `AdminDashboard` (sigue usando `lazy()` + `Suspense`)
- Providers nesting order
- Logica de `AdminGuard` (sigue verificando email)
- Service layer, hooks, componentes de negocio
- Cloud Functions
- Tests existentes (no hay tests de routing actualmente)

---

## Testing manual

1. Navegar a `/` — debe mostrar el mapa
2. Navegar a `/admin` — debe mostrar el dashboard con pantalla de login
3. Usar back/forward del navegador entre `/` y `/admin` — debe cambiar correctamente
4. Escribir una ruta invalida (ej: `/xyz`) — debe mostrar el mapa (catch-all)
5. Verificar que lazy loading sigue funcionando (AdminDashboard se carga bajo demanda)

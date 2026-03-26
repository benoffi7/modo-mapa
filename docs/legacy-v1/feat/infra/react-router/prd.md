# PRD — Migrar a React Router (reemplazar window.location.pathname)

**Issue:** [#37](https://github.com/benoffi7/modo-mapa/issues/37)
**Fecha:** 2026-03-12

---

## Objetivo

Reemplazar el uso de `window.location.pathname` por React Router para el manejo de rutas, obteniendo navegacion reactiva, soporte para back/forward del navegador, y la posibilidad de hacer navegacion programatica.

---

## Contexto

La app actualmente usa `window.location.pathname.startsWith('/admin')` en 2 lugares:

- `src/App.tsx:26` — decide si renderizar `AdminDashboard` o `AppShell`
- `src/context/AuthContext.tsx:51` — decide si hacer sign-in anonimo o quedarse sin autenticar

Este approach tiene varios problemas:

1. **No es reactivo**: `window.location.pathname` no dispara re-renders cuando la URL cambia. Si el usuario navega sin un full-page reload, la app no se actualiza.
2. **Back/forward no funciona**: los botones de navegacion del navegador no actualizan el estado de la app correctamente.
3. **No permite navegacion programatica**: no hay forma de redirigir al usuario a otra ruta desde codigo (ej: despues de logout del admin, volver a `/`).
4. **Anti-patron en React**: leer `window.location` directamente en el render es un side-effect que no sigue el modelo declarativo de React.

Firebase Hosting ya tiene configurado el SPA rewrite (`"source": "**", "destination": "/index.html"`), por lo que el routing client-side va a funcionar sin cambios en la configuracion de hosting.

---

## Requisitos funcionales

| ID | Requisito | Prioridad |
|----|-----------|-----------|
| RF-1 | La ruta `/` debe renderizar el mapa (`AppShell`) | Alta |
| RF-2 | La ruta `/admin` debe renderizar el dashboard (`AdminDashboard`) con lazy loading | Alta |
| RF-3 | Los botones back/forward del navegador deben funcionar correctamente | Alta |
| RF-4 | `AuthContext` debe usar la ruta actual reactivamente para decidir el tipo de autenticacion | Alta |
| RF-5 | Rutas no reconocidas deben redirigir a `/` | Media |

---

## Requisitos no funcionales

- No debe agregar mas de ~15 KB al bundle (react-router-dom es ~14 KB gzipped)
- Debe mantener el lazy loading de `AdminDashboard`
- Debe mantener el nesting actual de providers (`ThemeProvider > AuthProvider > ...`)
- No debe requerir cambios en la configuracion de Firebase Hosting

---

## Alcance

### Incluido

- Agregar `react-router-dom` v7 como dependencia
- Configurar `BrowserRouter` con 2 rutas: `/` y `/admin/*`
- Reemplazar los 2 usos de `window.location.pathname`
- Fallback route (redirect a `/`)

### Fuera de alcance

- Nuevas rutas o paginas
- Deep linking dentro de secciones (ej: `/admin/backups`)
- Breadcrumbs o indicadores de ruta en la UI
- Cambios en Firebase Hosting config

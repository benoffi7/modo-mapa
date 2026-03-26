# Plan de Implementación: Modo Offline PWA (Mitigación 4)

> **Nota:** Las mitigaciones 1-3 fueron implementadas en PR #26 (branch
> `feat/24-firebase-quota-offline`). Este plan cubre exclusivamente la
> mitigación 4: PWA + Service Worker.

**Branch:** `feat/25-pwa-offline`
**Base:** `main`

---

## Paso 1: Instalar `vite-plugin-pwa`

- `npm install -D vite-plugin-pwa`
- Verificar que se agrega a `devDependencies` en `package.json`

---

## Paso 2: Crear iconos PWA

- Crear directorio `public/icons/`
- Generar `icon-192x192.png` y `icon-512x512.png` a partir del logo de la app
- Asegurar que los iconos tienen fondo sólido (requerido para `maskable`)

---

## Paso 3: Configurar VitePWA en `vite.config.ts`

- Importar `VitePWA` de `vite-plugin-pwa`
- Agregar al array de plugins con la configuración definida en specs:
  - `registerType: 'autoUpdate'`
  - `manifest` con nombre, iconos, theme color, display standalone
  - `workbox.globPatterns` para precache de assets estáticos
  - `workbox.runtimeCaching` para Google Maps tiles y API

---

## Paso 4: Crear componente `OfflineIndicator`

- Crear `src/components/ui/OfflineIndicator.tsx`
- Hook `useEffect` para escuchar eventos `online`/`offline`
- Renderizar `Chip` de MUI con icono `CloudOff` cuando está offline
- Posicionamiento fijo centrado en la parte superior

---

## Paso 5: Integrar `OfflineIndicator` en `AppShell`

- Importar y montar `OfflineIndicator` en `src/components/layout/AppShell.tsx`
- Ubicar junto a los otros componentes globales

---

## Paso 6: Verificar build, lint y tests

- `npm run lint`
- `npm run build` — verificar que el SW se genera en `dist/sw.js`
- `npm run test:run`

---

## Paso 7: Test manual de PWA

- `npm run build && npm run preview`
- Abrir en Chrome → DevTools → Application:
  - Verificar que Service Worker está registrado y activo
  - Verificar que Cache Storage tiene assets precacheados
  - Verificar que Manifest muestra datos correctos
- Cortar red (DevTools → Network → Offline):
  - App debe cargar desde SW cache
  - Mapa debe mostrar tiles previamente cacheados
  - Indicador offline debe aparecer
- Reconectar red:
  - Indicador offline debe desaparecer
  - Datos pendientes de Firestore se sincronizan
- Verificar prompt de instalación PWA en Chrome

---

## Paso 8: Test de `OfflineIndicator`

- Crear `src/components/ui/OfflineIndicator.test.tsx`
- Test: se muestra cuando `navigator.onLine` es false
- Test: se oculta cuando `navigator.onLine` es true
- Test: reacciona a eventos `online`/`offline`

---

## Paso 9: Verificación final

- `npm run lint`
- `npm run build`
- `npm run test:run`
- Test manual completo del flujo offline

---

## Resumen de archivos

| Nuevos | Modificados |
|--------|------------|
| `src/components/ui/OfflineIndicator.tsx` | `vite.config.ts` |
| `src/components/ui/OfflineIndicator.test.tsx` | `src/components/layout/AppShell.tsx` |
| `public/icons/icon-192x192.png` | `package.json` |
| `public/icons/icon-512x512.png` | |

**Total:** 4 archivos nuevos, 3 archivos modificados

# Specs Técnicas: Modo Offline PWA (Mitigación 4)

> **Nota:** Las mitigaciones 1-3 (Firestore persistence, cache business view,
> cache listas) fueron implementadas y mergeadas en PR #26. Este documento
> cubre exclusivamente la mitigación 4: PWA + Service Worker.

---

## Dependencia: `vite-plugin-pwa`

```bash
npm install -D vite-plugin-pwa
```

Esta dependencia incluye Workbox internamente y genera el service worker
durante el build.

---

## Configuración de Vite — `vite.config.ts`

Agregar el plugin `VitePWA` a la configuración existente:

```typescript
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    // ...plugins existentes
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'robots.txt', 'icons/*.png'],
      manifest: {
        name: 'Modo Mapa',
        short_name: 'ModoMapa',
        description: 'Mapa de comercios con reseñas y favoritos',
        theme_color: '#1976d2',
        background_color: '#ffffff',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: 'icons/icon-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'icons/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'icons/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,json}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/maps\.googleapis\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'google-maps-api',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24, // 24 horas
              },
            },
          },
          {
            urlPattern: /^https:\/\/maps\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-maps-static',
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 60 * 60 * 24 * 7, // 7 días
              },
            },
          },
          {
            urlPattern: /^https:\/\/khms[0-9]+\.google\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-maps-tiles',
              expiration: {
                maxEntries: 500,
                maxAgeSeconds: 60 * 60 * 24 * 7, // 7 días
              },
            },
          },
        ],
      },
    }),
  ],
});
```

### Estrategias de cache

| Recurso | Estrategia | Cache name | Max entries | TTL |
|---------|-----------|------------|-------------|-----|
| Assets estáticos (JS, CSS, HTML) | Precache | workbox-precache | Todos | Actualización automática |
| JSON de comercios | Precache | workbox-precache | Todos | Actualización automática |
| Google Maps API | StaleWhileRevalidate | google-maps-api | 50 | 24 horas |
| Google Maps assets estáticos | CacheFirst | google-maps-static | 200 | 7 días |
| Google Maps tiles | CacheFirst | google-maps-tiles | 500 | 7 días |

---

## Iconos PWA — `public/icons/`

Se necesitan al menos dos iconos para el manifiesto:

| Archivo | Tamaño | Uso |
|---------|--------|-----|
| `public/icons/icon-192x192.png` | 192x192 | Ícono estándar Android/Chrome |
| `public/icons/icon-512x512.png` | 512x512 | Splash screen y app stores |

Generar a partir del logo existente de la app.

---

## Indicador de estado offline — Componente `OfflineIndicator`

### Ubicación

`src/components/ui/OfflineIndicator.tsx`

### Comportamiento

- Escucha eventos `online` / `offline` del navegador
- Cuando `navigator.onLine === false`: muestra un chip/banner fijo
- Cuando vuelve online: oculta el indicador (con breve delay opcional)
- Se monta en `AppShell` para estar siempre visible

### Implementación sugerida

```typescript
import { useState, useEffect } from 'react';
import { Chip } from '@mui/material';
import CloudOffIcon from '@mui/icons-material/CloudOff';

export function OfflineIndicator() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <Chip
      icon={<CloudOffIcon />}
      label="Sin conexión"
      color="warning"
      size="small"
      sx={{
        position: 'fixed',
        top: 8,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 1400,
      }}
    />
  );
}
```

### Integración en AppShell

```typescript
// En AppShell.tsx
import { OfflineIndicator } from '../ui/OfflineIndicator';

// Dentro del JSX, junto a los otros componentes globales:
<OfflineIndicator />
```

---

## Registro del Service Worker

`vite-plugin-pwa` con `registerType: 'autoUpdate'` genera automáticamente
el código de registro del service worker. No se necesita registro manual.

El plugin inyecta el script de registro en el HTML durante el build.

### Comportamiento de actualización

- Al detectar nueva versión del SW, se activa automáticamente (autoUpdate)
- Los assets precacheados se actualizan en background
- El usuario obtiene la nueva versión al recargar la página

---

## Archivos nuevos

| Archivo | Descripción |
|---------|-------------|
| `src/components/ui/OfflineIndicator.tsx` | Indicador visual de estado offline |
| `public/icons/icon-192x192.png` | Ícono PWA 192x192 |
| `public/icons/icon-512x512.png` | Ícono PWA 512x512 |

## Archivos modificados

| Archivo | Cambio |
|---------|--------|
| `vite.config.ts` | Agregar `VitePWA` plugin con config de manifest y workbox |
| `src/components/layout/AppShell.tsx` | Montar `OfflineIndicator` |
| `package.json` | Nueva devDependency `vite-plugin-pwa` |

---

## Testing

### Tests unitarios

| Test | Qué valida |
|------|-----------|
| `OfflineIndicator.test.tsx` | Se muestra cuando `navigator.onLine` es false, se oculta cuando es true |

### Tests manuales

| Escenario | Verificar |
|-----------|----------|
| Build + preview + cortar red | App carga desde service worker, mapa muestra tiles cacheados |
| Offline → escribir comentario | Comentario queda pendiente, se sincroniza al reconectar |
| Indicador offline | Chip aparece al cortar red, desaparece al reconectar |
| PWA install | Chrome muestra prompt "Agregar a pantalla de inicio" |
| Update SW | Tras deploy nueva versión, SW se actualiza automáticamente |
| DevTools → Application → Service Workers | SW registrado y activo |
| DevTools → Application → Cache Storage | Assets precacheados presentes |

---

## Dependencias

| Paquete | Tipo | Versión sugerida |
|---------|------|-----------------|
| `vite-plugin-pwa` | devDependency | ^0.21.x |

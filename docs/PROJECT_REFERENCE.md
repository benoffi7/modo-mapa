# Modo Mapa — Referencia del proyecto

**Version:** 2.2.0
**Repo:** <https://github.com/benoffi7/modo-mapa>
**Produccion:** <https://modo-mapa-app.web.app>
**Ultima actualizacion:** 2026-03-13

---

## Descripcion

App web mobile-first para empleados que necesitan encontrar comercios gastronomicos cercanos en un mapa interactivo. Los usuarios pueden buscar, filtrar, calificar, comentar, marcar favoritos, etiquetar comercios, subir fotos de menu y votar niveles de gasto. Localizada en espanol (es-AR), orientada a Buenos Aires.

---

## Stack tecnologico

| Capa | Tecnologia | Version |
|------|-----------|---------|
| Framework | React | 19.2 |
| Bundler | Vite | 7.3 |
| Lenguaje | TypeScript | 5.9 (strict) |
| UI | Material UI (MUI) | 7.3 |
| Mapa | @vis.gl/react-google-maps | 1.7 |
| Graficos | recharts | 3.8 |
| Auth | Firebase Anonymous Auth + Google Sign-In | 12.10 |
| Base de datos | Cloud Firestore | 12.10 |
| Storage | Firebase Storage | 12.10 |
| Cloud Functions | Firebase Functions v2 | 6.3 |
| Hosting | Firebase Hosting | — |
| Routing | react-router-dom | 7.x |
| Error tracking | @sentry/react + @sentry/node | latest |
| PWA | vite-plugin-pwa (Workbox) | 1.2 |
| CI/CD | GitHub Actions | — |

---

## Documentacion detallada

Cada seccion esta en un archivo separado en [`docs/reference/`](reference/):

| Archivo | Contenido |
|---------|-----------|
| [architecture.md](reference/architecture.md) | Arbol de componentes, capas, Cloud Functions structure, flujo de datos, tema visual |
| [files.md](reference/files.md) | Estructura completa de archivos (`src/`, `functions/`, config, scripts) |
| [data-layer.md](reference/data-layer.md) | Service layer, hooks compartidos, utilidades, AdminPanelWrapper, filtros |
| [firestore.md](reference/firestore.md) | Colecciones, tipos TypeScript, converters, Cloud Storage (fotos + backups) |
| [security.md](reference/security.md) | App Check, Firestore rules, Cloud Functions seguridad, CSP, Storage rules |
| [features.md](reference/features.md) | Funcionalidades: mapa, business sheet, menu lateral, admin dashboard, Cloud Functions (callable + triggers + scheduled) |
| [patterns.md](reference/patterns.md) | Patrones y convenciones: auth, datos, cache, UI, uploads, server-side, TypeScript, dark mode |
| [devops.md](reference/devops.md) | Variables de entorno, scripts npm, dev-env.sh, CI/CD, IAM roles, flujo de feature, versionado |
| [issues.md](reference/issues.md) | Issues resueltos (tabla completa), documentacion por feature (carpetas `docs/`) |

---

## Resumen rapido

### Funcionalidades clave

- **Mapa**: Google Maps con 40 marcadores, busqueda, filtros por tags y precio
- **Business Sheet**: rating, tags (predefinidos + custom), comentarios (editar/likes/sorting), nivel de gasto ($/$$/$$), foto de menu (upload/report), compartir (deep link)
- **Menu lateral**: recientes (localStorage), favoritos, comentarios, calificaciones, rankings, feedback, estadisticas
- **Notificaciones**: campana con badge, drawer, polling 60s, triggers automaticos (likes, fotos, rankings)
- **Perfil publico**: click en nombre de usuario → drawer con stats y comentarios recientes
- **Admin** (`/admin`): 9 tabs — overview, actividad, feedback, tendencias, usuarios, Firebase usage, alertas, backups, fotos
- **Cloud Functions**: 8 callable + 14 triggers + 5 scheduled
- **Seguridad**: App Check, Firestore rules, rate limiting (3 capas), moderacion, CSP

### Patrones clave

- **Service layer**: componentes → `src/services/` → Firestore SDK (nunca directo)
- **Cache**: business data cache (5 min TTL) + paginated query cache (2 min TTL) + persistent cache (prod)
- **Race condition fix**: `patchedRef` en `useBusinessData` previene sobreescritura de refetches parciales
- **Optimistic UI**: pendingRating, pendingLevel, optimistic comments/likes
- **`key={id}` remount**: evita useEffect/refs para reset de estado, compatible con strict lint
- **`enforceAppCheck: !IS_EMULATOR`**: App Check solo en prod, deshabilitado en emuladores

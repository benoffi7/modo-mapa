# Modo Mapa — Referencia completa del proyecto

**Versión:** 1.2.2
**Repo:** <https://github.com/benoffi7/modo-mapa>
**Producción:** <https://modo-mapa-app.web.app>
**Última actualización:** 2026-03-11

---

## Descripción

App web mobile-first para empleados que necesitan encontrar comercios gastronómicos cercanos en un mapa interactivo. Los usuarios pueden buscar, filtrar, calificar, comentar, marcar favoritos y etiquetar comercios. Localizada en español (es-AR), orientada a Buenos Aires.

---

## Stack tecnológico

| Capa | Tecnología | Versión |
|------|-----------|---------|
| Framework | React | 19.2 |
| Bundler | Vite | 7.3 |
| Lenguaje | TypeScript | 5.9 (strict) |
| UI | Material UI (MUI) | 7.3 |
| Mapa | @vis.gl/react-google-maps | 1.7 |
| Auth | Firebase Anonymous Auth | 12.10 |
| Base de datos | Cloud Firestore | 12.10 |
| Hosting | Firebase Hosting | — |
| CI/CD | GitHub Actions | — |

---

## Arquitectura

```text
main.tsx
  └─ App.tsx
       ├─ ThemeProvider (MUI theme)
       ├─ AuthProvider (Firebase Auth + displayName)
       ├─ MapProvider (estado central del mapa)
       └─ APIProvider (Google Maps)
            └─ AppShell.tsx
                 ├─ SearchBar (búsqueda + menú hamburguesa)
                 ├─ FilterChips (tags predefinidos)
                 ├─ MapView (Google Maps + markers)
                 ├─ LocationFAB (geolocalización)
                 ├─ BusinessSheet (bottom sheet con detalle)
                 │    ├─ BusinessHeader (nombre, dirección, favorito, direcciones)
                 │    ├─ BusinessRating (estrellas promedio + calificar)
                 │    ├─ BusinessTags (tags predefinidos + custom)
                 │    └─ BusinessComments (lista + formulario + eliminar)
                 ├─ NameDialog (nombre de usuario, primera visita)
                 └─ SideMenu (drawer lateral)
                      ├─ Header (avatar + nombre + editar)
                      ├─ Nav (Favoritos, Comentarios, Calificaciones, Feedback, Agregar comercio)
                      ├─ FavoritesList + ListFilters
                      ├─ CommentsList
                      ├─ RatingsList + ListFilters
                      ├─ FeedbackForm
                      └─ Footer (versión)
```

### Flujo de datos

1. **Datos estáticos**: `businesses.json` (40 comercios) se carga como import estático. No hay fetch.
2. **Datos dinámicos**: Firestore (favoritos, ratings, comentarios, tags, feedback). Cada componente hace su propia query.
3. **Estado global**: `AuthContext` (user, displayName) + `MapContext` (selectedBusiness, searchQuery, filters, userLocation).
4. **Estado local**: Cada sección del menú carga sus datos al montarse y los filtra client-side con `useListFilters`.

---

## Estructura de archivos

```text
src/
├── App.tsx                          # Providers + ErrorBoundary + AppShell
├── main.tsx                         # Entry point (StrictMode)
├── index.css                        # Estilos globales mínimos
├── config/
│   ├── firebase.ts                  # Init Firebase + emuladores en DEV + App Check (prod)
│   ├── collections.ts               # Nombres de colecciones Firestore centralizados
│   └── converters.ts                # FirestoreDataConverter<T> tipados por colección
├── context/
│   ├── AuthContext.tsx               # Auth anónima + displayName
│   └── MapContext.tsx                # Estado del mapa (selected, search, filters)
├── types/
│   └── index.ts                     # Business, Rating, Comment, CustomTag, UserTag, Favorite, categorías, tags
├── theme/
│   └── index.ts                     # MUI theme (colores Google, Roboto, borderRadius 8)
├── data/
│   └── businesses.json              # 40 comercios con id, name, address, category, lat, lng, tags, phone
├── hooks/
│   ├── useBusinesses.ts             # Filtra businesses por searchQuery + activeFilters
│   ├── useListFilters.ts            # Filtrado genérico: búsqueda (debounced), categoría, estrellas, ordenamiento
│   ├── usePaginatedQuery.ts         # Paginación genérica con cursores Firestore ("Cargar más")
│   └── useUserLocation.ts           # Geolocalización del navegador
├── components/
│   ├── auth/
│   │   └── NameDialog.tsx           # Dialog para pedir nombre (primera vez)
│   ├── layout/
│   │   ├── AppShell.tsx             # Layout principal, orquesta menú + mapa + sheet
│   │   ├── ErrorBoundary.tsx        # Error boundary genérico con fallback UI
│   │   └── SideMenu.tsx             # Drawer lateral con navegación entre secciones
│   ├── map/
│   │   ├── MapView.tsx              # Google Map con markers
│   │   ├── BusinessMarker.tsx       # Marker individual con color por categoría
│   │   └── LocationFAB.tsx          # FAB de geolocalización
│   ├── search/
│   │   ├── SearchBar.tsx            # Barra de búsqueda fija arriba
│   │   └── FilterChips.tsx          # Chips de tags predefinidos scrollables
│   ├── business/
│   │   ├── BusinessSheet.tsx        # Bottom sheet (SwipeableDrawer)
│   │   ├── BusinessHeader.tsx       # Nombre, categoría, dirección, teléfono, favorito, direcciones
│   │   ├── BusinessRating.tsx       # Rating promedio + estrellas del usuario
│   │   ├── BusinessTags.tsx         # Tags predefinidos (voto) + custom tags (CRUD)
│   │   ├── BusinessComments.tsx     # Comentarios + formulario + eliminar propios
│   │   ├── FavoriteButton.tsx       # Corazón toggle
│   │   └── DirectionsButton.tsx     # Abre Google Maps Directions
│   └── menu/
│       ├── FavoritesList.tsx        # Lista de favoritos con filtros
│       ├── CommentsList.tsx         # Lista de comentarios del usuario
│       ├── RatingsList.tsx          # Lista de calificaciones con filtros
│       ├── FeedbackForm.tsx         # Formulario de feedback (bug/sugerencia/otro)
│       └── ListFilters.tsx          # Componente visual de filtros reutilizable
```

### Otros archivos clave

| Archivo | Descripción |
|---------|-------------|
| `firestore.rules` | Reglas de seguridad para todas las colecciones |
| `firebase.json` | Config de hosting, emuladores, reglas |
| `.firebaserc` | Proyecto: `modo-mapa-app` |
| `vite.config.ts` | Plugin React + `__APP_VERSION__` desde package.json |
| `.github/workflows/deploy.yml` | CI/CD: build + deploy a Firebase en push a main |
| `PROCEDURES.md` | Flujo de desarrollo (PRD → specs → plan → implementar) |
| `.env.example` | Template de variables de entorno |
| `package.json` | Dependencias y scripts (v1.2.1) |
| `docs/SECURITY_GUIDELINES.md` | Guía de seguridad: App Check, timestamps, converters, patrones |
| `docs/INFORME_SEGURIDAD.md` | Informe de auditoría de seguridad |
| `docs/INFORME_MEJORAS.md` | Informe de mejoras pendientes y resueltas |

---

## Colecciones Firestore

| Colección | Doc ID | Campos | Reglas |
|-----------|--------|--------|--------|
| `users` | `{userId}` | displayName, createdAt | R/W solo el owner |
| `favorites` | `{userId}__{businessId}` | userId, businessId, createdAt | Read auth; create/delete owner |
| `ratings` | `{userId}__{businessId}` | userId, businessId, score (1-5), createdAt, updatedAt | Read auth; create/update owner, score 1-5 |
| `comments` | auto-generated | userId, userName, businessId, text (1-500), createdAt | Read auth; create owner; delete owner |
| `userTags` | `{userId}__{businessId}__{tagId}` | userId, businessId, tagId, createdAt | Read auth; create/delete owner |
| `customTags` | auto-generated | userId, businessId, label (1-30), createdAt | Read auth; create/update/delete owner |
| `feedback` | auto-generated | userId, message (1-1000), category, createdAt | Create auth+owner; read/delete owner |

---

## Tipos principales

```typescript
// Business (datos estáticos del JSON)
interface Business {
  id: string;             // "biz_001"
  name: string;           // "La Parrilla de Juan"
  address: string;        // "Av. Corrientes 1234, CABA"
  category: BusinessCategory;
  lat: number;
  lng: number;
  tags: string[];         // ["barato", "buena_atencion"]
  phone: string | null;
}

type BusinessCategory = 'restaurant' | 'cafe' | 'bakery' | 'bar' | 'fastfood' | 'icecream' | 'pizza';

// Tags predefinidos (6)
PREDEFINED_TAGS: barato, apto_celiacos, apto_veganos, rapido, delivery, buena_atencion

// Categorías con labels en español (7)
CATEGORY_LABELS: restaurant→Restaurante, cafe→Café, bakery→Panadería, bar→Bar,
                 fastfood→Comida rápida, icecream→Heladería, pizza→Pizzería
```

---

## Variables de entorno

```bash
VITE_GOOGLE_MAPS_API_KEY=       # API key de Google Maps
VITE_GOOGLE_MAPS_MAP_ID=        # Map ID para estilos
VITE_FIREBASE_API_KEY=           # Firebase web API key
VITE_FIREBASE_AUTH_DOMAIN=       # *.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=        # modo-mapa-app
VITE_FIREBASE_STORAGE_BUCKET=    # *.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=

# Opcional: App Check con reCAPTCHA Enterprise (ver docs/SECURITY_GUIDELINES.md)
VITE_RECAPTCHA_ENTERPRISE_SITE_KEY=
```

En CI/CD se inyectan como GitHub Secrets.

---

## Tema visual

- **Primary:** #1a73e8 (Google Blue)
- **Secondary:** #ea4335 (Google Red)
- **Texto:** #202124 (primary), #5f6368 (secondary)
- **Fuente:** Roboto
- **Border radius:** 8px (general), 16px (chips)
- **Estilo:** inspirado en Google Maps

---

## Scripts

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Vite dev server (sin emuladores) |
| `npm run dev:full` | Dev + emuladores Firebase |
| `npm run emulators` | Solo emuladores (Auth :9099, Firestore :8080, UI :4000) |
| `npm run build` | tsc + vite build → `dist/` |
| `npm run lint` | ESLint check |
| `npm run preview` | Preview del build de producción |
| `npm run test` | Vitest watch mode |
| `npm run test:run` | Vitest single run |
| `npm run analyze` | Build + genera `dist/stats.html` con análisis del bundle |

---

## CI/CD

**GitHub Actions** (`.github/workflows/deploy.yml`):

1. Trigger: push a `main`
2. Setup: Node 20 + npm cache
3. Build: `npm run build` con secrets como env vars
4. Deploy: Firebase Hosting (canal `live`) via `FirebaseExtended/action-hosting-deploy@v0`

**Flujo de feature:**

1. Crear issue en GitHub
2. Branch: `feat/<N>-<descripcion>` o `fix/<N>-<descripcion>`
3. PRD → specs → plan → implementar (ver `PROCEDURES.md`)
4. Test local con `npm run dev`
5. Commit con referencia al issue
6. PR con resumen y test plan
7. Merge a main → deploy automático

---

## Versionado

- Versión en `package.json` → expuesta via `__APP_VERSION__` (Vite define) → mostrada en footer del menú lateral.
- Cada 10 issues se incrementa el número mayor (1.x → 2.0).
- Formato: `MAJOR.MINOR.PATCH` donde MINOR se incrementa por feature/fix.

---

## Patrones y convenciones

| Patrón | Descripción |
|--------|-------------|
| **Auth anónima** | Todos los usuarios se autentican automáticamente (Firebase Anonymous). El `displayName` se pide opcionalmente. |
| **Doc ID compuesto** | `{userId}__{businessId}` para favoritos, ratings y userTags. Garantiza unicidad sin queries extra. |
| **Datos estáticos + dinámicos** | Comercios en JSON local, interacciones en Firestore. Se cruzan por `businessId` client-side. |
| **Optimistic UI** | Comentarios se agregan al state local antes de que Firestore confirme. |
| **Component remount via key** | `feedbackKey` en SideMenu fuerza remount del FeedbackForm al re-entrar a la sección. |
| **`component="span"`** | En MUI `ListItemText` secondary, para evitar `<p>` dentro de `<p>`. Se usa `display: block` en spans. |
| **import type** | Obligatorio por `verbatimModuleSyntax: true` en tsconfig. |
| **Hook genérico de filtros** | `useListFilters<T>` acepta cualquier item con `business` asociado. Reutilizado en favoritos y ratings. |
| **Emuladores en DEV** | `firebase.ts` conecta a emuladores solo en `import.meta.env.DEV`. |
| **App Check (prod)** | Firebase App Check con reCAPTCHA Enterprise, solo en producción. Opcional: se activa si `VITE_RECAPTCHA_ENTERPRISE_SITE_KEY` está presente. |
| **withConverter\<T\>()** | Todas las lecturas de Firestore usan `withConverter<T>()` con converters centralizados en `src/config/converters.ts`. Escrituras usan refs sin converter (por `serverTimestamp()`). |
| **Timestamps server-side** | Todas las reglas de `create` validan `createdAt == request.time`. Ratings valida `updatedAt == request.time` en create y update. |
| **Collection names** | Nombres de colecciones centralizados en `src/config/collections.ts` como constantes. Sin strings mágicos. |
| **ErrorBoundary** | `ErrorBoundary` genérico envuelve `AppShell` en `App.tsx`. Muestra fallback UI con opción de recargar. |
| **usePaginatedQuery** | Hook genérico para paginación con cursores Firestore. Usado en FavoritesList, CommentsList, RatingsList. Botón "Cargar más". |
| **Debounce con useDeferredValue** | `useBusinesses` y `useListFilters` usan `useDeferredValue` de React 19 para debounce de búsqueda. |
| **Pre-commit hooks** | `husky` + `lint-staged` ejecuta ESLint en archivos `.ts/.tsx` staged antes de cada commit. |
| **exactOptionalPropertyTypes** | Habilitado en tsconfig. Propiedades opcionales requieren `\| undefined` explícito para asignar `undefined`. |
| **Markdown lint** | Archivos `.md` deben cumplir markdownlint (`.markdownlint.json`). Reglas clave: blank lines around headings/lists/fences, language en code blocks (`text`, `typescript`, etc.), no duplicate headings. |

---

## Issues resueltos

| Issue | Tipo | Título | PR | Estado | Docs |
|-------|------|--------|----|--------|------|
| [#1](https://github.com/benoffi7/modo-mapa/issues/1) | fix | Google Maps: error de carga y warning de Map ID faltante | [#2](https://github.com/benoffi7/modo-mapa/pull/2) | Merged | — |
| [#3](https://github.com/benoffi7/modo-mapa/issues/3) | fix | Comentarios no aparecen después de enviar | [#4](https://github.com/benoffi7/modo-mapa/pull/4) | Merged | — |
| [#5](https://github.com/benoffi7/modo-mapa/issues/5) | feat | Etiquetas personalizadas por usuario | [#6](https://github.com/benoffi7/modo-mapa/pull/6) | Merged | `docs/feat-custom-user-tags/` |
| [#7](https://github.com/benoffi7/modo-mapa/issues/7) | feat | Menú lateral con sección Favoritos | [#8](https://github.com/benoffi7/modo-mapa/pull/8) | Merged | `docs/feat-menu-favoritos/` |
| [#9](https://github.com/benoffi7/modo-mapa/issues/9) | feat | Sección Comentarios en menú lateral | [#10](https://github.com/benoffi7/modo-mapa/pull/10) | Merged | `docs/feat-menu-comentarios/` |
| [#11](https://github.com/benoffi7/modo-mapa/issues/11) | feat | Feedback, Ratings, Agregar comercio, Versión, Filtros | [#12](https://github.com/benoffi7/modo-mapa/pull/12) | Merged | `docs/feat-menu-feedback-ratings-version/` |
| [#13](https://github.com/benoffi7/modo-mapa/issues/13) | fix | customTags read rule demasiado restrictiva | [#14](https://github.com/benoffi7/modo-mapa/pull/14) | Merged | — |
| [#15](https://github.com/benoffi7/modo-mapa/issues/15) | security | Auditoría de seguridad — hallazgos iniciales | [#16](https://github.com/benoffi7/modo-mapa/pull/16) | Merged | — |
| [#17](https://github.com/benoffi7/modo-mapa/issues/17) | feat | Agregar edición de comentarios | — | Open | — |
| — | security | Resolver hallazgos pendientes: App Check, timestamps, converters | [#18](https://github.com/benoffi7/modo-mapa/pull/18) | Merged | — |
| — | chore | Resolver mejoras técnicas: debounce, tests, paginación, husky, bundle analysis, strictTypes | [#20](https://github.com/benoffi7/modo-mapa/pull/20) | Merged | — |
| [#19](https://github.com/benoffi7/modo-mapa/issues/19) | fix | Fix CSP policy, tags auth guard, lint errors | [#22](https://github.com/benoffi7/modo-mapa/pull/22) | Merged | `docs/fix-csp-and-tags-permissions/` |

---

## Documentación por feature

Cada feature tiene su carpeta en `docs/<tipo>-<descripcion>/` con:

| Archivo | Contenido |
|---------|-----------|
| `prd.md` | Requisitos del producto |
| `specs.md` | Especificaciones técnicas (interfaces, props, lógica) |
| `plan.md` | Plan de implementación paso a paso |
| `changelog.md` | Archivos creados y modificados |

---

## Funcionalidades actuales

### Mapa

- Google Maps centrado en Buenos Aires (-34.6037, -58.3816)
- 40 marcadores con color por categoría
- Click en marker abre bottom sheet con detalle
- Geolocalización del usuario (FAB)
- Búsqueda por nombre/dirección/categoría
- Filtro por tags predefinidos (chips)

### Comercio (BusinessSheet)

- Nombre, categoría, dirección, teléfono (link tel:)
- Botón favorito (toggle corazón)
- Botón direcciones (abre Google Maps)
- Rating: promedio + estrellas del usuario (1-5)
- Tags predefinidos: vote count + toggle del usuario
- Tags custom: crear, editar, eliminar (privados por usuario)
- Comentarios: lista + formulario + eliminar propios

### Menú lateral (SideMenu)

- Header con avatar, nombre, botón editar nombre
- Secciones:
  - **Favoritos**: lista con filtros (búsqueda, categoría, orden). Quitar favorito inline. Click navega al comercio.
  - **Comentarios**: lista con texto truncado. Eliminar con confirmación. Click navega al comercio.
  - **Calificaciones**: lista con estrellas y filtros (búsqueda, categoría, estrellas mínimas, orden). Click navega al comercio.
  - **Feedback**: formulario con categoría (bug/sugerencia/otro) + mensaje (max 1000). Estado de éxito.
  - **Agregar comercio**: link externo a Google Forms.
- Footer con versión de la app

### Filtros reutilizables

- Hook `useListFilters<T>`: filtrado por nombre, categoría, score + ordenamiento
- Componente `ListFilters`: TextField búsqueda, chips categoría, chips estrellas (opcional), Select orden, contador "N de M"
- Usado en FavoritesList y RatingsList

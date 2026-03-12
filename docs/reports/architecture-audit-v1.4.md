# Auditoria de Arquitectura y Calidad de Codigo - Modo Mapa v1.4.0

**Fecha:** 2026-03-12
**Alcance:** Codebase completo (frontend, backend, infra, agentes Claude)
**Auditor:** Claude Opus 4.6

---

## Resumen Ejecutivo

Puntuacion de madurez: **7.2 / 10**

Modo Mapa es una aplicacion web mobile-first bien estructurada con una
arquitectura coherente para su escala (40 comercios, un admin). El proyecto
demuestra buenas practicas en seguridad (2 capas de validacion), tipado
estricto de TypeScript, y una separacion razonable entre UI y datos. Las
principales areas de mejora son: falta de capa de servicios (logica de
negocio mezclada en componentes), cobertura de tests baja, y componentes
admin con alto acoplamiento a Firestore.

### Fortalezas principales

- Configuracion de TypeScript estricta (`strict`, `exactOptionalPropertyTypes`,
  `verbatimModuleSyntax`)
- Seguridad en capas (Firestore rules + Cloud Functions + client-side)
- Converters tipados centralizados para todas las colecciones
- Nombres de colecciones sin strings magicos
- Sistema de cache client-side de dos niveles
- Admin lazy-loaded, no carga dependencias de mapa

### Debilidades principales

- Ausencia de capa de servicios: componentes hacen escrituras directas a Firestore
- Cobertura de tests estimada menor al 15%
- Duplicacion de logica de formateo de fechas y patrones de loading/error
- Componentes admin monoliticos que hacen fetch + render
- Sin router (navegacion basada en `window.location.pathname`)

---

## Analisis de Principios SOLID

### S - Responsabilidad Unica (6/10)

**Cumplimiento parcial.** La mayoria de componentes UI tienen una
responsabilidad clara, pero varios mezclan logica de negocio con presentacion.

**Bien aplicado:**

- `useBusinessDataCache.ts` - solo cache, una responsabilidad
- `useListFilters.ts` - solo filtrado generico
- `usePaginatedQuery.ts` - solo paginacion con cursores
- `BusinessHeader.tsx` - solo presentacion, sin side effects
- `StatCard.tsx`, `ActivityTable.tsx` - componentes puros de presentacion
- `rateLimiter.ts`, `moderator.ts`, `counters.ts` - funciones de utilidad focalizadas

**Violaciones:**

- `BusinessComments.tsx` (187 lineas) - mezcla presentacion, formulario de
  input, confirmacion de borrado, logica de rate limit client-side, y escrituras
  a Firestore
- `BusinessTags.tsx` (307 lineas) - contiene 3 dialogs, menu contextual,
  CRUD completo de custom tags, y toggle de predefined tags
- `SideMenu.tsx` (234 lineas) - mezcla navegacion, dialog de editar nombre,
  y orquestacion de secciones
- `DashboardOverview.tsx` - hace fetch de datos, calcula estadisticas, y
  renderiza todo
- `UsersPanel.tsx` - fetch de 7 colecciones completas, agregacion manual, y
  render de 6 TopLists
- `TrendsPanel.tsx` - logica de agregacion temporal (day/week/month/year)
  dentro del componente

### O - Abierto/Cerrado (7/10)

**Buen cumplimiento.** La arquitectura permite agregar funcionalidades sin
modificar mucho codigo existente.

**Bien aplicado:**

- `ActivityTable<T>` - generico, acepta cualquier tipo con columnas custom
- `useListFilters<T>` - generico para cualquier item con `business`
- `usePaginatedQuery<T>` - generico con converter pattern
- `LineChartCard` - configurable via props (`lines`, `xAxisKey`)
- `TopList` - reutilizable en admin y estadisticas publicas
- Tags predefinidos como constante `PREDEFINED_TAGS` - agregar uno es cambiar
  un array

**Limitaciones:**

- Agregar una nueva seccion al admin requiere modificar `AdminLayout.tsx`
  (switch por indice de tab)
- Agregar una nueva seccion al menu lateral requiere modificar `SideMenu.tsx`
  (tanto la navegacion como el renderizado condicional)
- Los converters siguen un patron repetitivo que podria abstraerse con un
  factory generico

### L - Sustitucion de Liskov (8/10)

**Buen cumplimiento.** Las interfaces son simples y coherentes.

- Los tipos de datos (`Rating`, `Comment`, `Favorite`, etc.) son interfaces
  consistentes
- `FilterableItem` define un contrato minimo para `useListFilters`
- `DailyMetrics extends PublicMetrics` es una herencia legitima
- Los converters implementan `FirestoreDataConverter<T>` correctamente

**Area de mejora:**

- `Feedback.category` esta tipado como `string` en vez de un literal
  union type (`'bug' | 'sugerencia' | 'otro'`), lo que permite valores
  invalidos

### I - Segregacion de Interfaces (7/10)

**Buen cumplimiento para la escala del proyecto.**

**Bien aplicado:**

- Tipos separados por dominio: `types/index.ts` (negocio),
  `types/admin.ts` (admin), `types/metrics.ts` (metricas publicas)
- Converters separados: `converters.ts`, `adminConverters.ts`,
  `metricsConverter.ts`
- Props de componentes bien focalizadas (ej: `BusinessRating` solo recibe
  lo que necesita)

**Limitaciones:**

- `AuthContextType` tiene 7 campos; `signInWithGoogle` y `signOut` solo
  los usa el admin, pero todos los componentes lo reciben
- `UseBusinessDataReturn` devuelve todos los datos del negocio aunque el
  consumidor solo necesite un subconjunto

### D - Inversion de Dependencias (5/10)

**Area de mejora significativa.** Es el principio SOLID mas debil.

**Problemas:**

- Componentes importan directamente `db` de `config/firebase.ts` y hacen
  operaciones de escritura (ej: `BusinessRating`, `BusinessComments`,
  `FavoriteButton`, `BusinessTags`, `FeedbackForm`)
- No existe una capa de servicios/repositorios que abstraiga Firestore
- Los componentes admin (`DashboardOverview`, `ActivityFeed`, `UsersPanel`,
  etc.) tienen queries de Firestore inline
- `useBusinessData.ts` importa directamente las funciones de cache del modulo

**Consecuencias:**

- Imposible testear componentes sin mockear Firebase
- Imposible cambiar el backend sin tocar componentes de UI
- Logica de negocio (rate limits client-side, sorting, filtering) acoplada
  a la presentacion

---

## Analisis de Arquitectura

### Diagrama de capas actual

```text
+------------------------------------------------------+
|                    PRESENTACION                       |
|  App.tsx -> AppShell -> Map / Business / Menu / Admin |
+------------------------------------------------------+
|     ESTADO GLOBAL          |      HOOKS               |
|  AuthContext  MapContext    |  useBusinessData          |
|                            |  useBusinesses            |
|                            |  useListFilters           |
|                            |  usePaginatedQuery        |
|                            |  usePublicMetrics         |
+------------------------------------------------------+
|               ACCESO A DATOS (directo)                |
|  firebase/firestore: getDoc, getDocs, setDoc, etc.    |
|  firebase/auth: signInAnonymously, signInWithPopup    |
|  firebase/functions: httpsCallable                    |
+------------------------------------------------------+
|                 CONFIGURACION                         |
|  firebase.ts  collections.ts  converters.ts           |
+------------------------------------------------------+
|               CLOUD FUNCTIONS                         |
|  triggers/ (7)  scheduled/ (1)  admin/ (4 callables)  |
|  utils/ (rateLimiter, moderator, counters, abuseLog)  |
+------------------------------------------------------+
```

### Diagrama de arquitectura deseada

```text
+------------------------------------------------------+
|                    PRESENTACION                       |
|  Componentes UI puros (props-driven)                  |
+------------------------------------------------------+
|            CONTENEDORES / HOOKS                       |
|  useBusinessData  usePaginatedQuery  etc.             |
+------------------------------------------------------+
|               CAPA DE SERVICIOS                       |
|  businessService  favoriteService  commentService     |
|  ratingService    feedbackService  adminService       |
+------------------------------------------------------+
|               CAPA DE REPOSITORIOS                    |
|  firestoreRepository (abstraccion sobre Firebase)     |
+------------------------------------------------------+
|                 INFRAESTRUCTURA                       |
|  firebase.ts  collections.ts  converters.ts           |
+------------------------------------------------------+
```

### Flujo de datos

```text
Usuario interactua
       |
       v
  Componente UI (ej: BusinessRating)
       |
       v
  Hook (useBusinessData) <-- cache layer
       |
       v
  Firestore (lecturas con converters)
       |
       v
  Cloud Function trigger (validacion server-side)
       |
       v
  Firestore (counters, flags, metricas)
```

### Evaluacion de modulos

| Modulo | Cohesion | Acoplamiento | Nota |
|--------|----------|-------------|------|
| `config/` | Alta | Bajo | Bien separado. Converters focalizados por dominio. |
| `context/` | Alta | Bajo | Dos contexts claros y minimalistas. |
| `hooks/` | Alta | Medio | Hooks bien extraidos. `useBusinessData` depende del cache module. |
| `types/` | Alta | Bajo | Separacion clara entre dominio, admin y metricas. |
| `components/business/` | Media | Alto | Componentes hacen writes directos a Firestore. |
| `components/admin/` | Baja | Alto | Cada componente hace su propio fetch + render. |
| `components/menu/` | Media | Alto | Similar patron de fetch directo. |
| `components/stats/` | Alta | Bajo | Componentes puros, reutilizables. |
| `functions/triggers/` | Alta | Bajo | Bien modularizados, usan utils compartidos. |
| `functions/utils/` | Alta | Bajo | Funciones puras y focalizadas. |
| `functions/admin/` | Alta | Medio | Backups bien estructurado con helpers. |

---

## Hallazgos de Calidad de Codigo

### TypeScript (8/10)

**Fortalezas:**

- `strict: true` con flags adicionales (`exactOptionalPropertyTypes`,
  `noUnusedLocals`, `noUnusedParameters`, `verbatimModuleSyntax`)
- `import type` usado consistentemente en todo el codebase
- Converters tipados eliminan `any` en lecturas de Firestore
- Generics bien usados en `ActivityTable<T>`, `useListFilters<T>`,
  `usePaginatedQuery<T>`

**Debilidades:**

- `Feedback.category` es `string` en vez de un literal union
- `data.text as string` casteos en Cloud Functions triggers (inevitable
  con admin SDK, pero podria tener validacion runtime)
- Tipo `unknown` en `toDate()` helper -- correcto pero podria tener un
  type guard dedicado
- `BusinessCategory` no se valida en runtime al cargar `businesses.json`

### Naming Conventions (8/10)

- Consistentes: PascalCase para componentes/tipos, camelCase para funciones/variables
- Archivos siguen el nombre del export principal
- Hooks con prefijo `use`
- Converters con sufijo `Converter`
- Constantes en UPPER_SNAKE_CASE

**Inconsistencias menores:**

- Carpeta `context/` vs `contexts/` (se usa singular, es aceptable)
- `src/pages/` solo tiene un archivo; podria estar en `components/admin/`
- `getBusinessName()` definida en `utils/businessHelpers.ts` Y duplicada
  dentro de `ActivityFeed.tsx`

### Violaciones DRY

1. **`formatDate()` duplicada en 4 archivos:**
   - `BusinessComments.tsx` linea 79
   - `CommentsList.tsx` linea 69
   - `RatingsList.tsx` linea 69
   - `BackupsPanel.tsx` linea 81 (diferente formato)

2. **`getBusinessName()` duplicada:**
   - `src/utils/businessHelpers.ts` (canonica)
   - `src/components/admin/ActivityFeed.tsx` linea 24 (duplicada)

3. **Patron loading/error repetido en componentes admin:**
   - `DashboardOverview`, `ActivityFeed`, `FeedbackList`, `TrendsPanel`,
     `UsersPanel`, `FirebaseUsage`, `AbuseAlerts` - todos tienen el mismo
     bloque `if (loading) return <CircularProgress />; if (error) return
     <Alert />;`

4. **`toDate()` helper duplicada:**
   - `src/config/converters.ts` linea 8
   - `src/config/adminConverters.ts` linea 53

5. **Patron de confirmacion de borrado repetido:**
   - `BusinessComments.tsx`, `BusinessTags.tsx`, `CommentsList.tsx` - misma
     estructura de Dialog de confirmacion

### Codigo Muerto / Innecesario

- `handleOpen` en `BusinessSheet.tsx` linea 17: funcion vacia (requerida
  por SwipeableDrawer pero podria usar `noop`)
- `FlaggedChip` en `ActivityFeed.tsx` linea 32: componente local que solo
  se usa una vez
- `refetch` acepta parametro `collectionName` en `useBusinessData.ts` linea
  18 pero `refetch` en linea 119 lo ignora y siempre refetchea todo

### Organizacion de Imports (8/10)

- Consistente en general: React primero, MUI segundo, Firebase tercero,
  imports internos al final
- `import type` correctamente separado
- Imports barrel para `../stats` (`index.ts`)

---

## Evaluacion de Modularizacion

### Componentes demasiado grandes

| Componente | Lineas | Problema |
|-----------|--------|----------|
| `BackupsPanel.tsx` | 419 | Mezcla UI + logica de negocio + manejo de errores + paginacion |
| `BusinessTags.tsx` | 307 | 3 dialogs + menu contextual + CRUD + toggle |
| `SideMenu.tsx` | 234 | Navegacion + dialog editar nombre + orquestacion |
| `BusinessComments.tsx` | 187 | Formulario + lista + confirmacion + rate limit |
| `UsersPanel.tsx` | 187 | Fetch de 7 colecciones + agregacion + render |
| `TrendsPanel.tsx` | 174 | Logica de agregacion temporal + render |
| `FirebaseUsage.tsx` | 153 | Estimacion de cuota + multiples graficos |
| `DashboardOverview.tsx` | 152 | Fetch + calculo + 6 cards + graficos + listas |
| `ActivityFeed.tsx` | 151 | Fetch de 5 colecciones + 4 tabs |

### Componentes bien dimensionados

| Componente | Lineas | Nota |
|-----------|--------|------|
| `StatCard.tsx` | 23 | Componente puro perfecto |
| `DirectionsButton.tsx` | 39 | Una responsabilidad |
| `LocationFAB.tsx` | 33 | Simple y enfocado |
| `FavoriteButton.tsx` | 54 | Props-driven, una accion |
| `TopList.tsx` | 54 | Reutilizable y generico |
| `PieChartCard.tsx` | 42 | Wrapper limpio de recharts |
| `ErrorBoundary.tsx` | 57 | Class component necesario |

### Hooks - Buena extraccion

| Hook | Lineas | Nota |
|------|--------|------|
| `useBusinessDataCache.ts` | 33 | Cache pura con TTL |
| `useUserLocation.ts` | 39 | Geolocation encapsulada |
| `usePublicMetrics.ts` | 43 | Fetch simple con cleanup |
| `useBusinesses.ts` | 35 | Filtrado con `useDeferredValue` |
| `useListFilters.ts` | 96 | Generico y reutilizable |
| `usePaginatedQuery.ts` | 158 | Generico con cache |
| `useBusinessData.ts` | 128 | Orquestador con cache + stale protection |

### Refactors recomendados

1. **Extraer `useFirestoreQuery` hook generico** para el patron
   fetch-on-mount que se repite en todos los componentes admin
2. **Crear `services/` layer** con funciones como `addComment()`,
   `toggleFavorite()`, `submitRating()` que encapsulen las escrituras
3. **Extraer `ConfirmDialog` componente** reutilizable para las
   confirmaciones de borrado
4. **Extraer `formatDate()` a `utils/`** como utilidad compartida
5. **Separar `BusinessTags` en `PredefinedTags` + `CustomTags`**

---

## Analisis de Performance

### Re-renders (7/10)

**Bien aplicado:**

- `BusinessMarker` usa `memo()` - evita re-render de 40 markers al
  seleccionar uno
- `BusinessRating`, `BusinessComments`, `BusinessTags` usan `memo()`
- `useDeferredValue` para debounce de busqueda en `useBusinesses` y
  `useListFilters`
- `useCallback` en handlers de MapView

**Problemas potenciales:**

- `MapContext` value object se recrea en cada render de `MapProvider`
  (deberia usar `useMemo`)
- `AuthContext` value object se recrea en cada render (idem)
- `FilterChips` se re-renderiza en cada cambio de `searchQuery` porque
  consume `useMapContext()` que incluye `searchQuery`
- Cada tab change en `AdminLayout` re-monta el componente completo de
  la tab, re-ejecutando todas las queries

### Cache y Firestore (8/10)

**Bien implementado:**

- Cache de business view (5 min TTL) evita re-queries al alternar negocios
- Cache de primera pagina (2 min TTL) en listas paginadas
- Persistent cache en prod (IndexedDB via `persistentLocalCache`)
- `Promise.all` para las 5 queries del business view
- `fetchIdRef` para evitar race conditions en `useBusinessData`

**Oportunidades:**

- Los componentes admin no tienen cache: cada cambio de tab re-ejecuta
  todas las queries
- `UsersPanel` hace fetch de 7 colecciones COMPLETAS sin paginacion ni
  limite -- potencial problema de escalabilidad
- `DashboardOverview` hace fetch de todos los `customTags` sin limite
- `TrendsPanel` y `FirebaseUsage` cargan todos los `dailyMetrics`
  (crece con el tiempo)
- `dailyMetrics` cron lee colecciones completas (ratings, comments,
  favorites, userTags) -- costoso a escala

### Bundle Size (7/10)

**Bien implementado:**

- Admin lazy-loaded con `React.lazy()` + `Suspense`
- `recharts` solo se importa en admin y StatsView
- `rollup-plugin-visualizer` disponible para analisis

**Oportunidades:**

- MUI tree-shaking: imports ya son por modulo (`@mui/material/Box`) en
  admin, pero barrel imports (`{ Box, Typography } from '@mui/material'`)
  en otros componentes -- inconsistente pero Vite/ESM tree-shakes bien
- `@vis.gl/react-google-maps` se carga siempre en la ruta principal
  (no hay alternativa razonable)
- `firebase` bundle es significativo; el persistent cache agrega overhead

---

## Analisis de Testing

### Estado actual (3/10)

**Tests existentes:**

| Archivo | Tipo | Cobertura |
|---------|------|-----------|
| `ErrorBoundary.test.tsx` | Componente | Basico: render + error state |
| `AuthContext.test.tsx` | Contexto | Basico |
| `MapContext.test.tsx` | Contexto | Basico |
| `useBusinesses.test.ts` | Hook | Filtrado |
| `useListFilters.test.ts` | Hook | Filtrado + ordenamiento |
| `useBusinessDataCache.test.ts` | Utilidad | Cache get/set/invalidate + TTL |
| `usePaginatedQuery.test.ts` | Hook | Paginacion (mocks Firebase) |
| `functions/__tests__/utils/counters.test.ts` | Backend | Counters |
| `functions/__tests__/utils/moderator.test.ts` | Backend | Moderacion |
| `functions/__tests__/utils/rateLimiter.test.ts` | Backend | Rate limit |

**No testeado (critico):**

- Escrituras a Firestore (add, delete, update) en componentes
- `useBusinessData` (orquestador principal)
- Componentes de negocio (BusinessSheet, BusinessComments, etc.)
- Flujos de autenticacion
- AdminGuard
- Cloud Functions triggers
- Scheduled function `dailyMetrics`
- Backups callable functions
- `businessHelpers.ts`

### Testabilidad del codigo (5/10)

- Hooks de logica pura (`useListFilters`, `useBusinesses`) son facilmente
  testeables
- Componentes que hacen writes directos a Firestore son dificiles de testear
  sin mockear el modulo completo
- Cloud Functions utils son testeables (estan testeados)
- Cloud Functions triggers requieren setup de emuladores
- Falta inyeccion de dependencias para facilitar mocking

---

## DevOps y CI/CD (7/10)

### Bien implementado

- GitHub Actions con deploy automatico a Firebase Hosting
- Firestore rules e indexes se despliegan automaticamente
- Node 22 en CI
- Secrets gestionados via GitHub Secrets
- Pre-commit hooks con husky + lint-staged (ESLint)
- Build verifica TypeScript (`tsc -b && vite build`)

### Oportunidades

- **CI no ejecuta tests:** `npm run test:run` no esta en el pipeline
- **Cloud Functions no se despliegan automaticamente:** es manual
- **No hay stage/preview environment:** solo production
- **No hay cache de `node_modules` en CI** (solo `npm` cache, no
  `node_modules`)
- **Falta step de lint de markdown** en CI
- **Falta `npm audit`** en CI para dependencias vulnerables

---

## Revision de Agentes y Skills

### Agentes (8/10)

**Estructura y organizacion: Excelente.** 9 agentes bien definidos con
responsabilidades claras.

| Agente | Evaluacion |
|--------|-----------|
| `orchestrator` | Bien definido. Delega correctamente. Lista todos los agentes. |
| `architecture` | Read-only correcto. Evalua estructura y patrones. |
| `security` | Read-only. Tiene contexto de security guidelines. |
| `testing` | Puede escribir. Estrategia de testing clara. |
| `performance` | Puede modificar. Areas de analisis bien listadas. |
| `documentation` | Puede escribir docs. Conoce reglas de markdownlint. |
| `ui-reviewer` | Read-only. Tiene contexto visual del tema. |
| `ui-ux-accessibility` | Puede modificar. WCAG 2.1 AA como estandar. |
| `git-expert` | Unico con acceso a git. Convenciones claras. |
| `pr-reviewer` | Read-only + git read-only. Checklist completo. |

**Fortalezas:**

- Separacion clara entre agentes que leen y los que modifican
- `git-expert` es el unico que puede ejecutar git (buena seguridad)
- Todos referencian `PROJECT_REFERENCE.md` para contexto
- Skills complementan a los agentes (read-only, no-create-files)

**Oportunidades de mejora:**

- No hay agente de **database/Firestore** especializado (queries, indexes,
  rules optimization)
- No hay agente de **deployment** (manejo de environments, rollbacks)
- El `orchestrator` no tiene criterios claros para decidir que agente
  invocar en casos ambiguos
- Skills son muy basicos (solo 2); podrian definirse skills para tareas
  especificas como "audit", "refactor", "migrate"

### Skills (5/10)

- `read-only.md` - util pero basico, solo lista herramientas permitidas
- `no-create-files.md` - util para limitar creacion de archivos

**Faltantes sugeridos:**

- Skill de `code-review` con checklist especifico del proyecto
- Skill de `firestore-query` con patrones de optimizacion
- Skill de `component-template` con la estructura esperada de un componente

---

## Roadmap de Mejoras Priorizado

### P0 - Critico (hacer ahora)

1. **Agregar tests al CI pipeline**
   - Agregar `npm run test:run` al workflow de deploy
   - Impacto: prevenir regresiones en produccion
   - Esfuerzo: 5 minutos

2. **Extraer capa de servicios para escrituras a Firestore**
   - Crear `src/services/` con funciones como `addComment()`,
     `toggleFavorite()`, `submitRating()`, `submitFeedback()`
   - Mover la logica de escritura de los componentes a los servicios
   - Impacto: testabilidad, mantenibilidad, SRP
   - Esfuerzo: 1-2 dias

3. **Limitar queries sin paginacion en admin**
   - `UsersPanel` carga 7 colecciones completas
   - `DashboardOverview` carga todos los customTags
   - Agregar `limit()` o paginacion
   - Impacto: prevenir timeouts y costos excesivos a medida que crece
   - Esfuerzo: 0.5 dias

### P1 - Alto (proxima iteracion)

1. **Extraer utilidades compartidas**
   - `formatDate()` a `src/utils/dateHelpers.ts`
   - `ConfirmDialog` a `src/components/shared/ConfirmDialog.tsx`
   - Eliminar duplicacion de `getBusinessName()` en ActivityFeed
   - Eliminar duplicacion de `toDate()` en adminConverters
   - Impacto: DRY, mantenibilidad
   - Esfuerzo: 0.5 dias

2. **Memoizar context values**
   - Wrap `MapContext.Provider value` en `useMemo`
   - Wrap `AuthContext.Provider value` en `useMemo`
   - Impacto: evitar re-renders innecesarios en consumidores
   - Esfuerzo: 30 minutos

3. **Mejorar cobertura de tests**
   - Tests para `useBusinessData` hook
   - Tests para `businessHelpers.ts`
   - Tests para componentes de negocio criticos (flujos de escritura)
   - Tests para Cloud Functions triggers
   - Impacto: confianza en cambios, prevencion de regresiones
   - Esfuerzo: 2-3 dias

4. **Tipar `Feedback.category` como union literal**
   - Cambiar `category: string` a `category: 'bug' | 'sugerencia' | 'otro'`
   - Actualizar converters y componentes
   - Impacto: seguridad de tipos, prevencion de valores invalidos
   - Esfuerzo: 30 minutos

### P2 - Medio (backlog planificado)

1. **Implementar React Router**
   - Reemplazar `window.location.pathname` por React Router
   - Rutas: `/` (mapa), `/admin` (dashboard)
   - Impacto: navegacion SPA correcta, deep linking, guards route-based
   - Esfuerzo: 1 dia

2. **Descomponer componentes grandes**
   - `BusinessTags` en `PredefinedTags` + `CustomTags`
   - `SideMenu` extraer dialog de nombre a componente
   - `BackupsPanel` extraer tabla y dialog de confirmacion
   - Impacto: SRP, legibilidad, testabilidad
   - Esfuerzo: 1-2 dias

3. **Crear `useAdminQuery` hook generico**
   - Para el patron fetch-on-mount repetido en todos los componentes admin
   - Soportar loading/error states, refresh, y cache opcional
   - Impacto: DRY, consistencia en manejo de errores admin
   - Esfuerzo: 0.5 dias

4. **Agregar `npm audit` y lint de markdown al CI**
   - Step de `npm audit --production` con threshold
   - Step de markdownlint para archivos `.md`
   - Impacto: seguridad de dependencias, calidad de documentacion
   - Esfuerzo: 30 minutos

5. **Deploy automatico de Cloud Functions**
   - Agregar step en GitHub Actions para `firebase deploy --only functions`
   - Solo si hay cambios en `functions/`
   - Impacto: consistencia entre frontend y backend
   - Esfuerzo: 30 minutos

### P3 - Bajo (mejoras a largo plazo)

1. **Converter factory generico**
   - Crear funcion `createConverter<T>(config)` que genere converters
     a partir de un esquema
   - Reducir boilerplate de los 9 converters actuales
   - Esfuerzo: 0.5 dias

2. **Preview environments**
   - Configurar Firebase Hosting preview channels para PRs
   - Impacto: revision visual antes de merge
   - Esfuerzo: 1 dia

3. **Error tracking (Sentry/similar)**
   - Integrar servicio de error tracking en produccion
   - Reemplazar `console.error` por tracking estructurado
   - Impacto: visibilidad de errores en produccion
   - Esfuerzo: 0.5 dias

4. **Agregar agentes Claude especializados**
   - Agente de database/Firestore
   - Agente de deployment
   - Skills mas especificos (code-review, firestore-query)
   - Esfuerzo: 0.5 dias

---

## Quick Wins

Cambios de alto impacto y bajo esfuerzo que se pueden hacer inmediatamente:

| Item | Esfuerzo | Impacto |
|------|----------|---------|
| Agregar `npm run test:run` al CI | 5 min | Prevenir regresiones |
| Memoizar context values (`useMemo`) | 30 min | Performance |
| Tipar `Feedback.category` como union | 30 min | Type safety |
| Extraer `formatDate` a utils | 30 min | DRY |
| Eliminar `getBusinessName` duplicada en ActivityFeed | 5 min | DRY |
| Mover `toDate` de adminConverters a un modulo compartido | 15 min | DRY |
| Agregar `limit()` a queries sin limitar en admin | 1 hora | Escalabilidad |
| Agregar `npm audit` al CI | 15 min | Seguridad |

---

## Conclusiones

Modo Mapa v1.4.0 es un proyecto bien mantenido para su escala actual.
La arquitectura es coherente y las decisiones de diseno (datos estaticos +
dinamicos, cache de dos niveles, seguridad en capas) son solidas. El
principal deficit es la falta de una capa de servicios que separe la logica
de negocio de los componentes UI, lo que dificulta el testing y aumenta el
acoplamiento. La cobertura de tests es el area mas critica a mejorar.

El ecosistema de agentes Claude es una fortaleza diferenciadora del proyecto,
con buena separacion de responsabilidades y contexto del proyecto integrado.

Para escalar mas alla de 40 comercios y un admin, las prioridades son:
limitar queries en admin, agregar tests al CI, y crear la capa de servicios.

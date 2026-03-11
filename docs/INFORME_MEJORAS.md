# Informe de Mejoras Técnicas

**Fecha:** 2026-03-11
**Versión analizada:** 1.2.0

---

## Resumen

| Categoría | Resueltos | Pendientes |
|-----------|-----------|------------|
| Error handling | 2/2 | 0 |
| Performance | 3/5 | 2 |
| Código / DRY | 4/4 | 0 |
| UX | 3/5 | 2 |
| Accesibilidad | 2/2 | 0 |
| Testing | 0/3 | 3 |
| Mobile | 2/3 | 1 |
| DevEx | 1/3 | 2 |

---

## Mejoras implementadas

| # | Mejora | Categoría |
|---|--------|-----------|
| 1 | Error Boundary global (`ErrorBoundary.tsx` envuelve `AppShell`) | Error handling |
| 2 | Estados de error con reintentar en FavoritesList, CommentsList, RatingsList, BusinessRating, BusinessTags, BusinessComments | Error handling |
| 3 | `allBusinesses` exportado desde `useBusinesses.ts`, eliminada duplicación en 3 archivos | Código / DRY |
| 4 | Collection names centralizados en `src/config/collections.ts` | Código / DRY |
| 5 | `useDeferredValue` en `useBusinesses` para debounce de búsqueda | Performance |
| 6 | `React.memo()` en BusinessComments, BusinessTags, BusinessRating | Performance |
| 7 | Loading feedback con `disabled` en toggle de tags predefinidos | Performance |
| 8 | ARIA labels en LocationFAB, SearchBar, FilterChips, FavoriteButton, DirectionsButton | Accesibilidad |
| 9 | Viewport zoom habilitado (`user-scalable=yes`) | Accesibilidad |
| 10 | Indicador "No se encontraron comercios" en MapView cuando hay filtros activos sin resultados | UX |
| 11 | Rate limit client-side de 20 comentarios/día | UX |
| 12 | Safe area insets (`env(safe-area-inset-bottom)`) en `index.css` y `BusinessSheet` | Mobile |
| 13 | Tipado estricto con `withConverter<T>()` en todas las lecturas de Firestore (`src/config/converters.ts`) | Código / DRY |
| 14 | Reglas de Firestore documentadas con comentarios por colección en `firestore.rules` | DevEx |

---

## Mejoras pendientes

### Media prioridad

#### 1. Paginación en listas del menú

- **Archivos:** `FavoritesList.tsx`, `CommentsList.tsx`, `RatingsList.tsx`
- **Problema:** Cargan todos los documentos de una vez. Con 1000+ items, rendimiento se degrada.
- **Accionable:** Implementar paginación con `limit()` + `startAfter()` de Firestore, o virtual scrolling.

#### 2. Mejorar cobertura de tests

- **Archivos:** Solo existen tests para `useListFilters` y `useBusinesses`.
- **Problema:** 0 tests de componentes, 0 tests de operaciones async.
- **Accionable:** Agregar tests para:
  - `AuthContext` (flujo de auth anónima)
  - `MapContext` (toggle filters, setSelectedBusiness)
  - Edge cases en hooks existentes (caracteres especiales, listas vacías)
  - ErrorBoundary (catch de errores)

#### 3. Debounce en ListFilters (listas del menú)

- **Archivo:** `src/components/menu/ListFilters.tsx`
- **Problema:** El filtrado en listas del menú se ejecuta en cada keystroke.
- **Accionable:** Agregar `useDeferredValue` al `useListFilters` hook.

### Baja prioridad

#### 4. Pre-commit hooks (husky + lint-staged)

- **Problema:** No hay hooks que fuercen correr tests y lint antes de commitear.
- **Accionable:** Instalar `husky` + `lint-staged` para correr `npm run test:run` y `markdownlint` automáticamente.

#### 5. Bundle size analysis

- **Problema:** No se monitorea el tamaño del bundle (actualmente 860 KB).
- **Accionable:** Agregar `rollup-plugin-visualizer` o `vite-bundle-analyzer` como dev dependency.

#### 6. Agregar `exactOptionalPropertyTypes` en tsconfig

- **Archivo:** `tsconfig.app.json`
- **Problema:** Propiedades opcionales pueden ser `undefined` sin control explícito.
- **Accionable:** Habilitar `exactOptionalPropertyTypes: true` y corregir los errores que aparezcan.

---

## Aspectos positivos del proyecto

- Arquitectura clara y bien organizada (contexts, hooks, components separados)
- MUI bien utilizado, tema consistente
- Hooks reutilizables (`useListFilters` genérico)
- TypeScript en modo strict
- Tests de lógica de hooks con buena cobertura (29 tests)
- Workflow de desarrollo documentado en `PROCEDURES.md`
- CI/CD automatizado con GitHub Actions
- Documentación por feature en `docs/`
- Error handling completo con Error Boundary y estados de error en todos los componentes async
- Collection names centralizados sin strings mágicos
- Accesibilidad: ARIA labels en todos los elementos interactivos
- Safe area insets para dispositivos con notch
- Security headers completos en producción

# Informe de Mejoras Técnicas

**Fecha:** 2026-03-11
**Versión analizada:** 1.1.1

---

## Resumen

| Categoría | Issues | Prioridad |
|-----------|--------|-----------|
| Error handling | 4 | Alta |
| Performance | 5 | Alta |
| Código / DRY | 4 | Media |
| UX | 5 | Media |
| Accesibilidad | 4 | Media |
| Testing | 3 | Media |
| Mobile | 3 | Baja |
| DevEx | 3 | Baja |

---

## Accionables por prioridad

### Alta prioridad

#### 1. Agregar Error Boundary global

- **Problema:** No hay React Error Boundary. Un error en un componente crashea toda la app.
- **Archivos a modificar:** `src/App.tsx`
- **Accionable:** Crear `src/components/layout/ErrorBoundary.tsx` y envolver `AppShell`.

#### 2. Agregar estados de error en listas y operaciones async

- **Archivos:** `FavoritesList.tsx`, `CommentsList.tsx`, `RatingsList.tsx`, `BusinessRating.tsx`, `BusinessTags.tsx`
- **Problema:** Los errores de Firestore se loguean en consola pero el usuario no ve nada. Queda en loading infinito o estado vacío.
- **Accionable:** Agregar estado `error` y renderizar mensaje "Error al cargar" con botón de reintentar.

#### 3. Centralizar carga de businesses (DRY)

- **Archivos:** 4+ archivos importan `businessesData` y hacen el cast a `Business[]`.
- **Problema:** Patrón duplicado. Si cambia el JSON, hay que tocar 4 archivos.
- **Accionable:** Exportar `allBusinesses` desde un único lugar (ya existe en `useBusinesses.ts`, usar ese export).

#### 4. Debounce en búsqueda

- **Archivos:** `src/components/search/SearchBar.tsx`, `src/components/menu/ListFilters.tsx`
- **Problema:** `setSearchQuery` se ejecuta en cada keystroke, forzando filtrado inmediato.
- **Accionable:** Agregar debounce de ~300ms con `useDeferredValue` o un custom hook `useDebounce`.

#### 5. Memoización de componentes pesados

- **Archivos:** `BusinessComments.tsx`, `BusinessTags.tsx`, `BusinessRating.tsx`
- **Problema:** Se re-renderizan en cada update del padre (BusinessSheet) aunque sus props no cambien.
- **Accionable:** Envolver con `React.memo()`.

### Media prioridad

#### 6. Agregar ARIA labels a elementos interactivos

- **Archivos:** `LocationFAB.tsx`, `SearchBar.tsx`, `FilterChips.tsx`, `FavoriteButton.tsx`, `DirectionsButton.tsx`
- **Problema:** Botones de ícono sin `aria-label`. Screen readers no pueden identificar su función.
- **Accionable:** Agregar `aria-label` a cada `IconButton` y `Fab`.

#### 7. Paginación en listas del menú

- **Archivos:** `FavoritesList.tsx`, `CommentsList.tsx`, `RatingsList.tsx`
- **Problema:** Cargan todos los documentos de una vez. Con 1000+ items, rendimiento se degrada.
- **Accionable:** Implementar paginación con `limit()` + `startAfter()` de Firestore, o al menos virtual scrolling.

#### 8. Indicador de "sin resultados" en búsqueda y mapa

- **Archivos:** `MapView.tsx`, `SearchBar.tsx`
- **Problema:** Si la búsqueda no tiene resultados, el mapa queda vacío sin explicación.
- **Accionable:** Mostrar mensaje "No se encontraron comercios" cuando `businesses.length === 0` y hay filtros activos.

#### 9. Extraer constantes y collection names

- **Archivos:** Múltiples componentes hardcodean `'ratings'`, `'comments'`, `'favorites'`, etc.
- **Problema:** Strings mágicos dispersos, fuente de errores de tipeo.
- **Accionable:** Crear `src/config/collections.ts` con constantes exportadas.

#### 10. Mejorar cobertura de tests

- **Archivos:** Solo existen tests para `useListFilters` y `useBusinesses`.
- **Problema:** 0 tests de componentes, 0 tests de operaciones async, 0 tests de edge cases.
- **Accionable:** Agregar tests para:
  - `AuthContext` (flujo de auth anónima)
  - `MapContext` (toggle filters, setSelectedBusiness)
  - Edge cases en hooks existentes (caracteres especiales, listas vacías)

#### 11. Agregar loading feedback en operaciones individuales

- **Archivos:** `BusinessTags.tsx` (toggle tag), `FavoriteButton.tsx` (toggle fav)
- **Problema:** Al hacer click en un tag o favorito, no hay feedback visual inmediato.
- **Accionable:** Agregar estado `pending` y deshabilitar el botón durante la operación.

#### 12. Viewport zoom habilitado

- **Archivo:** `index.html`
- **Problema:** `user-scalable=no` y `maximum-scale=1.0` impiden zoom en mobile.
- **Accionable:** Cambiar a `user-scalable=yes` (mejor accesibilidad, patrón recomendado).

### Baja prioridad

#### 13. Pre-commit hooks (husky + lint-staged)

- **Problema:** No hay hooks que fuercen correr tests y lint antes de commitear.
- **Accionable:** Instalar `husky` + `lint-staged` para correr `npm run test:run` y `markdownlint` automáticamente.

#### 14. Bundle size analysis

- **Problema:** No se monitorea el tamaño del bundle.
- **Accionable:** Agregar `rollup-plugin-visualizer` o `vite-bundle-analyzer` como dev dependency.

#### 15. Safe area insets para dispositivos con notch

- **Archivos:** `index.css`, `BusinessSheet.tsx`
- **Problema:** `100dvh` no contempla safe areas en iPhone con notch.
- **Accionable:** Agregar `env(safe-area-inset-bottom)` en los componentes que tocan el borde inferior.

#### 16. Tipado estricto para datos de Firestore

- **Archivos:** Todos los componentes que hacen `d.data()`.
- **Problema:** `d.data()` retorna `DocumentData` (any implícito). Se castea sin validación.
- **Accionable:** Crear converters tipados de Firestore (`withConverter<T>()`) o validar con Zod.

#### 17. Agregar `exactOptionalPropertyTypes` en tsconfig

- **Archivo:** `tsconfig.app.json`
- **Problema:** Propiedades opcionales pueden ser `undefined` sin control explícito.
- **Accionable:** Habilitar `exactOptionalPropertyTypes: true` y corregir los errores que aparezcan.

#### 18. Documentar reglas de Firestore

- **Archivo:** `firestore.rules`
- **Problema:** 64 líneas de reglas sin comentarios explicativos.
- **Accionable:** Agregar comentarios por colección explicando quién puede leer/escribir y por qué.

---

## Aspectos positivos del proyecto

- Arquitectura clara y bien organizada (contexts, hooks, components separados)
- MUI bien utilizado, tema consistente
- Hooks reutilizables (`useListFilters` genérico)
- TypeScript en modo strict
- Tests de lógica de hooks con buena cobertura
- Workflow de desarrollo documentado en `PROCEDURES.md`
- CI/CD automatizado con GitHub Actions
- Documentación por feature en `docs/`

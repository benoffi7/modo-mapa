# Specs: #284 Toast missing in settings + stale cache fallback

**Fecha:** 2026-03-31

---

## Resumen

Tres fixes independientes de bajo riesgo:

1. `useUserSettings` — `updateDigestFrequency`, `updateLocality`, `clearLocality` revierten en silencio. Copiar `toast.warning` de `updateSetting`.
2. `MenuPhotoViewer` — `handleReport` catch no da feedback al usuario. Agregar `toast.error`.
3. `SharedListsView` — cuando `fetchFeaturedLists` falla y el cache expiró, se muestra lista vacía. Usar el cache expirado como fallback stale.

---

## Modelo de datos

Sin cambios. Sin colecciones nuevas.

---

## Firestore Rules

Sin cambios.

---

## Cloud Functions

Sin cambios.

---

## Fix 1: useUserSettings — toast en catch de 3 métodos

**Archivo:** `src/hooks/useUserSettings.ts`

### Situación actual

`updateSetting` ya tiene el patrón correcto:

```ts
updateUserSettings(user.uid, { [key]: value }).catch((err) => {
  logger.error('[useUserSettings] updateUserSettings failed:', err);
  setOptimistic((prev) => { ... });
  toast.warning(MSG_COMMON.settingUpdateError);  // ← presente
});
```

Los otros tres métodos lo omiten:

```ts
// updateLocality — catch actual
.catch((err) => {
  logger.error('[useUserSettings] updateLocality failed:', err);
  setLocalityOverride(null);
  // ← sin toast
});

// clearLocality — catch actual
.catch((err) => {
  logger.error('[useUserSettings] clearLocality failed:', err);
  setLocalityOverride(null);
  // ← sin toast
});

// updateDigestFrequency — catch actual
.catch((err) => {
  logger.error('[useUserSettings] updateDigestFrequency failed:', err);
  setDigestOverride(null);
  // ← sin toast
});
```

### Propuesto

Agregar `toast.warning(MSG_COMMON.settingUpdateError)` al final de cada catch, y agregar `toast` a los deps arrays de `updateLocality`, `clearLocality`, `updateDigestFrequency`.

Los tres callbacks ya dependen de `user` en `useCallback`. La adición de `toast` al dep array es correcta — `ToastContext` devuelve un objeto estable (`useMemo`).

---

## Fix 2: MenuPhotoViewer — toast.error en handleReport catch

**Archivo:** `src/components/business/MenuPhotoViewer.tsx`

### Situación actual

```ts
const handleReport = async () => {
  setReporting(true);
  try {
    await reportMenuPhoto(photoId);
    setReported(true);
  } catch (err) {
    if (import.meta.env.DEV) logger.error('Error reporting photo:', err);
    // ← sin feedback al usuario
  } finally {
    setReporting(false);
  }
};
```

El componente no importa `useToast`. El logger está condicionado a DEV, lo que significa que en producción el error se traga completamente.

### Propuesto

1. Importar `useToast` de `../../context/ToastContext`.
2. Agregar constante de mensaje en `src/constants/messages/business.ts`: `photoReportError: 'No se pudo reportar la foto'`.
3. Cambiar catch:

```ts
} catch (err) {
  logger.error('Error reporting photo:', err);   // siempre, no solo DEV
  toast.error(MSG_BUSINESS.photoReportError);
}
```

Nota: el `if (import.meta.env.DEV)` se elimina — `logger.error` ya maneja verbosidad interna y silenciar errores en prod oculta bugs.

---

## Fix 3: SharedListsView — stale cache como fallback

**Archivo:** `src/components/lists/SharedListsView.tsx`

### Situación actual

```ts
// Warm desde cache solo si no expiró (< TTL)
if (Date.now() - ts < CACHE_TTL && !ignore) {
  setFeaturedLists(data.map(...));
}

fetchFeaturedLists()
  .then((result) => { ... })
  .catch((err) => logger.error('[SharedListsView] fetchFeaturedLists failed:', err));
  // ← si el cache expiró y fetchFeaturedLists falla → featuredLists queda []
```

### Propuesto

Separar la lógica en dos pasos:

1. **Warm inmediato:** cargar cache sin importar TTL, guardando `isStale = Date.now() - ts >= CACHE_TTL`.
2. **Fetch:** si fetch falla y el warm fue stale, conservar los datos stale (no limpiar). Si el warm fue fresco y el fetch falla, igual conservar los datos (ya estaban seteados).

Cambio concreto — reemplazar el bloque `try/catch` de warm + fetch:

```ts
// Warm desde cache: usar siempre, marcar si expirado
let warmedFromCache = false;
try {
  const cached = localStorage.getItem(CACHE_KEY);
  if (cached) {
    const { data, ts } = JSON.parse(cached) as { data: SharedList[]; ts: number };
    if (!ignore) {
      setFeaturedLists(data.map((l) => ({
        ...l,
        createdAt: new Date(l.createdAt),
        updatedAt: new Date(l.updatedAt),
      })));
      warmedFromCache = true;
    }
  }
} catch { /* ignore malformed cache */ }

fetchFeaturedLists()
  .then((result) => {
    if (!ignore) {
      setFeaturedLists(result);
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({ data: result, ts: Date.now() }));
      } catch { /* storage full */ }
    }
  })
  .catch((err) => {
    logger.error('[SharedListsView] fetchFeaturedLists failed:', err);
    // Si no hay datos de cache, no hay nada que hacer — lista queda vacía
    // Si hay datos de cache (frescos o stale), ya están seteados — no limpiar
    if (!warmedFromCache && !ignore) {
      // opcional: futuro toast offline si se quiere
    }
  });
```

La clave: remover la condición `Date.now() - ts < CACHE_TTL` del warm. El cache siempre se usa para warm. El fetch fresco lo reemplaza si tiene éxito.

`warmedFromCache` se declara fuera del `try` para que el `.catch` lo lea (closure). Como es `let` en el scope del `useEffect`, no hay problema de stale closure.

---

## Componentes

Sin componentes nuevos. Solo modificaciones mínimas a los tres archivos existentes.

---

## Textos de usuario

| Texto | Donde se usa | Notas |
|-------|-------------|-------|
| `'No se pudo guardar el cambio'` | toast en `updateLocality`, `clearLocality`, `updateDigestFrequency` | Ya existe en `MSG_COMMON.settingUpdateError` |
| `'No se pudo reportar la foto'` | toast en `MenuPhotoViewer` `handleReport` catch | Nueva constante `MSG_BUSINESS.photoReportError` |

---

## Hooks

`useUserSettings` — sin cambios de interfaz. Solo se agrega `toast` al dep array de tres callbacks y `toast.warning(...)` al final de sus catch.

---

## Servicios

Sin cambios en servicios.

---

## Integracion

Sin cambios de integración. Los tres archivos son independientes entre sí.

---

## Tests

| Archivo test | Que testear | Tipo |
|-------------|-------------|------|
| `src/hooks/useUserSettings.test.ts` (nuevo) | `updateLocality` revierte y llama `toast.warning` en error; `clearLocality` ídem; `updateDigestFrequency` ídem | Unit — renderHook + vi.fn |
| `src/components/business/MenuPhotoViewer.test.tsx` (nuevo) | `handleReport` muestra toast.error cuando `reportMenuPhoto` rechaza | Unit — render + userEvent |
| `src/components/lists/SharedListsView.test.tsx` (nuevo) | cuando `fetchFeaturedLists` falla y hay cache expirado, las `featuredLists` siguen mostrándose | Unit — render + mock localStorage |

### Estrategia de mocks

- `useUserSettings` tests: mockear `updateUserSettings` para que rechace; spy en `toast.warning`.
- `MenuPhotoViewer` tests: mockear `reportMenuPhoto` para que rechace; spy en `toast.error`.
- `SharedListsView` tests: mockear `fetchFeaturedLists` para que rechace; precargar `localStorage` con datos expirados (ts = `Date.now() - 25 * 60 * 60 * 1000`).

---

## Analytics

Sin eventos nuevos.

---

## Offline

Los tres fixes mejoran la experiencia offline/error:

- Fix 1 y 2: feedback explícito cuando operaciones fallan (conectividad o server error).
- Fix 3: contenido degradado en lugar de pantalla vacía cuando la red falla y el cache expiró.

### Cache strategy

| Dato | Estrategia | TTL | Storage |
|------|-----------|-----|---------|
| `featuredLists` | Warm siempre desde cache; fetch reemplaza si éxito | 24h (solo para decide si hacer fetch, no para mostrar) | localStorage `mm_featured_lists` |

---

## Accesibilidad y UI mobile

Sin cambios en elementos interactivos. El toast usa el sistema global existente.

---

## Decisiones tecnicas

**Fix 3 — TTL como hint de refresco, no de display:** el TTL de 24h se conserva como condición para decidir si el warm fue "fresco" (por si en el futuro se quiere mostrar un badge "datos del día anterior"), pero deja de controlar si se muestra o no. Esto sigue el patrón `stale-while-revalidate` ya usado en `useBusinessData` (`readCache` 3-tier).

**Fix 2 — Eliminar `if (import.meta.env.DEV)` del logger:** silenciar errores en producción contradice el propósito del logger. El logger ya tiene niveles internos; la decisión de verbosidad no debe estar en el componente.

---

## Deuda tecnica: mitigacion incorporada

Sin issues de deuda técnica activos directamente relacionados con estos tres archivos.

# Technical Specs: Fix CSP Policy & Custom Tags Permissions

## Cambio 1: CSP — Agregar `apis.google.com`

### Archivo: `firebase.json`

**Actual** (línea 16):

```text
script-src 'self' *.googleapis.com https://www.google.com https://www.gstatic.com
```

**Propuesto**:

```text
script-src 'self' *.googleapis.com https://apis.google.com https://www.google.com https://www.gstatic.com
```

### Justificación

- `apis.google.com` es un dominio separado de `googleapis.com`
- Firebase Auth usa Google Identity Services que carga scripts desde `https://apis.google.com/js/api.js`
- Sin este dominio en la whitelist, los navegadores que aplican CSP bloquean el script

---

## Cambio 2: Guard de auth en `loadTags()`

### Archivo: `src/components/business/BusinessTags.tsx`

**Actual** (`loadTags`, línea 68-103):

```typescript
const loadTags = useCallback(async () => {
  const q = query(
    collection(db, COLLECTIONS.USER_TAGS).withConverter(userTagConverter),
    where('businessId', '==', businessId)
  );
  try {
    setError(false);
    const snapshot = await getDocs(q);
    // ... procesa snapshot
  } catch (err) {
    console.error('Error loading tags:', err);
    setError(true);
  }
}, [businessId, seedTags, user]);
```

**Propuesto**:

```typescript
const loadTags = useCallback(async () => {
  if (!user) {
    // Sin auth, mostrar solo seed tags sin conteos de votos
    setTagCounts(
      seedTags.map((tagId) => ({ tagId, count: 0, userAdded: false }))
    );
    return;
  }
  const q = query(
    collection(db, COLLECTIONS.USER_TAGS).withConverter(userTagConverter),
    where('businessId', '==', businessId)
  );
  try {
    setError(false);
    const snapshot = await getDocs(q);
    // ... procesa snapshot (sin cambios)
  } catch (err) {
    console.error('Error loading tags:', err);
    setError(true);
  }
}, [businessId, seedTags, user]);
```

### Justificación del guard de auth

- Las reglas de Firestore requieren `request.auth != null` para leer `userTags`
- `loadCustomTags()` ya implementa este patrón correctamente
- Sin auth, se muestran los seed tags con count 0 (degradación elegante)
- Cuando el auth state se resuelve, el `useEffect` se re-ejecuta por dependencia en `user`

## Archivos afectados

| Archivo | Cambio |
|---------|--------|
| `firebase.json` | Agregar dominio a CSP `script-src` |
| `src/components/business/BusinessTags.tsx` | Guard de auth en `loadTags()` |

## Riesgos

- **Bajo**: Los cambios son mínimos y no afectan lógica de negocio
- La CSP sigue siendo restrictiva — solo se agrega un dominio necesario de Google

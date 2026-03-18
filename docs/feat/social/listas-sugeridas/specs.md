# Specs: Listas sugeridas por la plataforma

**PRD:** [prd.md](./prd.md)
**Issue:** #156
**Estado:** Pendiente de aprobación

---

## S1: Campo `featured` en SharedList

Agregar campo opcional al tipo en `src/types/index.ts`:

```typescript
export interface SharedList {
  id: string;
  ownerId: string;
  name: string;
  description: string;
  isPublic: boolean;
  itemCount: number;
  featured?: boolean;    // NEW — solo admin/system puede setear
  createdAt: Date;
  updatedAt: Date;
}
```

**Converter** (`src/config/converters.ts`): agregar `featured: d.get('featured') ?? false` en `fromFirestore`.

**Firestore rules** — actualizar read de `sharedLists`:

```text
allow read: if request.auth != null
  && (resource.data.ownerId == request.auth.uid
      || resource.data.isPublic == true
      || resource.data.get('featured', false) == true);
```

**Firestore rules** — actualizar `create` para aceptar `featured` opcionalmente:

```text
&& request.resource.data.keys().hasOnly(['ownerId', 'name', 'description', 'isPublic', 'itemCount', 'createdAt', 'updatedAt', 'featured'])
```

No agregar `featured` en create de usuarios normales — solo writable via admin SDK.

---

## S2: Callable `toggleFeaturedList`

Nuevo archivo `functions/src/admin/featuredLists.ts`:

```typescript
import { onCall } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { assertAdmin } from '../helpers/assertAdmin';
import { IS_EMULATOR } from '../helpers/env';

export const toggleFeaturedList = onCall(
  { enforceAppCheck: !IS_EMULATOR },
  async (request) => {
    assertAdmin(request.auth as never);

    const { listId, featured } = request.data as { listId: string; featured: boolean };
    if (!listId || typeof listId !== 'string') throw new HttpsError('invalid-argument', 'listId required');
    if (typeof featured !== 'boolean') throw new HttpsError('invalid-argument', 'featured must be boolean');

    const db = getFirestore();
    const listRef = db.doc(`sharedLists/${listId}`);
    const snap = await listRef.get();

    if (!snap.exists) throw new HttpsError('not-found', 'Lista no encontrada');
    if (featured && !snap.data()?.isPublic) {
      throw new HttpsError('failed-precondition', 'Solo listas públicas pueden ser destacadas');
    }

    await listRef.update({ featured });
    return { success: true };
  },
);
```

**Registrar** en `functions/src/index.ts`.

---

## S3: Scheduled — Generar listas automáticas

Nuevo archivo `functions/src/scheduled/featuredLists.ts`:

```typescript
export const generateFeaturedLists = onSchedule(
  { schedule: '0 5 * * 1', timeZone: 'America/Argentina/Buenos_Aires' },
  async () => {
    const db = getFirestore();
    const SYSTEM_OWNER = 'system';

    // Read pre-computed aggregates
    const aggSnap = await db.doc('config/aggregates').get();
    const agg = aggSnap.data() ?? {};

    // 1. Top 10 más calificados (por promedio)
    const ratingCounts = agg.businessRatingCount ?? {};
    const ratingSums = agg.businessRatingSum ?? {};
    const topRated = Object.keys(ratingCounts)
      .filter((id) => ratingCounts[id] >= 3) // mínimo 3 ratings
      .map((id) => ({ id, avg: ratingSums[id] / ratingCounts[id] }))
      .sort((a, b) => b.avg - a.avg)
      .slice(0, 10)
      .map((b) => b.id);

    // 2. Más comentados
    const bizComments = agg.businessComments ?? {};
    const topCommented = Object.entries(bizComments)
      .sort(([, a], [, b]) => (b as number) - (a as number))
      .slice(0, 10)
      .map(([id]) => id);

    // 3. Favoritos de la comunidad
    const bizFavorites = agg.businessFavorites ?? {};
    const topFavorited = Object.entries(bizFavorites)
      .sort(([, a], [, b]) => (b as number) - (a as number))
      .slice(0, 10)
      .map(([id]) => id);

    // Upsert each list
    const lists = [
      { key: 'featured_top_rated', name: 'Top 10 más calificados', desc: 'Los comercios con mejor promedio de rating', items: topRated },
      { key: 'featured_most_commented', name: 'Más comentados', desc: 'Los comercios con más opiniones de la comunidad', items: topCommented },
      { key: 'featured_most_favorited', name: 'Favoritos de la comunidad', desc: 'Los comercios que más usuarios guardaron', items: topFavorited },
    ];

    for (const list of lists) {
      const listRef = db.doc(`sharedLists/${list.key}`);
      await listRef.set({
        ownerId: SYSTEM_OWNER,
        name: list.name,
        description: list.desc,
        isPublic: true,
        featured: true,
        itemCount: list.items.length,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });

      // Replace items: delete old, create new
      const oldItems = await db.collection('listItems')
        .where('listId', '==', list.key).get();
      const batch = db.batch();
      oldItems.docs.forEach((d) => batch.delete(d.ref));
      for (const bizId of list.items) {
        batch.set(db.doc(`listItems/${list.key}__${bizId}`), {
          listId: list.key,
          businessId: bizId,
          createdAt: FieldValue.serverTimestamp(),
        });
      }
      await batch.commit();
    }

    logger.info(`Featured lists regenerated: ${lists.map((l) => `${l.key}(${l.items.length})`).join(', ')}`);
  },
);
```

**IDs fijos** (`featured_top_rated`, etc.) para que el upsert funcione sin duplicar.

---

## S4: Frontend — Fetch featured lists

Nueva función en `src/services/sharedLists.ts`:

```typescript
export async function fetchFeaturedLists(): Promise<SharedList[]> {
  const snap = await getDocs(
    query(
      getSharedListsCollection(),
      where('featured', '==', true),
      orderBy('updatedAt', 'desc'),
    ),
  );
  return snap.docs.map((d) => d.data());
}
```

---

## S5: UI — Sección "Destacadas"

En `SharedListsView.tsx`, antes de "Mis Listas":

```typescript
const [featuredLists, setFeaturedLists] = useState<SharedList[]>([]);

useEffect(() => {
  fetchFeaturedLists().then(setFeaturedLists).catch(() => {});
}, []);
```

Render:

```typescript
{featuredLists.length > 0 && (
  <Box sx={{ mb: 2 }}>
    <Typography variant="overline" sx={{ px: 2 }}>Destacadas</Typography>
    <Box sx={{ display: 'flex', gap: 1.5, px: 2, overflowX: 'auto', pb: 1 }}>
      {featuredLists.map((list) => (
        <Card key={list.id} variant="outlined" sx={{ minWidth: 180, flexShrink: 0 }}
          onClick={() => handleOpenFeatured(list.id)}>
          <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
            <Chip label="Destacada" size="small" color="primary" sx={{ mb: 0.5 }} />
            <Typography variant="subtitle2">{list.name}</Typography>
            <Typography variant="caption" color="text.secondary">
              {list.itemCount} comercios
            </Typography>
          </CardContent>
        </Card>
      ))}
    </Box>
  </Box>
)}
```

`handleOpenFeatured` setea `sharedListId` para mostrar la vista de shared list (reusa la vista existente).

---

## S6: Admin UI — Toggle featured

En el admin panel (nuevo sub-tab o sección en overview), mostrar listas públicas con toggle:

```typescript
// Fetch all public lists
const publicLists = await getDocs(
  query(collection(db, 'sharedLists'), where('isPublic', '==', true)),
);
```

Switch toggle que llama a `toggleFeaturedList` callable.

---

## Archivos a crear

| Archivo | Tamaño estimado |
|---------|----------------|
| `functions/src/admin/featuredLists.ts` | ~30 líneas |
| `functions/src/scheduled/featuredLists.ts` | ~70 líneas |

## Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `src/types/index.ts` | Agregar `featured?: boolean` a `SharedList` |
| `src/config/converters.ts` | `featured` en converter |
| `firestore.rules` | Read para featured lists, create keys |
| `src/services/sharedLists.ts` | `fetchFeaturedLists()` |
| `src/components/menu/SharedListsView.tsx` | Sección Destacadas con cards horizontales |
| `functions/src/index.ts` | Registrar callable + scheduled |

## Tests

| Archivo test | Qué cubre |
|-------------|-----------|
| `functions/src/__tests__/admin/featuredLists.test.ts` | `toggleFeaturedList`: admin guard, lista privada rechazada, toggle OK |
| `functions/src/__tests__/scheduled/featuredLists.test.ts` | Generación: aggregates parsing, top 10 sort, batch write, mínimo 3 ratings |
| `src/services/sharedLists.test.ts` | `fetchFeaturedLists`: query correcta |

---

## Dependencias nuevas

Ninguna. `Card`, `CardContent` de MUI ya están en el proyecto.

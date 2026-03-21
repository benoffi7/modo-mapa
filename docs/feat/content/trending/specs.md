# Specs: Trending — comercios populares esta semana

**Feature:** trending
**PRD:** [prd.md](prd.md)
**Fecha:** 2026-03-20

---

## S1: Tab Trending en Sugeridos

### Implementacion en SuggestionsView

`SuggestionsView` actualmente muestra solo la lista de sugerencias personalizadas. Se agrega un tab switcher para alternar entre "Para vos" y "Tendencia".

En `src/components/menu/SuggestionsView.tsx`, agregar tabs en la parte superior:

```typescript
import { useState } from 'react';
import { Tabs, Tab } from '@mui/material';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import LightbulbOutlinedIcon from '@mui/icons-material/LightbulbOutlined';
import TrendingList from './TrendingList';

// Dentro del componente, antes del return:
const [tab, setTab] = useState<'suggestions' | 'trending'>('suggestions');

// En el return, antes del contenido actual:
<Tabs value={tab} onChange={(_, v) => setTab(v)} variant="fullWidth" sx={{ mb: 1 }}>
  <Tab value="suggestions" label="Para vos" icon={<LightbulbOutlinedIcon />} iconPosition="start" />
  <Tab value="trending" label="Tendencia" icon={<TrendingUpIcon />} iconPosition="start" />
</Tabs>

{tab === 'trending' ? (
  <TrendingList onNavigate={onNavigate} />
) : (
  // ... contenido actual de sugerencias
)}
```

### Constantes trending

Nuevo archivo `src/constants/trending.ts`:

```typescript
export const TRENDING_WINDOW_DAYS = 7;
export const TRENDING_MAX_BUSINESSES = 10;

/** Pesos para scoring de trending */
export const TRENDING_SCORING = {
  ratings: 2,
  comments: 3,
  userTags: 1,
  priceLevels: 2,
  listItems: 1,
} as const;
```

### Componente TrendingList

Nuevo archivo `src/components/menu/TrendingList.tsx`:

```typescript
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';
import { useTrending } from '../../hooks/useTrending';
import TrendingBusinessCard from './TrendingBusinessCard';
import { logAnalyticsEvent } from '../../services/analytics';
import { useEffect } from 'react';

interface Props {
  onNavigate: () => void;
}

export default function TrendingList({ onNavigate }: Props) {
  const { data, loading, error } = useTrending();

  useEffect(() => {
    logAnalyticsEvent('trending_viewed');
  }, []);

  if (loading) return (
    <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
      <CircularProgress size={32} />
    </Box>
  );

  if (error) return (
    <Box sx={{ p: 2 }}>
      <Typography variant="body2" color="error">
        Error cargando tendencias.
      </Typography>
    </Box>
  );

  if (!data || data.businesses.length === 0) return (
    <Box sx={{ p: 3, textAlign: 'center' }}>
      <Typography variant="body2" color="text.secondary">
        No hay comercios en tendencia esta semana.
      </Typography>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, pb: 1.5 }}>
      {data.businesses.map((biz, i) => (
        <TrendingBusinessCard key={biz.businessId} business={biz} rank={i + 1} onNavigate={onNavigate} />
      ))}
      <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center', pt: 1 }}>
        Actualizado: {data.computedAt.toLocaleDateString('es-AR')}
      </Typography>
    </Box>
  );
}
```

### Componente TrendingBusinessCard

Nuevo archivo `src/components/menu/TrendingBusinessCard.tsx`. Muestra:

- Posicion (rank) con medalla para top 3.
- Nombre del comercio y categoria.
- Score total.
- Breakdown: iconos con "+N calificaciones", "+N comentarios", "+N tags", "+N precios", "+N listas".
- Click navega al comercio (`trending_business_clicked` event).

---

## S2: Cloud Function scheduled

### Data model

Nuevo tipo en `src/types/index.ts`:

```typescript
export interface TrendingBusinessBreakdown {
  ratings: number;
  comments: number;
  userTags: number;
  priceLevels: number;
  listItems: number;
}

export interface TrendingBusiness {
  businessId: string;
  name: string;
  category: string;
  score: number;
  breakdown: TrendingBusinessBreakdown;
  rank: number;
}

export interface TrendingData {
  businesses: TrendingBusiness[];
  computedAt: Date;
  periodStart: Date;
  periodEnd: Date;
}
```

### Documento Firestore

Coleccion: `trendingBusinesses`, documento: `current`.

Estructura en Firestore:

```json
{
  "businesses": [
    {
      "businessId": "abc123",
      "name": "Cafe del Sur",
      "category": "cafe",
      "score": 47,
      "breakdown": { "ratings": 8, "comments": 5, "userTags": 3, "priceLevels": 2, "listItems": 4 },
      "rank": 1
    }
  ],
  "computedAt": "Timestamp",
  "periodStart": "Timestamp",
  "periodEnd": "Timestamp"
}
```

### Firestore rules

En `firestore.rules`:

```text
match /trendingBusinesses/{docId} {
  allow read: if request.auth != null;
  allow write: if false; // Solo admin SDK desde Cloud Function
}
```

### Cloud Function

Nuevo archivo `functions/src/scheduled/trending.ts`:

```typescript
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { Timestamp } from 'firebase-admin/firestore';
import { getDb } from '../helpers/env';

const TRENDING_SCORING = { ratings: 2, comments: 3, userTags: 1, priceLevels: 2, listItems: 1 } as const;
const MAX_BUSINESSES = 10;
const WINDOW_DAYS = 7;

interface BusinessAccumulator {
  ratings: number;
  comments: number;
  userTags: number;
  priceLevels: number;
  listItems: number;
}

async function countByBusiness(
  db: FirebaseFirestore.Firestore,
  collectionName: string,
  since: Date,
): Promise<Map<string, number>> {
  const snap = await db
    .collection(collectionName)
    .where('createdAt', '>=', Timestamp.fromDate(since))
    .select('businessId')
    .get();

  const counts = new Map<string, number>();
  for (const doc of snap.docs) {
    const bid = doc.data().businessId as string;
    if (bid) counts.set(bid, (counts.get(bid) ?? 0) + 1);
  }
  return counts;
}

async function getBusinessNames(
  db: FirebaseFirestore.Firestore,
  businessIds: string[],
): Promise<Map<string, { name: string; category: string }>> {
  const result = new Map<string, { name: string; category: string }>();
  for (let i = 0; i < businessIds.length; i += 30) {
    const chunk = businessIds.slice(i, i + 30);
    const snap = await db
      .collection('businesses')
      .where('__name__', 'in', chunk)
      .select('name', 'category')
      .get();
    for (const doc of snap.docs) {
      const d = doc.data();
      result.set(doc.id, {
        name: (d.name as string) || 'Sin nombre',
        category: (d.category as string) || '',
      });
    }
  }
  return result;
}

export const computeTrendingBusinesses = onSchedule(
  {
    schedule: '0 3 * * *',
    timeZone: 'America/Argentina/Buenos_Aires',
  },
  async () => {
    const db = getDb();
    const now = new Date();
    const since = new Date(now);
    since.setDate(since.getDate() - WINDOW_DAYS);

    const [ratings, comments, userTags, priceLevels, listItems] = await Promise.all([
      countByBusiness(db, 'ratings', since),
      countByBusiness(db, 'comments', since),
      countByBusiness(db, 'userTags', since),
      countByBusiness(db, 'priceLevels', since),
      countByBusiness(db, 'listItems', since),
    ]);

    const allBusinessIds = new Set<string>();
    [ratings, comments, userTags, priceLevels, listItems].forEach((m) => {
      for (const bid of m.keys()) allBusinessIds.add(bid);
    });

    const scored: Array<{ businessId: string; score: number; breakdown: BusinessAccumulator }> = [];
    for (const businessId of allBusinessIds) {
      const breakdown: BusinessAccumulator = {
        ratings: ratings.get(businessId) ?? 0,
        comments: comments.get(businessId) ?? 0,
        userTags: userTags.get(businessId) ?? 0,
        priceLevels: priceLevels.get(businessId) ?? 0,
        listItems: listItems.get(businessId) ?? 0,
      };
      const score =
        breakdown.ratings * TRENDING_SCORING.ratings +
        breakdown.comments * TRENDING_SCORING.comments +
        breakdown.userTags * TRENDING_SCORING.userTags +
        breakdown.priceLevels * TRENDING_SCORING.priceLevels +
        breakdown.listItems * TRENDING_SCORING.listItems;

      if (score > 0) scored.push({ businessId, score, breakdown });
    }

    scored.sort((a, b) => b.score - a.score);
    const top = scored.slice(0, MAX_BUSINESSES);

    const nameMap = await getBusinessNames(
      db,
      top.map((s) => s.businessId),
    );

    const businesses = top.map((s, i) => {
      const info = nameMap.get(s.businessId) ?? { name: 'Sin nombre', category: '' };
      return {
        businessId: s.businessId,
        name: info.name,
        category: info.category,
        score: s.score,
        breakdown: s.breakdown,
        rank: i + 1,
      };
    });

    await db.doc('trendingBusinesses/current').set({
      businesses,
      computedAt: Timestamp.fromDate(now),
      periodStart: Timestamp.fromDate(since),
      periodEnd: Timestamp.fromDate(now),
    });
  },
);
```

### Exportar la funcion

En `functions/src/index.ts`, agregar:

```typescript
export { computeTrendingBusinesses } from './scheduled/trending';
```

---

## S2: Frontend — Service + Hook

### Servicio

Nuevo archivo `src/services/trending.ts`:

```typescript
import { doc, getDoc, Timestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import type { TrendingData, TrendingBusiness } from '../types';

export async function fetchTrending(): Promise<TrendingData | null> {
  const snap = await getDoc(doc(db, 'trendingBusinesses', 'current'));
  if (!snap.exists()) return null;

  const raw = snap.data();
  return {
    businesses: (raw.businesses ?? []) as TrendingBusiness[],
    computedAt: (raw.computedAt as Timestamp).toDate(),
    periodStart: (raw.periodStart as Timestamp).toDate(),
    periodEnd: (raw.periodEnd as Timestamp).toDate(),
  };
}
```

### Hook

Nuevo archivo `src/hooks/useTrending.ts`:

```typescript
import { useCallback } from 'react';
import { useAsyncData } from './useAsyncData';
import { fetchTrending } from '../services/trending';
import type { TrendingData } from '../types';

export function useTrending() {
  const fetcher = useCallback(() => fetchTrending(), []);
  const { data, loading, error, refetch } = useAsyncData<TrendingData | null>(fetcher);
  return { data, loading, error, refetch };
}
```

### Coleccion en config

En `src/config/collections.ts`, agregar:

```typescript
TRENDING_BUSINESSES: 'trendingBusinesses',
```

---

## S3: Badge en BusinessSheet

### Logica

Crear un contexto `TrendingContext` que expone `isTrending(businessId): boolean` y se alimenta del mismo `useTrending`.

### Chip visual

```typescript
{isTrending && (
  <Chip
    label="Tendencia"
    size="small"
    color="secondary"
    icon={<TrendingUpIcon />}
    sx={{ ml: 1 }}
  />
)}
```

---

## Analytics

Eventos a registrar:

| Evento | Cuando | Params |
|--------|--------|--------|
| `trending_viewed` | Al montar TrendingList | ninguno |
| `trending_business_clicked` | Al hacer click en un TrendingBusinessCard | `businessId`, `rank` |

---

## Tests

### Cloud Function test

Archivo: `functions/src/__tests__/trending.test.ts`

- Mock de Firestore con datos de ratings, comments, userTags, priceLevels, listItems.
- Verificar que el scoring es correcto (ratings*2 + comments*3 + userTags*1 + priceLevels*2 + listItems*1).
- Verificar ordenamiento descendente por score.
- Verificar limite de 10 businesses.
- Verificar que escribe a `trendingBusinesses/current` con estructura correcta.
- Verificar que solo considera documentos con `createdAt >= 7 dias atras`.

### Service test

Archivo: `src/__tests__/services/trending.test.ts`

- Mock de `getDoc` retornando documento con Timestamps.
- Verificar conversion de Timestamps a Dates.
- Verificar retorno `null` cuando no existe el documento.

### Hook test

Archivo: `src/__tests__/hooks/useTrending.test.ts`

- Mock de `fetchTrending`.
- Verificar estados: loading -> data, loading -> error.

### Componente test

Archivo: `src/__tests__/components/TrendingList.test.ts`

- Mock de `useTrending` con datos.
- Verificar rendering de cards con nombres y scores.
- Verificar empty state cuando no hay datos.
- Verificar evento analytics `trending_viewed`.

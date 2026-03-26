# Specs — Fase 2: Fotos de menú + Historial de visitas + Nivel de gasto

---

## 1. Tipos nuevos (`src/types/index.ts`)

```typescript
export type MenuPhotoStatus = 'pending' | 'approved' | 'rejected';

export interface MenuPhoto {
  id: string;
  userId: string;
  businessId: string;
  storagePath: string;
  thumbnailPath: string;
  status: MenuPhotoStatus;
  rejectionReason?: string;
  reviewedBy?: string;
  reviewedAt?: Date;
  createdAt: Date;
  reportCount: number;
}

export interface PriceLevel {
  userId: string;
  businessId: string;
  level: number;          // 1, 2, o 3
  createdAt: Date;
  updatedAt: Date;
}

export const PRICE_LEVEL_LABELS: Record<number, string> = {
  1: 'Económico',
  2: 'Moderado',
  3: 'Caro',
};
```

### Tipo para visit history (no Firestore, localStorage)

```typescript
// En src/hooks/useVisitHistory.ts (no en types/index.ts)
interface VisitEntry {
  businessId: string;
  lastVisited: string;  // ISO date string
  visitCount: number;
}
```

---

## 2. Colecciones nuevas (`src/config/collections.ts`)

```typescript
export const COLLECTIONS = {
  // ... existentes
  MENU_PHOTOS: 'menuPhotos',
  PRICE_LEVELS: 'priceLevels',
} as const;
```

---

## 3. Converters nuevos (`src/config/converters.ts`)

### menuPhotoConverter

```typescript
export const menuPhotoConverter: FirestoreDataConverter<MenuPhoto> = {
  toFirestore(photo: MenuPhoto) {
    return {
      userId: photo.userId,
      businessId: photo.businessId,
      storagePath: photo.storagePath,
      thumbnailPath: photo.thumbnailPath,
      status: photo.status,
      createdAt: photo.createdAt,
      reportCount: photo.reportCount,
    };
  },
  fromFirestore(snapshot: QueryDocumentSnapshot, options?: SnapshotOptions): MenuPhoto {
    const d = snapshot.data(options);
    return {
      id: snapshot.id,
      userId: d.userId,
      businessId: d.businessId,
      storagePath: d.storagePath ?? '',
      thumbnailPath: d.thumbnailPath ?? '',
      status: d.status ?? 'pending',
      rejectionReason: d.rejectionReason,
      reviewedBy: d.reviewedBy,
      reviewedAt: d.reviewedAt ? toDate(d.reviewedAt) : undefined,
      createdAt: toDate(d.createdAt),
      reportCount: (d.reportCount as number) ?? 0,
    };
  },
};
```

### priceLevelConverter

```typescript
export const priceLevelConverter: FirestoreDataConverter<PriceLevel> = {
  toFirestore(pl: PriceLevel) {
    return {
      userId: pl.userId,
      businessId: pl.businessId,
      level: pl.level,
      createdAt: pl.createdAt,
      updatedAt: pl.updatedAt,
    };
  },
  fromFirestore(snapshot: QueryDocumentSnapshot, options?: SnapshotOptions): PriceLevel {
    const d = snapshot.data(options);
    return {
      userId: d.userId,
      businessId: d.businessId,
      level: d.level,
      createdAt: toDate(d.createdAt),
      updatedAt: toDate(d.updatedAt),
    };
  },
};
```

---

## 4. Service layer

### `src/services/menuPhotos.ts` (nuevo)

```typescript
import { collection, doc, setDoc, getDocs, query, where, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../config/firebase';
import { COLLECTIONS } from '../config/collections';
import { menuPhotoConverter } from '../config/converters';
import { invalidateBusinessCache } from '../hooks/useBusinessDataCache';
import type { CollectionReference, UploadTask } from 'firebase/firestore';
import type { MenuPhoto } from '../types';

export function getMenuPhotosCollection(): CollectionReference<MenuPhoto> {
  return collection(db, COLLECTIONS.MENU_PHOTOS)
    .withConverter(menuPhotoConverter) as CollectionReference<MenuPhoto>;
}

/**
 * Upload a menu photo. Returns the upload task for progress tracking.
 * After upload completes, creates a Firestore doc with status 'pending'.
 */
export async function uploadMenuPhoto(
  userId: string,
  businessId: string,
  file: File,
): Promise<{ uploadTask: UploadTask; docId: string }> {
  // Validate
  const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error('Formato no soportado. Usa JPG, PNG o WebP.');
  }
  if (file.size > 5 * 1024 * 1024) {
    throw new Error('La imagen es muy grande. Máximo 5 MB.');
  }

  // Check pending count for this user
  const pendingSnap = await getDocs(query(
    collection(db, COLLECTIONS.MENU_PHOTOS),
    where('userId', '==', userId),
    where('status', '==', 'pending'),
  ));
  if (pendingSnap.size >= 3) {
    throw new Error('Ya tenés 3 fotos pendientes de revisión. Esperá a que se revisen.');
  }

  // Create Firestore doc first to get ID
  const docRef = doc(collection(db, COLLECTIONS.MENU_PHOTOS));
  const storagePath = `menus/${businessId}/${docRef.id}_original`;

  // Upload to Storage
  const storageRef = ref(storage, storagePath);
  const uploadTask = uploadBytesResumable(storageRef, file);

  // After upload completes, create Firestore doc
  return new Promise((resolve, reject) => {
    uploadTask.on('state_changed', null,
      (error) => reject(error),
      async () => {
        try {
          await setDoc(docRef, {
            userId,
            businessId,
            storagePath,
            thumbnailPath: '', // Will be set by Cloud Function
            status: 'pending',
            createdAt: serverTimestamp(),
            reportCount: 0,
          });
          invalidateBusinessCache(businessId);
          resolve({ uploadTask, docId: docRef.id });
        } catch (err) {
          reject(err);
        }
      },
    );
  });
}

/**
 * Get the approved menu photo for a business (if any).
 */
export async function getApprovedMenuPhoto(businessId: string): Promise<MenuPhoto | null> {
  const snap = await getDocs(query(
    collection(db, COLLECTIONS.MENU_PHOTOS).withConverter(menuPhotoConverter),
    where('businessId', '==', businessId),
    where('status', '==', 'approved'),
  ));
  if (snap.empty) return null;
  return snap.docs[0].data();
}

/**
 * Get user's pending photos for a business.
 */
export async function getUserPendingPhotos(
  userId: string,
  businessId: string,
): Promise<MenuPhoto[]> {
  const snap = await getDocs(query(
    collection(db, COLLECTIONS.MENU_PHOTOS).withConverter(menuPhotoConverter),
    where('userId', '==', userId),
    where('businessId', '==', businessId),
    where('status', '==', 'pending'),
  ));
  return snap.docs.map((d) => d.data());
}
```

### `src/services/priceLevels.ts` (nuevo)

```typescript
import { collection, doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import type { CollectionReference } from 'firebase/firestore';
import { db } from '../config/firebase';
import { COLLECTIONS } from '../config/collections';
import { priceLevelConverter } from '../config/converters';
import { invalidateQueryCache } from '../hooks/usePaginatedQuery';
import type { PriceLevel } from '../types';

export function getPriceLevelsCollection(): CollectionReference<PriceLevel> {
  return collection(db, COLLECTIONS.PRICE_LEVELS)
    .withConverter(priceLevelConverter) as CollectionReference<PriceLevel>;
}

export async function upsertPriceLevel(
  userId: string,
  businessId: string,
  level: number,
): Promise<void> {
  if (!Number.isInteger(level) || level < 1 || level > 3) {
    throw new Error('Level must be 1, 2, or 3');
  }

  const docId = `${userId}__${businessId}`;
  const plRef = doc(db, COLLECTIONS.PRICE_LEVELS, docId);
  const existing = await getDoc(plRef);

  if (existing.exists()) {
    await updateDoc(plRef, {
      level,
      updatedAt: serverTimestamp(),
    });
  } else {
    await setDoc(plRef, {
      userId,
      businessId,
      level,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  invalidateQueryCache(COLLECTIONS.PRICE_LEVELS, userId);
}
```

### `src/services/index.ts` — agregar exports

```typescript
export { uploadMenuPhoto, getApprovedMenuPhoto, getUserPendingPhotos } from './menuPhotos';
export { upsertPriceLevel } from './priceLevels';
```

---

## 5. Firebase config changes

### `src/config/firebase.ts` — agregar Storage

```typescript
import { getStorage, connectStorageEmulator } from 'firebase/storage';

// After app init:
export const storage = getStorage(app);

// In DEV block:
if (import.meta.env.DEV) {
  // ... existing emulators
  connectStorageEmulator(storage, 'localhost', 9199);
}
```

### `firebase.json` — agregar Storage emulator

```json
{
  "emulators": {
    // ... existing
    "storage": {
      "port": 9199
    }
  }
}
```

### `storage.rules` (nuevo)

```rules
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /menus/{businessId}/{fileName} {
      // Anyone authenticated can upload (rate limited in Firestore rules)
      allow create: if request.auth != null
        && request.resource.size < 5 * 1024 * 1024
        && request.resource.contentType.matches('image/(jpeg|png|webp)');

      // Anyone can read (approved photos are public)
      allow read: if request.auth != null;

      // Only Cloud Functions can delete (admin SDK bypasses rules)
      allow delete: if false;
    }
  }
}
```

---

## 6. Firestore Rules (`firestore.rules`)

### menuPhotos

```rules
match /menuPhotos/{docId} {
  allow read: if request.auth != null;
  allow create: if request.auth != null
    && request.resource.data.userId == request.auth.uid
    && isValidBusinessId(request.resource.data.businessId)
    && request.resource.data.status == 'pending'
    && request.resource.data.createdAt == request.time
    && request.resource.data.reportCount == 0;
  // Only admin can update (approve/reject) — via callable Cloud Functions with admin SDK
  allow update: if false;
  allow delete: if false;
}
```

### priceLevels

```rules
match /priceLevels/{docId} {
  allow read: if request.auth != null;
  allow create: if request.auth != null
    && request.resource.data.userId == request.auth.uid
    && isValidBusinessId(request.resource.data.businessId)
    && request.resource.data.level is int
    && request.resource.data.level >= 1
    && request.resource.data.level <= 3
    && request.resource.data.createdAt == request.time
    && request.resource.data.updatedAt == request.time;
  allow update: if request.auth != null
    && request.resource.data.userId == request.auth.uid
    && request.resource.data.level is int
    && request.resource.data.level >= 1
    && request.resource.data.level <= 3
    && request.resource.data.updatedAt == request.time;
}
```

---

## 7. Cloud Functions

### `functions/src/triggers/menuPhotos.ts` (nuevo)

```typescript
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { getStorage } from 'firebase-admin/storage';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import * as sharp from 'sharp';
import { incrementCounter, trackWrite } from '../utils/counters';

// Generate thumbnail on photo creation
export const onMenuPhotoCreated = onDocumentCreated(
  'menuPhotos/{photoId}',
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    const data = snap.data();
    const photoId = event.params.photoId;

    // Generate thumbnail
    const bucket = getStorage().bucket();
    const originalFile = bucket.file(data.storagePath);
    const [buffer] = await originalFile.download();

    const thumbBuffer = await sharp(buffer)
      .resize(400)
      .jpeg({ quality: 80 })
      .toBuffer();

    const thumbPath = `menus/${data.businessId}/${photoId}_thumb.jpg`;
    const thumbFile = bucket.file(thumbPath);
    await thumbFile.save(thumbBuffer, {
      metadata: { contentType: 'image/jpeg' },
    });

    // Update doc with thumbnail path
    await snap.ref.update({ thumbnailPath: thumbPath });

    // Counters
    await incrementCounter('menuPhotos');
    await trackWrite('menuPhotos');
  },
);
```

### `functions/src/admin/menuPhotos.ts` (nuevo)

```typescript
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

// Approve a menu photo
export const approveMenuPhoto = onCall(
  { enforceAppCheck: true, timeoutSeconds: 60 },
  async (request) => {
    // Verify admin
    const { auth } = request;
    if (!auth?.token.email_verified || auth.token.email !== process.env.ADMIN_EMAIL) {
      throw new HttpsError('permission-denied', 'Admin only');
    }

    const { photoId } = request.data;
    if (!photoId || typeof photoId !== 'string') {
      throw new HttpsError('invalid-argument', 'photoId required');
    }

    const db = getFirestore();
    const photoRef = db.collection('menuPhotos').doc(photoId);
    const photoSnap = await photoRef.get();
    if (!photoSnap.exists) {
      throw new HttpsError('not-found', 'Photo not found');
    }

    const data = photoSnap.data()!;
    if (data.status !== 'pending') {
      throw new HttpsError('failed-precondition', 'Photo is not pending');
    }

    // Mark any existing approved photo for this business as replaced
    const existingApproved = await db.collection('menuPhotos')
      .where('businessId', '==', data.businessId)
      .where('status', '==', 'approved')
      .get();

    const batch = db.batch();
    for (const doc of existingApproved.docs) {
      batch.update(doc.ref, { status: 'replaced' });
    }

    // Approve the new photo
    batch.update(photoRef, {
      status: 'approved',
      reviewedBy: auth.uid,
      reviewedAt: FieldValue.serverTimestamp(),
    });

    await batch.commit();
    return { success: true };
  },
);

// Reject a menu photo
export const rejectMenuPhoto = onCall(
  { enforceAppCheck: true, timeoutSeconds: 60 },
  async (request) => {
    const { auth } = request;
    if (!auth?.token.email_verified || auth.token.email !== process.env.ADMIN_EMAIL) {
      throw new HttpsError('permission-denied', 'Admin only');
    }

    const { photoId, reason } = request.data;
    if (!photoId || typeof photoId !== 'string') {
      throw new HttpsError('invalid-argument', 'photoId required');
    }

    const db = getFirestore();
    const photoRef = db.collection('menuPhotos').doc(photoId);
    const photoSnap = await photoRef.get();
    if (!photoSnap.exists) {
      throw new HttpsError('not-found', 'Photo not found');
    }

    await photoRef.update({
      status: 'rejected',
      rejectionReason: reason || '',
      reviewedBy: auth.uid,
      reviewedAt: FieldValue.serverTimestamp(),
    });

    return { success: true };
  },
);
```

### `functions/src/scheduled/cleanupPhotos.ts` (nuevo)

```typescript
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

// Run daily at 4AM — cleanup rejected photos older than 7 days
export const cleanupRejectedPhotos = onSchedule(
  { schedule: '0 4 * * *', timeZone: 'America/Argentina/Buenos_Aires' },
  async () => {
    const db = getFirestore();
    const bucket = getStorage().bucket();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const rejected = await db.collection('menuPhotos')
      .where('status', '==', 'rejected')
      .where('reviewedAt', '<', sevenDaysAgo)
      .get();

    for (const doc of rejected.docs) {
      const data = doc.data();
      // Delete files from storage
      try {
        await bucket.file(data.storagePath).delete();
        if (data.thumbnailPath) {
          await bucket.file(data.thumbnailPath).delete();
        }
      } catch { /* file may not exist */ }
      // Delete Firestore doc
      await doc.ref.delete();
    }

    console.log(`Cleaned up ${rejected.size} rejected photos`);
  },
);
```

### `functions/src/triggers/priceLevels.ts` (nuevo)

```typescript
import { onDocumentCreated, onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { incrementCounter, trackWrite } from '../utils/counters';

export const onPriceLevelCreated = onDocumentCreated(
  'priceLevels/{docId}',
  async () => {
    await incrementCounter('priceLevels');
    await trackWrite('priceLevels');
  },
);

export const onPriceLevelUpdated = onDocumentUpdated(
  'priceLevels/{docId}',
  async () => {
    await trackWrite('priceLevels');
  },
);
```

### `functions/src/index.ts` — agregar exports

```typescript
export { onMenuPhotoCreated } from './triggers/menuPhotos';
export { approveMenuPhoto, rejectMenuPhoto } from './admin/menuPhotos';
export { cleanupRejectedPhotos } from './scheduled/cleanupPhotos';
export { onPriceLevelCreated, onPriceLevelUpdated } from './triggers/priceLevels';
```

---

## 8. Hooks

### `src/hooks/useVisitHistory.ts` (nuevo)

```typescript
import { useState, useCallback, useEffect } from 'react';
import { allBusinesses } from './useBusinesses';
import type { Business } from '../types';

interface VisitEntry {
  businessId: string;
  lastVisited: string;
  visitCount: number;
}

const STORAGE_KEY = 'modo-mapa-visits';
const MAX_ENTRIES = 50;

function readVisits(): VisitEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeVisits(visits: VisitEntry[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(visits));
}

export interface VisitWithBusiness extends VisitEntry {
  business: Business | null;
}

export function useVisitHistory() {
  const [visits, setVisits] = useState<VisitEntry[]>(readVisits);

  const recordVisit = useCallback((businessId: string) => {
    setVisits((prev) => {
      const now = new Date().toISOString();
      const existing = prev.find((v) => v.businessId === businessId);
      let updated: VisitEntry[];

      if (existing) {
        updated = [
          { ...existing, lastVisited: now, visitCount: existing.visitCount + 1 },
          ...prev.filter((v) => v.businessId !== businessId),
        ];
      } else {
        updated = [
          { businessId, lastVisited: now, visitCount: 1 },
          ...prev,
        ].slice(0, MAX_ENTRIES);
      }

      writeVisits(updated);
      return updated;
    });
  }, []);

  const clearHistory = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setVisits([]);
  }, []);

  const visitsWithBusiness: VisitWithBusiness[] = visits.map((v) => ({
    ...v,
    business: allBusinesses.find((b) => b.id === v.businessId) || null,
  }));

  return { visits: visitsWithBusiness, recordVisit, clearHistory };
}
```

### `src/hooks/useBusinessData.ts` — cambios

Agregar `priceLevels` y `menuPhoto` al data flow:

```typescript
// Nuevo en UseBusinessDataReturn:
priceLevels: PriceLevel[];
menuPhoto: MenuPhoto | null;

// Nuevo en CollectionName:
type CollectionName = 'favorites' | 'ratings' | 'comments' | 'userTags' | 'customTags' | 'priceLevels' | 'menuPhoto';

// En fetchBusinessData: agregar 2 queries más al Promise.all:
// - priceLevels: getDocs(query(... where('businessId', '==', bId)))
// - menuPhoto: getDocs(query(... where('businessId', '==', bId), where('status', '==', 'approved')))

// En fetchSingleCollection: agregar cases para 'priceLevels' y 'menuPhoto'
```

### `src/hooks/useBusinessDataCache.ts` — cambios

```typescript
// Agregar a BusinessCacheEntry:
priceLevels: PriceLevel[];
menuPhoto: MenuPhoto | null;
```

---

## 9. Componentes — Business Sheet

### `src/components/business/MenuPhotoSection.tsx` (nuevo)

Sección en BusinessSheet que muestra:

- **Si hay foto aprobada**: Thumbnail clickeable + "Menú actualizado: 12 mar 2026" (usando `reviewedAt`). Si `reviewedAt` > 6 meses: chip sutil "Posiblemente desactualizado". Click abre `MenuPhotoViewer`.
- **Si no hay foto**: Botón "Subir foto del menú" (ícono cámara). Si el usuario ya tiene foto pendiente para ese comercio, mostrar "Tu foto está en revisión".
- **Props**: `menuPhoto: MenuPhoto | null`, `businessId: string`, `isLoading: boolean`, `onPhotoChange: () => void`

### `src/components/business/MenuPhotoUpload.tsx` (nuevo)

Dialog para subir foto:

- Input file (accept: image/jpeg, image/png, image/webp)
- Preview de la imagen seleccionada
- Compresión con `browser-image-compression` (maxSizeMB: 2, maxWidthOrHeight: 2048)
- Barra de progreso durante upload (usando `uploadTask.on('state_changed')`)
- Botones "Cancelar" / "Enviar"
- **Props**: `open: boolean`, `businessId: string`, `onClose: () => void`, `onSuccess: () => void`

### `src/components/business/MenuPhotoViewer.tsx` (nuevo)

Dialog fullscreen para ver la foto:

- Imagen a ancho completo
- Fecha de aprobación
- Botón cerrar
- **Props**: `open: boolean`, `photoUrl: string`, `reviewedAt: Date | undefined`, `onClose: () => void`

### `src/components/business/BusinessPriceLevel.tsx` (nuevo)

Sección "Nivel de gasto" similar a BusinessRating:

- Muestra promedio: "$" / "$$" / "$$$" con label "Económico" / "Moderado" / "Caro"
- Cantidad de votos: "(12 votos)"
- Si no hay votos: "Sin votos aún"
- Si el usuario está logueado: 3 botones "$", "$$", "$$$" clickeables (toggle)
- El voto del usuario se resalta (filled vs outlined)
- Optimistic UI: muestra el nuevo voto inmediatamente (pendingLevel state)
- **Props**: `businessId: string`, `priceLevels: PriceLevel[]`, `isLoading: boolean`, `onPriceLevelChange: () => void`

### `src/components/business/BusinessSheet.tsx` — cambios

```tsx
// Agregar entre BusinessRating y BusinessTags:
<Divider sx={{ my: 1.5 }} />
<BusinessPriceLevel
  businessId={selectedBusiness.id}
  priceLevels={data.priceLevels}
  isLoading={data.isLoading}
  onPriceLevelChange={() => data.refetch('priceLevels')}
/>

// Agregar entre BusinessTags y BusinessComments:
<Divider sx={{ my: 1.5 }} />
<MenuPhotoSection
  menuPhoto={data.menuPhoto}
  businessId={selectedBusiness.id}
  isLoading={data.isLoading}
  onPhotoChange={() => data.refetch('menuPhoto')}
/>
```

---

## 10. Componentes — Menu lateral

### `src/components/menu/RecentVisits.tsx` (nuevo)

Lista de comercios visitados recientemente:

- Usa `useVisitHistory()` para obtener datos
- Cada item muestra nombre, categoría, "Visitado hace X" (formateo relativo), y visitCount si > 1
- Click navega al comercio (`setSelectedBusiness` + `onNavigate`)
- Botón "Limpiar historial" al final
- Empty state: ícono de historial + "No visitaste comercios todavía"
- **Props**: `onNavigate: () => void`

### `src/components/layout/SideMenu.tsx` — cambios

```typescript
// Agregar Section:
type Section = 'nav' | 'favorites' | 'recent' | 'comments' | 'ratings' | 'feedback' | 'stats';

// Agregar título:
const SECTION_TITLES = { ..., recent: 'Recientes' };

// Agregar nav item (entre Favoritos y Comentarios):
import HistoryIcon from '@mui/icons-material/History';
import RecentVisits from '../menu/RecentVisits';

<ListItemButton onClick={() => setActiveSection('recent')}>
  <ListItemIcon>
    <HistoryIcon sx={{ color: '#ff9800' }} />
  </ListItemIcon>
  <ListItemText primary="Recientes" />
</ListItemButton>

// Agregar render:
{activeSection === 'recent' && <RecentVisits onNavigate={handleClose} />}
```

### `src/components/business/BusinessSheet.tsx` — visit tracking

```typescript
import { useVisitHistory } from '../../hooks/useVisitHistory';

// Inside component:
const { recordVisit } = useVisitHistory();

// In useEffect or when business opens:
useEffect(() => {
  if (selectedBusiness) {
    recordVisit(selectedBusiness.id);
  }
}, [selectedBusiness, recordVisit]);
```

---

## 11. Componentes — Admin

### `src/components/admin/PhotoReviewPanel.tsx` (nuevo)

Tab nueva en AdminLayout para revisar fotos pendientes:

- Usa `useAsyncData` + `AdminPanelWrapper` (patrón existente)
- Fetches all photos with `status == 'pending'` ordered by `createdAt`
- Grid de `PhotoReviewCard` components
- Empty state: "No hay fotos pendientes"

### `src/components/admin/PhotoReviewCard.tsx` (nuevo)

Card individual:

- Thumbnail de la foto (usando download URL de `thumbnailPath`)
- Nombre del comercio (usando `getBusinessName`)
- Nombre del usuario (usando `userId` → fetch displayName)
- Fecha de subida (createdAt formateada)
- Botón "Aprobar" (verde) → llama `approveMenuPhoto` callable
- Botón "Rechazar" (rojo) → abre input para motivo, luego llama `rejectMenuPhoto`
- Loading state durante aprobación/rechazo

### `src/components/admin/AdminLayout.tsx` — cambios

```tsx
// Agregar tab:
<Tab label="Fotos" />

// Agregar render (index 8):
{tab === 8 && <PhotoReviewPanel />}
```

### `src/services/admin.ts` — agregar

```typescript
export async function fetchPendingPhotos(): Promise<MenuPhoto[]> {
  const snap = await getDocs(query(
    collection(db, COLLECTIONS.MENU_PHOTOS).withConverter(menuPhotoConverter),
    where('status', '==', 'pending'),
    orderBy('createdAt', 'asc'),
  ));
  return snap.docs.map((d) => d.data());
}
```

---

## 12. Filtros — Nivel de gasto

### `src/context/MapContext.tsx` — cambios

```typescript
// Agregar al contexto:
activePriceFilter: number | null;  // null = sin filtro, 1/2/3 = nivel específico
setPriceFilter: (level: number | null) => void;
```

### `src/components/search/FilterChips.tsx` — cambios

Agregar 3 chips de nivel de gasto al final de la fila, después de los tags predefinidos:

```tsx
// Separador visual (Divider vertical o espaciado)
// Chip "$" / "$$" / "$$$" con toggle
{[1, 2, 3].map((level) => (
  <Chip
    key={`price-${level}`}
    label={'$'.repeat(level)}
    onClick={() => setPriceFilter(activePriceFilter === level ? null : level)}
    variant={activePriceFilter === level ? 'filled' : 'outlined'}
    color={activePriceFilter === level ? 'warning' : 'default'}
    // ... same sx as existing chips
  />
))}
```

### `src/hooks/useBusinesses.ts` — cambios

El filtro de precio NO se puede aplicar aquí directamente porque los datos de `priceLevels` están en Firestore, no en `businesses.json`. Dos opciones:

**Opción elegida: Filtro lazy con cache global.**

Cuando el usuario activa un filtro de precio, se necesita conocer el promedio de precio de cada comercio. Esto requeriría leer todos los `priceLevels` de Firestore — costoso.

**Alternativa práctica:** El filtro de precio funciona a nivel de mapa haciendo una query global de `priceLevels` agrupada por businessId. Se cachea en memoria y se recalcula cada 5 minutos.

```typescript
// Nuevo hook: src/hooks/usePriceLevelFilter.ts
// Fetches ALL priceLevels, groups by businessId, computes averages
// Returns Map<businessId, averageLevel>
// Se usa en useBusinesses para filtrar
```

Esto agrega ~1 query global de priceLevels (todos los docs). Con 40 comercios y ~10 usuarios, serían ~400 docs máximo — aceptable.

### `src/hooks/useListFilters.ts` — cambios

Agregar opción de filtro por nivel de gasto a `useListFilters`. Esto requiere que las listas (FavoritesList, RatingsList) pasen la info de precio del comercio.

Para el menú lateral, el filtro de precio es un `Select` adicional en `ListFilters.tsx`:

```typescript
// Agregar prop opcional:
priceFilter?: number | null;
onPriceFilterChange?: (level: number | null) => void;
```

---

## 13. Dependencias

### Frontend (`package.json`)

```bash
npm install browser-image-compression
```

### Functions (`functions/package.json`)

```bash
cd functions && npm install sharp
```

`sharp` requiere compilación nativa. En Cloud Functions v2 (Node 22) está disponible nativamente.

---

## 14. Seed script changes (`scripts/seed-admin-data.mjs`)

Agregar datos de prueba:

- ~15 menuPhotos (10 approved, 3 pending, 2 rejected) con storagePath/thumbnailPath simulados
- ~30 priceLevels (votos de precio aleatorios nivel 1-3)
- Actualizar counters con `menuPhotos` y `priceLevels`

---

## 15. Firestore indexes (`firestore.indexes.json`)

Agregar índices compuestos:

```json
{
  "collectionGroup": "menuPhotos",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "businessId", "order": "ASCENDING" },
    { "fieldPath": "status", "order": "ASCENDING" }
  ]
},
{
  "collectionGroup": "menuPhotos",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "status", "order": "ASCENDING" },
    { "fieldPath": "createdAt", "order": "ASCENDING" }
  ]
},
{
  "collectionGroup": "menuPhotos",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "userId", "order": "ASCENDING" },
    { "fieldPath": "status", "order": "ASCENDING" }
  ]
},
{
  "collectionGroup": "menuPhotos",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "status", "order": "ASCENDING" },
    { "fieldPath": "reviewedAt", "order": "ASCENDING" }
  ]
},
{
  "collectionGroup": "priceLevels",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "businessId", "order": "ASCENDING" }
  ]
}
```

---

## 16. Resumen de archivos

### Archivos nuevos

| Archivo | Descripción |
|---------|-------------|
| `src/services/menuPhotos.ts` | Service: upload, get approved/pending photos |
| `src/services/priceLevels.ts` | Service: upsert price level vote |
| `src/hooks/useVisitHistory.ts` | Hook: localStorage visit tracking |
| `src/hooks/usePriceLevelFilter.ts` | Hook: global price level cache for map filter |
| `src/components/business/MenuPhotoSection.tsx` | Sección menú foto en BusinessSheet |
| `src/components/business/MenuPhotoUpload.tsx` | Dialog upload con preview + progress |
| `src/components/business/MenuPhotoViewer.tsx` | Dialog fullscreen para ver foto |
| `src/components/business/BusinessPriceLevel.tsx` | Sección nivel de gasto |
| `src/components/menu/RecentVisits.tsx` | Lista de visitas recientes |
| `src/components/admin/PhotoReviewPanel.tsx` | Tab admin: revisar fotos |
| `src/components/admin/PhotoReviewCard.tsx` | Card review individual |
| `functions/src/triggers/menuPhotos.ts` | Trigger: thumbnail generation |
| `functions/src/triggers/priceLevels.ts` | Triggers: counters |
| `functions/src/admin/menuPhotos.ts` | Callables: approve/reject |
| `functions/src/scheduled/cleanupPhotos.ts` | Cron: cleanup rejected photos |
| `storage.rules` | Reglas de Cloud Storage |

### Archivos modificados

| Archivo | Cambios |
|---------|---------|
| `src/types/index.ts` | MenuPhoto, PriceLevel, PRICE_LEVEL_LABELS |
| `src/config/collections.ts` | MENU_PHOTOS, PRICE_LEVELS |
| `src/config/converters.ts` | menuPhotoConverter, priceLevelConverter |
| `src/config/firebase.ts` | Storage init + emulator |
| `src/services/index.ts` | Exports nuevos |
| `src/services/admin.ts` | fetchPendingPhotos |
| `src/hooks/useBusinessData.ts` | priceLevels + menuPhoto en data flow |
| `src/hooks/useBusinessDataCache.ts` | priceLevels + menuPhoto en cache |
| `src/hooks/useBusinesses.ts` | Filtro por precio |
| `src/hooks/useListFilters.ts` | Opción filtro precio |
| `src/context/MapContext.tsx` | activePriceFilter state |
| `src/components/business/BusinessSheet.tsx` | Render PriceLevel + MenuPhoto + visit tracking |
| `src/components/search/FilterChips.tsx` | Chips de precio |
| `src/components/layout/SideMenu.tsx` | Sección "Recientes" |
| `src/components/admin/AdminLayout.tsx` | Tab "Fotos" |
| `firestore.rules` | menuPhotos + priceLevels rules |
| `firestore.indexes.json` | Índices compuestos |
| `firebase.json` | Storage emulator |
| `functions/src/index.ts` | Exports nuevos |
| `scripts/seed-admin-data.mjs` | Datos de prueba |

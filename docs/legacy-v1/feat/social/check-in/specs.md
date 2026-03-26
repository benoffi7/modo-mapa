# Specs: Check-in — Fui acá

**Feature:** check-in
**Fecha:** 2026-03-20
**PRD:** [prd.md](prd.md)

---

## S1: Botón Check-in en BusinessSheet

### Data Model

Nuevo tipo `CheckIn` en `src/types/index.ts`:

```typescript
export interface CheckIn {
  id: string;
  userId: string;
  businessId: string;
  businessName: string;
  createdAt: Timestamp;
  location?: {
    lat: number;
    lng: number;
  };
}
```

Nueva colección Firestore: `checkins`.

### Constantes

Nuevo archivo `src/constants/checkin.ts`:

```typescript
/** Radio maximo en metros para validacion soft de proximidad */
export const CHECKIN_PROXIMITY_RADIUS_M = 500;

/** Horas minimas entre check-ins al mismo comercio */
export const CHECKIN_COOLDOWN_HOURS = 4;

/** Maximo de check-ins por dia por usuario */
export const MAX_CHECKINS_PER_DAY = 10;
```

### Converter

Nuevo converter `checkinConverter` en `src/config/converters.ts`, siguiendo el patron existente de otros converters del proyecto.

```typescript
export const checkinConverter: FirestoreDataConverter<CheckIn> = {
  toFirestore(checkin: CheckIn): DocumentData {
    return {
      userId: checkin.userId,
      businessId: checkin.businessId,
      businessName: checkin.businessName,
      createdAt: checkin.createdAt,
      ...(checkin.location && { location: checkin.location }),
    };
  },
  fromFirestore(snapshot: QueryDocumentSnapshot): CheckIn {
    const data = snapshot.data();
    return {
      id: snapshot.id,
      userId: data.userId,
      businessId: data.businessId,
      businessName: data.businessName,
      createdAt: data.createdAt,
      location: data.location ?? undefined,
    };
  },
};
```

### Firestore Rules

Colección `checkins/{docId}`:

```javascript
match /checkins/{docId} {
  // Solo lectura de documentos propios
  allow read: if request.auth != null
    && resource.data.userId == request.auth.uid;

  // Crear: autenticado, userId coincide, campos requeridos presentes
  allow create: if request.auth != null
    && request.resource.data.userId == request.auth.uid
    && request.resource.data.businessId is string
    && request.resource.data.businessName is string
    && request.resource.data.createdAt is timestamp;

  // No se permiten updates ni deletes (registro permanente)
  allow update, delete: if false;
}
```

Rate limit: max 10 check-ins por dia, usando `_rateLimits` collection (mismo patron que comments).

### Service

Nuevo archivo `src/services/checkins.ts`:

```typescript
/**
 * Crea un check-in para el comercio indicado.
 * Incluye la ubicacion del usuario si esta disponible.
 */
export async function createCheckIn(
  businessId: string,
  businessName: string,
  location?: { lat: number; lng: number }
): Promise<string>;

/**
 * Obtiene los check-ins del usuario, ordenados por fecha descendente.
 * Soporta paginacion via limit.
 */
export async function fetchMyCheckIns(
  userId: string,
  limit?: number
): Promise<CheckIn[]>;

/**
 * Obtiene los check-ins del usuario para un comercio especifico.
 * Usado para verificar cooldown (si hizo check-in en las ultimas 4h).
 */
export async function fetchCheckInsForBusiness(
  businessId: string,
  userId: string
): Promise<CheckIn[]>;
```

### Hook: useCheckIn

Nuevo archivo `src/hooks/useCheckIn.ts`:

```typescript
interface UseCheckInReturn {
  /** Si el usuario hizo check-in en las ultimas CHECKIN_COOLDOWN_HOURS */
  hasCheckedInRecently: boolean;

  /** Si el usuario esta lo suficientemente cerca (< 500m) o no hay ubicacion */
  isNearby: boolean;

  /** Si se puede hacer check-in (no en cooldown, no excede limite diario) */
  canCheckIn: boolean;

  /** Estado de la operacion */
  status: 'idle' | 'loading' | 'success' | 'error';

  /** Mensaje de error si hubo */
  error: string | null;

  /** Ejecuta el check-in */
  performCheckIn: () => Promise<void>;
}

/**
 * Hook que gestiona el estado de check-in para un comercio especifico.
 * Usa useUserLocation para validacion de proximidad.
 */
export function useCheckIn(
  businessId: string,
  businessName: string,
  businessLocation?: { lat: number; lng: number }
): UseCheckInReturn;
```

Logica interna:

1. Al montar, llama `fetchCheckInsForBusiness` para determinar `hasCheckedInRecently`.
2. Compara ubicacion del usuario (de `useUserLocation`) con `businessLocation` para calcular `isNearby`.
3. `canCheckIn` = `!hasCheckedInRecently` (el rate limit diario se valida en Firestore rules).
4. `performCheckIn` llama `createCheckIn`, actualiza estado, loguea analytics.

### UI: CheckInButton

Nuevo componente `src/components/business/CheckInButton.tsx`:

- Ubicacion: dentro de BusinessSheet, debajo de BusinessHeader.
- Boton con icono y texto "Fui aca".
- Estados visuales:
  - **Ready**: boton primario activo.
  - **Loading**: spinner, boton disabled.
  - **Success**: checkmark verde + "Visitado hace X min/h".
  - **Cooldown**: boton disabled, texto "Ya registraste visita".
  - **Proximity warning**: al hacer click estando lejos, muestra snackbar de advertencia pero permite continuar.
- Si no hay usuario autenticado, muestra prompt de login.

### Proximity Validation

Validacion soft (no bloquea):

1. Si `useUserLocation` no tiene ubicacion -> permitir sin advertencia.
2. Si distancia > `CHECKIN_PROXIMITY_RADIUS_M` -> mostrar snackbar "Parece que no estas cerca de este comercio" con opcion de continuar.
3. Si distancia <= `CHECKIN_PROXIMITY_RADIUS_M` -> permitir sin advertencia.

Calculo de distancia: usar formula Haversine (ya usada en el proyecto para sort by proximity).

### Cloud Function Trigger

Nuevo archivo `functions/src/triggers/checkins.ts`:

```typescript
/**
 * Trigger que se ejecuta al crear un check-in.
 * Incrementa contador en _rateLimits para rate limiting diario.
 */
export const onCheckInCreated = onDocumentCreated(
  'checkins/{docId}',
  async (event) => {
    // 1. Incrementar rate limit counter para el usuario
    // 2. Log para analytics server-side
  }
);
```

Patron: mismo que triggers existentes en `functions/src/triggers/`.

### Analytics Events

| Evento | Cuando | Params |
|--------|--------|--------|
| `checkin_created` | Check-in exitoso | `businessId`, `hasLocation`, `isNearby` |
| `checkin_proximity_warning` | Usuario lejos pero continua | `businessId`, `distance` |
| `checkin_cooldown_blocked` | Intento en cooldown | `businessId` |

---

## S2: Historial de visitas

### Hook: useMyCheckIns

Nuevo archivo `src/hooks/useMyCheckIns.ts`:

```typescript
interface UseMyCheckInsReturn {
  /** Lista de check-ins del usuario */
  checkIns: CheckIn[];

  /** Estadisticas calculadas */
  stats: {
    totalCheckIns: number;
    uniqueBusinesses: number;
  };

  /** Estado de carga */
  isLoading: boolean;

  /** Refrescar la lista */
  refresh: () => Promise<void>;
}

/**
 * Hook para obtener el historial de check-ins del usuario.
 * Calcula estadisticas de visitas.
 */
export function useMyCheckIns(): UseMyCheckInsReturn;
```

### UI: CheckInsView

Nuevo componente `src/components/menu/CheckInsView.tsx`:

- Ubicacion: nueva seccion "Mis visitas" en SideMenu.
- Header con stats: "X visitas a Y comercios".
- Lista cronologica de check-ins.
- Cada item muestra: nombre del comercio, fecha relativa ("hace 2 dias", "hoy").
- Click en item: cierra SideMenu y navega al comercio en el mapa (centra y abre BusinessSheet).
- Estado vacio: mensaje "Todavia no registraste visitas" con icono.
- Pull-to-refresh.
- Lazy-loaded (misma estrategia que otras secciones del SideMenu).

### SideMenu Integration

Agregar entrada "Mis visitas" en SideMenu, debajo de Recientes:

- Icono: pin/location check.
- Label: "Mis visitas".
- Counter badge con total de check-ins (si > 0).

---

## Tests

### Frontend Tests

| Archivo | Tipo | Coverage minimo |
|---------|------|----------------|
| `useCheckIn.test.ts` | Unit | 80% |
| `useMyCheckIns.test.ts` | Unit | 80% |
| `checkins.test.ts` (service) | Unit | 80% |
| `CheckInButton.test.tsx` | Component | 80% |
| `CheckInsView.test.tsx` | Component | 80% |

### Backend Tests

| Archivo | Tipo | Coverage minimo |
|---------|------|----------------|
| `checkins.rules.test.ts` | Integration | 80% |
| `checkins.triggers.test.ts` | Unit | 80% |

### Scenarios clave a cubrir

- Check-in exitoso con y sin ubicacion.
- Cooldown bloquea segundo check-in al mismo comercio.
- Rate limit diario bloquea en el check-in 11.
- Proximity warning se muestra cuando esta lejos.
- Historial se carga, se refresca, navega a comercio.
- Firestore rules bloquean: sin auth, userId distinto, update, delete.

# Specs — Panel de configuración de usuario

## Tipos

```typescript
// src/types/index.ts
export interface UserSettings {
  profilePublic: boolean;
  notificationsEnabled: boolean;
  notifyLikes: boolean;
  notifyPhotos: boolean;
  notifyRankings: boolean;
  updatedAt: Date;
}
```

## Firestore

### Colección `userSettings`

- Doc ID: `{userId}`
- Campos: ver `UserSettings` arriba
- Defaults si no existe: todo `true`

### Converter

```typescript
// src/config/converters.ts
export const userSettingsConverter: FirestoreDataConverter<UserSettings>
```

### Rules

```
match /userSettings/{userId} {
  allow read, write: if request.auth != null && request.auth.uid == userId
    && request.resource.data.profilePublic is bool
    && request.resource.data.notificationsEnabled is bool
    && request.resource.data.notifyLikes is bool
    && request.resource.data.notifyPhotos is bool
    && request.resource.data.notifyRankings is bool
    && request.resource.data.updatedAt == request.time;
}
```

## Service layer

### `src/services/userSettings.ts`

```typescript
const DEFAULTS: UserSettings = {
  profilePublic: false,
  notificationsEnabled: false,
  notifyLikes: false,
  notifyPhotos: false,
  notifyRankings: false,
  updatedAt: new Date(),
};

export async function fetchUserSettings(userId: string): Promise<UserSettings>
// Returns doc data or DEFAULTS if not exists

export async function updateUserSettings(
  userId: string,
  updates: Partial<Omit<UserSettings, 'updatedAt'>>
): Promise<void>
// setDoc with merge + serverTimestamp for updatedAt
```

## Hook

### `src/hooks/useUserSettings.ts`

```typescript
export function useUserSettings(): {
  settings: UserSettings;
  loading: boolean;
  updateSetting: (key: keyof Omit<UserSettings, 'updatedAt'>, value: boolean) => void;
}
```

- Usa `useAsyncData` para fetch inicial
- `updateSetting` aplica optimistic update + llama a `updateUserSettings`
- Solo funciona si hay usuario autenticado

## Componentes

### `src/components/menu/SettingsPanel.tsx`

- Panel dentro del SideMenu
- Secciones:
  1. **Privacidad** — Switch "Perfil público" con descripción
  2. **Notificaciones** — Switch principal + 3 switches granulares indentados
- Switches granulares deshabilitados si el principal está off
- Cada switch llama a `updateSetting` directamente (sin botón guardar)

### Props

```typescript
// No recibe props — usa useUserSettings() y useAuth() internamente
```

### Integración en SideMenu

- Nueva sección "Configuración" con icono `SettingsOutlined`
- Entre "Agregar comercio" y el dark mode toggle
- Solo visible si el usuario está autenticado

## Impacto en componentes existentes

### `BusinessComments.tsx`

- El click en nombre de usuario debe verificar si el target tiene `profilePublic: true`
- Problema: necesitamos saber el setting del *otro* usuario, no del propio
- Solución: crear una cache client-side. Cuando se renderiza la lista de comentarios, batch-fetch los settings de los userIds visibles
- Si `profilePublic: false` → no aplicar cursor/underline, no abrir drawer

### `src/hooks/useProfileVisibility.ts`

```typescript
export function useProfileVisibility(userIds: string[]): Map<string, boolean>
// Batch fetch de profilePublic para los userIds dados
// Cache en memoria (no refetch si ya se tiene el valor)
// Si el doc no existe → false (default privado)
```

### `functions/src/utils/notifications.ts`

- `createNotification()` recibe `type` como parámetro
- Antes de crear, fetch `userSettings/{userId}` del destinatario
- Verificar `notificationsEnabled` + el toggle específico del tipo
- Si cualquiera está off → return early sin crear

## Queries nuevas

| Query | Índice requerido |
|-------|-----------------|
| `userSettings/{userId}` (get by ID) | No (doc lookup) |
| Batch de `userSettings` por userId (in query) | No (`where in` no necesita índice compuesto) |

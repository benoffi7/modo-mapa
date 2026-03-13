# Plan — Panel de configuración de usuario

## Paso 1: Data layer

1. Agregar tipo `UserSettings` a `src/types/index.ts`
2. Agregar `USER_SETTINGS: 'userSettings'` a `src/config/collections.ts`
3. Agregar `userSettingsConverter` a `src/config/converters.ts`
4. Crear `src/services/userSettings.ts` con `fetchUserSettings` y `updateUserSettings`
5. Crear `src/hooks/useUserSettings.ts`

## Paso 2: Firestore rules

1. Agregar regla para `userSettings/{userId}`: read/write solo owner con validación de tipos y timestamp

## Paso 3: Componente SettingsPanel

1. Crear `src/components/menu/SettingsPanel.tsx` con switches para privacidad y notificaciones
2. Integrar en `src/components/layout/SideMenu.tsx` como nueva sección

## Paso 4: Privacidad del perfil

1. Crear `src/hooks/useProfileVisibility.ts` — batch fetch de `profilePublic` para userIds
2. Modificar `src/components/business/BusinessComments.tsx`:
   - Usar `useProfileVisibility` con los userIds de los comentarios
   - Condicionar el estilo clickeable y el onClick en el nombre

## Paso 5: Notificaciones server-side

1. Modificar `functions/src/utils/notifications.ts`:
   - `createNotification()` consulta `userSettings/{userId}` del destinatario
   - Verifica `notificationsEnabled` + toggle específico del tipo
   - Si está off → return early

## Paso 6: Seed data

1. Actualizar `scripts/seed-admin-data.ts` para crear algunos `userSettings` docs de prueba

## Paso 7: Testing y lint

1. `npm run lint`
2. `cd functions && npm run build`
3. Test local con emuladores

## Archivos a crear

- `src/services/userSettings.ts`
- `src/hooks/useUserSettings.ts`
- `src/hooks/useProfileVisibility.ts`
- `src/components/menu/SettingsPanel.tsx`

## Archivos a modificar

- `src/types/index.ts` — agregar `UserSettings`
- `src/config/collections.ts` — agregar `USER_SETTINGS`
- `src/config/converters.ts` — agregar `userSettingsConverter`
- `src/components/layout/SideMenu.tsx` — agregar sección Configuración
- `src/components/business/BusinessComments.tsx` — condicionar click en nombre
- `firestore.rules` — agregar regla para `userSettings`
- `functions/src/utils/notifications.ts` — verificar preferencias
- `scripts/seed-admin-data.ts` — agregar seed de userSettings

# Plan: Fix CSP Policy & Custom Tags Permissions

## Pasos de implementación

### 1. Actualizar CSP en `firebase.json`

- Agregar `https://apis.google.com` a `script-src`

### 2. Agregar guard de auth en `BusinessTags.tsx`

- Agregar check `if (!user)` al inicio de `loadTags()`
- Si no hay usuario, setear tagCounts con seedTags y count 0
- Return early sin hacer query a Firestore

### 3. Verificación local

- Ejecutar la app localmente
- Verificar que sin autenticación no aparece error de permisos
- Verificar que las etiquetas se cargan correctamente al autenticarse
- Verificar en consola que no hay errores de CSP

### 4. Deploy

- Crear branch `fix/csp-and-tags-permissions`
- Commit y push
- Crear issue en GitHub con referencia a la documentación

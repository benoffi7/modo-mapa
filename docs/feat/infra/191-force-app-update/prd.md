# PRD #191 — Force Update: forzar actualizacion cuando hay nueva version

## Contexto

Modo Mapa es una PWA con service worker (`vite-plugin-pwa`, `registerType: 'autoUpdate'`). Aunque `autoUpdate` actualiza el SW silenciosamente, los usuarios pueden quedarse en versiones viejas si no cierran la pestana, si el browser no activa el nuevo SW, o si el cache de IndexedDB (Firestore persistent cache) mantiene datos de esquema viejo. No existe ningun mecanismo del lado del servidor para forzar que el cliente se actualice.

## Problema

- Usuarios usan versiones viejas indefinidamente (especialmente en mobile donde las pestanas viven dias/semanas)
- No hay forma de forzar un rollout critico (fix de seguridad, cambio de schema)
- `autoUpdate` del SW depende de que el browser haga el check (cada 24hs segun spec) y que el usuario navegue
- No hay visibilidad de que version esta corriendo cada usuario (salvo Sentry y perfMetrics)

## Solucion propuesta

### Arquitectura general

```
[CI/CD deploy.yml]
       |
       v
[Firestore doc: config/appVersion]  <-- se escribe en el deploy
       |
       v
[Cliente: hook useForceUpdate]  <-- lee el doc, compara con __APP_VERSION__
       |
       v
[Si servidor > cliente: hard refresh]
```

### Componente 1: Escritura de version en Firestore (CI/CD)

En el workflow `deploy.yml`, despues del deploy de hosting, agregar un step que escriba en Firestore:

**Documento:** `config/appVersion`
**Campos:**
- `minVersion`: string semver (ej: `"2.31.0"`) — version minima aceptada
- `updatedAt`: timestamp del deploy

**Implementacion:** usar `firebase-tools` o un script con Firebase Admin SDK en el CI para escribir el doc. La version se lee de `package.json`.

**Nota:** solo se escribe `minVersion`, NO la version exacta. Esto permite controlar cuando forzar (por ejemplo, no forzar en un patch de docs).

### Componente 2: Lectura y comparacion en el cliente

**Hook:** `useForceUpdate()`

Responsabilidades:
1. Al montar la app (en `App.tsx`), leer `config/appVersion` de Firestore
2. Comparar `minVersion` del servidor contra `__APP_VERSION__` del build
3. Si `minVersion` > `__APP_VERSION__`: forzar actualizacion
4. Re-verificar periodicamente (cada 30 minutos) mientras la app esta abierta

**Comparacion semver:** usar comparacion simple split por `.` y comparar major > minor > patch numericamente. No hace falta libreria externa.

### Componente 3: Mecanismo de hard refresh

Cuando se detecta que hay que actualizar:

1. **Desregistrar el service worker** actual (`navigator.serviceWorker.getRegistrations()` → `registration.unregister()`)
2. **Limpiar caches del SW** (`caches.keys()` → `caches.delete()`) — esto limpia SOLO los caches de Workbox (assets estaticos, tiles de Google Maps), NO toca:
   - Cookies (se preservan)
   - `localStorage` / `sessionStorage` (se preservan)
   - IndexedDB de Firebase Auth (credenciales se preservan)
   - IndexedDB de Firestore (el persistent cache se reconstruye solo)
3. **Recargar la pagina** (`window.location.reload()`) — el browser descargara los assets frescos sin SW interceptando

### Componente 4: UX durante la actualizacion

**NO mostrar dialogo de confirmacion** — la actualizacion es obligatoria y transparente.

Opcionalmente mostrar un snackbar breve: "Actualizando a nueva version..." antes del reload, para que el usuario entienda que paso si ve la pantalla parpadear.

### Componente 5: Firestore Rules

Agregar regla de lectura publica para `config/appVersion`:

```
match /config/appVersion {
  allow read: if true;  // cualquier usuario (incluso no autenticado) puede leer
  allow write: if false; // solo Admin SDK (CI/CD)
}
```

Lectura publica porque:
- El dato no es sensible
- Usuarios no autenticados tambien necesitan actualizarse
- Simplifica la logica (no depende del estado de auth)

## Flujo completo

1. Dev mergea PR a `main`
2. CI ejecuta `deploy.yml`: build, deploy hosting, deploy functions
3. **Nuevo step:** CI escribe `config/appVersion.minVersion = "2.31.0"` en Firestore
4. Usuario abre la app (o la tiene abierta desde antes)
5. `useForceUpdate` lee `config/appVersion` → detecta `2.31.0 > 2.30.3`
6. Desregistra SW, limpia caches de Workbox, muestra snackbar, recarga
7. El browser descarga la nueva version sin SW cache → usuario queda en `2.31.0`
8. Auth token en IndexedDB sigue intacto → usuario no pierde sesion

## Consideraciones

### Por que Firestore y no Remote Config

- Ya tenemos Firestore inicializado y con persistent cache
- Remote Config requiere agregar `firebase/remote-config` al bundle (~15KB)
- Remote Config tiene cache de 12hs por default (configurable pero agrega complejidad)
- El doc de Firestore se lee con un simple `getDoc` y se beneficia del real-time listener si queremos
- El doc es gratis en la practica (1 read por sesion o cada 30 min)

### Control granular de minVersion

`minVersion` se escribe explicitamente en el CI, NO automaticamente con cada deploy. Esto permite:
- Deploys de docs/config sin forzar update
- Control manual: si un deploy tiene un bug, no forzar a todos a ese version
- El merge skill puede decidir si actualizar `minVersion` basado en el tipo de cambios

**Opcion recomendada:** el step de CI lee la version de `package.json` y la escribe como `minVersion` solo cuando hay cambios en `src/` o `functions/`. Cambios solo en `docs/` no actualizan `minVersion`.

### Frecuencia de verificacion

- **Al montar la app:** siempre (1 read de Firestore)
- **Cada 30 minutos:** con `setInterval` — balancea entre velocidad de rollout y costo de reads
- **Costo estimado:** con 100 usuarios activos, ~4800 reads/dia = gratis (free tier: 50K reads/dia)

### Edge cases

- **Sin conexion:** el hook no puede leer Firestore → no fuerza update → el usuario sigue offline normalmente. Al volver online, el proximo check forzara si es necesario.
- **Version identica:** no hacer nada (comparacion estricta)
- **minVersion no existe (doc no creado aun):** no hacer nada — fail-safe
- **Usuario en medio de una accion:** el reload interrumpe. Aceptable porque: (a) la app no tiene formularios largos, (b) se puede agregar un delay de 5 segundos para que el snackbar sea visible.

## Fuera de scope

- UI para "hay una actualizacion disponible, queres actualizar?" (esto es forzado, no opcional)
- Versionado de schema de Firestore (problema separado)
- Rollback de minVersion (se puede hacer manual desde Firebase Console)
- Notificacion push de nueva version

## Tests

### Unitarios
- `compareSemver(a, b)`: casos de mayor, menor, igual, con diferentes niveles (major, minor, patch)
- `useForceUpdate`: mock de Firestore doc, verificar que llama reload cuando version es mayor
- `useForceUpdate`: verificar que NO recarga cuando version es igual o menor
- `useForceUpdate`: verificar que maneja doc inexistente sin error

### Integracion
- CI step: verificar que el doc se escribe correctamente en Firestore
- E2E: verificar que un usuario con version vieja ve el reload (dificil de testear automaticamente, candidato a test manual)

### Manual
- Desplegar version nueva, verificar en browser que el reload ocurre
- Verificar que las credenciales se preservan post-reload
- Verificar comportamiento offline (no debe crashear)
- Verificar en mobile (Android Chrome, iOS Safari)

## Seguridad

- El doc `config/appVersion` es read-only para clientes — solo Admin SDK puede escribir
- No se expone informacion sensible (solo un string de version)
- El hard refresh no ejecuta codigo arbitrario — solo limpia cache y recarga
- Un atacante no puede escribir una version falsa para forzar reloads infinitos (write: false en rules)
- Considerar rate limiting del reload: si despues del refresh la version sigue siendo "vieja" (por cache de CDN), no reintentar en loop. Guardar en `sessionStorage` un flag con timestamp del ultimo refresh forzado y no reintentar por al menos 5 minutos.

## Dependencias

- **Cero dependencias nuevas** — usa Firestore existente, `__APP_VERSION__` existente, APIs nativas del browser
- **CI:** requiere que el service account de deploy tenga permisos de escritura en Firestore (ya los tiene para rules)
- **Firestore rules:** agregar regla para `config/appVersion`

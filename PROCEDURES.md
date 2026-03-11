# Procedimientos de Desarrollo

## Desarrollo local

```bash
npm install          # instalar dependencias (primera vez)
npm run emulators    # en una terminal: levanta Firebase Auth + Firestore local
npm run dev          # en otra terminal: levanta Vite en http://localhost:5173
```

En desarrollo (`npm run dev`), la app usa **emuladores de Firebase** automáticamente:
- Auth emulator: http://localhost:9099
- Firestore emulator: http://localhost:8080
- Emulator UI: http://localhost:4000 (para ver datos, usuarios, etc.)

Los datos del emulador son **efímeros** — se borran al parar el emulador. Producción nunca se toca en local.

Requiere `.env` con las API keys (copiar de `.env.example` y completar).

## Deploy

El deploy a Firebase Hosting es **automático** al mergear un PR a `main` via GitHub Actions (`.github/workflows/deploy.yml`).

**No se hace deploy manual.** El flujo es:
1. Trabajar en una rama
2. Crear PR hacia `main`
3. Mergear el PR
4. GitHub Actions buildea y deploya a https://modo-mapa-app.web.app

### Configuración requerida (una sola vez)
En GitHub repo Settings > Secrets and variables > Actions, agregar:
- `VITE_GOOGLE_MAPS_API_KEY`
- `VITE_GOOGLE_MAPS_MAP_ID` (opcional)
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `FIREBASE_SERVICE_ACCOUNT` (JSON de service account de Firebase)

## Flujo para nuevas funcionalidades

Toda funcionalidad nueva sigue estas etapas con aprobación del usuario en cada paso:

1. **PRD (Product Requirements Document)** — Claude lo crea incluyendo:
   - Descripción de la funcionalidad
   - Contexto del proyecto y estructura actual
   - Requisitos funcionales y no funcionales
   - Buenas prácticas y consideraciones UX
2. **Aprobación del usuario** — No avanzar sin OK
3. **Especificaciones técnicas** — Detalle de implementación:
   - Modelos de datos / interfaces
   - Componentes a crear o modificar
   - Interacciones con Firebase
   - Consideraciones de seguridad
4. **Aprobación del usuario** — No avanzar sin OK
5. **Plan técnico** — Pasos ordenados de implementación
6. **Implementación** — Siguiendo el flujo de ramas/PR habitual

### Documentación de features/fixes
Toda la documentación se guarda en `docs/<tipo>-<descripcion>/`:
- `prd.md` — Product Requirements Document
- `specs.md` — Especificaciones técnicas
- `plan.md` — Plan técnico de implementación
- `changelog.md` — Archivos modificados/creados durante la implementación

Cada iteración se empieza desde cero actualizando los archivos existentes (no se crean versiones).

## Flujo para corrección de errores / mejoras

1. **Crear issue en GitHub** con descripción del error o mejora
2. **Crear rama** desde `main`: `fix/<issue>-<descripcion>` o `feat/<issue>-<descripcion>`
3. **Implementar la solución** en la rama
4. **Probar en local** con `npm run dev` — validar que el fix funciona
5. **Commit** con referencia al issue (ej: `Fix #1: descripción`)
6. **Push + crear PR** hacia `main` con resumen y test plan
7. **Merge** del PR → deploy automático

### Convenciones de naming
- Ramas fix: `fix/<issue>-<descripcion>`
- Ramas feature: `feat/<issue>-<descripcion>`
- Commits: mensaje descriptivo + `Fix #N` o `Closes #N`

### Checklist pre-PR
- [ ] `npm run build` pasa sin errores
- [ ] Testeado en local con `npm run dev`
- [ ] Testeado en mobile (Chrome DevTools responsive)
- [ ] Sin secretos en el código

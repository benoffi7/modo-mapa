# Procedimientos de Desarrollo

## Desarrollo local

```bash
npm install       # instalar dependencias
npm run dev       # correr en http://localhost:5173
```

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

## Flujo para corrección de errores / mejoras

1. **Crear issue en GitHub** con descripción del error o mejora
2. **Crear rama** desde `main`: `fix/<issue>-<descripcion>` o `feat/<issue>-<descripcion>`
3. **Implementar la solución** en la rama
4. **Commit** con referencia al issue (ej: `Fix #1: descripción`)
5. **Crear PR** hacia `main` con resumen y test plan
6. **Merge** del PR → deploy automático

### Convenciones de naming
- Ramas fix: `fix/<issue>-<descripcion>`
- Ramas feature: `feat/<issue>-<descripcion>`
- Commits: mensaje descriptivo + `Fix #N` o `Closes #N`

### Checklist pre-PR
- [ ] `npm run build` pasa sin errores
- [ ] Testeado en local con `npm run dev`
- [ ] Testeado en mobile (Chrome DevTools responsive)
- [ ] Sin secretos en el código

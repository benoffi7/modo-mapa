# Procedimientos de Desarrollo

## Desarrollo local

```bash
npm install          # instalar dependencias (primera vez)
npm run emulators    # en una terminal: levanta Firebase Auth + Firestore local
npm run dev          # en otra terminal: levanta Vite en localhost:5173
```

En desarrollo (`npm run dev`), la app usa **emuladores de Firebase** automáticamente:

- Auth emulator: <http://localhost:9099>
- Firestore emulator: <http://localhost:8080>
- Emulator UI: <http://localhost:4000> (para ver datos, usuarios, etc.)

Los datos del emulador son **efímeros** — se borran al parar el emulador. Producción nunca se toca en local.

Requiere `.env` con las API keys (copiar de `.env.example` y completar).

## Deploy

El deploy a Firebase Hosting es **automático** al mergear un PR a `main` via GitHub Actions (`.github/workflows/deploy.yml`).

**No se hace deploy manual.** El flujo es:

1. Trabajar en una rama
2. Crear PR hacia `main`
3. Mergear el PR
4. GitHub Actions buildea y deploya a <https://modo-mapa-app.web.app>

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
   - Consideraciones de seguridad (ver `docs/SECURITY_GUIDELINES.md`)
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

## Trabajo en paralelo (múltiples agentes)

Cuando hay más de un agente trabajando en el repo al mismo tiempo, **cada agente debe usar su propio worktree** para evitar conflictos en el working directory:

```bash
# Crear worktree para una rama nueva
git worktree add ../modo-mapa-<feature> -b feat/<descripcion>

# Trabajar en el worktree (directorio independiente)
cd ../modo-mapa-<feature>
npm install

# Al terminar, limpiar el worktree
git worktree remove ../modo-mapa-<feature>
```

Esto permite que cada agente tenga su propio directorio con su propia rama, sin pisar archivos del otro. Los commits de cada agente van a ramas separadas y se resuelven conflictos al mergear PRs.

## Flujo para corrección de errores / mejoras

1. **Crear issue en GitHub** con descripción del error o mejora
2. **Crear rama** desde `main`: `fix/<issue>-<descripcion>` o `feat/<issue>-<descripcion>`
3. **Implementar la solución** en la rama
4. **Probar en local** con `npm run dev` — validar que el fix funciona
5. **Commit** con referencia al issue (ej: `Fix #1: descripción`)
6. **Push + crear PR** hacia `main` con resumen y test plan
7. **Merge** del PR → deploy automático

### Post-merge

Después de mergear un PR a `main`:

1. **Verificar CI** — Esperar a que GitHub Actions termine y confirmar que pasa. Si falla, diagnosticar y fixear inmediatamente. Main nunca debe quedar roto.
2. **Bump de versión** — Incrementar en `package.json` y `docs/reference/PROJECT_REFERENCE.md`:
   - PATCH (1.1.x) para fixes
   - MINOR (1.x.0) para features
   - MAJOR (x.0.0) cada 10 iteraciones
3. **Actualizar `docs/reference/PROJECT_REFERENCE.md`** — Agregar el issue y PR a la tabla de issues resueltos
4. **Auditar política de privacidad** — Ejecutar el agente `privacy-policy` para verificar que la política siga actualizada respecto a los cambios mergeados. Si hay discrepancias, actualizarla en el mismo merge o en un commit inmediato.

### Convenciones de naming

- Ramas fix: `fix/<issue>-<descripcion>`
- Ramas feature: `feat/<issue>-<descripcion>`
- Ramas chore: `chore/<issue>-<descripcion>`
- Commits: mensaje descriptivo + `Fix #N` o `Closes #N`

### Checklist pre-commit

- [ ] `npm run test:run` — todos los tests pasan
- [ ] `npm run build` pasa sin errores
- [ ] Archivos `.md` nuevos o modificados pasan `npx markdownlint-cli2`
- [ ] Testeado en local con `npm run dev`
- [ ] Testeado en mobile (Chrome DevTools responsive)
- [ ] Sin secretos en el código
- [ ] **Verificación de seguridad** — Evaluar según `docs/SECURITY_GUIDELINES.md`:
  - Firestore rules validan auth, ownership y longitud de campos
  - Collection names usan constantes de `src/config/collections.ts`
  - Operaciones async tienen error handling visible al usuario
  - Inputs del usuario se validan client-side y server-side
  - No hay `dangerouslySetInnerHTML`, `eval`, ni secretos hardcodeados

## Testing

Tests con **Vitest** + **@testing-library/react**.

```bash
npm run test        # watch mode (desarrollo)
npm run test:run    # ejecución única (CI / pre-commit)
```

### Convenciones

- Archivos de test colocados junto al código fuente: `useHook.test.ts` junto a `useHook.ts`
- Al agregar lógica nueva (hooks, utilidades, funciones puras), evaluar si necesita tests
- Priorizar tests de lógica (hooks, filtros, ordenamiento) sobre tests de UI
- Fixtures y helpers dentro del mismo test file, salvo que se compartan

### Cuándo agregar tests

- Hook nuevo con lógica de filtrado/ordenamiento/transformación → test obligatorio
- Función utilitaria pura → test obligatorio
- Corrección de bug → agregar test que reproduzca el escenario
- Componente UI simple (render + estilos) → no requiere test

## Markdown lint

Los archivos `.md` deben pasar markdownlint antes de commitear.

```bash
npx markdownlint-cli2 "**/*.md" --no-globs "#node_modules"
```

Configuración en `.markdownlint.json` (deshabilitados: MD013 line-length, MD060 table-column-style).

Reglas más comunes a respetar:

- Línea en blanco antes y después de headings (MD022)
- Línea en blanco antes y después de listas (MD032)
- Línea en blanco antes y después de bloques de código (MD031)
- Especificar lenguaje en bloques de código (MD040)
- No usar URLs desnudas, usar `<url>` (MD034)

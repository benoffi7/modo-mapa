# Specs: Lint rule for silent .catch(() => {})

**PRD:** [7-silent-catch-lint.md](7-silent-catch-lint.md)
**Fecha:** 2026-03-27

---

## Problema y contexto

El patron `.catch(() => {})` silencia errores y dificulta el debugging. Actualmente solo se detecta en el paso de pre-staging (`scripts/pre-staging-check.sh` check 4), lo que genera CI failures tardios. La deteccion debe ocurrir en tres capas:

1. **IDE** -- ESLint marca el patron como error en tiempo real
2. **Pre-commit** -- lint-staged ejecuta ESLint en archivos staged, bloqueando el commit
3. **Pre-staging** -- el grep existente actua como red de seguridad final

## Modelo de datos

No aplica -- este cambio es puramente de tooling/lint.

## Firestore Rules

No aplica.

## Cloud Functions

No aplica.

## Componentes

No aplica.

## Hooks

No aplica.

## Servicios

No aplica.

## Solucion tecnica

### Opcion elegida: regla ESLint `no-empty-function` refinada

ESLint ya tiene la regla built-in `no-empty-function` que detecta funciones vacias, incluyendo arrow functions usadas en `.catch()`. Sin embargo, la regla base de ESLint es sobreescrita por `@typescript-eslint/no-empty-function` cuando se extiende `tseslint.configs.recommended`.

La regla `@typescript-eslint/no-empty-function` ya esta incluida en `tseslint.configs.recommended` (que el proyecto ya extiende), pero esta configurada como `"warn"` por defecto en algunas presets o puede estar desactivada.

**Configuracion necesaria:**

```javascript
// eslint.config.js
rules: {
  'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
  '@typescript-eslint/no-empty-function': 'error',
}
```

Esto detecta:

- `.catch(() => {})` -- error
- `.catch(() => { })` -- error (espacio interior)
- `.catch(function() {})` -- error
- `const noop = () => {}` -- error (fuerza a declarar intencion)

**Escape valido cuando la funcion vacia es intencional:**

```typescript
// Cuando realmente se quiere ignorar el error (raro, documentar por que):
.catch((_e) => { /* intentionally ignored: reason */ })

// Patron recomendado — usar logger:
.catch((e) => logger.warn('Descripcion del contexto', e))
```

La regla `no-empty-function` permite funciones con un comentario dentro del body, lo cual es suficiente para los casos excepcionales.

### Alternativa descartada: grep custom en lint-staged

Agregar un grep al pre-commit ademas de ESLint seria redundante. ESLint ya se ejecuta via lint-staged en pre-commit. Agregar la regla ESLint cubre IDE + pre-commit con un solo cambio.

### Alternativa descartada: regla ESLint custom

Una regla custom con AST visitor seria mas precisa (solo `.catch` con arrow function vacia) pero `@typescript-eslint/no-empty-function` cubre el caso y todos sus parientes (event handlers vacios, callbacks vacios) que tambien son problematicos. El beneficio extra no justifica mantener un plugin custom.

## Integracion

### Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `eslint.config.js` | Agregar `'@typescript-eslint/no-empty-function': 'error'` a rules |

### Archivos que NO requieren cambio

| Archivo | Razon |
|---------|-------|
| `.husky/pre-commit` | Ya ejecuta `npx lint-staged` |
| `package.json` (lint-staged) | Ya corre `eslint --fix` en `*.{ts,tsx}` |
| `scripts/pre-staging-check.sh` | Se mantiene como red de seguridad (check 4). El grep es mas amplio y no depende de la config de ESLint. |

### Estado actual del codebase

Verificado: no hay instancias de `.catch(()` en `src/**/*.{ts,tsx}` (excluyendo tests). El codebase ya esta limpio, por lo que activar la regla no requiere migration de codigo existente.

**Nota:** `src/utils/logger.ts` linea 14 tiene un `catch {}` (sin arrow function, sin parametro). Esto es la forma abreviada de catch sin binding (`catch { }`) que es distinta de `.catch(() => {})`. La regla `@typescript-eslint/no-empty-function` **no** aplica a bloques catch vacios (esos son cubiertos por `no-empty` que es otra regla). Este caso particular esta justificado (Sentry no disponible = ignorar silenciosamente) y ya tiene un comentario explicativo.

## Tests

Este cambio es de configuracion de lint, no de codigo runtime. No requiere tests unitarios.

**Verificacion manual:**

| Verificacion | Como |
|-------------|------|
| La regla detecta `.catch(() => {})` | Crear archivo temporal con el patron, correr `npx eslint` |
| La regla permite `.catch((e) => logger.warn(...))` | Verificar que no tiene false positives |
| La regla permite funciones con comentario | `() => { /* intentional */ }` no marca error |
| Pre-commit bloquea el patron | Intentar commit con un archivo que tenga `.catch(() => {})` |

| Archivo test | Que testear | Tipo |
|-------------|-------------|------|
| N/A | Cambio de config, no de logica runtime | N/A |

## Analytics

No aplica.

---

## Offline

No aplica -- cambio de tooling.

---

## Decisiones tecnicas

| Decision | Alternativa | Razon |
|----------|------------|-------|
| Usar `@typescript-eslint/no-empty-function` built-in | Regla ESLint custom con AST para `.catch` especificamente | La regla built-in cubre `.catch(() => {})` y tambien otros callbacks vacios que son igualmente problematicos. Sin dependencias nuevas, sin mantenimiento de plugin custom. |
| Nivel `error` en vez de `warn` | `warn` | Un `warn` no bloquea el commit ni el build. El objetivo es prevenir que el patron llegue a CI, por lo que debe ser `error`. |
| Mantener check 4 en pre-staging | Eliminarlo por redundante | El grep en pre-staging es una red de seguridad independiente de la config de ESLint. Si alguien usa `--no-verify` en el commit, el pre-staging lo atrapa. Costo de mantenerlo: cero. |

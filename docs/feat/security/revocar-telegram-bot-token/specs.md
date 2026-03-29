# Specs: Revocar Telegram bot token expuesto en repo

**PRD:** [prd.md](prd.md)
**Fecha:** 2026-03-28

---

## Modelo de datos

No aplica. Este issue es puramente operacional sobre el repositorio y credenciales externas (Telegram BotFather). No involucra Firestore, tipos TypeScript ni la app React.

## Firestore Rules

No aplica. No hay cambios en reglas de Firestore.

### Rules impact analysis

No hay queries nuevas.

| Query (service file) | Collection | Auth context | Rule that allows it | Change needed? |
|---------------------|------------|-------------|-------------------|----------------|
| N/A | N/A | N/A | N/A | N/A |

### Field whitelist check

No hay campos nuevos.

| Collection | New/modified field | In create `hasOnly()`? | In update `affectedKeys().hasOnly()`? | Rule change needed? |
|-----------|-------------------|----------------------|--------------------------------------|-------------------|
| N/A | N/A | N/A | N/A | N/A |

## Cloud Functions

No aplica. No hay cambios en Cloud Functions.

## Componentes

No aplica. No hay cambios en componentes React.

### Mutable prop audit

No aplica.

| Component | Prop | Editable fields | Local state needed? | Parent callback |
|-----------|------|----------------|-------------------|-----------------|
| N/A | N/A | N/A | N/A | N/A |

## Textos de usuario

No aplica. No hay textos user-facing nuevos.

| Texto | Donde se usa | Notas |
|-------|-------------|-------|
| N/A | N/A | N/A |

## Hooks

No aplica.

## Servicios

No aplica.

## Integracion

No aplica. Este issue no modifica codigo de la aplicacion.

### Preventive checklist

No aplica (no hay cambios en codigo de la app).

- [x] **Service layer**: N/A
- [x] **Duplicated constants**: N/A
- [x] **Context-first data**: N/A
- [x] **Silent .catch**: N/A
- [x] **Stale props**: N/A

## Tests

Este issue es puramente operacional. No hay codigo nuevo que requiera tests unitarios.

| Archivo test | Que testear | Tipo |
|-------------|-------------|------|
| N/A | N/A | N/A |

### Verificaciones manuales

| Verificacion | Comando / accion | Resultado esperado |
|-------------|-----------------|-------------------|
| Token anterior revocado | Intentar usar token viejo con Telegram API | HTTP 401 Unauthorized |
| Bot funciona con token nuevo | Enviar mensaje al bot | Bot responde correctamente |
| `.env` nunca fue commiteado | `git log --all --diff-filter=A -- scripts/terminal-proxy/.env` | Sin resultados |
| `.env` esta ignorado | `git check-ignore -v scripts/terminal-proxy/.env` | Muestra regla que lo ignora |
| `.env.example` existe y no tiene secretos | `cat scripts/terminal-proxy/.env.example` | Solo placeholders |

## Analytics

No aplica.

---

## Offline

No aplica. Este issue es una operacion de seguridad sobre el repositorio y el bot de Telegram. No involucra la app web ni flujos de datos de Firestore.

### Cache strategy

| Dato | Estrategia | TTL | Storage |
|------|-----------|-----|---------|
| N/A | N/A | N/A | N/A |

### Writes offline

| Operacion | Mecanismo | Conflict resolution |
|-----------|-----------|-------------------|
| N/A | N/A | N/A |

### Fallback UI

No aplica.

---

## Decisiones tecnicas

### Verificacion de exposicion en historial

Se verifico con `git log --all --diff-filter=A -- scripts/terminal-proxy/.env` que el archivo `.env` **nunca fue commiteado** en ninguna branch del repositorio. La regla `.env*` en `.gitignore` raiz (linea 27) estuvo presente desde antes de que el archivo existiera. Esto elimina la necesidad de limpiar el historial de git con `git filter-repo` o BFG.

### Revocacion preventiva del token

Aunque el token no fue expuesto en el historial, se revoca igualmente como medida preventiva. El token existe en un archivo local en una maquina con acceso al repositorio publico. La revocacion y regeneracion via BotFather es la unica forma de garantizar que un token potencialmente comprometido quede invalidado.

### Defensa en profundidad en `.gitignore`

Aunque la regla global `.env*` ya cubre el archivo, se agrega una regla explicita `scripts/terminal-proxy/.env` como defensa en profundidad. Si alguien modifica la regla global en el futuro, la regla explicita sigue protegiendo este archivo especifico.

### `.env.example` con placeholders

Se crea un archivo `.env.example` que documenta las variables necesarias sin valores reales. Esto permite que cualquier persona que clone el repo sepa que variables configurar sin exponer secretos.

### Sin limpieza de historial

Dado que el archivo nunca fue commiteado, la Fase S4 del PRD (limpieza de historial con `git filter-repo`) **no aplica** y se omite del plan.

# PRD: Revocar Telegram bot token expuesto en repo

**Feature:** revocar-telegram-bot-token
**Categoria:** security
**Fecha:** 2026-03-28
**Issue:** #207
**Prioridad:** Critical

---

## Contexto

El repositorio de Modo Mapa es publico desde 2026-03-15. El directorio `scripts/terminal-proxy/` contiene un archivo `.env` con el token del bot de Telegram y el chat ID del admin. Aunque el `.gitignore` raiz tiene la regla `.env*` que previene que se trackee actualmente, es necesario verificar que el token nunca fue commiteado en el historial de git y, si lo fue, limpiar ese historial. Adicionalmente, el token debe ser revocado y regenerado como medida preventiva.

## Problema

- El token del bot de Telegram podria estar expuesto en el historial de git si fue commiteado antes de que `.env*` estuviera en `.gitignore`
- Un token expuesto permite takeover completo del bot: leer mensajes, impersonar al bot, enviar mensajes al admin
- El chat ID del admin tambien esta expuesto, lo que habilita social engineering dirigido

## Solucion

### S1. Verificar exposicion en historial de git

Revisar si `scripts/terminal-proxy/.env` fue alguna vez commiteado en cualquier branch del repositorio. Si fue commiteado, el token ya fue expuesto publicamente (el repo es publico desde 2026-03-15) y la limpieza del historial es obligatoria.

### S2. Revocar y regenerar token

Independientemente de si fue commiteado o no, revocar el token actual via BotFather (`/revoke`) y generar uno nuevo. Esta es la unica forma de invalidar un token potencialmente comprometido.

### S3. Proteger el nuevo token

- Verificar que `scripts/terminal-proxy/.env` esta efectivamente ignorado por `.gitignore` (la regla `.env*` en la raiz deberia cubrirlo)
- Agregar una regla explicita `scripts/terminal-proxy/.env` al `.gitignore` como defensa en profundidad
- Documentar en el README del terminal-proxy que el `.env` debe crearse manualmente a partir de `.env.example`
- Crear `scripts/terminal-proxy/.env.example` con placeholders sin valores reales

### S4. Limpiar historial si fue commiteado

Si la verificacion en S1 confirma que el archivo fue commiteado:

- Usar `git filter-repo` o `BFG Repo-Cleaner` para eliminar el archivo del historial completo
- Force-push a todas las branches afectadas
- Notificar a cualquier fork que puede tener el historial contaminado

---

## Scope

| Item | Prioridad | Esfuerzo |
|------|-----------|----------|
| Verificar historial de git para exposicion del .env | Alta | S |
| Revocar token via BotFather y generar nuevo | Alta | S |
| Actualizar .env local con nuevo token | Alta | S |
| Agregar regla explicita en .gitignore | Alta | S |
| Crear .env.example con placeholders | Media | S |
| Limpiar historial de git (si aplica) | Alta | M |

**Esfuerzo total estimado:** S (sin limpieza de historial) / M (con limpieza)

---

## Out of Scope

- Migrar a un secret manager (ej: Google Secret Manager, Vault) -- evaluar en issue separado si se quiere hardening adicional
- Auditar otros archivos del repo por secretos expuestos (se puede crear un issue separado para un scan completo con `trufflehog` o `gitleaks`)
- Cambiar la arquitectura del terminal-proxy para no depender de variables de entorno
- Implementar rotacion automatica de tokens

---

## Tests

Este issue es puramente operacional (revocacion de token + limpieza de git). No hay codigo nuevo que requiera tests unitarios.

### Archivos que necesitaran tests

| Archivo | Tipo | Que testear |
|---------|------|-------------|
| N/A | N/A | No hay codigo nuevo |

### Criterios de testing

- Verificacion manual: el bot responde con el nuevo token
- Verificacion manual: `git log --all -p -- scripts/terminal-proxy/.env` no muestra resultados post-limpieza
- Verificacion manual: `scripts/terminal-proxy/.env` aparece en `git check-ignore -v`

---

## Seguridad

- [x] `.env*` ya esta en `.gitignore` raiz (verificado)
- [x] `scripts/terminal-proxy/.env` no esta trackeado actualmente por git (verificado)
- [ ] Revocar token actual via BotFather
- [ ] Verificar que el token nunca fue commiteado en historial (`git log --all --diff-filter=A -- scripts/terminal-proxy/.env`)
- [ ] Si fue commiteado: limpiar historial con `git filter-repo`
- [ ] Agregar regla explicita `scripts/terminal-proxy/.env` a `.gitignore`
- [ ] Crear `.env.example` sin valores reales
- [ ] No incluir secretos, API keys, credenciales ni emails hardcodeados (checklist de repo publico)
- [ ] Considerar agregar un pre-commit hook o CI check con `gitleaks` para prevenir futuras exposiciones

---

## Offline

No aplica. Este issue es una operacion de seguridad sobre el repositorio y el bot de Telegram. No involucra la app web ni flujos de datos de Firestore.

### Data flows

| Operacion | Tipo (read/write) | Estrategia offline | Fallback UI |
|-----------|-------------------|-------------------|-------------|
| N/A | N/A | N/A | N/A |

### Checklist offline

No aplica a este issue.

### Esfuerzo offline adicional: N/A

---

## Modularizacion

No aplica. Este issue no involucra cambios en el codigo de la aplicacion React.

### Checklist modularizacion

No aplica a este issue.

---

## Success Criteria

1. El token anterior del bot de Telegram esta revocado y ya no funciona
2. El bot funciona correctamente con el nuevo token
3. `git log --all -p -- scripts/terminal-proxy/.env` no devuelve ningún resultado (si fue commiteado y se limpio el historial) o confirma que nunca fue commiteado
4. `git check-ignore scripts/terminal-proxy/.env` confirma que el archivo esta ignorado
5. Existe `scripts/terminal-proxy/.env.example` con placeholders documentados

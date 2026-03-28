# Plan: Revocar Telegram bot token expuesto en repo

**Specs:** [specs.md](specs.md)
**Fecha:** 2026-03-28

---

## Fases de implementacion

### Fase 1: Revocar y regenerar token (manual)

**Branch:** N/A (accion manual en Telegram, no requiere branch)

| Paso | Accion | Detalle |
|------|--------|---------|
| 1 | Abrir BotFather en Telegram | Buscar @BotFather |
| 2 | Ejecutar `/revoke` | Seleccionar el bot de terminal-proxy |
| 3 | Confirmar revocacion | BotFather invalida el token anterior |
| 4 | Ejecutar `/token` | Obtener nuevo token para el bot |
| 5 | Actualizar `scripts/terminal-proxy/.env` | Reemplazar `TELEGRAM_BOT_TOKEN` con el nuevo valor |
| 6 | Verificar que el bot funciona | Enviar mensaje de prueba al bot |

### Fase 2: Proteger el repositorio

**Branch:** `fix/telegram-token-protection`

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `.gitignore` | Agregar regla explicita `scripts/terminal-proxy/.env` debajo de la regla global `.env*` |
| 2 | `scripts/terminal-proxy/.env.example` | Crear archivo con placeholders: `TELEGRAM_BOT_TOKEN=your_bot_token_here` y `TELEGRAM_CHAT_ID=your_chat_id_here` |

---

## Orden de implementacion

1. Fase 1, Paso 1-4: Revocar token viejo y obtener nuevo (manual, BotFather)
2. Fase 1, Paso 5: Actualizar `.env` local con nuevo token
3. Fase 1, Paso 6: Verificar que el bot funciona con el nuevo token
4. Fase 2, Paso 1: Agregar regla explicita al `.gitignore`
5. Fase 2, Paso 2: Crear `.env.example`
6. Commit y PR

La Fase 1 es completamente manual y no genera cambios en el repositorio. La Fase 2 es la unica que produce cambios committeables.

## File size estimation

| Archivo | Lineas estimadas | Requiere descomposicion? |
|---------|-----------------|------------------------|
| `.gitignore` | +1 linea (total ~30) | No |
| `scripts/terminal-proxy/.env.example` | ~3 lineas (nuevo) | No |

## Riesgos

1. **El bot deja de funcionar despues de revocar**: Mitigacion: tener BotFather abierto para generar el nuevo token inmediatamente despues de revocar. El downtime es de segundos.
2. **El chat ID cambia**: El chat ID no cambia al revocar el token. Solo el token se invalida. No se necesita obtener un nuevo chat ID.
3. **Alguien usa el token viejo entre revocacion y actualizacion del `.env`**: Riesgo minimo dado que el token nunca fue expuesto en el historial de git. La revocacion es preventiva.

## Criterios de done

- [x] Verificado que `.env` nunca fue commiteado en el historial (`git log --all --diff-filter=A` sin resultados)
- [ ] Token anterior revocado via BotFather
- [ ] Nuevo token generado y guardado en `scripts/terminal-proxy/.env`
- [ ] Bot funciona correctamente con nuevo token
- [ ] Regla explicita `scripts/terminal-proxy/.env` agregada a `.gitignore`
- [ ] `scripts/terminal-proxy/.env.example` creado con placeholders sin valores reales
- [ ] `git check-ignore scripts/terminal-proxy/.env` confirma que el archivo esta ignorado
- [ ] No se requiere limpieza de historial (confirmado: archivo nunca fue commiteado)

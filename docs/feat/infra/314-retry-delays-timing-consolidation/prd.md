# PRD: tech-debt — import RETRY_DELAYS_MS from timing.ts in config.ts

**Feature:** 314-retry-delays-timing-consolidation
**Categoria:** infra
**Fecha:** 2026-04-23
**Issue:** #314
**Prioridad:** Baja

---

## Contexto

Durante el post-merge audit de `feat/force-update-reliability-specs-plan` (#191) se identifico que `src/services/config.ts` define `RETRY_DELAYS_MS = [500, 1500]` localmente, mientras que `src/constants/timing.ts` deberia ser la fuente canonica para esa constante. Al revisar el estado actual: `config.ts` no tiene `RETRY_DELAYS_MS` local (la logica de retry fue simplificada a silent-fail en #191), pero `timing.ts` ya fue actualizado con `FORCE_UPDATE_FETCH_RETRY_DELAYS_MS = [500, 1500]` y documentacion de su proposito (backoff entre reintentos de `fetchAppVersionConfig` ante errores `unavailable` o `deadline-exceeded`). El trabajo pendiente es conectar la constante existente con la logica de retry que aun falta en `config.ts`.

## Problema

- La spec original de #191 menciona `RETRY_DELAYS_MS = [500, 1500]` en `config.ts` y `FORCE_UPDATE_FETCH_RETRY_DELAYS_MS` en `timing.ts`, pero ninguno de los dos existe en el codigo actual.
- Si la logica de retry se elimino intencionalmente, `timing.ts` deberia reflejar esa decision (no definir una constante para algo que no se usa).
- Si la logica de retry debia existir pero se omitio, `fetchAppVersionConfig` es vulnerable a fallos de red transitorios: si Firestore tarda en responder, la version check falla silenciosamente y el usuario podria quedarse en una version desactualizada.
- Sin retry, un fallo momentaneo de red al iniciar la app puede hacer que un usuario que necesita update obligatorio no reciba la instruccion de actualizar.

## Solucion

### S1: Estado actual (ya completado)

`FORCE_UPDATE_FETCH_RETRY_DELAYS_MS = [500, 1500]` ya existe en `src/constants/timing.ts` con documentacion sobre su proposito (backoff ante `unavailable`/`deadline-exceeded`). El trabajo en esta etapa ya esta hecho.

### S2: Conectar la constante con logica de retry en config.ts

Importar `FORCE_UPDATE_FETCH_RETRY_DELAYS_MS` en `src/services/config.ts` e implementar retry:
- Intentar `getDoc` hasta 3 veces (1 intento original + 2 reintentos)
- Esperar `FORCE_UPDATE_FETCH_RETRY_DELAYS_MS[i]` entre reintentos
- Si todos los intentos fallan, retornar `{ minVersion: undefined }` (comportamiento actual: no forzar update si hay error de red)
- La logica de retry aplica solo a errores de red, no a "doc no existe"

### S3: Ajuste del test existente

`useForceUpdate.test.ts` mockea `fetchAppVersionConfig` directamente, por lo que los tests del hook no cambian. Agregar tests unitarios para la nueva logica de retry en `config.ts` o en un helper auxiliar de retry.

**Patron de retry recomendado** (consistente con `services/` layer del proyecto):

```typescript
async function withRetry<T>(
  fn: () => Promise<T>,
  delays: number[],
): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (delays.length === 0) throw err;
    await new Promise((resolve) => setTimeout(resolve, delays[0]));
    return withRetry(fn, delays.slice(1));
  }
}
```

La funcion `withRetry` va en `src/utils/retry.ts` para ser reutilizable, o inline en `config.ts` si es solo uso interno. Dada la politica de modularizacion, `src/utils/retry.ts` es preferible (reutilizable, testeable de forma aislada).

---

## Scope

| Item | Prioridad | Esfuerzo |
|------|-----------|----------|
| `FORCE_UPDATE_FETCH_RETRY_DELAYS_MS` en `timing.ts` (ya hecho) | Alta | XS |
| Crear `src/utils/retry.ts` con `withRetry` | Alta | XS |
| Actualizar `fetchAppVersionConfig` en `config.ts` para usar retry + constante | Alta | XS |
| Tests unitarios para `withRetry` | Alta | S |
| Tests unitarios para `fetchAppVersionConfig` con retry | Alta | S |

**Esfuerzo total estimado:** S

---

## Out of Scope

- Cambios a `useForceUpdate.ts` (ya correcto, mockea el servicio)
- Retry logic en otros servicios de Firestore (esto es especifico al check de version critico)
- UI de "reintentando..." durante el fetch de version
- Cambios a las reglas de Firestore para `config/appVersion`
- Agregar `measureAsync` a `fetchAppVersionConfig` (es el scope del issue #315)

---

## Tests

### Archivos que necesitaran tests

| Archivo | Tipo | Que testear |
|---------|------|-------------|
| `src/utils/retry.ts` | Unitario (Vitest) | Exito en primer intento; reintento con delay correcto; agotamiento de reintentos lanza error; no reintenta si delays=[] |
| `src/services/config.ts` | Unitario (Vitest) | fetchAppVersionConfig retorna minVersion en exito; retorna `{ minVersion: undefined }` si doc no existe; retorna `{ minVersion: undefined }` si todos los reintentos fallan; hace exactamente N reintentos antes de rendirse |
| `src/constants/timing.ts` | Test de barril (barrel.test.ts) | Export de `FORCE_UPDATE_FETCH_RETRY_DELAYS_MS` presente |

### Criterios de testing

- Cobertura >= 80% del codigo nuevo
- Mock de `setTimeout` con `vi.useFakeTimers()` para no hacer los tests lentos
- `fetchAppVersionConfig` testeado con mock de `getDoc` que falla N veces y luego triunfa
- Verificar que el numero de llamadas a `getDoc` es correcto (1 + reintentos)

---

## Seguridad

Esta tarea no escribe a Firestore ni expone nuevas superficies. Solo afecta una lectura de `config/appVersion` (read-only para clientes).

- [ ] No hay cambios a Firestore rules
- [ ] `withRetry` no introduce side effects (solo delays y reintentos de la misma fn)
- [ ] El retry no puede causar billing DoS: maximo 3 reads por check de version (1 + 2 reintentos), igual que antes en el peor caso

### Vectores de ataque automatizado

| Superficie | Ataque posible | Mitigacion requerida |
|-----------|---------------|---------------------|
| `fetchAppVersionConfig` con retry | Un atacante no puede triggear mas reads al no controlar el codigo cliente | Sin mitigacion adicional — el retry es client-side y acotado |

---

## Deuda tecnica y seguridad

```bash
gh issue list --label security --state open --json number,title
gh issue list --label "tech-debt" --state open --json number,title
```

### Issues relacionados

| Issue | Relacion | Accion |
|-------|----------|--------|
| #315 measureAsync en fetchAppVersionConfig | Complementario | Implementar en el mismo archivo; coordinar si se batchean |
| #316 debounce/concurrency en useForceUpdate | Independiente | No relacionado con retry en el service |
| #313 isCooldownActive duplication | Independiente | Diferentes archivos |

### Mitigacion incorporada

- Elimina el magic number `[500, 1500]` que podria aparecer inline si alguien agrega retry sin constante
- Establece `src/utils/retry.ts` como patron reutilizable para futuros servicios criticos

---

## Robustez del codigo

### Checklist de hooks async

- [ ] `withRetry` usa `Promise`-based delay (no `useEffect`) — no aplica checklist de React hooks
- [ ] `fetchAppVersionConfig` ya tiene silent-catch en `useForceUpdate` — el retry no cambia ese contrato
- [ ] `withRetry` no usa estado de React — va en `src/utils/`, no en `src/hooks/`
- [ ] La constante nueva usa key de `src/constants/timing.ts` — no string hardcodeado

### Checklist de observabilidad

- [ ] Si se agregan reintentos fallidos, considerar `logger.warn` con el numero de intento (no `logger.error` — es esperado en entornos con red inestable)
- [ ] No requiere nuevo `trackEvent` (el retry es transparente al usuario)

### Checklist offline

- [ ] Si el dispositivo esta offline, `getDoc` falla inmediatamente (no timeout largo) — el retry con delays cortos [500ms, 1500ms] es aceptable
- [ ] El comportamiento ante error total (offline completo) es identico al actual: `{ minVersion: undefined }` = no forzar update

### Checklist de documentacion

- [ ] Agregar `FORCE_UPDATE_FETCH_RETRY_DELAYS_MS` al inventario de constantes si hay uno en docs
- [ ] `src/utils/retry.ts` es un nuevo archivo de utilidad — no requiere actualizacion de `features.md` ni `firestore.md`
- [ ] `docs/reference/patterns.md` puede mencionar `withRetry` como patron disponible para servicios criticos

---

## Offline

### Data flows

| Operacion | Tipo (read/write) | Estrategia offline | Fallback UI |
|-----------|-------------------|-------------------|-------------|
| `fetchAppVersionConfig` | read | Retry con delays acotados; si falla, retorna `{ minVersion: undefined }` | Ninguno — el check de version falla silenciosamente |

### Checklist offline

- [ ] Reads de Firestore: usan persistencia offline? No — `config/appVersion` se lee con `getDoc` sin cache persistente (correcto: queremos el valor actual del servidor)
- [ ] Writes: no aplica
- [ ] APIs externas: no aplica
- [ ] UI: no hay UI de "verificando version" — fallo silencioso es el comportamiento deseado
- [ ] Datos criticos: `minVersion` no necesita estar en cache — si no se puede leer, se asume "no hay update"

### Esfuerzo offline adicional: XS

---

## Modularizacion y % monolitico

- `withRetry` va en `src/utils/retry.ts` — carpeta correcta para utilidades puras sin React
- `fetchAppVersionConfig` permanece en `src/services/config.ts` — sin cambio de ubicacion
- Ningun componente de layout se ve afectado
- No se agregan imports cruzados

### Checklist modularizacion

- [ ] Logica de retry en `utils/` (no inline en componente de layout)
- [ ] `withRetry` es reutilizable fuera del contexto de config
- [ ] No se agregan useState de logica de negocio a AppShell o SideMenu
- [ ] `config.ts` no importa de `firebase/firestore` directamente (ya usa `db` de `config/firebase`)
- [ ] Archivo `retry.ts` < 50 lineas

### Impacto en % monolitico

| Aspecto | Impacto | Justificacion |
|---------|---------|---------------|
| Acoplamiento de componentes | = | No toca componentes |
| Estado global | = | No crea ni modifica contextos |
| Firebase coupling | = | Queries siguen en services/ |
| Organizacion por dominio | + | Nueva utilidad en utils/ (correcto) |

---

## Accesibilidad y UI mobile

No aplica — esta tarea es puramente de capa de servicios y utilidades, sin cambios de UI.

---

## Success Criteria

1. `src/constants/timing.ts` exporta `FORCE_UPDATE_FETCH_RETRY_DELAYS_MS = [500, 1500]`
2. `src/utils/retry.ts` exporta `withRetry<T>` testeado y documentado
3. `fetchAppVersionConfig` usa `withRetry` con `FORCE_UPDATE_FETCH_RETRY_DELAYS_MS` y retorna `{ minVersion: undefined }` si todos los reintentos fallan
4. Tests unitarios cubren el happy path, el retry parcial, y el agotamiento total de reintentos
5. No hay magic numbers `[500, 1500]` hardcodeados en ningun archivo de `src/`

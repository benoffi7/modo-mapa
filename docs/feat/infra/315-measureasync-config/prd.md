# PRD: measureAsync instrumentation en fetchAppVersionConfig

**Feature:** 315-measureasync-config
**Categoria:** infra
**Fecha:** 2026-04-23
**Issue:** #315
**Prioridad:** Baja

---

## Contexto

`fetchAppVersionConfig` en `src/services/config.ts` es un read de Firestore que se ejecuta en cada ciclo de verificacion de version (al inicio de la app y ante cambios de visibilidad), pero no esta instrumentado con `measureAsync`. Esto significa que su latencia de red y sus retries son invisibles en el dashboard de performance del admin panel, a diferencia de otros servicios como `userSettings`, `notifications`, `ratings` y `recommendations` que ya usan `measureAsync`.

## Problema

- La latencia del read `config/appVersion` no aparece en los percentiles de queries (p50/p95) del admin panel de Performance.
- Si el read falla o tarda demasiado, no hay forma de correlacionarlo con los datos de performance diarios calculados por `dailyMetrics`.
- La instrumentacion es inconsistente: todos los demas servicios que hacen reads de Firestore usan `measureAsync` o `measuredGetDoc`; `config.ts` es la excepcion.

## Solucion

### S1: Agregar import de `measuredGetDoc` y envolver el read

Importar `measuredGetDoc` desde `../utils/perfMetrics` (ya exportado) y reemplazar el `getDoc(...)` directo por `measuredGetDoc('appVersionConfig', ref)`. Esto sigue el patron identico al de `userSettings.ts` que usa `measureAsync('userSettings', () => getDoc(...))`.

El read de `config/appVersion` es un `getDoc` sobre un `DocumentReference` sin converter, por lo que `measuredGetDoc` es el wrapper idoneo. No se requiere metadata adicional: el nombre de metrica `'appVersionConfig'` es suficiente para segmentacion en el dashboard.

### S2: Eliminar el import directo de `getDoc` si queda sin usos

Tras envolver con `measuredGetDoc`, `getDoc` de `firebase/firestore` queda sin uso en `config.ts` y debe eliminarse del import para mantener la regla del service layer (no importar Firebase SDK directamente en services cuando existe wrapper).

### S3: Actualizar el test de config.ts

El test existente en `src/services/config.test.ts` mockea `getDoc` directamente. Debe actualizarse para:
1. Mockear `../utils/perfMetrics` con `{ measuredGetDoc: (_name, fn) => fn() }` (patron identico al mock de `measureAsync` en `userSettings.test.ts`).
2. Verificar que `measuredGetDoc` es llamado con el nombre correcto `'appVersionConfig'` (nuevo test de instrumentacion).
3. Mantener los 4 casos existentes intactos.

---

## Scope

| Item | Prioridad | Esfuerzo |
|------|-----------|----------|
| Reemplazar `getDoc` por `measuredGetDoc` en `config.ts` | Alta | XS |
| Eliminar import directo de `getDoc` | Alta | XS |
| Actualizar mock en `config.test.ts` | Alta | XS |
| Agregar test de instrumentacion (`measuredGetDoc` llamado con nombre correcto) | Media | XS |

**Esfuerzo total estimado:** S

---

## Out of Scope

- Agregar nuevos campos al documento `config/appVersion`.
- Instrumentar otros reads en el archivo `config.ts` (actualmente hay uno solo).
- Cambiar la logica de retry o cooldown en `useForceUpdate` (tema del issue #316).
- Agregar `source` tag o metadata extra a `measureAsync` (la firma actual no acepta metadata; seria un refactor mayor fuera del scope de esta tarea).

---

## Tests

### Archivos que necesitaran tests

| Archivo | Tipo | Que testear |
|---------|------|-------------|
| `src/services/config.test.ts` | Unit | Mock de `measuredGetDoc`; verificar que se llama con nombre `'appVersionConfig'`; mantener los 4 casos existentes (doc existe, no existe, sin campo, error de red) |

### Criterios de testing

- Cobertura >= 80% del codigo nuevo (el cambio es de 1 linea; los 4 tests existentes cubren todos los paths).
- El mock de `../utils/perfMetrics` debe usar el patron `{ measuredGetDoc: (_name, fn) => fn() }` para transparencia de la instrumentacion en tests.
- Agregar al menos 1 test que verifique que `measuredGetDoc` fue invocado exactamente una vez con `'appVersionConfig'` como primer argumento.
- Los tests de regresion (doc existe, no existe, sin campo, error de red) no deben modificar sus aserciones de resultado.

---

## Seguridad

Este feature es una modificacion interna de instrumentacion. No expone nuevas superficies de ataque.

- [ ] No se agrega escritura a Firestore, solo lectura instrumentada.
- [ ] No hay inputs del usuario involucrados.
- [ ] No se modifican Firestore rules.

### Vectores de ataque automatizado

| Superficie | Ataque posible | Mitigacion requerida |
|-----------|---------------|---------------------|
| `config/appVersion` (read) | Scraping del documento de configuracion via cliente | Ya mitigado: App Check en prod + el documento no contiene datos sensibles |

---

## Deuda tecnica y seguridad

```bash
gh issue list --label "tech-debt" --state open --json number,title
```

### Issues relacionados

| Issue | Relacion | Accion |
|-------|----------|--------|
| #314 tech-debt: import RETRY_DELAYS_MS from timing.ts in config.ts | Mismo archivo `config.ts` | Considerar hacer ambos cambios en el mismo PR para minimizar toques al archivo |
| #316 tech-debt: debounce/concurrency guard en useForceUpdate | Consumidor de `fetchAppVersionConfig` | No agravar: no modificar la logica de llamada en `useForceUpdate` |
| #313 tech-debt: remove isCooldownActive duplication | Relacionado con el ciclo de force update | Sin impacto directo |

### Mitigacion incorporada

- El PR que implementa este feature puede incluir el fix de #314 (import `RETRY_DELAYS_MS` desde `timing.ts`) ya que ambos tocan `config.ts`. Esto evita un segundo toque al mismo archivo y reduce overhead de PR review.

---

## Robustez del codigo

### Checklist de hooks async

- [ ] No hay hooks involucrados — cambio en service puro (`config.ts`).
- [ ] `measuredGetDoc` maneja internamente la medicion; el error propagation es transparente (si `fn()` rechaza, `measuredGetDoc` propaga el rechazo sin tragarselo).
- [ ] No hay `setState` ni efectos secundarios de React en este cambio.

### Checklist de observabilidad

- [ ] `measuredGetDoc('appVersionConfig', ...)` registra timing en `queryTimings` de `perfMetrics.ts`, que luego es agregado por `dailyMetrics` en `p50/p95` del admin panel.
- [ ] No se requiere nuevo `trackEvent` ni entrada en `GA4_EVENT_NAMES`.

### Checklist offline

- [ ] `fetchAppVersionConfig` no tiene fallback offline (comportamiento existente, no cambia).
- [ ] `measuredGetDoc` hace early-return `fn()` cuando `sessionId` es falsy (modo sin instrumentacion activa, emuladores, staging) — sin efecto en comportamiento.

### Checklist de documentacion

- [ ] No se agregan secciones a `HomeScreen`, ni analytics events, ni tipos nuevos.
- [ ] `docs/reference/features.md` no requiere actualizacion (no es un feature de usuario).

---

## Offline

### Data flows

| Operacion | Tipo | Estrategia offline | Fallback UI |
|-----------|------|--------------------|-------------|
| `fetchAppVersionConfig` | read (getDoc) | Sin cache offline — comportamiento existente no cambia | El hook consumidor (`useForceUpdate`) ya maneja el error de red con retry |

### Checklist offline

- [ ] Read de Firestore: sin persistencia offline (es un doc de configuracion, no datos de usuario).
- [ ] No hay writes en este feature.
- [ ] El manejo de error de red existente en el consumidor no se modifica.

### Esfuerzo offline adicional: S (ninguno requerido)

---

## Modularizacion y % monolitico

Este cambio es un refactor de 1-2 lineas en un service ya bien modularizado. No afecta el porcentaje monolitico.

### Checklist modularizacion

- [ ] Logica de negocio permanece en service (`config.ts`), no se mueve a componentes.
- [ ] Ningun archivo nuevo supera 300 lineas (el archivo tiene 22 lineas, queda igual).
- [ ] No se agrega estado global ni contextos nuevos.
- [ ] El import de `firebase/firestore` (`getDoc`) se elimina, mejorando la boundary del service layer.

### Impacto en % monolitico

| Aspecto | Impacto | Justificacion |
|---------|---------|---------------|
| Acoplamiento de componentes | = | Sin cambio en componentes |
| Estado global | = | Sin nuevo estado |
| Firebase coupling | - (mejora) | Elimina import directo de `firebase/firestore` en `config.ts` |
| Organizacion por dominio | = | Archivo existente, sin mover |

---

## Accesibilidad y UI mobile

No aplica — cambio exclusivamente en la capa de servicio.

---

## Success Criteria

1. `fetchAppVersionConfig` usa `measuredGetDoc('appVersionConfig', ...)` en lugar de `getDoc` directo.
2. `config.ts` no importa nada de `firebase/firestore` directamente (boundary del service layer respetada).
3. `config.test.ts` mockea `../utils/perfMetrics` correctamente y agrega al menos 1 test verificando que `measuredGetDoc` fue llamado con el nombre correcto.
4. Los 4 tests existentes de `config.test.ts` pasan sin modificar sus aserciones de resultado.
5. El timing de `config/appVersion` aparece en los datos de `queryTimings` de `perfMetrics.ts` y por ende en el agregado diario de `dailyMetrics`.

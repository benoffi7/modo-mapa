# PRD: Tech debt: converters.ts over 400 lines + useFollowedTags exhaustive-deps warnings

**Feature:** 247-converters-exhaustive-deps
**Categoria:** infra
**Fecha:** 2026-03-30
**Issue:** #247
**Prioridad:** Media

---

## Contexto

El issue #247 agrupa tres items de deuda tecnica detectados tras los merges de #203 (notificationDigest) y #205 (followedTags): `converters.ts` supera las 505 lineas (limite del proyecto: 400), `useFollowedTags.ts` tiene warnings de exhaustive-deps con `eslint-disable` comments, y `useVerificationBadges.ts` tiene 250 lineas con 3 computaciones independientes que podrian separarse. El split de `converters.ts` se trato en un issue dedicado #249, por lo que este PRD cubre los dos items restantes.

## Problema

- `useFollowedTags.ts` tiene un `eslint-disable-next-line react-hooks/exhaustive-deps` en linea 36 para el useEffect que sincroniza el estado optimista con el server. La variable `serverTags` (derivada de `settings`) no esta en las dependencias del useCallback de `followTag`/`unfollowTag` de forma estable, lo que puede causar closures stale.
- `useVerificationBadges.ts` tiene 250 lineas con 3 computaciones de badges independientes (Local Guide, Verified Visitor, Trusted Reviewer) acopladas en un solo hook. Cada badge tiene su propia logica de calificacion y cache, lo que dificulta testeabilidad y reutilizacion individual.
- Ambos problemas fueron pre-existentes pero se agravaron con los features recientes que agregaron complejidad al hook de settings.

## Solucion

### S1. Resolver exhaustive-deps en useFollowedTags

Envolver `serverTags` en `useMemo` para estabilizar la referencia y poder incluirla en los dependency arrays de `followTag`/`unfollowTag` sin causar re-renders innecesarios. Eliminar el `eslint-disable` comment.

```typescript
const serverTags = useMemo(() => settings?.followedTags ?? [], [settings?.followedTags]);
```

Tambien revisar el useEffect de sincronizacion (linea 31-37) para que las dependencias sean explicitas sin suppress.

### S2. Splitear useVerificationBadges en 3 hooks

Extraer las 3 computaciones de badges en hooks dedicados:

- `useLocalGuideBadge(userId)` — calcula badge de guia local basado en cantidad de ratings y diversidad de comercios
- `useVerifiedVisitorBadge(userId)` — calcula badge de visitante verificado basado en check-ins
- `useTrustedReviewerBadge(userId)` — calcula badge de reviewer confiable basado en comentarios y likes recibidos

El hook `useVerificationBadges` se convierte en un orquestador que llama a los 3 y combina resultados, manteniendo la API publica intacta para los consumidores.

La cache en localStorage (`mm_verification_badges_{userId}` con TTL 24h, segun patterns.md) se mantiene en el orquestador, no en los sub-hooks.

### S3. Actualizar tests

Los tests existentes de `useFollowedTags.test.ts` y `useVerificationBadges.test.ts` se actualizan para cubrir los nuevos hooks y la eliminacion de suppressions.

---

## Scope

| Item | Prioridad | Esfuerzo |
|------|-----------|----------|
| S1: useMemo para serverTags + eliminar eslint-disable | Alta | S |
| S2: Extraer useLocalGuideBadge | Media | S |
| S2: Extraer useVerifiedVisitorBadge | Media | S |
| S2: Extraer useTrustedReviewerBadge | Media | S |
| S2: Refactorizar useVerificationBadges como orquestador | Media | S |
| S3: Actualizar tests de useFollowedTags | Alta | S |
| S3: Tests para los 3 nuevos hooks de badges | Media | M |

**Esfuerzo total estimado:** S

---

## Out of Scope

- Split de `converters.ts` (cubierto por #249)
- Agregar nuevos badges o tipos de verificacion
- Cambiar la logica de calificacion de badges
- Migrar cache de localStorage a otro mecanismo

---

## Tests

### Archivos que necesitaran tests

| Archivo | Tipo | Que testear |
|---------|------|-------------|
| `src/hooks/useFollowedTags.ts` | Hook | Verificar que no hay eslint-disable, que useMemo estabiliza serverTags, que followTag/unfollowTag usan tags frescos |
| `src/hooks/useLocalGuideBadge.ts` | Hook | Logica de calificacion, thresholds, edge cases (0 ratings, max ratings) |
| `src/hooks/useVerifiedVisitorBadge.ts` | Hook | Logica de check-ins, thresholds |
| `src/hooks/useTrustedReviewerBadge.ts` | Hook | Logica de comentarios + likes, thresholds |
| `src/hooks/useVerificationBadges.ts` | Hook | Orquestacion, cache localStorage, TTL 24h |

### Criterios de testing

- Cobertura >= 80% del codigo nuevo
- Tests de validacion para todos los inputs del usuario
- Todos los paths condicionales cubiertos
- Side effects verificados (cache, analytics, notifications)

---

## Seguridad

Este feature es un refactor interno sin nuevas superficies de ataque. No se agregan endpoints, escrituras a Firestore ni inputs de usuario.

- [ ] No se exponen datos adicionales al cliente
- [ ] No se agregan imports de Firebase SDK en componentes

### Vectores de ataque automatizado

No aplica. Este feature no agrega superficies nuevas.

---

## Deuda tecnica y seguridad

### Issues relacionados

| Issue | Relacion | Accion |
|-------|----------|--------|
| #249 converters.ts split | relacionado | Se complementan; #249 resuelve converters, este resuelve los otros 2 items |
| #168 Vite 8 + ESLint 10 | no afecta | Los eslint-disable removidos usan reglas de eslint-plugin-react-hooks actual |

### Mitigacion incorporada

- Eliminacion de `eslint-disable-next-line react-hooks/exhaustive-deps` en useFollowedTags (reduce suppressions del proyecto)
- Reduccion de useVerificationBadges de 250 a ~60 lineas como orquestador

---

## Offline

### Data flows

| Operacion | Tipo (read/write) | Estrategia offline | Fallback UI |
|-----------|-------------------|-------------------|-------------|
| useFollowedTags fetchSettings | read | Firestore persistent cache (ya existente) | Loading state existente |
| useVerificationBadges cache | read | localStorage cache con TTL 24h (ya existente) | Badges no visibles hasta cache |

### Checklist offline

- [x] Reads de Firestore: usan persistencia offline (ya existente)
- [x] Writes: useFollowedTags ya tiene optimistic UI con rollback
- [x] APIs externas: no hay
- [x] UI: no cambia
- [x] Datos criticos: badges cacheados en localStorage

### Esfuerzo offline adicional: Ninguno

---

## Modularizacion y % monolitico

### Checklist modularizacion

- [x] Logica de negocio en hooks/services (no inline en componentes de layout)
- [x] Componentes nuevos son reutilizables fuera del contexto actual de layout
- [x] No se agregan useState de logica de negocio a AppShell o SideMenu
- [x] Props explicitas en vez de dependencias implicitas a contextos de layout
- [x] Cada prop de accion tiene un handler real especificado
- [x] Ningun componente nuevo importa directamente de `firebase/firestore`
- [x] Archivos nuevos van en carpeta de dominio correcta (`src/hooks/`)
- [x] Si el feature necesita estado global, evaluar si un contexto existente lo cubre antes de crear uno nuevo
- [x] Ningun archivo nuevo supera 400 lineas

### Impacto en % monolitico

| Aspecto | Impacto | Justificacion |
|---------|---------|---------------|
| Acoplamiento de componentes | - | Separa 3 computaciones acopladas en hooks independientes |
| Estado global | = | No modifica contextos, usa hooks locales |
| Firebase coupling | = | No cambia imports de Firebase |
| Organizacion por dominio | = | Hooks en `src/hooks/` donde corresponde |

---

## Success Criteria

1. `useFollowedTags.ts` no tiene ningun `eslint-disable` comment
2. `useVerificationBadges.ts` queda por debajo de 100 lineas como orquestador
3. Los 3 nuevos hooks de badges tienen tests con >= 80% cobertura
4. No hay regresiones en el comportamiento de followed tags ni badges de verificacion
5. `npm run lint` pasa sin warnings nuevos de exhaustive-deps

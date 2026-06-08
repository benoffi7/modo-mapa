# Guard: Correctness (#341)

Regression-guard de correctitud para bugs de robustez de alto impacto detectados
en el `/health-check` 2026-06-08. A diferencia de la mayoría de los guards (que
cubren convenciones de estilo/arquitectura), éste cubre bugs concretos cuya
reaparición rompe la app en runtime.

## Contexto

- Issue: #341
- Detectado por: agente `pr-reviewer` durante `/health-check`
- Archivos: `src/context/AuthContext.tsx`, `src/services/userProfile.ts`

## Reglas

1. **`R1-authcontext-loading-finally` — loading infinito en arranque.**
   El callback de `onAuthStateChanged` en `AuthContext.tsx` hace
   `await fetchUserProfileDoc(uid)` en el camino crítico de autenticación. Si
   ese `getDoc` rechaza (regla de Firestore que deniega, red transitoria,
   offline en el primer arranque) y `setIsLoading(false)` no está en un
   `finally`, el callback lanza, nunca se baja el flag y la app **queda
   atascada en pantalla de carga permanente**.
   - **Invariante:** `setIsLoading(false)` debe ejecutarse en un bloque
     `finally` (o la lectura de perfil debe estar envuelta en try/catch que
     garantice el reset).
   - El agregado `fetchUserProfile` (`userProfile.ts`) ya envuelve su getDoc
     en `.catch(() => null)` — precisamente porque puede fallar. La ruta de
     auth crítica (`fetchUserProfileDoc`) debe tener la misma protección.

2. **`R2-updateUserAvatar-no-fallback` — updateDoc sin fallback de creación.**
   `updateUserAvatar` usa `updateDoc`, que lanza `not-found` si el user doc no
   existe todavía. Su gemelo `updateUserDisplayName` maneja el caso con un
   `setDoc(..., { merge: true })` / existence-check. `updateUserAvatar` debe
   seguir el mismo patrón para ser robusto si el avatar picker se abre antes de
   que exista el doc.
   - **Invariante:** `updateUserAvatar` usa `setDoc(..., { merge: true })` o un
     existence-check, no `updateDoc` pelado.

## Detección

```bash
# R1 — setIsLoading reseteado en finally
grep -q "} finally {" src/context/AuthContext.tsx \
  || echo "AuthContext.tsx: setIsLoading(false) no está en un finally"

# R2 — updateUserAvatar con fallback de creación
awk '/export async function updateUserAvatar/,/^}/' src/services/userProfile.ts \
  | grep -q "merge: true\|setDoc\|getDoc" \
  || echo "userProfile.ts: updateUserAvatar usa updateDoc sin fallback setDoc/merge"
```

Implementadas en `scripts/guards/checks.mjs` bajo el guard `312`.

## Acción esperada cuando falla el guard

1. **R1:** envolver la lectura de perfil del callback de `onAuthStateChanged`
   en `try/catch`, con `setIsLoading(false)` en un `finally`.
2. **R2:** cambiar `updateDoc` por `setDoc(ref, { avatarId }, { merge: true })`
   en `updateUserAvatar` (alinear con `updateUserDisplayName`).
3. Una vez corregido, el count baja a 0; re-lockear con
   `npm run guards:baseline`. A partir de ahí cualquier reaparición es
   regresión vs baseline 0.

## Relacionados

- Issue: #341
- Agente: `.claude/agents/pr-reviewer.md`
- Guard #304 (offline): las mutaciones de perfil sin feedback offline se
  cubren ahí.
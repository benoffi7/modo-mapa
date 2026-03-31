# Plan: Admin panels — migrate to service layer

**Specs:** [1-admin-service-layer-specs.md](1-admin-service-layer-specs.md)
**Fecha:** 2026-03-27

---

## Fases de implementacion

### Fase 1: Types and service layer

**Branch:** `refactor/admin-service-layer`

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/types/admin.ts` | Add `Special`, `AchievementCondition`, `Achievement` interfaces at the end of the file |
| 2 | `src/types/index.ts` | Re-export `Special`, `AchievementCondition`, `Achievement` from `./admin` |
| 3 | `src/services/specials.ts` | Create service with `fetchSpecials()`, `fetchActiveSpecials()`, `saveAllSpecials(specials)`, `deleteSpecial(id)`. Import `db` from `config/firebase`, `COLLECTIONS` from `config/collections`, `Special` type from `types`. Use `getDocs`, `setDoc`, `deleteDoc` from `firebase/firestore`. `saveAllSpecials` reads existing docs, deletes removed ones, upserts current ones with `updatedAt: new Date()`. |
| 4 | `src/services/achievements.ts` | Create service with `fetchAchievements()`, `saveAllAchievements(achievements)`, `deleteAchievement(id)`. Same pattern as specials service. |

### Fase 2: Migrate components

| Paso | Archivo | Cambio |
|------|---------|--------|
| 5 | `src/components/admin/SpecialsPanel.tsx` | Remove `firebase/firestore`, `db`, `COLLECTIONS` imports. Remove inline `Special` interface. Import `Special` from `../../types` and `{ fetchSpecials, saveAllSpecials }` from `../../services/specials`. Replace `load()` body: `const data = await fetchSpecials(); setSpecials(data);`. Replace `saveAll()` body: `await saveAllSpecials(specials); await load();`. |
| 6 | `src/components/admin/AchievementsPanel.tsx` | Remove `firebase/firestore`, `db`, `COLLECTIONS` imports. Remove inline `Achievement` and `AchievementCondition` interfaces. Import `Achievement` from `../../types` and `{ fetchAchievements, saveAllAchievements }` from `../../services/achievements`. Replace `load()` and `saveAll()` bodies with service calls. |
| 7 | `src/components/home/SpecialsSection.tsx` | Remove `firebase/firestore`, `db`, `COLLECTIONS` imports. Remove inline `Special` interface. Import `Special` from `../../types` and `{ fetchActiveSpecials }` from `../../services/specials`. Import `{ logger }` from `../../utils/logger`. Replace `useEffect` body: call `fetchActiveSpecials()` then `setSpecials(data)` if `data.length > 0`. Replace `console.warn(...)` with `logger.warn(...)`. |

### Fase 3: Tests

| Paso | Archivo | Cambio |
|------|---------|--------|
| 8 | `src/services/specials.test.ts` | Create test file. Mock `firebase/firestore`, `config/firebase`, `config/collections`. Test 8 cases: `fetchSpecials` returns mapped docs and handles empty, `fetchActiveSpecials` uses active filter and handles empty, `saveAllSpecials` deletes removed + upserts current + handles empty + sets updatedAt, `deleteSpecial` calls deleteDoc. |
| 9 | `src/services/achievements.test.ts` | Create test file. Same mock pattern. Test 6 cases: `fetchAchievements` returns mapped docs and handles empty, `saveAllAchievements` deletes removed + upserts current + handles empty + sets updatedAt, `deleteAchievement` calls deleteDoc. |

### Fase 4: Lint, verify, commit

| Paso | Archivo | Cambio |
|------|---------|--------|
| 10 | N/A | Run `npx eslint src/services/specials.ts src/services/achievements.ts src/components/admin/SpecialsPanel.tsx src/components/admin/AchievementsPanel.tsx src/components/home/SpecialsSection.tsx` -- fix any lint errors |
| 11 | N/A | Run `npx vitest run src/services/specials.test.ts src/services/achievements.test.ts` -- verify all tests pass |
| 12 | N/A | Run `npx tsc --noEmit` -- verify no type errors |
| 13 | N/A | Verify no component in `src/components/` imports `firebase/firestore` for writes: `grep -r "from 'firebase/firestore'" src/components/ \| grep -v node_modules` should return zero results for `setDoc`, `deleteDoc`, `updateDoc` in the three modified files |
| 14 | N/A | Commit: `refactor: migrate admin panels to service layer (specials + achievements)` |

---

## Orden de implementacion

1. `src/types/admin.ts` -- types must exist before services reference them
2. `src/types/index.ts` -- re-exports for clean imports
3. `src/services/specials.ts` -- service must exist before component migration
4. `src/services/achievements.ts` -- service must exist before component migration
5. `src/components/admin/SpecialsPanel.tsx` -- depends on specials service
6. `src/components/admin/AchievementsPanel.tsx` -- depends on achievements service
7. `src/components/home/SpecialsSection.tsx` -- depends on specials service
8. `src/services/specials.test.ts` -- tests for specials service
9. `src/services/achievements.test.ts` -- tests for achievements service
10. Lint + type check + test run
11. Commit

## Riesgos

1. **`saveAllSpecials` diff logic regression**: The delete-then-upsert logic in `saveAll` is subtle (read existing, compute diff, delete removed, upsert remaining). Mitigation: the test suite explicitly covers the diff scenario with mock data.

2. **SpecialsSection fallback behavior change**: Currently the catch block uses `console.warn`. Changing to `logger.warn` is cosmetically different in dev (same output) but correct in prod (silenced). Mitigation: the fallback specials remain displayed regardless -- only the log call changes.

3. **Missing import after migration**: If a component still imports from `firebase/firestore` after refactoring, the whole point of the migration is missed. Mitigation: Step 13 explicitly greps for stale imports as a verification gate before commit.

## Criterios de done

- [ ] All items from PRD scope implemented
- [ ] No component in `src/components/` imports `firebase/firestore` for writes to specials/achievements
- [ ] `Special` and `Achievement` types centralized in `src/types/admin.ts`
- [ ] `src/services/specials.ts` and `src/services/achievements.ts` exist with full CRUD
- [ ] Tests pass with >= 80% coverage on new service code
- [ ] No lint errors
- [ ] Build succeeds (`npx tsc --noEmit`)
- [ ] `console.warn` in SpecialsSection replaced with `logger.warn`

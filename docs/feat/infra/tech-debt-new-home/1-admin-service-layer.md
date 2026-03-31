# PRD: Admin panels — migrate to service layer

**Issue:** #206 item 1
**Priority:** Medium
**Effort:** Small (1-2h)

## Problema

`SpecialsPanel.tsx` y `AchievementsPanel.tsx` importan `firebase/firestore` directamente y hacen `setDoc`, `deleteDoc`, `getDocs` inline. Esto viola el patron del proyecto donde componentes llaman `src/services/` para CRUD y nunca importan Firestore directo para escrituras.

## Archivos afectados

- `src/components/admin/SpecialsPanel.tsx`
- `src/components/admin/AchievementsPanel.tsx`
- `src/components/home/SpecialsSection.tsx` (lectura)

## Solucion propuesta

1. Crear `src/services/specials.ts` con funciones: `fetchSpecials()`, `saveSpecials(specials[])`, `deleteSpecial(id)`
2. Crear `src/services/achievements.ts` con funciones analogas
3. Migrar los 3 componentes a usar los servicios
4. Los servicios usan `COLLECTIONS.SPECIALS` / `COLLECTIONS.ACHIEVEMENTS`

## Criterios de aceptacion

- [ ] Ningun componente en `src/components/` importa `firebase/firestore` para escrituras
- [ ] Tests unitarios para los nuevos servicios
- [ ] Funcionalidad identica en admin y home

## Seguridad

Sin cambios — las Firestore rules ya existen para ambas colecciones.

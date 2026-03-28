# PRD: Extract shared achievement definitions

**Issue:** #206 item 2
**Priority:** Low
**Effort:** Small (<1h)

## Problema

`AchievementsGrid.tsx` y `AchievementsSection.tsx` definen arrays identicos de achievements hardcodeados (label, description, icon, condition). Si se agrega un logro en uno y no en el otro, la UI se desincroniza.

## Archivos afectados

- `src/components/profile/AchievementsGrid.tsx`
- `src/components/profile/AchievementsSection.tsx`

## Solucion propuesta

1. Crear `src/constants/achievements.ts` con el array compartido
2. Ambos componentes importan desde ahi
3. Si en el futuro los achievements vienen de Firestore (collection `achievements`), la constante sirve como fallback

## Criterios de aceptacion

- [ ] Un solo source of truth para las definiciones
- [ ] Ambos componentes renderizan igual que antes

# Specs: Extract shared achievement definitions

**PRD:** [2-achievements-constants.md](2-achievements-constants.md)
**Fecha:** 2026-03-27

---

## Modelo de datos

No hay cambios en Firestore. Este refactor es puramente frontend: extraer definiciones hardcodeadas a un modulo compartido.

### Nuevo tipo

```typescript
// src/constants/achievements.ts

/** Definicion estatica de un achievement (sin progreso del usuario) */
export interface AchievementDefinition {
  id: string;
  label: string;
  description: string;
  /** MUI icon component name — se instancia en el componente consumidor */
  icon: string;
  /** MUI icon color prop */
  iconColor: 'success' | 'info' | 'warning' | 'secondary' | 'primary' | 'action' | 'error';
  target: number;
}
```

Nota: los iconos se almacenan como strings (`'ExploreOutlined'`, `'PeopleOutlined'`, etc.) en la constante. Cada componente consumidor mantiene un map local `ACHIEVEMENT_ICONS: Record<string, React.ComponentType<SvgIconProps>>` para instanciar el icono correcto. Esto evita que el modulo de constantes importe componentes de React/MUI, manteniendo el patron de `src/constants/` (solo datos puros, sin dependencias de framework). Ambos componentes ya importan estos iconos, asi que el map es un refactor local sin nuevas dependencias.

## Firestore Rules

Sin cambios.

### Rules impact analysis

No hay queries nuevas. Este cambio no toca servicios ni Firestore.

## Cloud Functions

Sin cambios.

## Componentes

### `AchievementsGrid` (modificacion)

- **Archivo:** `src/components/profile/AchievementsGrid.tsx`
- **Cambio:** Reemplazar el array `achievements` hardcodeado por import de `ACHIEVEMENT_DEFINITIONS` desde `src/constants/achievements.ts`. Mantener el map local `ACHIEVEMENT_ICONS` para resolver icon strings a componentes React. Construir el array de `Achievement` (con `current` computado) en el cuerpo del componente usando `ACHIEVEMENT_DEFINITIONS.map(...)`.
- **Interfaz `Achievement` local:** Se mantiene como tipo local (agrega `current` a `AchievementDefinition`). No se exporta porque incluye `icon: React.ReactElement` (instanciado).

### `AchievementsSection` (modificacion)

- **Archivo:** `src/components/profile/AchievementsSection.tsx`
- **Cambio:** Mismo patron que `AchievementsGrid`. Importa `ACHIEVEMENT_DEFINITIONS`, usa `ACHIEVEMENT_ICONS` map local, construye achievements con progreso. `AchievementsSection` solo muestra los primeros 4 (ya lo hace hoy tomando los primeros 4 del array hardcodeado). Se cambia a `ACHIEVEMENT_DEFINITIONS.slice(0, 4)` para mantener el mismo comportamiento.

## Hooks

Sin cambios.

## Servicios

Sin cambios.

## Integracion

| Componente | Cambio |
|-----------|--------|
| `AchievementsGrid.tsx` | Import `ACHIEVEMENT_DEFINITIONS` + `AchievementDefinition` type. Eliminar array hardcodeado. Agregar `ACHIEVEMENT_ICONS` map. |
| `AchievementsSection.tsx` | Import `ACHIEVEMENT_DEFINITIONS` + `AchievementDefinition` type. Eliminar array hardcodeado. Agregar `ACHIEVEMENT_ICONS` map. |
| `src/constants/index.ts` | Agregar `export * from './achievements';` al barrel. |

## Tests

Este cambio cae en la excepcion de testing: "Constantes sin logica" no requieren tests unitarios (ver `docs/reference/tests.md`, seccion Excepciones). El modulo `achievements.ts` solo exporta un array de objetos literales y una interfaz.

**Verificacion manual:** ambos componentes deben renderizar exactamente igual que antes. Se valida visualmente en dev.

| Archivo test | Que testear | Tipo |
|-------------|-------------|------|
| N/A | Constantes sin logica — exento | N/A |

## Analytics

Sin cambios.

---

## Offline

Sin impacto. Las definiciones son constantes en bundle, no dependen de red.

### Cache strategy

| Dato | Estrategia | TTL | Storage |
|------|-----------|-----|---------|
| Achievement definitions | Bundle estatico | N/A | JS bundle |

### Writes offline

N/A

### Fallback UI

N/A

---

## Decisiones tecnicas

1. **Iconos como strings, no como JSX en constantes.** El patron del proyecto requiere que `src/constants/` no importe React ni MUI (solo datos puros, compatible con `import type`). Seguimos el mismo patron que `src/constants/badges.ts` que usa emoji strings para iconos. Cada componente consumidor resuelve el string a un componente React via un map local. Alternativa descartada: exportar JSX directamente desde constantes (rompe la convencion y dificulta re-uso en contextos no-React).

2. **No se crea tipo en `src/types/`.** `AchievementDefinition` se exporta desde `src/constants/achievements.ts` directamente. Es un tipo acoplado a la constante, no un tipo de dominio compartido. Si en el futuro los achievements vienen de Firestore, se movera a `src/types/` en ese momento.

3. **`AchievementsSection` sigue mostrando 4 items.** Se usa `slice(0, 4)` sobre `ACHIEVEMENT_DEFINITIONS` en vez del array inline de 4 elementos. Si se agregan achievements, la seccion resumen sigue mostrando solo los primeros 4 (consistente con el layout de cards horizontales).

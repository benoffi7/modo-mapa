# PRD: Onboarding gamificado — Primeros pasos

**Feature:** onboarding-gamificado
**Categoria:** ux
**Fecha:** 2026-03-16
**Issue:** #145
**Prioridad:** Baja

---

## Contexto

Más allá del tour interactivo (#144) y las sugerencias contextuales (#134), se busca motivar a los nuevos usuarios con un sistema de gamificación que premie las primeras acciones en la plataforma.

## Problema

- Los usuarios nuevos no tienen incentivo claro para completar acciones clave.
- Sin motivación, muchos usuarios hacen una o dos acciones y abandonan.
- No hay sentido de progreso o logro para usuarios nuevos.

## Solución

### S1: Checklist de primeros pasos

- Widget en el menú lateral o home que muestra progreso del onboarding.
- Tareas:
  1. "Calificá tu primer comercio" ⭐
  2. "Agregá un tag a un comercio" 🏷️
  3. "Dejá un comentario" 💬
  4. "Guardá un favorito" ❤️
  5. "Explorá tu primer ranking" 🏆

### S2: Reward visual

- Animación de celebración al completar cada tarea (confetti, checkmark animado).
- Badge "Explorador" al completar todas las tareas.
- El badge se muestra en el perfil del usuario.

### S3: Persistencia

- Progreso guardado en Firestore (`userProfile.onboardingProgress`).
- El checklist desaparece después de completar todas las tareas.
- Opción de dismissear antes de completar ("No me interesa").

---

## Scope

| Item | Prioridad | Esfuerzo |
|------|-----------|----------|
| Widget checklist con 5 tareas | Alta | M |
| Detección automática de tarea completada | Alta | M |
| Animación de reward por tarea | Media | S |
| Badge "Explorador" en perfil | Baja | S |
| Persistencia en Firestore | Alta | S |
| Opción de dismiss | Media | XS |

**Esfuerzo total estimado:** M-L

---

## Out of Scope

- Sistema de badges/logros extendido más allá del onboarding.
- Puntos o niveles de usuario.
- Leaderboard de onboarding.
- Rewards reales (cupones, descuentos).

---

## Success Criteria

1. El checklist muestra las 5 tareas con estado actual.
2. Cada tarea se marca automáticamente al completarse.
3. Animación de celebración visible al completar una tarea.
4. El badge "Explorador" se otorga al completar todas.
5. El widget desaparece post-completado o si el usuario lo dismissea.

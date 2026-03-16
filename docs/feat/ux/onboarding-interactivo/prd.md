# PRD: Onboarding interactivo

**Feature:** onboarding-interactivo
**Categoria:** ux
**Fecha:** 2026-03-16
**Issue:** #144
**Prioridad:** Media

---

## Contexto

La Help Section (#79) proporciona documentación estática sobre cómo usar la app. Sin embargo, falta un onboarding interactivo que guíe paso a paso a los nuevos usuarios a través de las funcionalidades principales.

## Problema

- Los usuarios nuevos deben descubrir funcionalidades por su cuenta.
- La Help Section requiere navegación activa; pocos usuarios la visitan proactivamente.
- Sin guía, el time-to-first-action es alto y muchos usuarios no completan acciones clave.
- Las sugerencias contextuales (#134) cubren tooltips puntuales pero no un flujo completo.

## Solución

### S1: Tour interactivo

- Al primer login, ofrecer un tour interactivo opcional ("¿Querés un tour rápido?").
- Highlight secuencial de elementos clave con tooltips explicativos:
  1. Mapa: "Acá ves los comercios cercanos"
  2. Marker: "Tocá un comercio para ver detalles"
  3. BusinessSheet: "Calificá, comentá o guardá en favoritos"
  4. Menú lateral: "Accedé a tus favoritos, comentarios y más"

### S2: Paso a paso con overlay

- Overlay semitransparente que resalta el elemento actual.
- Botones "Siguiente" / "Saltar tour".
- Progreso visual (1/4, 2/4, etc.).

### S3: Poder relanzar

- Opción en Settings para volver a ver el tour.
- Flag `onboardingCompleted` en localStorage.

---

## Scope

| Item | Prioridad | Esfuerzo |
|------|-----------|----------|
| Componente Tour con overlay y highlights | Alta | M |
| 4 pasos del tour con tooltips | Alta | S |
| Trigger al primer login | Alta | XS |
| Botón "Repetir tour" en Settings | Media | XS |
| Progreso visual (step indicator) | Media | XS |

**Esfuerzo total estimado:** M

---

## Out of Scope

- Tour para funcionalidades avanzadas (admin, tags custom).
- Tour adaptativo según el comportamiento del usuario.
- Video tutorial embebido.
- A/B testing del onboarding.

---

## Success Criteria

1. El tour se ofrece automáticamente al primer login.
2. El usuario puede completar el tour o saltarlo.
3. Los 4 elementos clave se explican de forma clara y breve.
4. El tour se puede relanzar desde Settings.
5. El overlay no bloquea la navegación si el usuario quiere explorar por su cuenta.

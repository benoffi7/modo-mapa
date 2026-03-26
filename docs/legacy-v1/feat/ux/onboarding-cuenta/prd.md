# PRD — Onboarding de cuenta: beneficios de verificar email

**Feature:** onboarding-cuenta
**Categoria:** ux
**Fecha:** 2026-03-19
**Issue:** [#157](https://github.com/benoffi7/modo-mapa/issues/157)
**Prioridad:** Media
**Milestone:** v2.19.0 (14 abr – 20 abr)

---

## Contexto

La app auto-crea una cuenta anónima vía `signInAnonymously` para cada visitante nuevo. El upgrade a email se hace con `linkWithCredential` (preserva UID y datos). Sin embargo, la tasa de conversión anónimo → email es baja porque los únicos puntos de contacto están enterrados en el SideMenu header y SettingsPanel.

### Estado actual del flujo de conversión

| Touchpoint | Ubicación | Visible para anónimos |
|---|---|---|
| Botón "Crear cuenta" | SideMenu header | Sí — solo al abrir el menú |
| Botón "Ya tengo cuenta" | SideMenu header | Sí — solo al abrir el menú |
| EmailPasswordDialog en Settings | SettingsPanel | Sí — requiere navegar a Settings |
| OnboardingChecklist | SideMenu (post-registro) | No — solo para usuarios registrados |

**Gaps identificados:**

- No hay ningún indicador en el mapa principal (donde el usuario pasa el 90% del tiempo) que motive la creación de cuenta.
- No se explican los beneficios de tener cuenta antes de mostrar el formulario de registro.
- No hay recordatorio después de uso prolongado como anónimo.
- El nudge de verificación de email es solo un ícono de warning en el header, sin CTA clara.
- No hay eventos de analytics para medir exposición/click en los CTAs de conversión.

### Componentes existentes relevantes

| Componente | Archivo | Rol |
|---|---|---|
| `AuthContext` | `src/context/AuthContext.tsx` | Maneja auth state, `linkEmailPassword`, `emailVerified` |
| `EmailPasswordDialog` | `src/components/auth/EmailPasswordDialog.tsx` | Dialog de registro/login con tabs |
| `SideMenu` | `src/components/layout/SideMenu.tsx` | Menú lateral con header de usuario |
| `OnboardingChecklist` | `src/components/menu/OnboardingChecklist.tsx` | Checklist post-registro (5 tareas) |
| `emailAuth` service | `src/services/emailAuth.ts` | `sendEmailVerification`, `resendVerification` |

---

## Problema

1. Los usuarios anónimos no saben que pueden perder sus datos (ratings, comentarios, favoritos) al cambiar de dispositivo o limpiar el navegador.
2. No hay incentivo visual en la pantalla principal para crear cuenta.
3. No hay explicación de beneficios antes del formulario de registro.
4. No hay recordatorio después de un uso prolongado como anónimo.
5. El estado "email no verificado" no tiene un CTA claro — solo un ícono que el usuario puede ignorar.

---

## Solución

### S1: Banner motivacional en el mapa

**Qué:** Un banner/snackbar no-intrusivo en la parte inferior del mapa para usuarios anónimos.

**Texto:** "Creá tu cuenta para no perder tus datos" con CTA "Crear cuenta".

**Comportamiento:**
- Aparece después de la primera interacción significativa (primer rating, favorito, o comentario).
- Dismisseable con X → `localStorage` flag `onboarding_banner_dismissed`.
- El CTA abre `EmailPasswordDialog` en tab "Crear cuenta".
- Si el usuario ya dismissió, no vuelve a aparecer nunca.

**Ubicación en UI:** Snackbar-like, posicionado arriba del FAB de ubicación, con `z-index` apropiado para no tapar el mapa.

### S2: Pantalla de beneficios pre-registro

**Qué:** Dialog intermedio que se muestra antes del `EmailPasswordDialog` cuando un anónimo toca "Crear cuenta" (desde cualquier punto de entrada).

**Contenido (lista con íconos):**
- Sincronizá tus datos entre dispositivos
- Participá en rankings y listas colaborativas
- Tu perfil público con tus reseñas
- Tus favoritos siempre disponibles

**Comportamiento:**
- Botón "Continuar" → abre `EmailPasswordDialog` en tab register.
- Botón "Ahora no" → cierra el dialog.
- Se muestra solo la primera vez. Flag: `localStorage` `benefits_screen_shown`.
- Después de la primera vez, "Crear cuenta" va directo al `EmailPasswordDialog`.

### S3: Recordatorio suave post-actividad

**Qué:** Toast/snackbar que aparece después de N acciones como anónimo.

**Trigger:** Después de 5 ratings sin cuenta (configurable, basado en `profile.stats.ratings` del usuario anónimo o un counter en `localStorage`).

**Texto:** "¿Querés guardar tu progreso? Creá una cuenta" con link accionable.

**Comportamiento:**
- Se muestra una sola vez. Flag: `localStorage` `activity_reminder_shown`.
- El link abre el flujo de creación de cuenta (S2 → EmailPasswordDialog).
- No se muestra si el banner (S1) no fue dismisseado aún (evitar doble nudge).

### S4: Nudge de verificación post-registro

**Qué:** Card en el SideMenu para usuarios con email no verificado.

**Texto:** "Verificá tu email para obtener el badge de verificado" con beneficios: más confianza en la comunidad, perfil completo.

**Comportamiento:**
- Aparece debajo del header del SideMenu, arriba del `OnboardingChecklist`.
- Botón "Re-enviar email" → llama a `resendVerification()` del AuthContext.
- Botón "Ya verifiqué" → llama a `refreshEmailVerified()`. Si verificado, muestra toast de éxito y desaparece.
- Dismisseable con X → `localStorage` flag. Vuelve a aparecer en la próxima sesión si sigue sin verificar.

---

## Requisitos funcionales

| ID | Requisito | Prioridad | Solución |
|----|-----------|-----------|----------|
| RF-1 | Banner motivacional para anónimos en la pantalla principal del mapa | Alta | S1 |
| RF-2 | Dialog de beneficios pre-registro que explique ventajas de crear cuenta | Media | S2 |
| RF-3 | Recordatorio después de N ratings como anónimo | Media | S3 |
| RF-4 | Card de nudge para verificación de email en SideMenu | Baja | S4 |
| RF-5 | Todos los CTAs de conversión deben trackear eventos de analytics | Alta | Transversal |
| RF-6 | Todos los dismissals deben persistir en localStorage | Alta | Transversal |

---

## Requisitos no funcionales

- Los componentes nuevos deben ser lazy-loaded (no impactar bundle del mapa inicial).
- Los banners/snackbars no deben tapar controles críticos del mapa (zoom, ubicación, filtros).
- El diseño debe funcionar en mobile (< 400px) y desktop.
- Los textos deben ser concisos y no agresivos (tono informativo, no urgente).
- Dark mode: usar tokens de tema MUI, nunca colores hardcodeados.

---

## Analytics events nuevos

| Evento | Trigger | Props |
|--------|---------|-------|
| `onboarding_banner_shown` | Banner S1 se renderiza | — |
| `onboarding_banner_clicked` | CTA del banner S1 | — |
| `onboarding_banner_dismissed` | X del banner S1 | — |
| `benefits_screen_shown` | Dialog S2 se abre | `{ source: 'banner' \| 'menu' \| 'settings' }` |
| `benefits_screen_continue` | "Continuar" en S2 | — |
| `activity_reminder_shown` | Toast S3 se muestra | `{ ratings_count: number }` |
| `activity_reminder_clicked` | Link del toast S3 | — |
| `verification_nudge_shown` | Card S4 se renderiza | — |
| `verification_nudge_resend` | "Re-enviar email" en S4 | — |
| `verification_nudge_dismissed` | X del card S4 | — |

---

## Plan de implementación por fases

### Fase 1 — Banner motivacional (S1) + Analytics base

**Scope:** Componente nuevo + wiring de analytics

| Tarea | Detalle |
|-------|---------|
| Crear `OnboardingBanner.tsx` | Snackbar-like con CTA, dismiss logic, localStorage |
| Integrar en `MapView` o layout principal | Renderizar condicionalmente para anónimos |
| Eventos de analytics | `onboarding_banner_shown/clicked/dismissed` |

### Fase 2 — Pantalla de beneficios (S2)

**Scope:** Dialog nuevo + interceptar flujo existente

| Tarea | Detalle |
|-------|---------|
| Crear `BenefitsDialog.tsx` | Dialog con lista de beneficios, botones Continuar/Ahora no |
| Interceptar apertura de `EmailPasswordDialog` | Si es anónimo y no vio S2 → mostrar S2 primero |
| Eventos de analytics | `benefits_screen_shown/continue` |

### Fase 3 — Recordatorio post-actividad (S3)

**Scope:** Lógica de conteo + toast

| Tarea | Detalle |
|-------|---------|
| Counter de acciones anónimas | Incrementar en localStorage después de cada rating |
| Toast con CTA | Mostrar después de threshold, una sola vez |
| No-overlap con S1 | No mostrar si S1 sigue visible |
| Eventos de analytics | `activity_reminder_shown/clicked` |

### Fase 4 — Nudge de verificación (S4)

**Scope:** Card en SideMenu

| Tarea | Detalle |
|-------|---------|
| Crear `VerificationNudge.tsx` | Card con botones re-enviar y "ya verifiqué" |
| Integrar en `SideMenu` | Debajo del header, arriba de OnboardingChecklist |
| Eventos de analytics | `verification_nudge_shown/resend/dismissed` |

---

## Scope

| Item | Prioridad | Esfuerzo |
|------|-----------|----------|
| S1: Banner motivacional en mapa | Alta | S |
| S2: Pantalla de beneficios pre-registro | Media | S |
| S3: Recordatorio post-actividad (toast) | Media | S |
| S4: Nudge de verificación post-registro | Baja | XS |
| Analytics events (transversal) | Alta | S |

**Esfuerzo total estimado:** M

---

## Fuera de scope

- Incentivos monetarios o gamificados por crear cuenta.
- Push notifications para recordar crear cuenta.
- A/B testing de mensajes de conversión.
- Forzar creación de cuenta para usar funcionalidades (la app sigue siendo 100% usable como anónimo).
- Cambios en el flujo de Google sign-in (solo admin).
- Nuevas features gated behind email verification.

---

## Tests

| Archivo / Componente | Qué testear | Cobertura target |
|---|---|---|
| `OnboardingBanner.tsx` | Render condicional (anónimo vs registrado), dismiss persiste en localStorage, CTA abre dialog, no se muestra si dismissed | ≥ 80% |
| `BenefitsDialog.tsx` | Render correcto de beneficios, "Continuar" abre EmailPasswordDialog, "Ahora no" cierra, no se muestra la segunda vez | ≥ 80% |
| Lógica de reminder (S3) | Counter incrementa, toast aparece en threshold, no aparece si ya se mostró, no overlap con S1 | ≥ 80% |
| `VerificationNudge.tsx` | Render para unverified, "Re-enviar" llama resendVerification, "Ya verifiqué" llama refreshEmailVerified, dismiss funciona | ≥ 80% |
| Analytics events | Cada evento se dispara en el momento correcto con las props esperadas | ≥ 80% |

```bash
# Validar cobertura
npm run test -- --coverage --collectCoverageFrom='src/components/onboarding/**'
```

---

## Criterios de aceptación

- [ ] Usuarios anónimos ven un banner en el mapa después de su primera interacción.
- [ ] El banner se puede cerrar y no vuelve a aparecer.
- [ ] Al tocar "Crear cuenta" (desde cualquier punto), se muestra la pantalla de beneficios antes del formulario.
- [ ] Después de 5 ratings como anónimo, aparece un recordatorio suave (una sola vez).
- [ ] Usuarios con email no verificado ven un card en el SideMenu con CTA para verificar.
- [ ] Todos los nuevos CTAs trackean eventos de analytics.
- [ ] Los componentes nuevos funcionan en mobile y desktop.
- [ ] Dark mode: no hay colores hardcodeados.
- [ ] Tests con ≥ 80% cobertura para todos los componentes nuevos.
- [ ] Aumento medible en tasa de conversión anónimo → email (trackeable vía analytics).

---

## Riesgos

| Riesgo | Mitigación |
|--------|-----------|
| Banner percibido como spam / molesto | Hacerlo dismisseable de un toque, no volver a mostrar, tono informativo |
| Múltiples nudges simultáneos (S1 + S3) | Lógica explícita: S3 no se muestra si S1 sigue visible |
| Pantalla de beneficios (S2) agrega fricción al registro | Flag localStorage: solo se muestra la primera vez, después va directo |
| Nuevos analytics events no llegan a GA4 | Validar con GA4 DebugView en staging antes de merge |
| Layout roto en mobile con banner + FAB | Testear en viewport 360px, posicionar con spacing adecuado |

---

## Para el review

- [ ] El problema está bien definido?
- [ ] La solución propuesta tiene sentido?
- [ ] El scope es correcto? (algo sobra o falta?)
- [ ] Las prioridades están bien?
- [ ] Algún concern de seguridad?
- [ ] Los analytics events cubren lo necesario para medir conversión?

# PRD: Onboarding de cuenta — beneficios de verificar email

**Feature:** onboarding-cuenta
**Categoria:** ux
**Fecha:** 2026-03-17
**Issue:** [#157](https://github.com/benoffi7/modo-mapa/issues/157)
**Prioridad:** Media

---

## Contexto

Muchos usuarios se quedan con cuenta anónima porque no entienden los beneficios de crear una cuenta con email. La tasa de conversión anónimo → email es baja y los datos se pierden al cambiar de dispositivo.

## Problema

- Los usuarios anónimos no saben que pueden perder sus datos (ratings, comentarios, favoritos).
- No hay incentivo visual para crear cuenta ni para verificar el email.
- No hay recordatorio después de un uso prolongado con cuenta anónima.

## Solución

### S1: Banner motivacional en menú lateral

- Para usuarios anónimos: card/banner en el SideMenu: "Creá tu cuenta para no perder tus datos".
- CTA que abre el EmailPasswordDialog directamente.
- Dismisseable con X (localStorage flag para no mostrar de nuevo).

### S2: Pantalla de beneficios

- Al tocar "Crear cuenta" (sea desde el banner o el botón existente), mostrar pantalla intermedia con beneficios:
  - Sincronizar datos entre dispositivos
  - Participar en rankings
  - Recibir notificaciones
  - Perfil público
- Botón "Continuar" lleva al EmailPasswordDialog.

### S3: Recordatorio suave post-actividad

- Después de N acciones (configurable, default 5 ratings) sin cuenta, mostrar toast: "¿Querés guardar tu progreso? Creá una cuenta".
- Se muestra una sola vez (localStorage flag).
- Accionable: link que abre el flujo de creación de cuenta.

### S4: Nudge de verificación post-registro

- Después de crear cuenta con email, mostrar card en SideMenu: "Verificá tu email para obtener el badge".
- Explicar beneficios: badge verificado, más confianza en la comunidad.
- Dismisseable después de verificar.

---

## Scope

| Item | Prioridad | Esfuerzo |
|------|-----------|----------|
| Banner motivacional en SideMenu | Alta | S |
| Pantalla de beneficios pre-registro | Media | S |
| Recordatorio post-actividad (toast) | Media | S |
| Nudge de verificación post-registro | Baja | XS |

**Esfuerzo total estimado:** S-M

---

## Out of Scope

- Incentivos monetarios o gamificados por crear cuenta.
- Push notifications para recordar crear cuenta.
- A/B testing de mensajes.
- Forzar creación de cuenta para usar funcionalidades.

---

## Success Criteria

1. Los usuarios anónimos ven un banner claro en el menú lateral incentivando la creación de cuenta.
2. La pantalla de beneficios se muestra antes del formulario de registro.
3. Después de 5 ratings sin cuenta, aparece un recordatorio suave.
4. Después del registro, hay un nudge para verificar el email.
5. Aumento medible en tasa de conversión anónimo → email (trackear con analytics).

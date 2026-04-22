# PRD: Tech debt — Privacy policy drift (Sentry + Google Maps + analytics events)

**Feature:** 308-privacy-policy-drift
**Categoria:** security
**Fecha:** 2026-04-18
**Issue:** #308
**Prioridad:** Media

---

## Contexto

El componente `src/components/profile/PrivacyPolicy.tsx` (fechado "abril 2026") describe qué datos recopila Modo Mapa y con quién se comparten, pero quedó desfasado respecto al código real. El `/health-check` del 2026-04-18 detectó que Sentry (cargado desde `src/config/sentry.ts` vía `main.tsx` en producción) y los proveedores de tiles de Google Maps (que reciben IP + viewport al renderizar el mapa) no están listados en la sección "Compartición con terceros". Además, la lista de eventos de analytics y de claves de localStorage enumeradas explícitamente quedó corta frente a los features agregados en los últimos sprints (verification badges, force update, perf vitals, digest, rating prompt, follow tags, interests, trending cerca tuyo, quick actions y admin events), y la colección `abuseLogs` no figura en la sección de almacenamiento.

## Problema

- **Riesgo legal/de compliance**: la política no declara a Sentry como procesador de datos aunque recibe stack traces + app version + URL/UID contextual en producción.
- **Riesgo de transparencia**: los tile providers de Google Maps reciben IP + coordenadas de viewport y no están declarados como terceros.
- **Drift estructural**: la enumeración exhaustiva de eventos de analytics y keys de localStorage obliga a editar la política cada vez que se agrega un feature, y hoy omite `verification_badge_*`, `force_update_*`, `perf_vitals_captured`, `digest_*`, `rating_prompt_*`, `tag_followed/unfollowed`, `interests_*`, `trending_near_*`, `trending_business_clicked`, `quick_actions_*`, `admin_*` y una docena de keys de onboarding/UI.
- **Datos de admin no declarados**: `abuseLogs` (logs de rate limit / contenido flaggeado por UID) no aparece en la sección Firestore.

## Solucion

### S1 — Agregar Sentry a "Compartición con terceros"

Sumar un párrafo en la sección `Compartición con terceros` (`PrivacyPolicy.tsx:208-221`) explicando que, si ocurre un error en la app, se envía información técnica del incidente (stack trace, versión de la app, URL afectada, UID) a Sentry con el único fin de diagnosticar y corregir fallos. Tono consistente con el resto del documento (voseo, "tu identidad", frases cortas).

### S2 — Agregar proveedores de mapas a "Compartición con terceros"

Agregar bullet indicando que al renderizar el mapa el navegador solicita tiles a Google Maps/OpenStreetMap, lo que implica compartir IP y coordenadas del viewport con dichos proveedores (política de privacidad de cada servicio). Esto es inherente al uso del mapa y no está bajo control de la app.

### S3 — Reformular enumeración exhaustiva a lenguaje no-exhaustivo

Para evitar drift crónico:

1. En la sección "Datos de uso" (`PrivacyPolicy.tsx:110-127`), reemplazar el listado largo por una descripción por dominios (navegación, interacciones con comercios, social, onboarding, performance, administración) terminando en "entre otros eventos de uso". Mantener mención explícita al UID y a la propiedad `auth_type`.
2. En la sección "localStorage" (`PrivacyPolicy.tsx:154-163`), reemplazar la lista cerrada por descripción de categorías: preferencias de tema, cola de visitas recientes, flags de onboarding y UI, estado de tutoriales, contadores de rate-limit client-side, cache de verificación, email recordado. Mantener la afirmación clave: "no se envían a ningún servidor" y "podés borrarlos desde la configuración del navegador".

### S4 — Agregar `abuseLogs` al detalle de Firestore

Agregar bullet en la sección "Almacenamiento" > Cloud Firestore mencionando que, cuando se exceden límites de uso o se flaggea contenido, se registra un log administrativo con el UID, tipo de evento y timestamp, accesible sólo por administradores (sin contenido del usuario).

### S5 — Actualizar fecha y alinear con `currentDate`

Cambiar `Última actualización: abril 2026` a la fecha actual (2026-04-18) y dejar el formato "abril 2026" consistente con el mes en curso. En el mismo cambio, revisar que "Eliminar tu contenido" (`:232-237`) siga listando todos los tipos que el usuario puede borrar (check-ins, listas, etc.) — ya alineado post-audit.

### UX / dónde vive

- `PrivacyPolicy.tsx` se renderiza desde el tab Perfil (SettingsPanel) — ver [features.md](../../../reference/features.md) sección Menu lateral > Configuración / Ayuda.
- El componente es solo-texto (JSX estático). No hay lógica que testear. La interacción ya existe (scroll + back) y no cambia.

### Consideración clave

Este es un cambio **puramente documental** en un componente React estático. No toca Firestore rules, ni servicios, ni hooks. La auditoría de "no romper" se reduce a: markdownlint del bundle y que el componente siga compilando con `exactOptionalPropertyTypes`.

---

## Scope

| Item | Prioridad | Esfuerzo |
|------|-----------|----------|
| S1 — Bullet Sentry en "Compartición con terceros" | Alta | XS |
| S2 — Bullet Google Maps/tile providers en "Compartición con terceros" | Alta | XS |
| S3a — Reformular sección "Datos de uso" a lenguaje no-exhaustivo | Alta | S |
| S3b — Reformular sección "localStorage" a categorías | Alta | S |
| S4 — Bullet `abuseLogs` en sección Almacenamiento | Media | XS |
| S5 — Actualizar fecha "Última actualización" | Alta | XS |
| Actualizar `docs/reference/features.md` si se menciona política | Media | XS |

**Esfuerzo total estimado:** S

---

## Out of Scope

- No se modifica `firestore.rules` ni Cloud Functions — este ticket es solo de documentación user-facing.
- No se agrega un mecanismo automático de detección de drift (ese trabajo puede ser un ticket futuro de tech-debt si se repite).
- No se cambian los eventos de analytics ni las keys de localStorage — solo cómo se describen en la política.
- No se traduce la política a otros idiomas.
- No se agrega un changelog versionado de la política (si el legal team lo requiere, es otro ticket).

---

## Tests

Según [tests.md](../../../reference/tests.md), los componentes puramente visuales sin lógica son una excepción explícita de la política de 80% de cobertura. `PrivacyPolicy.tsx` no tiene estado, props, handlers ni queries — es JSX estático.

### Archivos que necesitaran tests

| Archivo | Tipo | Que testear |
|---------|------|-------------|
| `src/components/profile/PrivacyPolicy.tsx` | Componente puramente visual | Ninguno (excepción `tests.md`) |

### Criterios de testing

- No aplica cobertura >= 80% porque es componente sin lógica (explicit exception en `tests.md`).
- Sí aplica: el snapshot visual debe seguir compilando (TypeScript + markdownlint del repo).
- El `vitest.config.ts` ya no requiere test adicional ya que no hay paths condicionales ni side effects.

---

## Seguridad

Este feature es corrección de privacy policy — no introduce nuevas superficies de ataque.

- [x] No toca Firestore rules (sólo documenta colecciones existentes).
- [x] No toca Cloud Functions.
- [x] No toca Storage rules.
- [x] No agrega inputs del usuario.
- [x] No agrega secretos ni env vars.

### Vectores de ataque automatizado

No hay superficies nuevas expuestas. El cambio es solo texto en un componente estático.

### Defensas transversales que este ticket refuerza

- **Transparencia regulatoria**: declarar Sentry y tile providers reduce riesgo reputacional y acerca la política a los requisitos de políticas de privacidad serias (aunque la app sea interna).
- **Auditabilidad**: mencionar `abuseLogs` cierra el gap entre lo que el admin ve y lo que el usuario sabe que se guarda.

---

## Deuda tecnica y seguridad

No hay issues abiertos de `security` ni `tech debt` al momento de escribir este PRD (`gh issue list --label security --state open` y `--label "tech debt"` vacíos). El único issue abierto es #168 (Vite 8 bloqueado por peer deps), que no está relacionado.

### Issues relacionados

| Issue | Relacion | Accion |
|-------|----------|--------|
| — | — | — |

### Mitigacion incorporada

- Reformular las secciones "Datos de uso" y "localStorage" a lenguaje no-exhaustivo reduce la deuda crónica de mantenimiento: cada feature nuevo hoy debería editar la política y nadie lo hace → con la reformulación, la mayoría de features encaja bajo categorías ya cubiertas.

---

## Robustez del codigo

### Checklist de hooks async

- [x] No aplica — el componente no tiene hooks ni async ops.
- [x] Archivo sigue bajo 300 líneas (actual ~278, post-cambios ~290).
- [x] No usa `logger.error` ni guards de `import.meta.env.DEV`.

### Checklist de observabilidad

- [x] No aplica — sin Cloud Functions nuevas, sin servicios Firestore nuevos, sin eventos de analytics nuevos.

### Checklist offline

- [x] No aplica — el componente renderiza sin tocar la red.

### Checklist de documentacion

- [x] `docs/reference/features.md` — revisar si hay mención a la política (sección Configuración > Ayuda); si la hay, no cambia.
- [x] `docs/reference/firestore.md` — verificar que `abuseLogs` ya está documentada (sí, per security.md:99).
- [ ] `docs/reference/patterns.md` — no aplica.
- [x] No hay colecciones nuevas.
- [x] No hay eventos de analytics nuevos.

---

## Offline

### Data flows

| Operacion | Tipo (read/write) | Estrategia offline | Fallback UI |
|-----------|-------------------|-------------------|-------------|
| Renderizar `PrivacyPolicy.tsx` | — (solo JSX estático) | No aplica | Componente siempre disponible (parte del bundle principal) |

### Checklist offline

- [x] No hay reads ni writes de Firestore.
- [x] No hay APIs externas.
- [x] No hay indicadores de estado offline relevantes para este componente.
- [x] El componente ya es parte del bundle de perfil y está disponible offline.

### Esfuerzo offline adicional: S (nulo, solo herencia)

---

## Modularizacion y % monolitico

- El cambio es local a `PrivacyPolicy.tsx`. No agrega acoplamiento, no toca layout, no toca contextos globales.
- El componente ya está en su carpeta de dominio correcta (`src/components/profile/`).
- No agrega imports a `firebase/*`.
- No supera 300 líneas.

### Checklist modularizacion

- [x] Lógica de negocio: N/A (componente estático).
- [x] No crea nuevos hooks ni servicios.
- [x] No agrega useState al AppShell/SideMenu.
- [x] Sin noop callbacks (no hay props).
- [x] No importa de `firebase/firestore/functions/storage`.
- [x] Carpeta de dominio correcta (`profile/`).
- [x] No agrega contexto global nuevo.
- [x] Archivo sigue bajo 400 líneas.

### Impacto en % monolitico

| Aspecto | Impacto | Justificacion |
|---------|---------|---------------|
| Acoplamiento de componentes | = | Cambio aislado, solo JSX. |
| Estado global | = | No toca providers. |
| Firebase coupling | = | No importa Firebase. |
| Organizacion por dominio | = | Archivo ya en `components/profile/`. |

---

## Accesibilidad y UI mobile

- El componente usa `Typography` y listas semánticas (`<ul>` / `<li>`). Post-cambio, la estructura se mantiene.
- Al reformular bullets, respetar tildes correctas y voseo (Modo Mapa usa voseo argentino).
- Copy reutilizable: los nuevos bullets mencionan "Sentry" y "Google Maps" — son nombres propios, no requieren traducción.

### Checklist de accesibilidad

- [x] Sin `<IconButton>` nuevos.
- [x] Semántica correcta mantenida (`<Typography>` para body, `<li>` para items).
- [x] No hay elementos clickables nuevos.
- [x] Sin touch targets nuevos.
- [x] No hay carga de datos.
- [x] Sin imágenes dinámicas.
- [x] Sin formularios.

### Checklist de copy

- [x] Tildes correctas (Última, información, contraseña, compartición, etc.).
- [x] Voseo consistente (podés, activás, registrás).
- [x] Terminología: "comercios" (sí presente) y "reseñas/comentarios" (ambos presentes — se mantienen).
- [ ] Strings centralizados: N/A — el componente es texto largo, no encaja en `src/constants/messages/` (que es para toasts cortos).
- [x] Mensajes accionables: N/A — es política descriptiva, no UI interactiva.

---

## Success Criteria

1. La sección "Compartición con terceros" de `PrivacyPolicy.tsx` menciona explícitamente Sentry (con propósito: diagnóstico de errores) y Google Maps/tile providers (con propósito: renderizar el mapa, IP + viewport).
2. La sección "Datos de uso" describe los eventos por dominio con frase "entre otros", no una lista cerrada.
3. La sección "localStorage" describe categorías (preferencias, flags de onboarding, cache de verificación, email recordado) en lugar de enumerar cada key.
4. La sección "Almacenamiento" > Cloud Firestore menciona `abuseLogs` como log administrativo con UID + tipo + timestamp.
5. La fecha "Última actualización" refleja la fecha real del merge.
6. El componente sigue compilando sin warnings de TypeScript, sigue pasando markdownlint y tests preexistentes no cambian.

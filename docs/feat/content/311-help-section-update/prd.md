# PRD: Tech debt — HelpSection desincronizado con features actuales

**Feature:** 311-help-section-update
**Categoria:** content
**Fecha:** 2026-04-18
**Issue:** #311
**Prioridad:** Media

---

## Contexto

`HelpSection` es la pantalla de ayuda que el usuario abre desde Perfil > Ayuda y soporte. Es una lista estatica de 14 Accordions agrupados en 6 chips (Inicio, Buscar, Social, Listas, Perfil, Ajustes) cuya fuente es el array `HELP_GROUPS` hardcodeado en `src/components/profile/HelpSection.tsx`. Un `/health-check` del 2026-04-18 detecto que varias features enviadas en v2.30–v2.35 no estan descriptas (modo offline #136, Rankings "Mi zona" #200, Trending cerca tuyo #200, Q&A sub-tabs #127, rating prompt #199, onboarding de cuenta #157, perfil publico de otros usuarios, preguntas vs comentarios, fotos de menu) y otras estan desactualizadas (toggle dark mode, cantidad de avatares, ubicacion del digest, color/icon picker de listas, 20/dia compartido con preguntas).

## Problema

- **Documentacion in-app incompleta**: el usuario no descubre features importantes (offline, Trending cerca tuyo, filtro "Mi zona", perfil publico, Q&A) desde la pantalla de Ayuda.
- **Inconsistencias visibles**: la seccion cita "modo oscuro en menu lateral" cuando el toggle vive en Configuracion > Apariencia (#231); nombra "20 opciones de avatar" sin verificar el count real; no aclara que 20/dia es compartido entre comentarios y preguntas.
- **Ausencia de sistema offline (#136)**: el item mas estrategico del ultimo trimestre (cola IndexedDB, OfflineIndicator, seccion Pendientes, StaleBanner) no aparece en la guia del usuario, reduciendo percepcion de valor.
- **Naming inconsistente**: HelpSection habla de "Ayuda y soporte" y features.md usa "Feedback"; hay que unificar.

## Solucion

### S1 — Auditoria puntual contra features.md

Mapear 1 a 1 las secciones faltantes vs features.md. Items a agregar/mejorar:

| Grupo | Item nuevo/actualizado | Accion |
|-------|------------------------|--------|
| Buscar | "Modo offline" | **Nuevo item**: cola de acciones en IndexedDB (max 50, TTL 7d), sync automatica al reconectar, OfflineIndicator, seccion "Pendientes" en SideMenu, StaleBanner cuando los datos vienen de cache. |
| Buscar | "Detalle de comercio" | **Actualizar**: aclarar que 20/dia es limite **compartido** entre comentarios y preguntas. Mencionar Q&A sub-tab "Preguntas" con "Mejor respuesta" (likeCount>=1 y mas votada). Fotos de menu (upload con compresion, reportar, staleness chip >6 meses). |
| Inicio | "Pantalla principal" | **Actualizar**: listar secciones reales (SpecialsSection, ActivityDigestSection/Novedades, Sorprendeme con radio 5km y fallback a random, RecentSearches, TrendingNearYouSection con subtitulo dinamico segun fuente de ubicacion, RatingPromptBanner post check-in, YourInterestsSection). |
| Social | "Rankings" | **Nuevo item** o ampliar "Actividad y seguidos": tiers (Bronce/Plata/Oro/Diamante), 11 badges, sparkline de evolucion, streak, filtro "Mi zona" (#200), compartir via Web Share. |
| Social | "Perfil publico" | **Nuevo item**: click en nombre de usuario abre bottom sheet con stats, ranking badge top-3, ultimos 5 comentarios y FollowButton. |
| Social | "Recomendaciones" | **Actualizar**: recordar 200 chars, rate limit 20/dia con warning cuando quedan <=3, badge en tab, "Marcar todas como leidas" al abrir. |
| Listas | "Favoritos y listas" | **Actualizar**: color picker + icon picker (30 iconos), seccion "Compartidas conmigo" (#155), seccion "Destacadas" (#156), copiar lista ajena y agregar todos a favoritos en batch (#160). |
| Perfil | "Notificaciones" | **Actualizar**: mencionar frecuencia del digest (tiempo real / diaria / semanal) y que ActivityDigestSection agrupa no leidas en Home. Agregar "Marcar todas como leidas" en Recomendaciones. |
| Perfil | "Tu perfil" | **Verificar**: contar avatares reales en `AvatarPicker` y corregir el numero. |
| Ajustes | "Configuracion" | **Actualizar**: el toggle dark mode vive en **Configuracion > Apariencia** (#231), no en el menu lateral. Unificar con la descripcion del item "Modo oscuro". |
| Ajustes | "Modo oscuro" | **Actualizar**: reubicar CTA a Configuracion > Apariencia, mantener mencion al `prefers-color-scheme`. |
| Ajustes | "Onboarding de cuenta" | **Nuevo item** (opcional): banners para conversion anonimo → email, beneficios pre-registro, recordatorio tras 5 ratings, nudge de verificacion (#157). |

### S2 — Unificar terminologia

- Renombrar item "Feedback" → matchear features.md (sigue siendo "Feedback" como label de seccion, pero el texto de ayuda dice "desde Perfil > Ayuda y soporte" cuando en app es solo "Feedback"). Revisar el label actual de la ruta real y alinear.
- Tono voseo consistente (OK segun el health-check).

### S3 — Extraccion a constante reutilizable

El array `HELP_GROUPS` ocupa las primeras 184 lineas del archivo de 243 lineas. Sigue el patron de `HOME_SECTIONS` registry. Extraer `HELP_GROUPS` a `src/constants/helpGroups.tsx` (o `src/components/profile/helpGroups.tsx` si prefiere mantener JSX cerca) para:

- Separar contenido de rendering (match patron anti-sabana).
- Facilitar tests de snapshot por grupo.
- Permitir futuras ediciones sin tocar el componente.
- El archivo final de `HelpSection.tsx` quedaria <80 lineas.

Los iconos de MUI quedan en el archivo de constantes porque son nodos JSX declarativos (no logica). Precedente: `HOME_SECTIONS` en `components/home/homeSections.ts` usa `React.lazy()` en constantes.

**UX**:

- Mantener el layout actual (Accordion MUI, chips como dividers de grupo).
- Agregar `aria-label` explicito en cada AccordionSummary con el titulo (actualmente solo el Typography lo transmite, pero el expand button no).
- Verificar que cada icono tenga contraste correcto en dark mode (ya usa `color="primary"`).

---

## Scope

| Item | Prioridad | Esfuerzo |
|------|-----------|----------|
| Extraer `HELP_GROUPS` a archivo de constantes dedicado | Alta | XS |
| Agregar item "Modo offline" en grupo Buscar | Alta | XS |
| Agregar item "Perfil publico" en grupo Social | Alta | XS |
| Ampliar item "Rankings" en grupo Social (tiers, badges, Mi zona, streak) | Alta | XS |
| Actualizar "Pantalla principal" con secciones reales (digest, trending, rating prompt, intereses) | Alta | XS |
| Actualizar "Detalle de comercio" con Q&A, fotos de menu, 20/dia compartido | Alta | XS |
| Actualizar "Favoritos y listas" con color/icon picker, compartidas, destacadas, copiar/favs batch | Alta | XS |
| Actualizar "Configuracion" y "Modo oscuro" con nueva ubicacion del toggle | Media | XS |
| Actualizar "Notificaciones" con digest frequency + ActivityDigestSection | Media | XS |
| Agregar/actualizar item "Recomendaciones" con rate limit y "marcar todas como leidas" | Media | XS |
| Verificar count real de avatares en `AvatarPicker` y actualizar | Media | XS |
| (Opcional) Agregar item "Onboarding de cuenta" | Baja | XS |
| Agregar `aria-label` a cada AccordionSummary | Media | XS |
| Tests de snapshot + test de integridad (todos los grupos no vacios, ids unicos) | Alta | XS |

**Esfuerzo total estimado:** S (1 sesion de trabajo, sin cambios server-side ni rules ni schema).

---

## Out of Scope

- Nuevos flujos de autenticacion, auth features, rules o Cloud Functions.
- Rediseno visual de la pantalla de ayuda (mantenemos Accordion + chips).
- Buscador dentro de la ayuda (se descarta para este ciclo — podria hacerse en un issue aparte si crece el array).
- Traducciones a otros idiomas.
- Sistema CMS para textos de ayuda (sigue siendo constante compilada).

---

## Tests

### Archivos que necesitaran tests

| Archivo | Tipo | Que testear |
|---------|------|-------------|
| `src/constants/helpGroups.tsx` | Constante | Estructura no vacia, cada grupo tiene >=1 item, todos los `id` son unicos, todos los items tienen `title` y `description` no vacios. |
| `src/components/profile/HelpSection.tsx` | Component | Renderiza todos los grupos; click en Accordion expande/colapsa; version de app visible; cada AccordionSummary tiene role="button" accesible. |

### Criterios de testing

- Cobertura >= 80% del codigo nuevo (componente + constante).
- Snapshot del array `HELP_GROUPS` para detectar cambios accidentales en PRs futuros.
- Tests de validacion para unicidad de `id`.
- Interaccion de expand/collapse cubierta con `@testing-library/react`.
- Integridad: ningun grupo vacio, ningun title/description vacio, ningun id duplicado.

---

## Seguridad

Este feature solo cambia texto estatico en un componente React. No introduce:

- Nuevos campos de Firestore.
- Nuevos endpoints o callables.
- Nuevos inputs de usuario.
- Nuevas URLs o dominios para CSP.

Checklist relevante:

- [x] No hay secretos en codigo (solo strings en espanol).
- [x] No hay nuevas dependencias.
- [x] Textos renderizados via JSX escaping (sin `dangerouslySetInnerHTML`).
- [x] Sin links externos nuevos (si se agrega alguno, usar `rel="noopener"`).

### Vectores de ataque automatizado

No hay superficies expuestas nuevas. El feature es read-only client-side sobre contenido hardcodeado en el bundle.

---

## Deuda tecnica y seguridad

No hay issues abiertos de `security` ni `tech debt` activos relacionados (ver `gh issue list` al momento del PRD, solo #168 bloqueado por peer deps esta abierto). Este PRD **resuelve** parcialmente la deuda identificada por `/health-check` 2026-04-18.

### Issues relacionados

| Issue | Relacion | Accion |
|-------|----------|--------|
| #311 (este) | Tech debt documental | Resuelve |
| #157 (onboarding cuenta) | Falta item en HelpSection | Agregar item (S1) |
| #136 (offline) | Falta item en HelpSection | Agregar item (S1) |
| #200 (trending zona / rankings filtro) | Falta mencion en HelpSection | Actualizar item Rankings y Home (S1) |
| #127 (Q&A) | Falta mencion de Preguntas vs Comentarios | Actualizar item "Detalle de comercio" (S1) |
| #199 (rating prompt) | Falta mencion en Home | Actualizar item "Pantalla principal" (S1) |
| #231 (toggle dark mode en Apariencia) | Dato desactualizado | Corregir item "Configuracion" y "Modo oscuro" (S1) |

### Mitigacion incorporada

- Sincronizar HelpSection con features.md en un unico cambio para cerrar el gap completo.
- Dejar documentado que al mergear nuevas features (#200, #127, #136, etc.) hay que actualizar HelpSection como parte del checklist de cierre — agregar bullet a `docs/reference/features.md` y `patterns.md`.

---

## Robustez del codigo

### Checklist de hooks async

- [x] No hay operaciones async en este componente.
- [x] No hay `setState` post-async.
- [x] Componente solo tiene `useState` sincrono para `expanded`.
- [x] No hay imports de Firebase SDK.
- [x] No hay handlers async.

### Checklist de observabilidad

- No aplica: no hay Cloud Functions ni queries Firestore nuevas.
- Opcional: `trackEvent('help_item_expanded', { id })` al abrir un accordion para entender que items son mas consultados. Si se agrega, registrar en `GA4_EVENT_NAMES` + `ga4FeatureDefinitions.ts` + archivo de dominio bajo `src/constants/analyticsEvents/` (nuevo archivo `help.ts` o extender uno existente).

### Checklist offline

- [x] Componente funciona offline (es estatico, sin queries). No requiere cambios offline.

### Checklist de documentacion

- [x] `docs/reference/features.md` ya describe todas las features — no requiere cambio.
- [x] `docs/reference/firestore.md` sin cambios.
- [x] `docs/reference/patterns.md` — opcional: documentar "HELP_GROUPS registry" similar al patron HOME_SECTIONS si se extrae a constante.
- [ ] Agregar bullet al final de `docs/reference/features.md` o `docs/procedures/worktree-workflow.md` recordando actualizar HelpSection con cada feature user-facing nueva.

---

## Offline

### Data flows

| Operacion | Tipo (read/write) | Estrategia offline | Fallback UI |
|-----------|-------------------|--------------------|-------------|
| Render de HELP_GROUPS | read (bundle) | Ninguna — es estatico | No aplica |

### Checklist offline

- [x] Reads de Firestore: ninguno.
- [x] Writes: ninguno.
- [x] APIs externas: ninguno.
- [x] UI: no hay estado offline en esta pantalla (es estatica).
- [x] Datos criticos: bundle precacheado por Workbox ya cubre este componente.

### Esfuerzo offline adicional: S (ninguno)

---

## Modularizacion y % monolitico

### Checklist modularizacion

- [x] Logica (config) extraida a archivo de constantes separado.
- [x] Componente nuevo (post-refactor) queda enfocado en render puro.
- [x] No se agregan useState de logica de negocio en AppShell o SideMenu.
- [x] No hay props implicitas ni contextos de layout.
- [x] Cada prop de accion es real — aqui no hay props de accion, solo `expanded` state local.
- [x] Ningun import directo de `firebase/firestore`, `firebase/functions`, `firebase/storage`.
- [x] Archivo nuevo (`helpGroups.tsx`) va en `src/constants/` (o `src/components/profile/`) — carpeta correcta de dominio.
- [x] No se crea contexto nuevo.
- [x] Archivos finales < 300 lineas (HelpSection queda ~80, helpGroups ~220).
- [x] Archivo en `src/hooks/`: no aplica, esto no es un hook.
- [x] Constantes de localStorage: no aplica.

### Impacto en % monolitico

| Aspecto | Impacto | Justificacion |
|---------|---------|---------------|
| Acoplamiento de componentes | = | HelpSection sigue aislado, sin imports cruzados con otros componentes. |
| Estado global | = | No usa contexto global. |
| Firebase coupling | = | Cero Firebase. |
| Organizacion por dominio | + | Extraer `HELP_GROUPS` a constantes reduce tamano de componente y separa contenido de render. |

---

## Accesibilidad y UI mobile

### Checklist de accesibilidad

- [ ] `<AccordionSummary>` debe tener `aria-label={item.title}` para que screen readers anuncien el accordion completo (el icono expand button de MUI tiene aria implicito pero refuerza con aria-controls nativo).
- [x] No hay `<IconButton>` nuevo.
- [x] Usa semantica MUI correcta (Accordion = `region` + `button`).
- [x] Touch targets: AccordionSummary default >=48px.
- [x] No hay data fetching — no hay skeleton forever.
- [x] No hay imagenes con URL dinamica.
- [x] No hay formulario.

### Checklist de copy

- [x] Todos los textos en espanol con tildes correctas (auditar con agente `copy-auditor` antes de merge).
- [x] Tono voseo consistente (Tocá, Registrá, Calificá).
- [x] Terminologia: "comercios", "reseñas", "negocios" segun convenciones.
- [ ] Considerar centralizar textos largos en `src/constants/messages/help.ts` si el array crece mucho. Por ahora queda en `helpGroups.tsx` porque son descripciones largas (no reutilizables).
- [x] Mensajes accionables ("Tocá…", "Andá a…", "Activá…").

---

## Success Criteria

1. La pantalla Perfil > Ayuda y soporte describe el 100% de las features user-facing documentadas en `docs/reference/features.md`: modo offline, Trending cerca tuyo, filtro "Mi zona", Q&A, perfil publico, fotos de menu, rating prompt, onboarding de cuenta, digest frequency, color/icon picker, listas destacadas/compartidas.
2. El numero de avatares citado ("20 opciones") coincide con el array real de `AvatarPicker`.
3. El toggle dark mode se referencia correctamente en "Configuracion > Apariencia" (no en el menu lateral) tanto en el item "Configuracion" como en "Modo oscuro".
4. `HELP_GROUPS` esta extraido a un archivo dedicado y `HelpSection.tsx` queda <100 lineas.
5. Tests cubren: unicidad de ids, no vacios, expand/collapse, y un snapshot que detectara cambios accidentales en PRs futuros. Cobertura >= 80% en el componente y 100% en el modulo de constantes.

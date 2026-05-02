# PRD: Tech debt: privacy — feedback PDF support + contact categories wording

**Feature:** 329-privacy-feedback-pdf-categories
**Categoria:** security
**Fecha:** 2026-04-29
**Issue:** #329
**Prioridad:** Media

---

## Contexto

`src/components/profile/PrivacyPolicy.tsx` quedo corto respecto al codigo real despues de #308. La auditoria del privacy-policy auditor del 2026-04-25 detecto que el tipo `FeedbackCategory` en `src/types/feedback.ts` declara cinco variantes y `mediaType` incluye `'pdf'`, pero la politica solo habla de "imagenes adjuntas" y solo enumera dos categorias en la seccion de Contacto. Es exactamente el tipo de drift que la regla 6 del guard `docs/reference/guards/308-privacy.md` busca prevenir, asi que ademas de ajustar el copy hay que asegurarse de que el guard chequea estos casos.

## Problema

- La seccion "Contenido generado" (`PrivacyPolicy.tsx:71-73`) y "Almacenamiento" (`:157-159`) describen solo "imagenes adjuntas" pero el cliente acepta tambien PDFs (`mediaType?: 'image' | 'pdf'` en `src/types/feedback.ts`, validado en Storage rules `feedback-media/{userId}/{feedbackId}/{fileName}` con `application/pdf`). El usuario que sube un PDF no esta cubierto por la politica vigente.
- La seccion "Contacto" (`:296-298`) sugiere usar las categorias "Datos de usuario" o "Datos de comercio", pero `FeedbackForm.tsx:116-122` ofrece cinco chips: `Bug | Sugerencia | Datos de usuario | Datos de comercio | Otro`. La politica deja al usuario sin instruccion clara para los otros tres casos y deja la impresion de que solo hay dos canales.
- Hay dos issues cosmeticos que vienen del mismo audit: `:124` lee raro ("google para administradores", sin parentesis) y `:34` declara la fecha dos veces ("abril 2026 (actualizada el 20/04/2026)"). Son menores pero conviene cerrarlas en el mismo PR para no dejar TODOs colgados.

## Solucion

S1. **Disclosure de PDF en feedback.** Reemplazar las menciones de "imagenes adjuntas" por "imagen o PDF adjunto" en los tres puntos de la politica que tocan media de feedback:
- `PrivacyPolicy.tsx:71-73` — "feedback (incluyendo imagen o PDF adjunto opcional)"
- `PrivacyPolicy.tsx:157-159` — "Firebase Storage: almacena fotos de menu e imagenes o PDFs adjuntos de feedback subidos por los usuarios"
- `PrivacyPolicy.tsx:218` — "El contenido de tu feedback (mensaje, categoria e imagen o PDF adjunto si lo hay) puede ser compartido con GitHub..."

S2. **Categorias de contacto completas.** Ampliar `PrivacyPolicy.tsx:293-299` para que mencione las cinco variantes de `FeedbackCategory`. La idea no es enumerar las cinco como canales de contacto formal — la seccion "Contacto" sigue siendo sobre datos personales/comercio — sino aclarar que los otros tres existen para feedback general. Wording propuesto:

> Si tenes consultas sobre tus datos personales o los datos de comercios, podes enviarnos un mensaje desde **Perfil > Ayuda y soporte > Feedback** usando las categorias "Datos de usuario" o "Datos de comercio". Otras categorias ("Bug", "Sugerencia" y "Otro") estan disponibles para feedback general sobre la app.

S3. **Fixes cosmeticos del mismo audit.** Mientras se toca el archivo:
- `:124` cambiar "google para administradores" a "google (para administradores)" para que se lea como una aclaracion, no como un sujeto.
- `:34` simplificar a una sola fecha. Como el cambio de este PR amerita bumpear la fecha, el resultado deberia ser solo "Ultima actualizacion: abril 2026" (formato consistente con la convencion existente, sin doble fechado).

S4. **Bumpear fecha y guard.** La regla 5 del guard `308-privacy.md` exige bumpear "Ultima actualizacion" cuando aterrizan nuevos `mediaType` o cambia el wording de categorias. Como la politica acumula los cambios, este PR cumple ese requerimiento. Ademas hay que extender el detection pattern del guard (linea ~62) para que `grep -in "imagen\|pdf"` valide explicitamente que `pdf` aparece en la politica cuando `feedback.ts` lo declare — hoy el chequeo lista "image\|pdf\|imagen\|video\|audio" pero no falla si falta una.

S5. **Privacy es componente puramente visual.** Esto cae bajo la excepcion de `tests.md` (componentes puramente visuales sin logica). No se agrega test unitario para `PrivacyPolicy.tsx`. La validacion automatizada vive en el guard via grep, no en vitest.

---

## Scope

| Item | Prioridad | Esfuerzo |
|------|-----------|----------|
| Reemplazar wording "imagen adjunta" por "imagen o PDF adjunto" en 3 puntos | Alta | XS |
| Ampliar seccion "Contacto" con menciones a Bug/Sugerencia/Otro | Alta | XS |
| Fix cosmetico "google (para administradores)" | Baja | XS |
| Fix doble fechado en linea 34 + bump a fecha actual | Baja | XS |
| Extender guard `308-privacy.md` con detection pattern para PDF | Media | XS |

**Esfuerzo total estimado:** S

---

## Out of Scope

- No se agregan nuevas variantes a `FeedbackCategory` ni a `mediaType`. El tipo se mantiene como esta — este PR solo alinea la politica con lo que ya existe.
- No se cambia el comportamiento de `FeedbackForm.tsx`. Las chips, validacion y orden quedan intactos.
- No se redacta de cero la politica ni se reorganizan secciones — se editan los strings minimos para cerrar el drift.
- No se actualizan los textos de `MyFeedbackList.tsx` ni `FeedbackList.tsx` (admin); ya manejan las cinco categorias correctamente.

---

## Tests

`PrivacyPolicy.tsx` es componente puramente visual (Box + Typography, sin logica condicional ni props). Cae bajo la excepcion de `docs/reference/tests.md` seccion "Excepciones" — no requiere test unitario.

### Archivos que necesitaran tests

| Archivo | Tipo | Que testear |
|---------|------|-------------|
| `src/components/profile/PrivacyPolicy.tsx` | Componente visual | Excepcion: no aplica |
| `docs/reference/guards/308-privacy.md` | Guard doc | Detection pattern actualizado para `pdf` |

### Criterios de testing

- No baja la cobertura global del proyecto (el archivo no estaba testeado antes).
- El guard `308-privacy.md` tiene un grep nuevo que falla si `pdf` no aparece textualmente en la politica cuando el tipo lo declara.
- Validacion manual al mergear: `grep -in "PDF" src/components/profile/PrivacyPolicy.tsx` devuelve >= 3 matches y `grep -in "Bug\|Sugerencia\|Otro" src/components/profile/PrivacyPolicy.tsx` devuelve los tres.

---

## Seguridad

Este PR es disclosure-only: no agrega superficies nuevas, no cambia rules, no toca callables. La seguridad relevante es la consistencia entre lo que el codigo permite y lo que la politica declara — un usuario que sube un PDF debe poder leer en la politica que ese tipo de archivo se almacena en Firebase Storage.

- [x] No hay nuevas colecciones, callables, ni rules. N/A para los checklists de hasOnly/affectedKeys/rate limit.
- [x] Storage rules ya validan PDF en `feedback-media/{userId}/{feedbackId}/{fileName}` con `application/pdf` (verificado en `docs/reference/security.md` linea 303). Este PR alinea la politica con esa configuracion existente.
- [x] No se cambia ningun campo de `userSettings` ni converters. N/A.
- [x] No hay nuevas escrituras de usuario. N/A para rate limiting.

### Vectores de ataque automatizado

| Superficie | Ataque posible | Mitigacion requerida |
|-----------|---------------|---------------------|
| N/A — solo se editan strings de copy | No aplica | No aplica |

---

## Deuda tecnica y seguridad

`gh issue list --label security --state open` y `gh issue list --label "tech debt" --state open` retornaron vacio (verificado el 2026-04-29). #308, el predecesor que cubrio el drift inicial de Sentry/Google Maps/analytics, esta cerrado.

### Issues relacionados

| Issue | Relacion | Accion |
|-------|----------|--------|
| #308 (cerrado) | Predecesor: aterrizo el guard `308-privacy.md` regla 6 que pide alinear `FeedbackCategory` y `mediaType` con la politica | Este PR es la primera deuda detectada por el guard despues de #308 — completar el wording que faltaba |
| #322 R12 firestore rules hardening (cerrado) | Tangencial: valida `feedback.message is string` antes de `.size()`. No afecta a este PR | Ninguna |

### Mitigacion incorporada

- Extender el detection pattern del guard `308-privacy.md` para que un futuro PR no pueda dejar la politica sin mencionar `pdf` cuando el tipo lo declare. Es la regla 6 del guard, hoy enunciada pero sin grep enforcement explicito para PDF.

---

## Robustez del codigo

`PrivacyPolicy.tsx` no tiene hooks async, ni estado, ni handlers. Es un arbol de Typography puro. Los checklists de hooks async, observabilidad y offline no aplican.

### Checklist de hooks async

- [x] N/A — no hay async, no hay efectos, no hay state.

### Checklist de observabilidad

- [x] N/A — no se agregan triggers ni servicios ni `trackEvent`.

### Checklist offline

- [x] N/A — solo lectura de copy estatico, sin escrituras a Firestore.

### Checklist de documentacion

- [x] N/A para `homeSections.ts`.
- [x] N/A para `analyticsEvents/`.
- [x] N/A para `types/`.
- [ ] `docs/reference/features.md` no requiere cambios — la politica ya esta listada en el indice de funcionalidades.
- [x] N/A para `firestore.md` — no hay colecciones nuevas.
- [ ] `docs/reference/patterns.md` no requiere cambios — no se introduce un patron nuevo.
- [ ] `docs/reference/guards/308-privacy.md` actualizado con detection pattern para PDF.

---

## Offline

Politica de privacidad es una pantalla de lectura pura — no hace queries ni writes ni APIs externas. Ya esta cubierta por la cache estatica del bundle (lazy import en `ProfileScreen.tsx:26`).

### Data flows

| Operacion | Tipo (read/write) | Estrategia offline | Fallback UI |
|-----------|-------------------|-------------------|-------------|
| Render de PrivacyPolicy | N/A (string statico) | Cubierto por bundle PWA | Disponible offline una vez cacheado |

### Checklist offline

- [x] N/A — no hay reads de Firestore.
- [x] N/A — no hay writes.
- [x] N/A — no hay APIs externas.
- [x] N/A — no necesita indicador offline (el copy se renderiza desde el bundle).
- [x] La politica esta disponible offline una vez instalado el PWA, igual que ahora.

### Esfuerzo offline adicional: S (cero)

---

## Modularizacion y % monolitico

Este PR no agrega componentes ni hooks, no toca contextos, no toca AppShell ni SideMenu. Es una edicion de strings dentro de un componente que ya existe y ya esta en su carpeta correcta (`src/components/profile/`).

### Checklist modularizacion

- [x] No se mueve logica de negocio — no hay logica.
- [x] No se agregan props nuevas.
- [x] No se agrega useState a layouts.
- [x] N/A — no hay handlers nuevos.
- [x] N/A — no se importa Firebase SDK.
- [x] N/A — no se agregan archivos en `src/hooks/`.
- [x] No se crean archivos nuevos. `PrivacyPolicy.tsx` actual = 302 lineas, cambio agregara ~6 lineas → ~308 lineas. Sigue debajo del threshold de 400.
- [x] N/A — no se tocan converters.
- [x] N/A — no se crean archivos nuevos.
- [x] N/A — no hay estado global.

### Impacto en % monolitico

| Aspecto | Impacto | Justificacion |
|---------|---------|---------------|
| Acoplamiento de componentes | = | Solo se editan strings dentro de un componente existente |
| Estado global | = | No hay estado |
| Firebase coupling | = | El componente no importa Firebase |
| Organizacion por dominio | = | Ya esta en `src/components/profile/` |

---

## Accesibilidad y UI mobile

Solo se editan strings dentro de `<Typography>` y `<Li>` existentes. La estructura semantica no cambia.

### Checklist de accesibilidad

- [x] No se agregan IconButtons.
- [x] No se agrega semantica clickable.
- [x] No se cambian touch targets.
- [x] No hay carga de datos.
- [x] No hay imagenes nuevas.
- [x] No hay formularios nuevos.

### Checklist de copy

- [x] Todos los textos en espanol con tildes correctas — verificar "categoria" / "categorias" tienen acento, "PDF" en mayusculas (acronimo).
- [x] Tono consistente con el resto de `PrivacyPolicy.tsx`: voseo donde el resto lo usa ("podes", "tenes"), formal en parrafos descriptivos.
- [x] Terminologia: "comercios" (ya usado), "feedback" (ya usado).
- [x] Strings inline en `PrivacyPolicy.tsx` — no se centralizan en `messages/` porque es texto largo de policy, no UI reutilizable.
- [x] N/A — no hay mensajes de error.

---

## Success Criteria

1. `grep -i "PDF" src/components/profile/PrivacyPolicy.tsx` devuelve >= 3 matches (en Contenido generado, Almacenamiento y Comparticion con terceros).
2. La seccion "Contacto" de `PrivacyPolicy.tsx` menciona las cinco variantes de `FeedbackCategory` (Datos de usuario, Datos de comercio, Bug, Sugerencia, Otro), con redaccion que aclara para que sirve cada bloque.
3. Linea 34 muestra una sola fecha actualizada (abril 2026, sin paréntesis duplicado), y "google (para administradores)" en linea 124 esta entre paréntesis.
4. `docs/reference/guards/308-privacy.md` tiene un detection pattern explicito que falla si `feedback.ts` declara `pdf` y la politica no lo menciona.
5. Build, lint y tipos pasan; el resto de los tests no se ven afectados (no hay tests sobre `PrivacyPolicy.tsx`).

---

## Validacion Funcional

**Fecha:** 2026-05-01
**Auditor:** Sofia (analista funcional)
**Estado:** VALIDADO CON OBSERVACIONES

### Cerrado en esta iteracion

No se abrieron BLOQUEANTES ni IMPORTANTES. El PRD es autocontenido, las afirmaciones del Contexto/Problema verifican contra el codigo (`FeedbackCategory` declara cinco variantes, `mediaType` incluye `pdf`, lineas 71-73, 124, 157-159, 218, 293-299 de `PrivacyPolicy.tsx` coinciden con lo descrito), la regla 6 del guard `308-privacy.md` existe y la regla 5 tambien — el PRD respeta el contrato del guard predecesor.

### Observaciones para el implementador

1. **Fecha "Ultima actualizacion" — mes calendario.** S3 propone literalmente "abril 2026" pero S4 pide bumpear la fecha al merge. Como hoy ya es 29/04/2026 y el merge probablemente caiga en mayo 2026, conviene escribir el mes en el commit final, no copiar el literal "abril 2026" del PRD. Si llegara a mergear en abril, esta bien el literal — la observacion es solo no copy-pastear ciegamente si el merge se desliza al mes siguiente.

2. **Detection pattern del guard — alcance.** S4 dice que el grep "no falla si falta una" variante. El PRD pide "extender el detection pattern para PDF" pero deja al implementador decidir si lo hace como check fijo (`grep -i "pdf"` debe devolver match) o correlacionando automaticamente contra `feedback.ts`. Cualquiera de las dos cumple el criterio, queda a criterio del implementador / tech-lead — no es ambiguedad funcional.

### Listo para specs-plan-writer?

Si.

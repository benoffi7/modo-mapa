# Specs: Tech debt — privacy feedback PDF support + contact categories wording

**PRD:** [prd.md](prd.md)
**Fecha:** 2026-04-29

---

## Modelo de datos

No hay cambios de modelo. El PR solo edita strings de copy en un componente visual y un guard de docs.

Tipos de referencia (sin modificar):

```ts
// src/types/feedback.ts
export type FeedbackCategory = 'bug' | 'sugerencia' | 'datos_usuario' | 'datos_comercio' | 'otro';
export interface Feedback {
  // ...
  mediaUrl?: string;
  mediaType?: 'image' | 'pdf';
}
```

La politica debe alinear con esos cinco valores de `FeedbackCategory` y los dos valores de `mediaType`.

## Firestore Rules

N/A. No se tocan rules.

### Rules impact analysis

| Query (service file) | Collection | Auth context | Rule that allows it | Change needed? |
|---------------------|------------|-------------|-------------------|----------------|
| N/A — solo edicion de copy | N/A | N/A | N/A | No |

### Field whitelist check

| Collection | New/modified field | In create `hasOnly()`? | In update `affectedKeys().hasOnly()`? | Rule change needed? |
|-----------|-------------------|----------------------|--------------------------------------|-------------------|
| N/A — no se agregan ni modifican campos | N/A | N/A | N/A | No |

## Cloud Functions

N/A. No se agregan ni modifican functions.

## Seed Data

N/A. No hay cambios de schema ni colecciones nuevas.

## Componentes

### `src/components/profile/PrivacyPolicy.tsx` (modificado)

Componente visual puro (Box + Typography + Divider). No tiene props, ni state, ni handlers, ni async. Sigue como esta — solo se editan strings inline.

**Cambios concretos**

| Linea actual | String actual | String nuevo |
|--------------|---------------|--------------|
| 34 | `Última actualización: abril 2026 (actualizada el 20/04/2026)` | `Última actualización: {mes calendario al merge} 2026` (ver Textos de usuario abajo) |
| 71-73 | `feedback (incluyendo imágenes adjuntas opcionales)` | `feedback (incluyendo imagen o PDF adjunto opcional)` |
| 124 | `auth_type</code> (anónima / email / google para administradores)` | `auth_type</code> (anónima / email / google [para administradores])` — usar parentesis adicionales o reformular para que "para administradores" lea como aclaracion. Ver Textos de usuario. |
| 157-159 | `Firebase Storage: almacena fotos de menú e imágenes adjuntas de feedback subidas por los usuarios.` | `Firebase Storage: almacena fotos de menú e imágenes o PDFs adjuntos de feedback subidos por los usuarios.` |
| 218 | `El contenido de tu feedback (mensaje, categoría e imagen adjunta si la hay) puede ser compartido con GitHub...` | `El contenido de tu feedback (mensaje, categoría e imagen o PDF adjunto si lo hay) puede ser compartido con GitHub...` |
| 293-298 (sección Contacto) | Solo menciona "Datos de usuario" o "Datos de comercio" | Ampliar con un segundo parrafo que mencione las cinco variantes (ver Textos de usuario) |

### Mutable prop audit

| Component | Prop | Editable fields | Local state needed? | Parent callback |
|-----------|------|----------------|-------------------|-----------------|
| PrivacyPolicy | (sin props) | (no editable) | NO | N/A |

## Textos de usuario

Todos los strings nuevos visibles al usuario:

| Texto | Donde se usa | Notas |
|-------|-------------|-------|
| `Última actualización: {mes} 2026` (linea 34) | Caption al tope de la politica | Una sola fecha. Mes calendario del commit final (no copiar literal "abril" si el merge cae en mayo). Tildes en "Última" y "actualización". |
| `feedback (incluyendo imagen o PDF adjunto opcional)` (linea 71-73) | Item "Contenido generado" | "PDF" en mayusculas (acronimo). |
| `auth_type</code> (anónima / email / google [para administradores])` (linea 124) | Item "Datos de uso" | Decision: incluir "para administradores" entre corchetes / parentesis adicionales para que se lea como aclaracion, no como sujeto. Ver Decisiones tecnicas. |
| `Firebase Storage: almacena fotos de menú e imágenes o PDFs adjuntos de feedback subidos por los usuarios.` (linea 157-159) | Item Storage en seccion "Almacenamiento" | "PDFs" plural en mayusculas. Tildes en "menú". Concordancia: "subidos" (plural masculino). |
| `El contenido de tu feedback (mensaje, categoría e imagen o PDF adjunto si lo hay) puede ser compartido con GitHub para la gestión interna de mejoras y corrección de errores.` (linea 218) | Seccion "Compartición con terceros" | Tildes: categoría, gestión, corrección. |
| `Si tenés consultas sobre tus datos personales o los datos de comercios, podés enviarnos un mensaje desde Perfil > Ayuda y soporte > Feedback usando las categorías "Datos de usuario" o "Datos de comercio". Otras categorías ("Bug", "Sugerencia" y "Otro") están disponibles para feedback general sobre la app.` (seccion Contacto) | Reemplaza linea 295-298 con dos parrafos | Voseo: tenés, podés. Tildes: categorías, están. Comillas tipograficas o `&quot;` segun el resto del archivo (usa `&quot;` actualmente). |

## Hooks

N/A. No hay hooks nuevos ni modificados.

## Servicios

N/A. No hay servicios nuevos ni modificados.

## Integracion

El componente `PrivacyPolicy.tsx` ya esta integrado en `ProfileScreen.tsx:26` via lazy import. No hay que tocar consumidores. Ningun otro archivo de `src/` referencia el wording de la politica.

### Preventive checklist

- [x] **Service layer**: N/A — no hay servicios nuevos.
- [x] **Duplicated constants**: N/A — strings inline son texto largo de policy, no UI reutilizable.
- [x] **Context-first data**: N/A — no hay data fetching.
- [x] **Silent .catch**: N/A — no hay async.
- [x] **Stale props**: N/A — el componente no tiene props.

## Tests

| Archivo test | Que testear | Tipo |
|-------------|-------------|------|
| `src/components/profile/PrivacyPolicy.tsx` | Excepcion: componente puramente visual sin logica condicional. No requiere test unitario segun `docs/reference/tests.md` | Visual / N/A |
| `docs/reference/guards/308-privacy.md` | Detection pattern actualizado para forzar mencion de `pdf` | Guard doc |

**Validacion automatizada (no vitest):**

```bash
# Debe devolver >= 3 matches
grep -i "PDF" src/components/profile/PrivacyPolicy.tsx

# Debe devolver las cinco variantes (al menos un match cada una)
grep -in "Bug\|Sugerencia\|Datos de usuario\|Datos de comercio\|Otro" src/components/profile/PrivacyPolicy.tsx

# Debe devolver una sola fecha (no dos)
grep -c "Última actualización" src/components/profile/PrivacyPolicy.tsx  # esperado: 1
grep -c "actualizada el" src/components/profile/PrivacyPolicy.tsx        # esperado: 0
```

## Analytics

N/A. No se agregan ni modifican `logEvent`.

---

## Offline

`PrivacyPolicy.tsx` es lectura pura desde el bundle. No hace queries ni writes. Cubierto por la cache estatica del PWA.

### Cache strategy

| Dato | Estrategia | TTL | Storage |
|------|-----------|-----|---------|
| Strings de la politica | Bundle PWA | Hasta nuevo deploy | Service worker cache |

### Writes offline

| Operacion | Mecanismo | Conflict resolution |
|-----------|-----------|-------------------|
| N/A — no hay writes | N/A | N/A |

### Fallback UI

N/A. La pantalla esta disponible offline una vez instalado el PWA, igual que ahora.

---

## Accesibilidad y UI mobile

Solo se editan strings dentro de `<Typography>` y `<Li>` existentes. Estructura semantica sin cambios.

| Componente | Elemento | aria-label | Min touch target | Error state |
|-----------|----------|------------|-----------------|-------------|
| PrivacyPolicy | (sin elementos interactivos) | N/A | N/A | N/A |

### Reglas

- N/A — no se agregan IconButtons, Boxes clickables, ni elementos focusables.
- Lectura: el componente sigue siendo navegable por screen reader (semantica `<ul>` + `<li>` se mantiene).

## Textos y copy

Ya cubierto en la seccion "Textos de usuario" arriba. Reglas aplicadas:

- Voseo: "tenés", "podés" (existentes en el archivo, se preservan en el nuevo parrafo de Contacto).
- Tildes obligatorias: "Última", "actualización", "categoría", "categorías", "menú", "gestión", "corrección", "están", "compartición", "anónima".
- Terminologia: "comercios" (ya usado), "feedback" (ya usado, no se traduce).
- "PDF" en mayusculas (acronimo).
- Strings inline en `PrivacyPolicy.tsx` — no se centralizan en `messages/` porque es texto largo de policy, no UI reutilizable.

---

## Decisiones tecnicas

### D1. Mes calendario en linea 34: dinamico al commit, no literal del PRD

El PRD en S3 propone "abril 2026" pero la observacion #1 de Sofia (validacion funcional) advierte que si el merge cae en mayo, hay que escribir "mayo 2026". Decision: el implementador escribe el mes calendario vigente al momento del commit final. Si hoy (2026-04-29) el commit aterriza el mismo dia, queda "abril 2026"; si pasa a mayo, "mayo 2026".

### D2. Reformulacion de "google para administradores" — usar corchetes

El PRD en S3 propone "google (para administradores)" pero la linea 124 ya tiene parentesis externos. Anidar parentesis lee mal. Decision: usar corchetes — `auth_type (anónima / email / google [para administradores])` — o reformular el bullet para mover la aclaracion fuera del parentesis. Cualquiera de las dos cumple el criterio. Se prefiere corchetes por simplicidad y porque preserva la estructura existente.

### D3. Detection pattern del guard — chequeo fijo, no correlacion automatica

La observacion #2 de Sofia deja al implementador decidir entre:
- (a) `grep -i "pdf"` en la politica debe devolver match (chequeo fijo).
- (b) Correlacion automatica contra `feedback.ts` (parsea el union type).

Decision: opcion (a). El chequeo fijo es simple, robusto, y suficiente para el alcance actual. La correlacion automatica seria utilil si el conjunto de mediaTypes creciera, pero hoy son solo dos (`image | pdf`) y agregar uno nuevo es lo bastante raro como para no justificar el costo de un parser. Si en el futuro se agregan mas mediaTypes, la regla 6 del guard sigue obligando a actualizar la politica en el mismo PR, asi que el riesgo de drift queda acotado.

### D4. Seccion "Contacto" — dos parrafos en vez de uno largo

La redaccion sugerida en S2 del PRD se puede meter en un solo parrafo, pero es mas legible separarla en dos:

- Parrafo 1: existente, sobre "Datos de usuario" / "Datos de comercio".
- Parrafo 2: nuevo, aclara que "Bug", "Sugerencia" y "Otro" existen para feedback general.

Asi se mantiene el peso de la seccion "Contacto" en datos personales/comercio, sin convertir a las otras tres categorias en canales formales de soporte.

---

## Hardening de seguridad

PR disclosure-only. No hay superficies nuevas.

### Firestore rules requeridas

N/A. No se tocan rules.

### Rate limiting

N/A. No hay nuevas escrituras de usuario.

### Vectores de ataque mitigados

| Ataque | Mitigacion | Archivo |
|--------|-----------|---------|
| N/A — solo se editan strings de copy | N/A | N/A |

El unico riesgo de seguridad relevante es el drift entre lo que el codigo permite (PDFs en feedback) y lo que la politica declara — y este PR justamente cierra ese drift.

---

## Deuda tecnica: mitigacion incorporada

`gh issue list --label security --state open` y `gh issue list --label "tech debt" --state open` retornaron vacio el 2026-04-29 (verificado en el PRD).

| Issue | Que se resuelve | Paso del plan |
|-------|----------------|---------------|
| #308 (cerrado) — predecesor | Aterrizo la regla 6 del guard `308-privacy.md` que pide alinear `FeedbackCategory` y `mediaType`. Este PR es la primera deuda detectada por esa regla y la cierra. | Fase 1 (politica) + Fase 2 (guard) |

No se agrega deuda nueva. El componente se mantiene en su carpeta correcta (`src/components/profile/`), no importa Firebase, no agrega state ni hooks, no aumenta el % monolitico.

---

## Validacion Tecnica

**Fecha:** 2026-05-01
**Auditor:** Diego (solution architect)
**Estado:** VALIDADO

### Cerrado en esta iteracion

No se abrieron BLOQUEANTES, IMPORTANTES ni OBSERVACIONES. El specs es autocontenido y cierra el PRD palmo a palmo:

- S1 (PDF disclosure) → tabla "Cambios concretos" lineas 71-73, 157-159, 218.
- S2 (cinco categorias en Contacto) → linea 293-298 + decision D4.
- S3 (cosmeticos lineas 34 y 124) → cubierto + decisiones D1, D2 que cierran la ambiguedad.
- S4 (bump fecha + extender guard) → seccion Tests con `grep -i "PDF"` y decision D3 que cierra la opcion abierta del PRD.
- S5 (excepcion test) → verificado contra `docs/reference/tests.md:77` (componentes puramente visuales).
- Observacion #1 Sofia (mes calendario) → integrada en D1.
- Observacion #2 Sofia (alcance detection pattern) → resuelta en D3 con decision explicita (opcion a, chequeo fijo).

Verificaciones de codigo realizadas:

- `src/types/feedback.ts` — `FeedbackCategory` declara los cinco literales y `mediaType: 'image' | 'pdf'` coinciden con lo descrito en specs.
- `src/components/profile/PrivacyPolicy.tsx` — 302 lineas (cambio agregara ~6 → ~308, debajo del threshold de 400). Strings de las lineas 34, 71-72, 124, 157, 218, 297 coinciden con los descritos en la tabla.
- Guard `docs/reference/guards/308-privacy.md` — regla 6 (lineas 34-40) y detection pattern (lineas 60-63) existen y se corresponden con lo que S4 pide extender.
- `docs/reference/tests.md:77` — confirma la excepcion de componentes puramente visuales.

PR es disclosure-only: no toca data model, rules, functions, services, hooks, analytics, ni storage keys. No aplican checklists de hasOnly/affectedKeys, rate limit, App Check, observabilidad, offline ni multi-tab.

### Observaciones tecnicas para el plan (Pablo)

1. **Orden de fases.** Fase 1 (editar politica) debe completarse antes de Fase 2 (extender guard con `grep -i "pdf"`). Si el plan invierte el orden, el grep del guard falla en pre-merge.
2. **Verificacion del mes calendario.** D1 deja la fecha "Ultima actualizacion" al criterio del commit final. El plan deberia incluir un check explicito en la fase de validacion manual: confirmar que la linea 34 lleva el mes vigente al merge, no copiado literal del PRD.
3. **Grep del guard.** D3 elige chequeo fijo. El plan deberia explicitar que el nuevo grep se agrega como un check adicional con assert de match obligatorio, sin romper los chequeos existentes (lineas 60-63 del guard hoy no fallan si falta una variante).

### Listo para pasar a plan?

Si.

# De programador a producto

> Informe metodológico sobre la evolución del repo **Modo Mapa**
>
> Período cubierto: **2026-03-11 → 2026-05-30** (≈ 11 semanas)
> Versión actual: **2.51.0** · Commits totales: **~1.500** · Releases: **51**

---

## Resumen ejecutivo

Lo que arrancó como un repositorio de código en marzo de 2026 terminó en mayo siendo algo más parecido a una **mini-organización**: un equipo (virtual) con roles definidos, una cadena de validaciones documentada, gates automáticos de calidad, una memoria que aprende, y una documentación viva publicada en GitHub Pages.

El cambio no fue tecnológico — la stack siguió siendo la misma. El cambio fue **metodológico**: pasar de "escribir código que funciona" a **operar un producto** con la disciplina de un equipo formal. Este informe reconstruye esa evolución y destila los principios que la sostienen.

---

## 1. La premisa: ¿qué quiere decir "de programador a producto"?

El programador trabaja sobre **tareas**. El producto trabaja sobre **decisiones**.

| Programador | Producto |
|---|---|
| "Voy a hacer X" | "¿Por qué hacemos X y no Y?" (PRD) |
| Empezar a codear | Validar antes de codear (gates) |
| Tests si alcanza el tiempo | Tests como parte del Definition of Done |
| Documentar al final | Documentar como infraestructura |
| Recordar las decisiones | Persistir las decisiones (memoria) |
| Yo solo | Un equipo con roles diferenciados |

La metodología que se desarrolló en este repo es, en esencia, una respuesta a esta pregunta: **¿cómo sostengo la disciplina de producto cuando estoy programando solo (asistido por LLMs)?**

La respuesta fue: **simulando un equipo real con un sistema de información sólido**.

---

## 2. Cronología de la evolución metodológica

### Fase 0 · Fundación (2026-03-11)
- Primer commit. Scaffold inicial.
- Se crean **9 agentes fundacionales** desde el día 1: `architecture`, `documentation`, `git-expert`, `orchestrator`, `performance`, `pr-reviewer`, `security`, `testing`, `ui-reviewer`.
- Aparece el primer PRD sistemático (security hardening).
- Primeras *skills* operativas: `no-create-files`, `read-only`.

> **Insight**: la metodología no se *agregó* al repo, **nació con él**. La decisión más importante fue tratar el setup metodológico como infraestructura, no como agregado posterior.

### Fase 1 · Reorganización de la información (2026-03-13 al 15)
- Reorganización mayor de `docs/` en estructura modular: `feat/`, `procedures/`, `reference/`.
- Aparece el primer auditor de dominio: `privacy-policy`.
- Salto de versiones v1.4 → v2.3 — primer release maduro.
- Se incorporan 9 auditores especializados: `admin-metrics-auditor`, `changelog-writer`, `ci-guardian`, `continuous-improvement`, `dark-mode-auditor`, `dependency-updater`, `help-docs-reviewer`, `seed-manager`, `perf-auditor`.

### Fase 2 · El workflow PRD-specs-plan (2026-03-20 al abr-01)
- **2026-03-20**: Aparece `prd-writer` y `pre-implementation-gate`. Se formaliza la regla "**no se codea sin PRD aprobado**".
- **2026-03-23**: Auditor `offline-auditor` (PWA-first).
- **2026-03-27 al 31**: Aparecen los primeros agentes con **nombre humano**: `Luna` (frontend), `Manu` (tech lead), `Nico` (backend). Nace el equipo.
- **2026-04-01**: `Cami` (UX writer). Skill `/merge` se refuerza con gates de security/UI/offline y obligación de tests para hooks/services nuevos.

### Fase 3 · Validación cruzada (2026-04-22 al 25)
El cambio cualitativo más grande. Aparecen los **revisores humanizados** con protocolo de 2 ciclos:
- **Sofia** — analista funcional, revisa PRDs.
- **Diego** — solution architect, revisa specs.
- **Pablo** — delivery lead, revisa planes.
- **Thanos** — auditor adversarial post-implementación, "asume que algo se va a romper".

Se introduce el **convergence enforcer**: baseline cuantificado de guards (R1–R14) que solo puede *bajar* — ningún PR puede empeorar el score de calidad.

### Fase 4 · Sistema en régimen (2026-04-29 al 05-02)
- **Tanda A** completa (v2.44.0): primer ciclo full con Sofia-Diego-Pablo.
- **Tanda B** completa (v2.47.0): merge gate con downgrade automático.
- **Tanda C** completa (v2.49.0): metodología estable.

### Fase 5 · Consolidación (2026-05-16)
- v2.51.0. Sistema en su forma actual: **34 agentes**, **10 skills**, **701 archivos .md** en `docs/`, ~1.500 commits.

**Aceleración**: 51 releases en 66 días — un ritmo solo sostenible porque la metodología absorbe la complejidad.

---

## 3. Los pilares metodológicos

### 3.1 · El flujo PRD → specs → plan → implementación

Todo trabajo no-trivial sigue el mismo carril:

```
Issue de GitHub
   ↓ prd-writer
PRD.md  ←→  Sofia (analista funcional, máx 2 ciclos)
   ↓ specs-plan-writer
specs.md  ←→  Diego (architect, máx 2 ciclos)
   ↓
plan.md  ←→  Pablo (delivery lead, máx 2 ciclos)
   ↓ pre-implementation-gate
[verifica que existan PRD + specs + plan validados]
   ↓
Implementación (Luna frontend / Nico backend)
   ↓
Thanos (adversarial review post-impl, máx 2 ciclos)
   ↓ /merge
8 fases de gates + audits
   ↓
new-home (base branch) → staging → main
```

**Tres reglas no negociables**:
1. **No-code sin PRD aprobado** (memoria persistente, `feedback_workflow_methodology.md`).
2. **El revisor puede pedir ajustes máximo 2 veces** — evita ciclos infinitos.
3. **El gate `pre-implementation-gate` es bloqueante**: si falta cualquiera de los 3 documentos, no se mergea.

> **Punto fuerte**: separar pensar (PRD) de diseñar (specs) de planear (plan) de ejecutar (impl) obliga a tomar cada decisión en el momento correcto. Programar "antes de tiempo" cuesta más caro que el papeleo.

### 3.2 · El team virtual

Se conformó un equipo de **8 personajes con nombre humano** + **26 especialistas funcionales**.

**Equipo principal (los que tienen "personalidad"):**

| Nombre | Rol real | Modo |
|---|---|---|
| **Manu** | Staff Engineer / Tech Lead | Orquesta, delega, code review. **No codea.** |
| **Luna** | Senior Frontend | Implementa UI, hooks, componentes, mapa. |
| **Nico** | Senior Backend | Cloud Functions, Firestore, rules, services. |
| **Sofia** | Analista funcional | Valida PRDs (completitud, edge cases PWA). |
| **Diego** | Solution Architect | Valida specs técnicas. |
| **Pablo** | Delivery Lead | Valida planes (riesgo, rollback, granularidad). |
| **Cami** | UX Writer | Audita copy (voseo, tildes, terminología). |
| **Thanos** | Auditor adversarial | "Asume que algo va a romperse." |

**Especialistas funcionales (sin personalidad, dominio puro):**
`security`, `performance`, `architecture`, `testing`, `dark-mode-auditor`, `ui-reviewer`, `ui-ux-accessibility`, `copy-auditor`, `offline-auditor`, `privacy-policy`, `perf-auditor`, `admin-metrics-auditor`, `help-docs-reviewer`, `pr-reviewer`, `ci-guardian`, `dependency-updater`, `seed-manager`, `docs-site-maintainer`, `documentation`, `changelog-writer`, `continuous-improvement`, `git-expert`, `prd-writer`, `specs-plan-writer`, `pre-implementation-gate`, `claude-code-guide`.

> **¿Por qué nombrar a los agentes?** Personalizar los revisores cambia la *relación cognitiva* con la herramienta. "Sofia te pidió que clarifiques el flujo offline" pesa distinto que "el agente A123 detectó un gap". El nombre construye accountability y conversación. Los revisores se vuelven colegas.

**Separación de poderes**:
- Solo **`git-expert`** está autorizado a ejecutar comandos `git`. Ningún otro agente toca el repo.
- Los **auditores son read-only**. Los **implementadores son read-write**.
- El **tech lead (Manu) no escribe código** — solo delega y revisa.

Esto es una abstracción importada del mundo real: en un equipo sano, el tech lead que codea es el tech lead que no orquesta.

### 3.3 · El sistema de gates

Se construyó una **escalera de validación en 4 capas**, todas ejecutadas por el comando `/merge`:

```
Pre-flight  → ¿rama correcta? ¿working tree limpio?
   ↓
Phase 0a    → Guards regression (mechanical grep vs baseline)
Phase 0b    → ¿Existen PRD + specs + plan? (solo feat/)
   ↓
Phase 1     → Quality gates (lint, tsc, tests, build, coverage 80%,
              file size ≤400 líneas, Firestore rules, accessibility,
              offline-readiness, billing, secrets)
   ↓
Phase 2     → 11 auditorías paralelas (Thanos, security, dark-mode,
              architecture, UI, performance, privacy, offline, copy,
              admin-metrics, perf-instrumentation)
   ↓
Phase 3     → Actualización automática de docs (project-reference,
              privacy-policy, seeds, help-docs)
   ↓
Phase 4-5   → Merge a new-home + version bump + push + tag
   ↓
Phase 6-8   → Tech debt issues + continuous-improvement + self-reflection
```

**Convergence enforcer**: el baseline de R1–R14 (14 reglas de calidad cuantificadas) **solo puede bajar**. Si tu PR sube el contador de `any` o de `console.log`, no mergea.

> **Punto fuerte**: el gate no es un "checklist mental" — es código. Lo que no se mide, no se cumple. Y lo que se mide automáticamente, se cumple sin discusión.

### 3.4 · Documentación viva

La documentación es **infraestructura de primera clase**, no un agregado.

```
docs/
├── feat/          ← 7 dominios × N features (cada uno: prd.md + specs.md + plan.md)
├── fix/           ← bugs resueltos (misma estructura)
├── chore/         ← refactors y deuda técnica
├── procedures/    ← runbooks operativos (worktree, staging, rollback)
├── reference/     ← arquitectura, patrones, schema, guards
├── design/        ← decisiones de diseño, paletas
└── reports/       ← health checks, postmortems
```

**Publicación automática a GitHub Pages** via Docsify. La documentación se actualiza en cada merge. El sidebar se regenera con un agente (`docs-site-maintainer`).

**El archivo más importante**: `docs/reference/project-reference.md` — versión + stack + estado, *autoritativo*. Es el "estado del producto" en una sola hoja.

> **Insight**: cuando la documentación es un *side effect* del merge, no se desactualiza. Cuando es un *paso manual aparte*, sí.

### 3.5 · Memoria persistente

Sistema de memoria por archivos en `~/.claude/projects/.../memory/`. **No es ruido** — es un currículum de aprendizajes operacionales.

Categorías:
- **User**: nombre, workflow (Telegram, GH Pages).
- **Project**: base branch (`new-home`, no `main`), publicación de docs.
- **Feedback**: 25+ reglas operacionales destiladas de incidentes reales:
  - "Nunca mergear sin la skill `/merge`"
  - "Verificar `isAdmin()` en Firestore rules antes de deployar admin queries"
  - "Worktrees: usar paths absolutos (cwd se resetea)"
  - "MUI Chip padding: cambiar `size` prop, no pelear con sx"
  - "Pre-push hook tarda 90s en la Pi — no es un cuelgue"
  - "Nunca exponer existencia de usuarios en búsqueda"
  - "Saltar coverage local si los agentes paralelos saturan la Pi"

> **Punto fuerte**: cada vez que algo salió mal, se destiló en una regla. Las reglas viven con el repo. La próxima sesión no comete el mismo error. **Esto es aprendizaje continuo a nivel de equipo, no de individuo.**

### 3.6 · Skills como músculo automatizado

10 skills (`/start`, `/merge`, `/stage`, `/release`, `/bump`, `/audit`, `/health-check`, `/review-pr`, `/bulk-prd`, `/deps`). Cada una encapsula un procedimiento entero.

> **¿Por qué importan?** Una operación documentada en prosa exige que alguien la lea y la siga. Una operación encapsulada en una skill **se ejecuta igual cada vez**. Los runbooks se convierten en comandos.

Ejemplo: el merge a main no es "leer una página y hacer 30 checks". Es `/merge`. La skill corre las 8 fases, los 11 auditores, la actualización de docs y el version bump. **El procedimiento es código**.

---

## 4. Puntos fuertes del sistema

### 4.1 · Disciplina sin burocracia
La validación es estricta pero **automatizada**. Ningún paso del flujo requiere que alguien recuerde algo — el gate lo recuerda por vos.

### 4.2 · Separación de planos
Pensar (PRD), diseñar (specs), planear (plan), ejecutar (impl) son **pasos separados con dueños distintos**. Esto previene la trampa clásica: codear antes de entender.

### 4.3 · Adversarial review como hábito
Thanos no es un "nice-to-have" — corre en cada feature implementada. **Asumir que algo va a romperse** previene más bugs que cualquier suite de tests.

### 4.4 · Memoria que aprende
Cada error genera una regla. Las reglas viven en el repo. El sistema se vuelve más robusto con el tiempo, no más frágil.

### 4.5 · Equipo simulado con accountability
Los nombres importan. Sofia, Diego, Pablo, Cami, Thanos no son herramientas — son **colegas con criterio**. El usuario se siente parte de un equipo, no operando una fábrica.

### 4.6 · Documentación como side effect
La doc se actualiza en el merge, no después. La probabilidad de que se desactualice tiende a cero.

### 4.7 · Worktrees para paralelismo
Múltiples agentes pueden trabajar en paralelo sin pisarse, en worktrees aislados. Luna toca el frontend, Nico toca el backend, cada uno en su árbol. Integración explícita al final.

### 4.8 · Velocidad sostenible
51 releases en 66 días no es agotador — es **agradable**, porque cada release es predecible.

---

## 5. Aprendizajes y fricciones

Honestidad: el sistema no es perfecto. Algunos aprendizajes destilados:

### Lo que costó aprender
- **No saltar el flujo nunca, ni cuando es "trivial"**. La regla "no-code sin PRD" se rompió varias veces al principio, siempre con costo posterior.
- **Worktrees tienen permisos limitados**: los agentes en worktree no pueden hacer todo lo que hace el agente principal. Se simplificó priorizando implementación directa cuando hay overlap.
- **La Raspberry Pi como entorno** introduce sus propios límites: el pre-push hook tarda ~90s, los agentes paralelos saturan CPU. Hay reglas explícitas para cuándo *no* correr coverage local.

### Las fricciones que llevaron a mejoras
- **Agentes paralelos pisándose archivos** → se introdujo *file ownership* explícito en planes con múltiples implementadores.
- **Decisiones perdidas entre sesiones** → memoria persistente.
- **Documentos desactualizados** → automatización en `/merge` Phase 3.
- **Reviewers en loops infinitos** → protocolo de **máximo 2 ciclos** por revisor.

> El sistema **se construyó a sí mismo** vía el agente `continuous-improvement`, que después de cada merge propone refinamientos al workflow basado en las fricciones observadas. **El método mejora el método.**

---

## 6. Claves para llevarse (talking points para la charla)

1. **La metodología no se agrega después** — se diseña desde el primer commit.
2. **Separá pensar de codear** con artefactos explícitos (PRD ≠ specs ≠ plan ≠ código).
3. **Nombrá a tus revisores** — convierte herramientas en colegas y mejora la relación cognitiva.
4. **El gate más útil es el que es código**, no el que es checklist.
5. **El convergence enforcer es magia**: solo permitir que la calidad mejore. Nunca empeore.
6. **Memoria persistente = aprendizaje de equipo**. Cada error vive como regla.
7. **Documentación = side effect del merge**, no tarea aparte.
8. **Adversarial review como hábito**, no como excepción ("asumí que algo se rompe").
9. **El tech lead no codea** — orquesta. Esa separación es disciplinaria.
10. **El método mejora el método** vía `continuous-improvement`: el sistema es reflexivo.

---

## 7. La pregunta de cierre

> ¿Es esto sobreingeniería para un proyecto solo?

No, si el objetivo es **operar un producto**, no escribir código.

El esfuerzo de armar el sistema (gates, skills, agentes, memoria, docs) se amortiza después del feature ~5. A partir de ahí, cada feature nueva *cuesta menos* que en un repo sin metodología, porque las decisiones recurrentes ya están resueltas.

**De programador a producto** no es un cambio de herramientas — es un cambio de **lo que considerás que es tu trabajo**.

El programador escribe código. El producto opera un sistema. Modo Mapa es la traducción concreta de ese cambio.

---

*Informe generado a partir del estado del repo al 2026-05-30. Para los detalles técnicos, ver `docs/reference/project-reference.md`. Para los procedimientos, `docs/procedures/`. Para el equipo, `.claude/agents/`.*

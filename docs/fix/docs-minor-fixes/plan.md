# Plan: docs: minor fixes — broken link, version mismatch, badges vs achievements

**Specs:** [specs.md](specs.md)
**Fecha:** 2026-03-29

---

## Fases de implementacion

### Fase 1: Corregir inconsistencias en docs

**Branch:** `fix/docs-minor-fixes`

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `docs/reports/README.md` | Eliminar la fila `Usability Report 2026-03-14 / usability-report-2026-03-14.md` de la tabla. Dejar solo la fila de `Tech Debt Backlog` |
| 2 | `docs/reports/backlog-producto.md` | En linea 38, cambiar `v2.10.0 – v2.30.0` a `v2.10.0 – v2.30.4` |
| 3 | `docs/reports/tech-debt.md` | En linea 3, cambiar `**Ultima actualizacion:** 2026-03-25` a `**Ultima actualizacion:** 2026-03-29` |
| 4 | `docs/reference/features.md` | Agregar subseccion `## Sistemas de reconocimiento: Achievements y Badges` despues de la seccion `## HomeScreen -- SpecialsSection`. Contenido: distinguir Achievements (8 tipos, goal-based, `src/constants/achievements.ts`, servicio `src/services/achievements.ts`, coleccion Firestore `achievements`) de Badges (11 tipos, activity-based, `src/constants/badges.ts`, funcion `evaluateBadges()`, usados en Rankings). Listar los tipos de cada sistema |

### Fase 2: Documentacion (OBLIGATORIA)

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `docs/_sidebar.md` | Agregar entradas Specs y Plan bajo `docs-minor-fixes` |

---

## Orden de implementacion

1. `docs/reports/README.md` — eliminar link roto (sin dependencias)
2. `docs/reports/backlog-producto.md` — actualizar version (sin dependencias)
3. `docs/reports/tech-debt.md` — actualizar fecha (sin dependencias)
4. `docs/reference/features.md` — agregar subseccion badges vs achievements (sin dependencias)
5. `docs/_sidebar.md` — agregar entradas de specs y plan

Los pasos 1-4 son independientes entre si y pueden ejecutarse en cualquier orden.

## Riesgos

1. **Markdownlint**: los archivos modificados deben cumplir con `.markdownlint.json` (blank lines around headings/lists/fences). Mitigacion: verificar lint antes de commit.
2. **GH Pages build**: un error de formato en markdown podria romper el build de docsify. Mitigacion: verificar que la estructura de tablas y headings sea correcta.

## Guardrails de modularidad

No aplica. No se crea ni modifica codigo fuente.

- [x] Ningun componente nuevo importa `firebase/firestore` directamente — N/A
- [x] Archivos nuevos en carpeta de dominio correcta — N/A
- [x] Logica de negocio en hooks/services, no en componentes — N/A
- [x] Si se toca un archivo con deuda tecnica, se incluye el fix en el plan — N/A
- [x] Ningun archivo resultante supera 400 lineas — N/A

### File size estimation

| Archivo | Lineas actuales | Lineas estimadas post-cambio | Supera 400? |
|---------|----------------|------------------------------|-------------|
| `docs/reports/README.md` | 8 | 7 | No |
| `docs/reports/backlog-producto.md` | ~120 | ~120 | No |
| `docs/reports/tech-debt.md` | ~49 | ~49 | No |
| `docs/reference/features.md` | ~380 | ~400 | No |

## Fase final: Documentacion (OBLIGATORIA)

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `docs/_sidebar.md` | Agregar Specs y Plan bajo la entrada existente de `docs-minor-fixes` |

No se requieren actualizaciones a `security.md`, `firestore.md`, `patterns.md`, ni `project-reference.md` porque este fix solo corrige documentacion existente sin cambios funcionales.

## Criterios de done

- [x] All items from PRD scope implemented
- [x] No lint errors (markdownlint)
- [x] GH Pages build succeeds
- [ ] S1: `docs/reports/README.md` no contiene link roto a `usability-report-2026-03-14.md`
- [ ] S2: `docs/reports/backlog-producto.md` dice `v2.10.0 – v2.30.4`
- [ ] S3: `docs/reports/tech-debt.md` tiene fecha `2026-03-29`
- [ ] S4: `docs/reference/features.md` distingue Achievements (8, goal-based) de Badges (11, activity-based)
- [ ] `docs/_sidebar.md` tiene entradas para specs.md y plan.md

# Plan: Copy Fixes #282 — Tildes y Voseo v2

**Specs:** [specs.md](specs.md)
**Fecha:** 2026-03-31

---

## Fases de implementacion

### Fase 1: Correcciones user-facing

**Branch:** `fix/282-copy-v2`

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/components/home/QuickActions.tsx:151` | `Acciones rapidas` → `Acciones rápidas` |
| 2 | `src/components/home/YourInterestsSection.tsx:57` | `Segui temas` → `Seguí temas` |
| 3 | `src/components/home/YourInterestsSection.tsx:83` | `Explorar mas tags` → `Explorar más tags` |
| 4 | `src/components/social/ReceivedRecommendations.tsx:94` | `Segui a otros` → `Seguí a otros` |
| 5 | `src/components/lists/ListDetailScreen.tsx:208` | `Agrega comercios` → `Agregá comercios` |

### Fase 2: Correcciones admin

| Paso | Archivo | Cambio |
|------|---------|--------|
| 6 | `src/components/admin/ListStatsSection.tsx:27` | `Estadisticas de Listas` → `Estadísticas de Listas` |
| 7 | `src/components/admin/ListStatsSection.tsx:33` | `Publicas` → `Públicas` |
| 8 | `src/components/admin/ListStatsSection.tsx:52` | `Listas mas grandes` → `Listas más grandes` |
| 9 | `src/components/admin/audit/DeletionAuditPanel.tsx:234` | `Cargar mas` → `Cargar más` |
| 10 | `src/components/admin/BackupsPanel.tsx:261` | `Cargar mas` → `Cargar más` |

### Fase 3: Documentacion

| Paso | Archivo | Cambio |
|------|---------|--------|
| 11 | `docs/_sidebar.md` | Agregar entradas Specs y Plan bajo Fixes > #282 |

---

## Orden de implementacion

1. Los 10 pasos son independientes entre si — se pueden aplicar en cualquier orden.
2. Commit unico con los 10 archivos modificados.

---

## Riesgos

- **Regresion nula**: son reemplazos de string literales dentro de JSX. No hay riesgo de
  romper logica, tipos ni tests.
- **Colision con rama paralela**: si otra rama toca los mismos archivos, el merge es trivial
  porque los contextos de linea son distintos.

---

## Criterios de done

- [ ] Los 10 strings corregidos verificados visualmente en dev
- [ ] `npm run lint` sin errores
- [ ] `npm run build` exitoso
- [ ] No hay nuevos strings mal escritos introducidos

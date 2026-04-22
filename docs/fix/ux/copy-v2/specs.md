# Specs: Copy Fixes #282 — Tildes y Voseo v2

**Issue:** #282
**Fecha:** 2026-03-31

---

## Descripcion

Correcciones ortograficas puras: 10 strings visibles al usuario con tildes faltantes o voseo
incorrecto. Sin cambios de logica, tipos, reglas ni tests.

---

## Correcciones

### User-facing (5)

| # | Archivo | Linea | Actual | Correcto |
|---|---------|-------|--------|----------|
| 1 | `src/components/home/QuickActions.tsx` | 151 | `Acciones rapidas` | `Acciones rápidas` |
| 2 | `src/components/home/YourInterestsSection.tsx` | 57 | `Segui temas que te interesan` | `Seguí temas que te interesan` |
| 3 | `src/components/home/YourInterestsSection.tsx` | 83 | `Explorar mas tags` | `Explorar más tags` |
| 4 | `src/components/social/ReceivedRecommendations.tsx` | 94 | `Segui a otros usuarios para empezar!` | `Seguí a otros usuarios para empezar!` |
| 5 | `src/components/lists/ListDetailScreen.tsx` | 208 | `Agrega comercios desde el mapa` | `Agregá comercios desde el mapa` |

### Admin (5)

| # | Archivo | Linea | Actual | Correcto |
|---|---------|-------|--------|----------|
| 6 | `src/components/admin/ListStatsSection.tsx` | 27 | `Estadisticas de Listas` | `Estadísticas de Listas` |
| 7 | `src/components/admin/ListStatsSection.tsx` | 33 | `Publicas` | `Públicas` |
| 8 | `src/components/admin/ListStatsSection.tsx` | 52 | `Listas mas grandes` | `Listas más grandes` |
| 9 | `src/components/admin/audit/DeletionAuditPanel.tsx` | 234 | `Cargar mas` | `Cargar más` |
| 10 | `src/components/admin/BackupsPanel.tsx` | 261 | `Cargar mas` | `Cargar más` |

---

## Notas tecnicas

- Cambios de tipo `s/texto/texto/` — sin impacto en props, tipos ni tests existentes.
- `ListStatsSection.tsx` tiene tres correcciones en el mismo archivo (items 6, 7, 8).
- No se introducen nuevos strings a `src/constants/messages/` porque estos textos son
  especificos de cada componente y no se reutilizan.
- No hay cambios de datos, Firestore, Cloud Functions, seed, hooks, servicios ni analytics.

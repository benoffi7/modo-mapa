# Plan: #309 Tech debt copy — tildes faltantes + terminologia Sorprendeme

**Feature:** 309-copy-tildes-sorprendeme
**PRD:** [prd.md](./prd.md)
**Specs:** [specs.md](./specs.md)
**Fecha:** 2026-04-18

---

## Estrategia

4 commits atomicos en un solo branch `fix/309-copy-tildes-sorprendeme` (branch desde `new-home`, merge a `new-home`). Cada commit cubre una seccion del PRD (S1, S2, S3, S4) para facilitar bisect si algun test rompe.

Orden elegido: S1 → S2 → S4 → S3 (S3 al final porque modifica mas archivos y depende de que no haya conflictos con los anteriores).

---

## Prerequisitos

- [ ] Estar en branch `new-home` limpio
- [ ] `npm install` al dia
- [ ] `npm run test:run` verde baseline
- [ ] Issue #309 leido completo

---

## Paso 1 — Setup

1. Crear branch desde `new-home`:
   ```bash
   git checkout new-home && git pull
   git checkout -b fix/309-copy-tildes-sorprendeme
   ```
2. Verificar que los 5 archivos con tildes reportados existen y las lineas coinciden con el issue:
   - `src/components/profile/NotificationsSection.tsx`
   - `src/components/admin/NotificationsPanel.tsx`
   - `src/components/admin/SocialPanel.tsx`
   - `src/components/admin/CronHealthSection.tsx`
   - `src/components/admin/AdminLayout.tsx`
   - `src/components/admin/features/ga4FeatureDefinitions.ts`

---

## Paso 2 — Commit 1 (S1: Fix tildes)

**Archivos:**

- `src/components/profile/NotificationsSection.tsx` linea 49
- `src/components/admin/NotificationsPanel.tsx` lineas 38, 41, 55, 56 (y header table cell linea 66 si aplica)
- `src/components/admin/SocialPanel.tsx` lineas 61, 86
- `src/components/admin/CronHealthSection.tsx` linea 93
- `src/components/admin/AdminLayout.tsx` linea 69
- `src/components/admin/features/ga4FeatureDefinitions.ts` lineas 117, 126, 135

**Cambios:**

| File | Antes | Despues |
|------|-------|---------|
| NotificationsSection:49 | `Marcar todas como leidas` | `Marcar todas como leídas` |
| NotificationsPanel:38 | `label="Leidas"` | `label="Leídas"` |
| NotificationsPanel:41 | `label="No leidas"` | `label="No leídas"` |
| NotificationsPanel:55 | `<TableCell>Leidas</TableCell>` | `<TableCell>Leídas</TableCell>` |
| NotificationsPanel:56 | `<TableCell>No leidas</TableCell>` | `<TableCell>No leídas</TableCell>` |
| SocialPanel:61 | `label="Reco. leidas"` | `label="Reco. leídas"` |
| SocialPanel:86 | `title="Top 10 — Mas seguidos"` | `title="Top 10 — Más seguidos"` |
| CronHealthSection:93 | `title="Distribucion de Tiers"` | `title="Distribución de Tiers"` |
| AdminLayout:69 | `<Tab label="Auditorias" />` | `<Tab label="Auditorías" />` |
| ga4FeatureDefinitions:117 | `name: 'Acciones rapidas'` | `name: 'Acciones rápidas'` |
| ga4FeatureDefinitions:126 | `name: 'Seccion intereses'` | `name: 'Sección intereses'` |
| ga4FeatureDefinitions:135 | `name: 'Seccion digest'` | `name: 'Sección digest'` |

**Validacion:**

```bash
npm run typecheck
npm run lint
npm run test:run -- src/components/admin src/components/profile
```

**Commit:**

```bash
git add -A
git commit -m "fix(#309): tildes faltantes en paneles admin y profile (S1)"
```

---

## Paso 3 — Commit 2 (S2: Unificar Sorprendeme)

**Archivos:**

- `src/components/home/QuickActions.tsx` linea 50
- `src/components/profile/HelpSection.tsx` linea 50
- `src/components/admin/features/ga4FeatureDefinitions.ts` linea 190

**Cambios:**

| File | Antes | Despues |
|------|-------|---------|
| QuickActions:50 | `label: 'Sorpresa'` | `label: 'Sorprendeme'` |
| HelpSection:50 | `probar "Sorpréndeme"` | `probar "Sorprendeme"` |
| ga4FeatureDefinitions:190 | `name: 'Sorprendeme!'` | `name: 'Sorprendeme'` |

**Validacion:**

```bash
npm run typecheck
npm run lint
# Verificar que no hay mas variantes residuales en el codigo
grep -rnE "Sorp(resa|réndeme)" src/
# Esperado: 0 resultados
```

**Commit:**

```bash
git add -A
git commit -m "fix(#309): unificar terminologia Sorprendeme (S2)"
```

---

## Paso 4 — Commit 3 (S4: Mensajes de error accionables)

**Archivos:**

- `src/constants/messages/common.ts` linea 9
- `src/constants/messages/checkin.ts` linea 6

**Cambios:**

| File | Antes | Despues |
|------|-------|---------|
| common.ts:9 | `settingUpdateError: 'No se pudo guardar el cambio'` | `settingUpdateError: 'No pudimos guardar el cambio. Intentá de nuevo.'` |
| checkin.ts:6 | `error: 'Error al hacer check-in'` | `error: 'No se pudo registrar la visita. Intentá de nuevo.'` |

**Validacion:**

```bash
npm run typecheck
npm run lint
# Buscar tests que hardcodean los strings viejos
grep -rn 'No se pudo guardar el cambio\|Error al hacer check-in' src/
# Si hay, ajustar assertions para consumir MSG_* en vez de literal.
npm run test:run -- src/hooks/useUserSettings
npm run test:run -- src/services/checkins
```

**Commit:**

```bash
git add -A
git commit -m "fix(#309): mensajes de error mas accionables (S4)"
```

---

## Paso 5 — Commit 4 (S3: Centralizar strings en MSG_COMMON)

Este es el commit mas grande. Dividir en 3 sub-pasos.

### 5.1 — Extender `MSG_COMMON`

**Archivo:** `src/constants/messages/common.ts`

Agregar las 6 claves nuevas despues de `settingUpdateError`:

```ts
  // Nuevos (aria-labels y acciones comunes)
  closeAriaLabel: 'Cerrar',
  closeNoticeAriaLabel: 'Cerrar aviso',
  loadMore: 'Cargar más',
  loading: 'Cargando...',
  genericErrorTitle: 'Algo salió mal',
  genericErrorBody: 'Ocurrió un error inesperado. Intentá recargar la página.',
```

**Validacion:**

```bash
npm run typecheck
```

### 5.2 — Migrar call sites a `MSG_COMMON`

Aplicar el patron `import { MSG_COMMON } from '...constants/messages'` + reemplazo del string literal en cada archivo listado en specs.md > "Archivos a tocar".

Lista de archivos en orden alfabetico:

1. `src/components/admin/AbuseAlerts.tsx` — `Cargar más (${N}…)` → `` `${MSG_COMMON.loadMore} (${N}…)` ``
2. `src/components/admin/BackupsPanel.tsx` — linea 218 loading/loadMore
3. `src/components/admin/audit/DeletionAuditPanel.tsx` — linea 234 loading/loadMore
4. `src/components/business/MenuPhotoViewer.tsx` — aria-label Cerrar (linea 66)
5. `src/components/common/PaginatedListShell.tsx` — lineas 110, 113 loadMore/loading
6. `src/components/home/SpecialsSection.tsx` — aria-label Cerrar (linea 117)
7. `src/components/layout/ErrorBoundary.tsx` — lineas 55, 57 error title/body
8. `src/components/lists/FavoritesList.tsx` — lineas 138, 223 loading/loadMore
9. `src/components/onboarding/AccountBanner.tsx` — aria-label Cerrar aviso (linea 77)
10. `src/components/profile/AvatarPicker.tsx` — aria-label Cerrar (linea 18)
11. `src/components/profile/RatingsList.tsx` — lineas 71, 153 loading/loadMore
12. `src/components/search/SearchScreen.tsx` — aria-label Cerrar aviso (linea 49)
13. `src/components/social/UserProfileModal.tsx` — aria-label Cerrar (linea 62)
14. `src/components/ui/RatingPromptBanner.tsx` — aria-label Cerrar (linea 42)
15. `src/components/ui/StaleBanner.tsx` — aria-label Cerrar aviso (linea 53)
16. `src/context/ToastContext.tsx` — aria-label Cerrar (linea 59)

**Validacion despues de cada lote de 4 archivos:**

```bash
npm run typecheck
```

### 5.3 — Ajustar tests que dependen de los strings

**Archivos:**

- `src/components/layout/ErrorBoundary.test.tsx` lineas 34, 35, 67

```ts
import { MSG_COMMON } from '../../constants/messages';

expect(screen.getByText(MSG_COMMON.genericErrorTitle)).toBeInTheDocument();
expect(screen.getByText(MSG_COMMON.genericErrorBody)).toBeInTheDocument();
// linea 67 igual
```

- Revisar `src/components/onboarding/AccountBanner.test.tsx:61` — si busca por texto `'Cerrar aviso'`, cambiar a `MSG_COMMON.closeNoticeAriaLabel`:

```bash
grep -n "Cerrar aviso\|Cerrar\b" src/components/onboarding/AccountBanner.test.tsx
```

Si el test usa `getByRole('button', { name: 'Cerrar aviso' })`, funciona igual porque el aria-label sigue siendo 'Cerrar aviso' (solo que ahora via constante). No requiere cambio salvo que el proyecto prefiera tests que importen la constante para desacoplar.

- Revisar `src/components/ui/RatingPromptBanner.test.tsx:29` — mismo analisis.

**Validacion final:**

```bash
npm run typecheck
npm run lint
npm run test:run
```

### 5.4 — Actualizar `docs/reference/features.md`

Cambiar las menciones de "Sorpréndeme" a "Sorprendeme" para documentar el nombre canonico:

```bash
grep -n "Sorpréndeme\|sorpréndeme" docs/reference/features.md
# aplicar replace en cada match
```

**Commit:**

```bash
git add -A
git commit -m "fix(#309): centralizar strings comunes en MSG_COMMON + tests + docs (S3)"
```

---

## Paso 6 — Validacion final

```bash
# Lint y typecheck
npm run lint
npm run typecheck

# Tests completos
npm run test:run
npm run test:coverage

# Build
npm run build

# Grep anti-regresiones
grep -rnE "leidas|Leidas|No leidas|Auditorias|Distribucion|Acciones rapidas|Seccion (intereses|digest)|Mas seguidos|Sorp(resa|réndeme)|Sorprendeme!" src/ docs/reference/features.md
# Esperado: 0 matches user-facing (puede haber matches en test files si algun test hardcodea el texto viejo — investigar)

# Opcional: correr el copy-auditor agent manualmente si esta disponible
```

Actualizar `docs/_sidebar.md` agregando esta entrada en la seccion Fixes (ver Paso 8).

---

## Paso 7 — PR

```bash
git push -u origin fix/309-copy-tildes-sorprendeme

gh pr create --base new-home --title "fix(#309): tildes, unificar Sorprendeme y centralizar strings comunes" --body "$(cat <<'EOF'
## Summary

- S1: corrige 11 tildes faltantes en paneles admin y profile
- S2: unifica la terminologia Sorprendeme (3 variantes → 1) en QuickActions, HelpSection y ga4FeatureDefinitions
- S3: centraliza strings repetidos (`Cerrar`, `Cerrar aviso`, `Cargar más`, `Cargando...`, error boundary title/body) en `MSG_COMMON` y los consume desde 16 call sites
- S4: mejora la redaccion de 2 mensajes de error para ser mas accionables

Cierra #309.

## Test plan

- [ ] npm run lint verde
- [ ] npm run typecheck verde
- [ ] npm run test:run verde (incluye ErrorBoundary.test.tsx ajustado)
- [ ] npm run build verde
- [ ] grep anti-regresion 0 matches para las variantes viejas
- [ ] Review visual: admin panel muestra tildes correctos en tabs y tabla
- [ ] Review visual: home QuickActions muestra "Sorprendeme" en vez de "Sorpresa"
- [ ] Review visual: HelpSection menciona "Sorprendeme" en la descripcion de Inicio
EOF
)"
```

---

## Paso 8 — Post-merge

- [ ] Actualizar `docs/_sidebar.md` — agregar entrada en seccion **Fixes**:

```markdown
  - [#309 Copy tildes + Sorprendeme + MSG_COMMON](/fix/ux/309-copy-tildes-sorprendeme/prd.md)
    - [Specs](/fix/ux/309-copy-tildes-sorprendeme/specs.md)
    - [Plan](/fix/ux/309-copy-tildes-sorprendeme/plan.md)
```

- [ ] (opcional, si el usuario lo solicita) Actualizar `docs/reports/changelog.md` con una linea referenciando el issue.
- [ ] Confirmar que `docs/reference/features.md` fue actualizado en el mismo PR (Sorpréndeme → Sorprendeme).
- [ ] Cerrar issue #309 automatic via PR body.

---

## Checklist de integracion

- [ ] Branch desde `new-home` (base correcto)
- [ ] PR apunta a `new-home` (no a `main`)
- [ ] 4 commits atomicos (S1, S2, S4, S3)
- [ ] Todos los tests existentes pasan
- [ ] Copy auditor re-ejecutado sobre `new-home` post-merge devuelve 0 issues en los archivos tocados
- [ ] `docs/_sidebar.md` actualizado
- [ ] Issue #309 cerrado via PR

---

## Estimacion

- S1: 15 min (11 reemplazos directos)
- S2: 10 min (3 reemplazos)
- S4: 10 min (2 strings)
- S3: 60-90 min (16 archivos con imports + test adjustment + docs update)
- Validacion + PR: 20 min

**Total:** 2-2.5 horas.

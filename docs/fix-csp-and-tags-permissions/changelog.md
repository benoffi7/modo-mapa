# Changelog: Fix CSP Policy & Custom Tags Permissions

## Documentación creada

- `docs/fix-csp-and-tags-permissions/prd.md`
- `docs/fix-csp-and-tags-permissions/specs.md`
- `docs/fix-csp-and-tags-permissions/plan.md`
- `docs/fix-csp-and-tags-permissions/changelog.md`

## Archivos modificados

- `firebase.json` — Agregado `https://apis.google.com` a directiva `script-src` del CSP
- `src/components/business/BusinessTags.tsx` — Agregado guard `if (!user)` en `loadTags()` para evitar query sin autenticación
- `src/components/business/BusinessComments.tsx` — Refactorizado useEffect para cumplir reglas de lint React 19
- `eslint.config.js` — Agregado `allowConstantExport: true` para react-refresh

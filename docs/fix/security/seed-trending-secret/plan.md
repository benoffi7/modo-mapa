# Plan: #280 Remove client_secret from seed-trending.mjs

**Specs:** [specs.md](specs.md)
**Fecha:** 2026-03-31

---

## Fase 1: Remover credencial hardcodeada

**Branch:** `fix/280-seed-trending-secret`

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `scripts/seed-trending.mjs` | Eliminar imports `readFileSync`, variables `firebaseToolsPath` y `firebaseTools` (lines 12–20). Agregar imports `existsSync` y `resolve` desde `fs`/`path`. Agregar guard ADC con `process.exit(1)` si no existe `~/.config/gcloud/application_default_credentials.json`. |
| 2 | `scripts/seed-trending.mjs` | Reemplazar el bloque `admin.initializeApp({ credential: admin.credential.refreshToken({...}) })` en el branch `else` con `admin.initializeApp({ projectId: 'modo-mapa-app' })` — el SDK resuelve ADC automáticamente. |
| 3 | `docs/reference/security.md` | Agregar nota en la seccion de seed scripts: `seed-trending.mjs` ahora requiere ADC (`gcloud auth application-default login`) para `--target staging`. |

---

## Criterios de done

- [ ] `client_secret` y `client_id` no aparecen en ninguna linea del archivo
- [ ] `readFileSync` y `firebaseTools` eliminados
- [ ] Guard ADC presente (igual que seed-staging.ts)
- [ ] `node scripts/seed-trending.mjs` sin flags sigue funcionando contra emulador local
- [ ] `git grep client_secret scripts/` devuelve 0 resultados
- [ ] `docs/reference/security.md` actualizado

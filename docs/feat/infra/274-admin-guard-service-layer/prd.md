# PRD: migrar AdminGuard.tsx al service layer

**Feature:** 274-admin-guard-service-layer
**Categoria:** infra
**Fecha:** 2026-04-01
**Issue:** #274
**Prioridad:** Media

---

## Contexto

La auditoria de arquitectura (#274) detecto que 4 componentes admin usaban `httpsCallable` directamente. Desde entonces, 3 de 4 fueron migrados: `BackupsPanel` usa `services/admin/backups.ts`, `FeaturedListsPanel` usa `services/adminFeatured.ts`, `PhotoReviewCard` usa `services/adminPhotos.ts`. Solo queda `AdminGuard.tsx`.

## Problema

- **P2**: `src/components/admin/AdminGuard.tsx` importa `httpsCallable` directamente de `firebase/functions` (linea ~30) para llamar a `setAdminClaim`. Esto viola la convencion de service layer donde todos los Cloud Function calls deben pasar por `src/services/`.

## Solucion

### S1: Crear services/adminClaims.ts

Crear `src/services/adminClaims.ts` siguiendo el patron de `services/adminFeedback.ts`:

```typescript
import { httpsCallable } from 'firebase/functions';
import { functions } from '../config/firebase';

export async function setAdminClaim(uid: string): Promise<void> {
  const fn = httpsCallable(functions, 'setAdminClaim');
  await fn({ uid });
}
```

### S2: Actualizar AdminGuard.tsx

Reemplazar el import directo de `httpsCallable` y `firebase/functions` por el import de `setAdminClaim` desde `services/adminClaims.ts`. Eliminar el import dinamico de firebase/functions.

---

## Scope

| Item | Prioridad | Esfuerzo |
|------|-----------|----------|
| Crear services/adminClaims.ts | P2 | S |
| Actualizar AdminGuard.tsx para usar service | P2 | S |

**Esfuerzo total estimado:** S

---

## Tests

- Verificar que AdminGuard sigue funcionando en emulador (setAdminClaim callable)
- Verificar que no quedan imports de `firebase/functions` en AdminGuard.tsx
- Grep: ningun componente en `src/components/admin/` debe importar `httpsCallable` directamente

## Seguridad

- Sin cambios de seguridad. El callable `setAdminClaim` ya esta protegido por auth en Cloud Functions.
- Verificar que el service no expone la funcion sin validacion.

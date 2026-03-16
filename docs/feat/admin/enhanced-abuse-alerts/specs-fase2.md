# Specs: Enhanced Abuse Alerts — Fase 2

**Feature:** enhanced-abuse-alerts (Fase 2)
**Fecha:** 2026-03-16

---

## Cambios respecto a Fase 1

Fase 1 (implementada): KPI cards, filtros fecha, CSV export, tabla expandible.
Fase 2: acciones sobre alertas + detalle de usuario inline.

---

## 1. Nuevos campos en AbuseLog

Agregar campos opcionales (backwards compatible):

```typescript
// src/types/admin.ts
export interface AbuseLog {
  // ... existentes
  reviewed?: boolean;      // default false
  dismissed?: boolean;     // default false
  reviewedAt?: Date;
}
```

Actualizar converter en `adminConverters.ts` para leer los nuevos campos.

## 2. Firestore Rules

Permitir update parcial de abuseLogs por admin:

```
match /abuseLogs/{docId} {
  allow read: if isAdmin();
  allow update: if isAdmin()
    && request.resource.data.diff(resource.data).affectedKeys()
      .hasOnly(['reviewed', 'dismissed', 'reviewedAt']);
}
```

## 3. Service layer

Agregar en `src/services/admin.ts`:

```typescript
export async function reviewAbuseLog(logId: string): Promise<void>
export async function dismissAbuseLog(logId: string): Promise<void>
```

Ambas usan `updateDoc` directamente (no Cloud Function).

## 4. Acciones en AbuseAlerts.tsx

En el panel expandido de cada alerta, agregar 2 botones:

- **Revisar** (CheckCircle, verde): marca `reviewed: true, reviewedAt: serverTimestamp()`.
- **Descartar** (DeleteOutline, gris): marca `dismissed: true`.

Ambos con confirmación simple (no dialog, solo disabled durante la operación).

## 5. Filtro de estado

Agregar chip toggle antes de los filtros de tipo:

- "Pendientes" (default): excluye dismissed y reviewed.
- "Todas": muestra todo.

## 6. Detalle de usuario inline

En el panel expandido, mostrar debajo del detalle:

- Total de alertas de este usuario (conteo de `abuseLogs` filtrado en los datos ya cargados client-side).
- Tipo más frecuente de este usuario.
- Badge "Reincidente" si tiene > 3 alertas.

**No se hace query adicional** — se calcula con los datos ya cargados en el componente.

## 7. No implementar en Fase 2

- Bloquear usuario (requiere Cloud Function + Firebase Auth, se deja para Fase 3).
- Link a Firebase Console.
- Notificaciones realtime (onSnapshot).

---

## Archivos

| Archivo | Acción |
|---------|--------|
| `src/types/admin.ts` | Agregar campos reviewed/dismissed/reviewedAt |
| `src/config/adminConverters.ts` | Leer nuevos campos |
| `src/services/admin.ts` | Funciones reviewAbuseLog, dismissAbuseLog |
| `firestore.rules` | Permitir update parcial por admin |
| `src/components/admin/AbuseAlerts.tsx` | Botones acción, filtro estado, detalle usuario |

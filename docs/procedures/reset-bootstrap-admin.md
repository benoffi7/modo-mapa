# Procedimiento: Reset del bootstrap admin gate

> Introducido en #322 (Fase 5.1). Cubre recovery operativo del gate
> `config/bootstrap.adminAssigned` que protege la rama bootstrap de
> `setAdminClaim`.

## Cuando aplica

Tras el primer admin asignado, `config/bootstrap.adminAssigned === true` y la
rama bootstrap de `setAdminClaim` queda cerrada. Si el primer admin pierde
acceso (cuenta deshabilitada, password perdido, MFA roto, email comprometido),
no hay forma de asignar otro admin sin un admin existente. Este procedimiento
es la salida.

## Operadores autorizados

- **Solo Gonzalo Benoffi** (`gonzalo.benoffi@modo.com.ar`) via `gcloud` CLI con
  credenciales del proyecto `modo-mapa-prod`.
- En staging: cualquier dev con acceso a `modo-mapa-staging` (sin restriccion,
  staging es desechable).

## Condiciones legitimas

- Cuenta del email bootstrap deshabilitada.
- Password perdido sin posibilidad de reset (ej: email asociado tambien
  perdido).
- MFA roto sin codigos de recovery.
- Email bootstrap comprometido — bajo investigacion (rotar el secret antes de
  re-bootstrappear).

## Pasos

### 1. Rotar el secret `ADMIN_EMAIL` (si compromiso)

Si el motivo es compromiso del email, rotar antes:

```bash
echo -n "nuevo-admin@modo.com.ar" | gcloud secrets versions add ADMIN_EMAIL \
  --project=modo-mapa-prod --data-file=-
```

Re-deploy de funciones para que tomen la nueva version del secret:

```bash
firebase deploy --only functions --project=modo-mapa-prod
```

### 2. Reset del flag `config/bootstrap.adminAssigned`

```bash
# Via Firebase Admin SDK desde maquina autorizada
node -e "
  const { initializeApp } = require('firebase-admin/app');
  const { getFirestore } = require('firebase-admin/firestore');
  initializeApp({ projectId: 'modo-mapa-prod' });
  const db = getFirestore();
  db.doc('config/bootstrap').set({ adminAssigned: false }, { merge: true })
    .then(() => console.log('Reset OK'))
    .catch(console.error);
"
```

### 3. Loguear con el nuevo email e invocar `setAdminClaim`

Desde la app admin: login con el nuevo `ADMIN_EMAIL` (Google o email/password
verificado), invocar `setAdminClaim({ targetUid: <new-admin-uid> })`. Con la
rama bootstrap abierta (flag `false`), el handler asignara el claim y
escribira el flag de nuevo a `true`.

### 4. Verificar audit log

Revisar Cloud Functions logs (Cloud Console → Logging) para `Admin claim set`
con `via: 'bootstrap'`.

```bash
gcloud logging read \
  'resource.type="cloud_run_revision" AND jsonPayload.message="Admin claim set"' \
  --project=modo-mapa-prod --limit=10 --format=json
```

### 5. Postcondition

Tras el assignment exitoso, el handler escribe
`config/bootstrap.adminAssigned = true` automaticamente (idempotente).
Verificar manualmente:

```bash
node -e "
  const { initializeApp } = require('firebase-admin/app');
  const { getFirestore } = require('firebase-admin/firestore');
  initializeApp({ projectId: 'modo-mapa-prod' });
  getFirestore().doc('config/bootstrap').get()
    .then(s => console.log(s.data()))
    .catch(console.error);
"
```

Esperado: `{ adminAssigned: true, assignedAt: <timestamp>, assignedTo: '<uid>' }`.

## Variante: claim asignado pero flag NO escrito

El handler de `setAdminClaim` (rama bootstrap) hace dos writes secuenciales:

1. `setCustomUserClaims(targetUid, { admin: true })` — Auth API.
2. `db.doc('config/bootstrap').set({ adminAssigned: true, ... }, { merge: true })` — Firestore.

Si el paso 2 falla (Firestore down, network glitch), el claim queda asignado
pero el flag NO se escribe. El handler **NO re-throwea** (`logger.error` con
`remediation` apuntando a este documento) — el cliente recibe `success: true`
correctamente.

**Sintoma operativo:** el primer admin tiene custom claim `admin: true` pero
una segunda invocacion bootstrap (con un atacante que controle `ADMIN_EMAIL`)
podria pasar el gate porque el flag no esta seteado.

**Remediacion (sin reset, solo cierre del gate):**

```bash
node -e "
  const { initializeApp } = require('firebase-admin/app');
  const { getFirestore, FieldValue } = require('firebase-admin/firestore');
  initializeApp({ projectId: 'modo-mapa-prod' });
  getFirestore().doc('config/bootstrap').set({
    adminAssigned: true,
    assignedAt: FieldValue.serverTimestamp(),
    assignedTo: '<uid-del-primer-admin>',
  }, { merge: true })
    .then(() => console.log('Flag manually set'))
    .catch(console.error);
"
```

Buscar el log de error en Cloud Logging:

```bash
gcloud logging read \
  'jsonPayload.message="Bootstrap flag write FAILED — manual remediation required"' \
  --project=modo-mapa-prod --limit=5 --format=json
```

Tomar el `targetUid` del payload y usarlo como `assignedTo` en el comando de
arriba.

## Notas de seguridad

- Documentar en el ticket interno la razon del reset (compromise vs lockout).
- Si fue compromise: revisar logs de auth de los ultimos 30 dias para detectar
  actividad sospechosa del email anterior.
- El reset NO revoca el admin claim del primer admin perdido — si todavia
  tiene acceso al dispositivo, sigue siendo admin. Para revocar, primero
  invocar `removeAdminClaim` desde el admin nuevo.
- El procedimiento implica acceso a credenciales de produccion. Limitar
  estrictamente segun la lista de operadores autorizados.

## Referencias

- Implementacion: `functions/src/admin/claims.ts` (rama bootstrap +
  try/catch del flag write).
- Specs: `docs/feat/security/322-firestore-rules-hardening-bootstrap-admin/specs.md`
  (S5).
- Threat model: el bootstrap path esta gated por **(email verificado +
  flag false)**. Rotar el secret cierra la primer dimension; resetear el flag
  re-abre la segunda. Sin rate limit por convencion (un rate limit de N/hora
  no mitiga ADMIN_EMAIL comprometido — solo se necesita una invocacion
  exitosa).

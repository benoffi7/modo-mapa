# Staging Environment

Referencia tecnica del entorno de staging para testing pre-merge.

---

## Datos basicos

| Item | Valor |
|------|-------|
| URL | <https://modo-mapa-staging.web.app> |
| Deploy trigger | Push a branch `staging` |
| CI workflow | `.github/workflows/deploy-staging.yml` |
| Firestore DB | `staging` (database separada de `(default)`) |
| Env var | `VITE_FIRESTORE_DATABASE_ID=staging` |

---

## Cloud Functions — Patrones de staging

Staging y produccion **comparten el mismo deployment** de Cloud Functions. Esto implica restricciones importantes:

### getDb(databaseId?)

Todas las Cloud Functions usan `getDb(databaseId)` en vez de `getFirestore()` directo:

- **Callable functions**: reciben `databaseId` como parametro opcional del cliente. El frontend pasa `import.meta.env.VITE_FIRESTORE_DATABASE_ID`.
- **Triggers/scheduled**: usan `getDb()` sin params (default DB).

### App Check deshabilitado

`ENFORCE_APP_CHECK = false` esta hardcodeado porque staging no tiene App Check configurado. La seguridad en staging se basa en `assertAdmin()` y `request.auth` checks.

**Importante:** No usar `!IS_EMULATOR` como condicion para App Check — rompe todos los callables en staging.

### CI auto-deploy

`deploy-staging.yml` detecta cambios en `functions/src/` y deploya automaticamente.

### pre-staging-check.sh

Script de validacion que verifica antes del deploy:

- No hay `getFirestore()` directo (debe ser `getDb()`)
- No hay silent catches vacios
- No hay `as never` casts
- No hay `!IS_EMULATOR` (patron deprecado)

---

## Deploy de Firestore Rules a staging

Las rules deben deployarse **SEPARADAMENTE** al database staging. El comando estandar `firebase deploy --only firestore:rules` solo afecta `(default)`.

### Procedimiento via REST API

```bash
# 1. Obtener access token
ACCESS_TOKEN=$(node -e 'const t=require("/home/walrus/.config/configstore/firebase-tools.json");const rt=t.tokens.refresh_token;const https=require("https");const data="grant_type=refresh_token&refresh_token="+encodeURIComponent(rt)+"&client_id=563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com&client_secret=j9iVZfS8kkCEFUPaAeJV0sAi";const req=https.request({hostname:"oauth2.googleapis.com",path:"/token",method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"}},res=>{let body="";res.on("data",d=>body+=d);res.on("end",()=>{const r=JSON.parse(body);console.log(r.access_token)})});req.write(data);req.end()')

# 2. Crear ruleset
RULES_CONTENT=$(cat firestore.rules | node -e 'let d="";process.stdin.on("data",c=>d+=c);process.stdin.on("end",()=>console.log(JSON.stringify(d)))')
RULESET=$(curl -s -X POST "https://firebaserules.googleapis.com/v1/projects/modo-mapa-app/rulesets" -H "Authorization: Bearer $ACCESS_TOKEN" -H "Content-Type: application/json" -d "{\"source\":{\"files\":[{\"content\":$RULES_CONTENT,\"name\":\"firestore.rules\"}]}}" | node -e 'let d="";process.stdin.on("data",c=>d+=c);process.stdin.on("end",()=>console.log(JSON.parse(d).name))')

# 3. Aplicar al database staging
curl -s -X PATCH "https://firebaserules.googleapis.com/v1/projects/modo-mapa-app/releases/cloud.firestore%2Fstaging" -H "Authorization: Bearer $ACCESS_TOKEN" -H "Content-Type: application/json" -d "{\"release\":{\"name\":\"projects/modo-mapa-app/releases/cloud.firestore/staging\",\"rulesetName\":\"$RULESET\"}}"
```

---

## Checklist de deploy completo a staging

Antes de testear en staging, verificar que **todo** este deployado:

| Cambio | Accion |
|--------|--------|
| Rules (`firestore.rules`) | Deploy via REST API (ver arriba) |
| Indexes (`firestore.indexes.json`) | `npx firebase-tools deploy --only firestore:indexes` + REST API para staging DB |
| Cloud Functions (`functions/src/`) | `npx firebase-tools deploy --only functions --project modo-mapa-app` (auto en CI) |
| Nuevas colecciones | Verificar rules + indexes en ambos databases |
| Callable functions | Usuario necesita admin custom claims. Staging comparte functions con prod |

**Nota sobre indexes:** Despues de crear indexes en staging via REST API, esperar 2-5 minutos para que se construyan antes de testear.

---

## Verificacion de deploy

Despues de pushear a staging, **siempre** verificar que el deploy termino:

```bash
# Ver estado del ultimo run
gh run list --branch staging --limit 1 --json status,conclusion,databaseId

# Si esta en progreso, esperar
gh run watch <id> --exit-status

# Verificar conclusion explicitamente
gh run view <id> --json conclusion --jq '.conclusion'
```

**Solo informar al usuario que puede testear cuando `conclusion` es `"success"`.**

Si el deploy falla, revisar logs con `gh run view <id> --log-failed` y arreglar antes de avisar.

---

## Limitaciones de staging

### Cloud Function triggers NO disparan en staging DB

Los triggers de Firestore (`onDocumentCreated`, `onDocumentWritten`, etc.) solo escuchan la base de datos `(default)`. Cuando el cliente staging escribe a la DB `staging`, **ningun trigger se ejecuta**.

**Implicaciones:**
- Counters server-side no se actualizan (likes, replies, follows)
- Fan-out writes no ocurren (activity feed)
- Rate limits no se aplican
- Notificaciones no se generan
- Moderacion de contenido no se ejecuta

**Solucion:** Para features que dependen de triggers, implementar un fallback client-side que se ejecute en ambos entornos. El trigger server-side y el fallback client-side pueden coexistir (deduplicar por referenceId en UI si es necesario).

### Datos estaticos vs Firestore

Los comercios (`businesses`) son datos estaticos en `src/data/businesses.json`, **NO** una coleccion de Firestore. Nunca hacer `getDoc('businesses/{id}')` — usar `allBusinesses` de `hooks/useBusinesses.ts`.

Ver la seccion "Datos estaticos + dinamicos" en `docs/reference/patterns.md` para el registro completo.

---

## Cuando actualizar este documento

- Al cambiar el workflow de deploy staging
- Al agregar nuevos recursos que necesiten deploy separado
- Al modificar patrones de Cloud Functions compartidas

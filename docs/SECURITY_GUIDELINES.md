# Consideraciones de Seguridad para Nuevas Funcionalidades

Este documento define los criterios de seguridad que deben evaluarse al desarrollar nuevas funcionalidades. Toda feature o fix debe pasar esta verificación antes de ser commiteada.

---

## Checklist de seguridad por commit

Antes de cada commit, verificar:

- [ ] **Firestore rules:** Si se agrega/modifica una colección, las reglas validan:
  - Autenticación (`request.auth != null`)
  - Ownership (`request.resource.data.userId == request.auth.uid`)
  - Longitud de strings (máximo razonable, ej: `<= 30` para nombres, `<= 500` para textos)
  - Rango de valores numéricos (ej: `score >= 1 && score <= 5`)
  - Timestamps del servidor (`request.resource.data.createdAt == request.time`)
- [ ] **Sin strings mágicos:** Nombres de colecciones usan `COLLECTIONS` de `src/config/collections.ts`
- [ ] **Sin secretos en código:** No hay API keys, tokens ni credenciales hardcodeadas
- [ ] **Error handling:** Toda operación async tiene `try/catch` con estado de error visible al usuario
- [ ] **Validación de input:** Inputs del usuario se validan tanto client-side como en Firestore rules
- [ ] **Sin `dangerouslySetInnerHTML`:** Nunca renderizar HTML sin sanitizar
- [ ] **Sin eval/Function:** No ejecutar código dinámico
- [ ] **Links externos:** URLs generadas por el usuario se abren con `target="_blank"` y `rel="noopener"`

---

## Consideraciones por tipo de funcionalidad

### Escritura a Firestore (create/update)

1. **Firestore rules obligatorias:** Toda colección nueva debe tener reglas que validen:
   - Auth requerida
   - Ownership del documento
   - Validación de tipo y longitud de cada campo
   - Validación de rangos numéricos si aplica
   - Timestamps del servidor: `request.resource.data.createdAt == request.time` en create, `updatedAt == request.time` en update
2. **Rate limiting client-side:** Limitar cantidad de escrituras por usuario/día
3. **Optimistic updates:** Actualizar UI inmediatamente pero manejar el rollback si falla
4. **Loading state:** Deshabilitar el botón/control durante la operación
5. **Tipado con converters:** Usar `withConverter<T>()` de `src/config/converters.ts` para lecturas tipadas

### Lectura de Firestore (read/query)

1. **Auth requerida:** Toda lectura debe requerir autenticación
2. **No exponer datos de otros usuarios:** Queries filtradas por `userId` cuando es data privada
3. **Paginación:** Para colecciones que pueden crecer, usar `limit()` + `startAfter()`
4. **Error state:** Mostrar mensaje de error con botón de reintentar

### Formularios y inputs de usuario

1. **Validación client-side:** Antes de enviar a Firestore
   - Trim de whitespace
   - Longitud máxima
   - Caracteres válidos si aplica
2. **Validación server-side:** Duplicar validaciones en Firestore rules
3. **Feedback visual:** Mostrar conteo de caracteres, estados de error inline
4. **Sanitización:** React escapa por defecto, pero evitar pasar user input a `href`, `src`, etc.

### Autenticación y autorización

1. **Auth anónima:** El proyecto usa Firebase Anonymous Auth. Toda funcionalidad debe funcionar con usuarios anónimos
2. **Ownership:** Solo el creador de un documento puede modificarlo/eliminarlo
3. **DisplayName:** Validar longitud (<= 30) tanto en client como en rules
4. **No confiar en datos del cliente:** El `userId` en documentos debe ser `request.auth.uid`, no un valor enviado por el cliente

### Componentes y UI

1. **Error Boundary:** Componentes que pueden fallar deben estar dentro del Error Boundary global
2. **ARIA labels:** Todo botón de ícono y elemento interactivo sin texto visible debe tener `aria-label`
3. **No deshabilitar zoom:** Mantener `user-scalable=yes` en el viewport

### Variables de entorno

1. **Prefijo `VITE_`:** Todas las env vars client-side deben tener prefijo `VITE_`
2. **Validación al iniciar:** Nuevas vars requeridas deben agregarse a la validación en `src/config/firebase.ts`
3. **No commitear `.env`:** Verificar que `.env` esté en `.gitignore`
4. **GitHub Secrets:** Para CI/CD, agregar en GitHub repo Settings

### Headers de seguridad

Los headers en `firebase.json` se aplican automáticamente en producción:

- `Content-Security-Policy`: Si se agrega un nuevo origen (CDN, API, etc.), actualizar la CSP
- `X-Frame-Options: DENY`: No permitir embedding en iframes
- `X-Content-Type-Options: nosniff`: Prevenir MIME sniffing

### Firebase App Check

App Check verifica que las requests a Firestore vengan de la app legítima (no de clientes modificados o bots).

**Configuración (una sola vez):**

1. Google Cloud Console > reCAPTCHA Enterprise > crear site key para el dominio de producción
2. Firebase Console > App Check > Registrar app con proveedor reCAPTCHA Enterprise
3. Agregar `VITE_RECAPTCHA_ENTERPRISE_SITE_KEY` a `.env` y GitHub Secrets
4. Firebase Console > Firestore > App Check > Enforce (activar enforcement)

**En desarrollo:** Se usa un debug token automático (`FIREBASE_APPCHECK_DEBUG_TOKEN = true` en `src/config/firebase.ts`).

**Nota:** Si `VITE_RECAPTCHA_ENTERPRISE_SITE_KEY` no está configurada, App Check no se inicializa (funcionalidad condicional).

---

## Patrones seguros del proyecto

### Colecciones de Firestore

```text
COLLECTIONS.USERS        → solo el owner lee/escribe, timestamp validado
COLLECTIONS.FAVORITES    → auth para leer, ownership + timestamp para crear/eliminar
COLLECTIONS.RATINGS      → auth para leer, ownership + rango 1-5 + timestamps para crear/actualizar
COLLECTIONS.COMMENTS     → auth para leer, ownership + validación de texto + timestamp para crear
COLLECTIONS.USER_TAGS    → auth para leer, ownership + timestamp para crear/eliminar
COLLECTIONS.FEEDBACK     → ownership para crear/leer/eliminar, validación de mensaje + timestamp
COLLECTIONS.CUSTOM_TAGS  → auth para leer, ownership + validación de label + timestamp para crear
```

### Converters tipados

Todas las lecturas de Firestore usan `withConverter<T>()` desde `src/config/converters.ts`:

```typescript
// Lectura tipada (sin d.data() as any)
const q = query(collection(db, COLLECTIONS.COMMENTS).withConverter(commentConverter), where(...));
const snapshot = await getDocs(q);
const items: Comment[] = snapshot.docs.map((d) => d.data()); // tipado automático

// Escritura sin converter (usa serverTimestamp() directamente)
await addDoc(collection(db, COLLECTIONS.COMMENTS), { userId, text, createdAt: serverTimestamp() });
```

Converters disponibles: `userProfileConverter`, `ratingConverter`, `commentConverter`, `userTagConverter`, `customTagConverter`, `favoriteConverter`.

### Límites actuales

| Recurso | Límite | Tipo |
|---------|--------|------|
| displayName | 30 chars | Client + Server |
| userName (comments) | 30 chars | Server |
| Comment text | 500 chars | Server |
| Custom tag label | 30 chars | Client + Server |
| Feedback message | 1000 chars | Server |
| Rating score | 1-5 | Server |
| Custom tags por comercio | 10 | Client |
| Comentarios por usuario/día | 20 | Client |

---

## Cuándo actualizar este documento

- Al agregar una nueva colección de Firestore
- Al agregar un nuevo tipo de input de usuario
- Al integrar un servicio externo (API, CDN, etc.)
- Al cambiar la política de autenticación
- Al descubrir un nuevo vector de ataque o patrón inseguro

# Informe de Seguridad

**Fecha:** 2026-03-11
**Versión auditada:** 1.1.1

---

## Resumen

| Severidad | Cantidad |
|-----------|----------|
| Alta | 3 |
| Media | 6 |
| Baja | 2 |

**Nivel de riesgo general:** MEDIO-ALTO

---

## Hallazgos y accionables

### Alta severidad

#### 1. Sin rate limiting en escrituras de Firestore

- **Archivo:** `firestore.rules` (todas las colecciones)
- **Problema:** No hay mecanismo de rate limiting. Un usuario puede crear documentos ilimitados (comentarios, feedback, tags).
- **Impacto:** DoS potencial, abuso de cuota de Firestore.
- **Accionable:** Implementar rate limiting via Cloud Functions o App Check.

#### 2. Headers de seguridad faltantes (CSP, X-Frame-Options)

- **Archivo:** `firebase.json`
- **Problema:** No hay Content-Security-Policy, X-Frame-Options ni X-Content-Type-Options.
- **Impacto:** Sin protección contra clickjacking ni inyección de scripts externos.
- **Accionable:** Agregar headers en `firebase.json`:

```json
"headers": [
  {
    "source": "**",
    "headers": [
      { "key": "X-Frame-Options", "value": "DENY" },
      { "key": "X-Content-Type-Options", "value": "nosniff" },
      { "key": "Content-Security-Policy", "value": "default-src 'self'; script-src 'self' *.googleapis.com; style-src 'self' 'unsafe-inline' fonts.googleapis.com; font-src fonts.gstatic.com; img-src 'self' data: *.gstatic.com *.googleapis.com; connect-src 'self' *.firebaseio.com *.googleapis.com;" }
    ]
  }
]
```

#### 3. DisplayName sin validación server-side

- **Archivo:** `firestore.rules` (colección `users`)
- **Problema:** Solo tiene `allow read, write: if auth.uid == userId`. No valida longitud del `displayName`.
- **Impacto:** Usuario puede escribir directamente nombres de cualquier longitud via API.
- **Accionable:** Agregar validación: `&& request.resource.data.displayName.size() <= 30`

### Media severidad

#### 4. userName en comentarios sin validación de longitud

- **Archivo:** `firestore.rules` (colección `comments`)
- **Problema:** Se valida `text.size()` pero no `userName.size()`.
- **Impacto:** Nombres excesivamente largos rompen el layout.
- **Accionable:** Agregar: `&& request.resource.data.userName.size() <= 30`

#### 5. Colección feedback sin reglas de read/delete

- **Archivo:** `firestore.rules` (colección `feedback`, líneas 43-48)
- **Problema:** Solo tiene `allow create`. El usuario no puede leer ni eliminar su propio feedback.
- **Impacto:** Sin posibilidad de gestionar feedback enviado.
- **Accionable:** Agregar `allow read, delete: if request.auth != null && resource.data.userId == request.auth.uid;`

#### 6. Sin límite de documentos por usuario/business en customTags

- **Archivo:** `firestore.rules` (colección `customTags`)
- **Problema:** Un usuario puede crear tags custom ilimitados por comercio.
- **Impacto:** Agotamiento de recursos, UI degradada.
- **Accionable:** Validar client-side (máx 10 tags custom por comercio) y considerar Cloud Function para validación server-side.

#### 7. Timestamps controlables por el cliente

- **Archivos:** Múltiples componentes usan `serverTimestamp()` (correcto), pero Firestore rules no validan que el campo sea efectivamente un timestamp del servidor.
- **Impacto:** Un cliente modificado podría enviar timestamps arbitrarios.
- **Accionable:** Bajo impacto real, documentar como riesgo aceptado.

#### 8. Auth anónima automática sin control

- **Archivo:** `src/context/AuthContext.tsx` (líneas 36-40)
- **Problema:** Cada visitante genera un UID anónimo automáticamente.
- **Impacto:** Crecimiento de usuarios anónimos en Firebase Auth (cuota).
- **Accionable:** Monitorear cuota de auth. Considerar Firebase App Check para limitar bots.

#### 9. Sin validación de variables de entorno al iniciar

- **Archivo:** `src/config/firebase.ts`
- **Problema:** Si falta una env var, Firebase falla con errores crípticos.
- **Accionable:** Agregar validación en startup que arroje error claro si faltan vars requeridas.

### Baja severidad

#### 10. Sin protección contra MIME sniffing

- **Archivo:** `firebase.json`
- **Problema:** Falta header `X-Content-Type-Options: nosniff`.
- **Accionable:** Incluido en el accionable #2.

#### 11. Comentarios sin regla de update

- **Archivo:** `firestore.rules` (colección `comments`)
- **Problema:** No hay `allow update`, los usuarios no pueden editar sus comentarios.
- **Accionable:** Decisión de producto — si se quiere permitir edición, agregar regla.

---

## Aspectos positivos

- Sin vulnerabilidades XSS (React escapa automáticamente, no hay `dangerouslySetInnerHTML`)
- Secrets bien gestionados en GitHub Actions
- `.env` correctamente en `.gitignore`
- Variables client-side correctamente prefijadas con `VITE_`
- Emuladores correctamente limitados a `import.meta.env.DEV`
- Sin dependencias con vulnerabilidades conocidas (`npm audit` limpio)
- Firestore rules validan ownership en operaciones de escritura

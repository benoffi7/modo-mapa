# Informe de Seguridad

**Fecha:** 2026-03-11
**Versión auditada:** 1.2.1
**Archivos revisados:** 24 archivos (config, contextos, hooks, componentes, reglas, hosting)

---

## Resumen

| Severidad | Cantidad |
|-----------|----------|
| Alta | 0 |
| Media | 0 |
| Baja | 0 |

**Nivel de riesgo general:** BAJO — Todos los hallazgos fueron resueltos o mitigados. Sin vulnerabilidades críticas.

---

## Hallazgos resueltos

Los siguientes hallazgos fueron identificados y resueltos en auditorías anteriores y la presente:

| # | Hallazgo | Severidad original | Resolución |
|---|----------|-------------------|------------|
| 1 | Headers de seguridad faltantes | Alta | Agregados CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy en `firebase.json` |
| 2 | DisplayName sin validación server-side | Alta | Validación de tipo, largo > 0 y <= 30 en `firestore.rules` + trim client-side |
| 3 | Rate limiting en comentarios | Alta | Límite client-side de 20 comentarios por día por usuario |
| 4 | userName en comentarios sin validación | Media | Validación `userName.size() > 0 && <= 30` en `firestore.rules` |
| 5 | Feedback sin reglas de read/delete | Media | Agregado `allow read, delete` con ownership check |
| 6 | CustomTags sin límite por usuario | Media | Límite client-side de 10 tags custom por comercio |
| 7 | Sin validación de env vars | Media | Validación en startup con error claro si faltan vars requeridas |
| 8 | Rate limiting server-side en escrituras | Media | Firebase App Check con reCAPTCHA Enterprise. Verifica que las requests vengan de la app legítima |
| 9 | Timestamps controlables por el cliente | Media | Validación `createdAt == request.time` y `updatedAt == request.time` en todas las reglas de create/update en `firestore.rules` |
| 10 | MIME sniffing sin protección | Baja | Resuelto con header `X-Content-Type-Options: nosniff` |
| 11 | Viewport zoom deshabilitado | Baja | Cambiado a `user-scalable=yes` |
| 12 | Auth anónima automática sin control | Baja | Firebase App Check limita bots. Firebase permite millones de usuarios anónimos en plan gratuito |
| 13 | Comentarios sin regla de update | Baja | Issue #17 creado para implementar edición como feature futura. Sin riesgo: sin regla de update, el update no es posible |
| 14 | Tipado estricto para datos de Firestore | Baja | Implementado `withConverter<T>()` en todas las lecturas. Converters centralizados en `src/config/converters.ts` |
| 15 | CSP bloqueaba `apis.google.com` | Media | Agregado `https://apis.google.com` a `script-src` en `firebase.json`. El dominio no era cubierto por `*.googleapis.com` |
| 16 | Query a Firestore sin auth guard en `loadTags()` | Media | Agregado guard `if (!user)` que muestra seed tags con count 0 sin autenticación, evitando error de permisos |

---

## Hallazgos pendientes

No hay hallazgos pendientes.

---

## Áreas auditadas en v1.2.1

### 1. Content Security Policy (CSP)

**Estado:** SEGURO

- `script-src`: `self`, `*.googleapis.com`, `https://apis.google.com`, `https://www.google.com`, `https://www.gstatic.com`
- `style-src`: `self`, `unsafe-inline`, `fonts.googleapis.com`
- `connect-src`: `self`, `*.firebaseio.com`, `*.googleapis.com`, `*.google.com`, `*.firebaseapp.com`
- `frame-src`: `self`, `*.firebaseapp.com`, `https://www.google.com`
- Sin `unsafe-eval` en ninguna directiva
- Todos los dominios de Google necesarios están cubiertos

### 2. Reglas de Firestore

**Estado:** SEGURO

- Auth guard (`request.auth != null`) en todas las operaciones de escritura
- Ownership check (`resource.data.userId == request.auth.uid`) en delete/update
- Validación de timestamps server-side (`createdAt == request.time`)
- Validación de longitud en campos de texto
- Validación de tipos en todos los campos
- Doc ID compuesto previene duplicados sin queries extra

### 3. Autenticación

**Estado:** SEGURO

- Firebase Anonymous Auth con App Check en producción
- DisplayName validado client-side (trim, max 30) y server-side (rules)
- Guard de auth en todas las queries que requieren autenticación
- `loadTags()` y `loadCustomTags()` verifican usuario antes de consultar

### 4. Input de usuario

**Estado:** SEGURO

- React escapa automáticamente todo el output (sin `dangerouslySetInnerHTML`)
- Sin `eval()`, `Function()`, `innerHTML` en toda la codebase
- Comentarios: texto limitado, userName validado
- Custom tags: label limitado a 30 caracteres, máximo 10 por comercio
- Feedback: mensaje limitado, timestamp server-side
- SearchBar: búsqueda client-side sobre datos estáticos (sin queries a DB)
- Ratings: valores 1-5 validados

### 5. Configuración de Firebase

**Estado:** SEGURO

- Emuladores solo en `import.meta.env.DEV`
- App Check con reCAPTCHA Enterprise solo en producción
- Variables client-side con prefijo `VITE_`
- `.env` en `.gitignore`
- Validación de env vars al iniciar la app

### 6. Dependencias

**Estado:** SEGURO

- `npm audit`: 0 vulnerabilidades
- React 19.2.0, Firebase 12.10.0, MUI 7.3.9, Vite 7.3.1, TypeScript 5.9.3
- Sin dependencias con CVEs conocidos

### 7. Patrones de data fetching

**Estado:** SEGURO

- Todas las lecturas usan `withConverter<T>()`
- Converters centralizados en `src/config/converters.ts`
- Hook `usePaginatedQuery` con paginación por cursores (sin riesgo de memory leak)
- `pageSize` limita la cantidad de documentos por request
- Patrón `ignore` flag en useEffect para evitar updates a componentes desmontados
- Error handling con try/catch en todas las operaciones async

### 8. Patrones peligrosos ausentes (verificado)

- Sin `dangerouslySetInnerHTML`
- Sin `eval()` ni `Function()`
- Sin `innerHTML`
- Sin `fetch()` directo (Firebase SDK maneja requests)
- Sin `localStorage`/`sessionStorage` (Firebase maneja persistencia)
- Sin parsing de JSON de fuentes no confiables
- Sin construcción dinámica de URLs

---

## Aspectos positivos

- Sin vulnerabilidades XSS (React escapa automáticamente)
- Secrets bien gestionados en GitHub Actions
- `.env` correctamente en `.gitignore`
- Variables client-side con prefijo `VITE_`
- Emuladores limitados a modo desarrollo
- 0 vulnerabilidades en dependencias (`npm audit` limpio)
- Firestore rules validan ownership en escrituras
- Headers de seguridad completos (CSP, X-Frame-Options, MIME sniffing, Referrer-Policy, Permissions-Policy)
- Validación de longitud en todos los campos de texto
- Validación de env vars al iniciar
- Collection names centralizados (sin strings mágicos)
- Error boundaries y estados de error en todos los componentes async
- Rate limiting client-side en comentarios (20/día) y custom tags (10/comercio)
- Firebase App Check para verificar origen de requests
- Timestamps validados server-side con `request.time`
- Lectura de datos tipada con `withConverter<T>()`
- Guards de auth en todas las queries que requieren autenticación
- Paginación con cursores (sin riesgo de carga masiva)
- Pre-commit hooks con ESLint para prevenir código inseguro
- `exactOptionalPropertyTypes` habilitado para tipado más estricto

---

## Recomendaciones para hardening futuro

Estas no son vulnerabilidades sino mejoras opcionales para fortalecer la seguridad:

1. **Rate limiting server-side**: Implementar Cloud Functions para limitar escrituras por IP/usuario (DDoS)
2. **Moderación de contenido**: Cloud Functions para filtrar contenido inapropiado en comentarios y tags
3. **Monitoreo**: Firebase Analytics o Cloud Logging para detectar patrones de abuso
4. **Rotación de API keys**: Rotar keys periódicamente como práctica estándar
5. **Budget alerts**: Configurar alertas de presupuesto en Firebase para detectar picos de uso inesperados

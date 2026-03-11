# Informe de Seguridad

**Fecha:** 2026-03-11
**Versión auditada:** 1.2.0

---

## Resumen

| Severidad | Cantidad |
|-----------|----------|
| Alta | 0 |
| Media | 0 |
| Baja | 0 |

**Nivel de riesgo general:** BAJO — Todos los hallazgos fueron resueltos o mitigados.

---

## Hallazgos resueltos

Los siguientes hallazgos fueron identificados y resueltos:

| # | Hallazgo | Severidad original | Resolución |
|---|----------|-------------------|------------|
| 1 | Headers de seguridad faltantes | Alta | Agregados CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy en `firebase.json` |
| 2 | DisplayName sin validación server-side | Alta | Validación de tipo, largo > 0 y <= 30 en `firestore.rules` + trim client-side |
| 3 | userName en comentarios sin validación | Media | Validación `userName.size() > 0 && <= 30` en `firestore.rules` |
| 4 | Feedback sin reglas de read/delete | Media | Agregado `allow read, delete` con ownership check |
| 5 | CustomTags sin límite por usuario | Media | Límite client-side de 10 tags custom por comercio |
| 6 | Sin validación de env vars | Media | Validación en startup con error claro si faltan vars requeridas |
| 7 | MIME sniffing sin protección | Baja | Resuelto con header `X-Content-Type-Options: nosniff` |
| 8 | Viewport zoom deshabilitado | Baja | Cambiado a `user-scalable=yes` |
| 9 | Rate limiting en comentarios | Alta | Límite client-side de 20 comentarios por día por usuario |
| 10 | Rate limiting server-side en escrituras | Media | Firebase App Check implementado con reCAPTCHA Enterprise. Verifica que las requests vengan de la app legítima. |
| 11 | Timestamps controlables por el cliente | Media | Validación `createdAt == request.time` y `updatedAt == request.time` en todas las reglas de create/update en `firestore.rules` |
| 12 | Auth anónima automática sin control | Baja | Firebase App Check limita bots. Firebase permite millones de usuarios anónimos en plan gratuito. |
| 13 | Comentarios sin regla de update | Baja | Issue #17 creado para implementar edición de comentarios como feature futura. Sin riesgo actual: sin regla de update, el update no es posible. |
| 14 | Tipado estricto para datos de Firestore | Baja | Implementado `withConverter<T>()` en todas las lecturas de Firestore. Converters centralizados en `src/config/converters.ts`. |

---

## Hallazgos pendientes

No hay hallazgos pendientes.

---

## Aspectos positivos

- Sin vulnerabilidades XSS (React escapa automáticamente, no hay `dangerouslySetInnerHTML`)
- Secrets bien gestionados en GitHub Actions
- `.env` correctamente en `.gitignore`
- Variables client-side correctamente prefijadas con `VITE_`
- Emuladores correctamente limitados a `import.meta.env.DEV`
- Sin dependencias con vulnerabilidades conocidas (`npm audit` limpio)
- Firestore rules validan ownership en operaciones de escritura
- Headers de seguridad completos (CSP, X-Frame-Options, MIME sniffing, Referrer-Policy)
- Validación de longitud en todos los campos de texto (displayName, userName, text, label, message)
- Validación de variables de entorno al iniciar
- Collection names centralizados en constantes (sin strings mágicos)
- Error boundaries y estados de error en todos los componentes async
- Rate limiting client-side en comentarios y custom tags
- Firebase App Check configurado para verificar origen de requests
- Timestamps validados server-side con `request.time` en Firestore rules
- Lectura de datos tipada con `withConverter<T>()` en todas las colecciones
- Reglas de Firestore documentadas con comentarios por colección

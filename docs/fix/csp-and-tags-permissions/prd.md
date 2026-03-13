# PRD: Fix CSP Policy & Custom Tags Permissions

## Problema

Se detectaron dos errores en producción que afectan funcionalidad:

### 1. CSP bloquea script de Google Identity Services

```text
Loading the script 'https://apis.google.com/js/api.js?onload=__iframefcb138202'
violates the following Content Security Policy directive:
"script-src 'self' *.googleapis.com https://www.google.com https://www.gstatic.com"
```

**Causa raíz**: El dominio `apis.google.com` no es subdominio de `googleapis.com`, por lo que el wildcard `*.googleapis.com` no lo cubre. Firebase Auth (Google Sign-In) requiere cargar scripts desde `https://apis.google.com`.

**Impacto**: Potencial fallo en el flujo de autenticación con Google en navegadores que apliquen estrictamente CSP.

### 2. Error de permisos al cargar etiquetas

```text
Error loading custom tags: FirebaseError: Missing or insufficient permissions.
```

**Causa raíz**: La función `loadTags()` en `BusinessTags.tsx` ejecuta una query a la colección `userTags` sin verificar si el usuario está autenticado. Las reglas de Firestore requieren `request.auth != null` para leer `userTags`. Cuando el componente se monta antes de que el estado de auth se resuelva (o el usuario es anónimo), la query falla.

**Impacto**: Las etiquetas no se cargan para usuarios no autenticados o durante la transición de auth state.

## Solución propuesta

1. **CSP**: Agregar `https://apis.google.com` a la directiva `script-src` en `firebase.json`.
2. **Tags**: Agregar guard de autenticación en `loadTags()` antes de ejecutar la query, similar a como ya lo hace `loadCustomTags()`.

## Criterios de aceptación

- [ ] No aparece error de CSP en consola al cargar la app en producción
- [ ] No aparece error de permisos al cargar etiquetas sin autenticación
- [ ] Las etiquetas se cargan correctamente para usuarios autenticados
- [ ] Las etiquetas predefinidas se muestran (sin votos) para usuarios no autenticados

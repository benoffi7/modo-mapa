# Guard: Privacy policy consistency (#308)

Reglas de regresion para mantener `src/components/profile/PrivacyPolicy.tsx`
alineado con el codigo real, derivadas del PRD de tech-debt #308 (drift de
politica post-incorporacion de Sentry, Google Maps y nuevos eventos de
analytics).

El objetivo es evitar que cada feature nuevo obligue a editar la politica y,
cuando sí haga falta, que el cambio quede registrado en el mismo PR.

## Rules

1. `PrivacyPolicy.tsx` debe declarar todos los terceros que reciben datos de la
   app. Como minimo: **Firebase** (Auth, Firestore, Functions, Storage, App
   Check, Remote Config, Hosting), **Sentry** (stack traces + app version + URL
   + UID en errores de produccion), **proveedores de tiles de Google Maps /
   OpenStreetMap** (IP + coordenadas de viewport al renderizar el mapa) y
   **GitHub** (cuando el feedback del usuario se sincroniza a issues).
2. La lista de eventos de analytics en la politica es **no exhaustiva**: debe
   estar redactada por dominios (navegacion, interacciones con comercios,
   social, onboarding, performance, administracion) y cerrar con la frase
   "entre otros eventos de uso", con un enlace al panel de features del admin
   para quien quiera el detalle.
3. El wording de `localStorage` es **generico** ("flags de onboarding, UI y
   cache", "preferencias de tema", "cache de verificacion", "email
   recordado"). No se enumeran keys individuales para evitar drift cronico.
4. La coleccion `abuseLogs` esta declarada como log administrativo de
   seguridad/auditoria (UID + tipo de evento + timestamp, accesible solo por
   admins, sin contenido del usuario).
5. La fecha "Ultima actualizacion" en `PrivacyPolicy.tsx` se actualiza cada vez
   que aterrizan nuevas categorias de datos (nuevos terceros, nuevos dominios
   de analytics, nuevas colecciones de Firestore con datos de usuario, nuevas
   categorias de feedback o nuevos derechos del usuario).

## Detection patterns

Chequeos automatizables (ejecutar en pre-merge o como parte del audit
`privacy-policy`):

```bash
# Sentry debe aparecer al menos una vez en la politica.
grep -n "Sentry\|sentry" src/components/profile/PrivacyPolicy.tsx

# Los proveedores de mapas deben estar mencionados (tile / mapa).
grep -n "mapa\|tile" src/components/profile/PrivacyPolicy.tsx
```

Ambos greps deben devolver al menos un match. Si no hay match, la politica
perdio la mencion y hay que re-agregarla antes de mergear.

### Merge checklist

Al abrir un PR que agregue nuevos patrones de observabilidad o persistencia
en `src/services/` — tipicamente cualquier `logEvent(` o `addDoc(` nuevo —,
verificar manualmente:

- [ ] `grep -rn "logEvent(" src/services/` muestra eventos que encajen en los
  dominios descritos en la politica (o se agrego el dominio faltante).
- [ ] `grep -rn "addDoc(" src/services/` no introduce colecciones de datos de
  usuario que no esten cubiertas por la seccion "Almacenamiento".
- [ ] `PrivacyPolicy.tsx` actualizo la fecha "Ultima actualizacion" en el mismo
  PR que agrega el feature, aunque solo sea para reflejar el nuevo dominio.
- [ ] Si el feature integra un tercero nuevo (ej. un CDN, un proveedor de
  push, un SDK externo), se agrego un bullet en "Comparticion con terceros".

## Related

- PRD: <../../feat/security/308-privacy-policy-drift/prd.md>
- Agent auditor: <../../../.claude/agents/privacy-policy.md>
- Referencia de tests: <../tests.md> (componentes puramente visuales son
  excepcion de la regla 80%).

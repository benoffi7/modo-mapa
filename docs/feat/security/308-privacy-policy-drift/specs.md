# Specs: Privacy policy drift (Sentry + Google Maps + analytics events)

**PRD:** [prd.md](./prd.md)
**Issue:** #308
**Fecha:** 2026-04-18

---

## Archivos a modificar

| Archivo | Cambio | Líneas aprox |
|---------|--------|--------------|
| `src/components/profile/PrivacyPolicy.tsx` | Editar secciones "Datos de uso", "Almacenamiento" (Firestore + localStorage), "Compartición con terceros", "Última actualización" | ~40 líneas modificadas, ~8 líneas agregadas |

**Sin archivos nuevos.** No se agregan hooks, servicios, constantes, converters, Firestore rules, Cloud Functions ni tests nuevos.

---

## Contratos y signatures

No hay cambios de API. El componente `PrivacyPolicy` exporta `default function PrivacyPolicy(): JSX.Element` y mantiene la misma signature.

---

## Cambios detallados por sección

### Sección "Última actualización" (línea 34)

**Antes:**

```tsx
Última actualización: abril 2026
```

**Después:**

```tsx
Última actualización: abril 2026 (actualizada el 18/04/2026)
```

Nota: el formato "abril 2026" se mantiene porque es el mes vigente. Se agrega la fecha exacta entre paréntesis para reflejar el commit.

---

### Sección "Datos de uso" (líneas 110-127)

**Antes (resumen):** lista exhaustiva de eventos hardcodeada (`business_view`, `business_search`, `account_created`, `question_created`, `checkin_created`, `recommendation_sent`, `offline_action_queued`, etc.) que quedó desfasada respecto a los eventos reales en `src/constants/analyticsEvents/`.

**Después:** descripción por dominios + "entre otros". Mantener:

- mención a `Firebase Analytics (GA4)`;
- mención explícita a UID como identificador (no email);
- propiedad `auth_type` declarada.

**Copy propuesto:**

```tsx
<Li>
  <strong>Datos de uso (opcional):</strong> si activás &quot;Enviar datos
  de uso&quot; en Configuración, Firebase Analytics (GA4) recopila eventos
  anónimos de uso de la app agrupados por dominio: navegación entre
  secciones, interacciones con comercios (vistas, búsquedas, filtros,
  calificaciones, comentarios, favoritos, fotos, recomendaciones, preguntas,
  check-ins), interacciones sociales (seguir usuarios, rankings, actividad,
  intereses), progreso de onboarding y creación de cuenta, sincronización
  offline, rendimiento (Web Vitals) y acciones administrativas —
  entre otros eventos de uso. Estos eventos se asocian a tu UID
  (no a tu email) y no identifican a personas individuales. También se
  registra la propiedad de usuario <code>auth_type</code> (anónima /
  email / google para administradores).
</Li>
```

---

### Sección "Almacenamiento" > "localStorage" (líneas 154-163)

**Antes:** lista cerrada de 5-6 keys.

**Después:** descripción por categorías. Mantener afirmaciones clave:

- "no se envían a ningún servidor";
- "podés borrarlos desde la configuración del navegador";
- mención al email opcional de "Recordar mi email".

**Copy propuesto:**

```tsx
<Li>
  <strong>localStorage:</strong> almacena preferencias locales en tu
  navegador: tema claro/oscuro, visitas recientes, preferencia de analytics,
  estado y flags de los tutoriales y de onboarding, configuración de
  acciones rápidas del inicio, avatar seleccionado, caché local de badges
  de verificación de otros usuarios (con clave <code>mm_verification_badges_u[uid]</code>),
  contadores de límites locales (por ejemplo, para evitar duplicados de
  recordatorios), y opcionalmente tu email si activás &quot;Recordar mi
  email&quot;. Estos datos no se envían a ningún servidor y podés borrarlos
  en cualquier momento desde la configuración del navegador o desactivando
  la opción correspondiente en la app.
</Li>
```

---

### Sección "Almacenamiento" > "Cloud Firestore" (líneas 146-149)

**Antes:**

```tsx
<Li>
  <strong>Cloud Firestore:</strong> almacena datos estructurados (listas
  de comercios, comentarios, calificaciones, favoritos, rankings de
  usuarios, logros, métricas de rendimiento, etc.) en servidores de
  Google Cloud.
</Li>
```

**Después:** agregar un segundo bullet dedicado a `abuseLogs`.

**Copy agregado:**

```tsx
<Li>
  <strong>Logs de seguridad (abuseLogs):</strong> cuando se exceden
  límites de uso (rate limiting) o se flaggea contenido inapropiado,
  se registra un log administrativo con tu UID, el tipo de evento
  y la fecha. Estos logs no contienen el contenido generado por el
  usuario y sólo son accesibles por administradores para investigar
  abusos o patrones anómalos.
</Li>
```

El bullet existente de Cloud Firestore se mantiene sin cambios.

---

### Sección "Compartición con terceros" (líneas 208-221)

**Antes:** dos párrafos (feedback a GitHub + compartir voluntario).

**Después:** los dos párrafos existentes se mantienen, y se agregan dos párrafos nuevos (Sentry + Google Maps) antes del párrafo de compartir voluntario.

**Copy agregado:**

```tsx
<P>
  <strong>Diagnóstico de errores (Sentry):</strong> si la app encuentra
  un error inesperado en producción, se envía información técnica del
  incidente a <strong>Sentry</strong> (stack trace, versión de la app,
  URL donde ocurrió el fallo y tu UID) con el único fin de diagnosticar
  y corregir el problema. No se comparte tu email ni contenido generado
  por vos.
</P>
<P>
  <strong>Mapa (Google Maps):</strong> al renderizar el mapa interactivo,
  tu navegador solicita tiles (imágenes del mapa) a los servidores de
  Google Maps. Esto implica compartir tu dirección IP y las coordenadas
  del área del mapa que estás viendo con Google, según su propia política
  de privacidad. Esto es inherente al uso del mapa y no pasa por nuestros
  servidores.
</P>
```

---

## Accesibilidad (a11y)

- El componente sigue usando `Typography component="li"` dentro de `<Box component="ul">` — estructura semántica ya correcta.
- Los bullets nuevos agregan `<code>` en dos lugares (nombre de la propiedad `auth_type` y key de localStorage). Es contenido inline — el lector de pantalla lo leerá literal, lo cual es correcto. No requiere `aria-label` ni `role`.
- Todo el texto sigue siendo seleccionable, escaneable y compatible con screen readers.
- Contraste: no se cambian colores.

---

## Testing

### Casos a cubrir

- **N/A** — `PrivacyPolicy.tsx` es un componente puramente visual sin lógica, según la excepción explícita en [tests.md](../../../reference/tests.md) sección "Excepciones".
- No se agregan tests nuevos.
- Los gates de CI preexistentes aplican:
  - TypeScript strict (`npm run build` debe compilar).
  - Markdownlint del `prd.md`, `specs.md`, `plan.md` (`.markdownlint.json`).

### Cobertura

La cobertura global no debe bajar. Como no se modifica código con lógica, los umbrales 80% se mantienen intactos.

---

## Mocks y dependencias

- Sin mocks nuevos.
- Sin nuevas dependencias npm.
- Sin nuevas env vars.
- Sin nuevos secrets en Firebase Secret Manager.

---

## Error handling

- **N/A**: el componente no tiene paths de error porque no hay operaciones async.
- Si algún día se agrega lógica (fetching de la política desde Firestore, por ejemplo), sería otro ticket — este trabajo mantiene el componente estático.

---

## Analytics

- Sin eventos nuevos.
- Sin cambios en `src/constants/analyticsEvents/`.
- Sin cambios en `ga4FeatureDefinitions.ts`.

---

## Firestore rules

- Sin cambios.

## Cloud Functions

- Sin cambios.

## Storage rules

- Sin cambios.

## Converters

- Sin cambios.

## Tipos

- Sin cambios en `src/types/`.

## Constantes

- Sin cambios en `src/constants/`.

---

## Rollout y observabilidad

- Deploy estándar a `new-home` → merge → hosting auto-deploy.
- No hay métricas nuevas para monitorear.
- Validación manual post-deploy: abrir `/` → Perfil → Ayuda → Política de privacidad → verificar que los 4 cambios aparecen renderizados correctamente en mobile y desktop, y en dark mode.

---

## Riesgos

| Riesgo | Mitigación |
|--------|------------|
| El copy nuevo queda inconsistente con el tono del resto | Copy revisado en PRD + voseo argentino mantenido |
| Markdownlint falla en el `.md` del PRD/specs/plan | Corrida local antes de commit |
| Breaking change de TypeScript por `<code>` dentro de `<Li>` | `<code>` es HTML estándar, soportado por Typography children |
| Olvido de actualizar la fecha | Checklist de plan incluye paso dedicado |

---

## Convenciones y referencias

- [`docs/reference/patterns.md`](../../../reference/patterns.md) — Copywriting y localización (voseo argentino, tildes).
- [`docs/reference/security.md`](../../../reference/security.md) — Colecciones de Firestore (`abuseLogs` ya documentada en línea 99).
- [`docs/reference/tests.md`](../../../reference/tests.md) — Excepciones a la política de cobertura para componentes puramente visuales.

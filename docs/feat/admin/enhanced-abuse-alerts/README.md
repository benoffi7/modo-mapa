# PRD: Enhanced Abuse Alerts Panel

**Estado:** Draft
**Prioridad:** Media
**Componente:** `src/components/admin/AbuseAlerts.tsx`

---

## Contexto

El tab de Alertas del panel admin muestra logs de abuso (rate limits, contenido flaggeado, top writers) en una tabla con filtrado por tipo, ordenación por columnas, y búsqueda por userId. Funciona, pero a medida que crecen los datos se vuelve difícil identificar patrones, priorizar acciones y entender la salud del sistema de un vistazo.

### Estado actual

- **Filtros:** por tipo (chips con badge de conteo), por colección (chips dinámicos), por userId (texto libre)
- **Ordenación:** por tipo, colección, timestamp
- **Paginación:** "Cargar más" de a 20 items
- **Detalle:** fila expandible con detalle completo, userId, colección y fecha
- **Data:** fetch de 200 logs más recientes (hardcodeado)
- **Sin acciones:** es solo lectura, no se puede actuar sobre las alertas

---

## Mejoras propuestas

### M1: Resumen visual (KPI cards)

Agregar una fila de StatCards arriba de los filtros con métricas clave:

| Card | Valor | Lógica |
|------|-------|--------|
| Alertas hoy | Conteo de logs con timestamp = hoy | Filtro client-side sobre los datos cargados |
| Tipo más frecuente | El tipo con más ocurrencias en las últimas 24hs | Calculado en memo |
| Usuario más activo | userId con más alertas | Calculado en memo |
| Tendencia | Comparación hoy vs ayer (sube/baja/igual) | Requiere ampliar el fetch o agregar campo |

**Impacto:** Vista rápida del estado del sistema sin scrollear la tabla.
**Esfuerzo:** Bajo — reutiliza `StatCard` existente, cálculos client-side.

### M2: Filtro por rango de fechas

Agregar un date range picker para filtrar alertas por período.

- Dos campos de fecha (desde/hasta) o presets rápidos: "Hoy", "Última semana", "Último mes"
- Filtra client-side sobre los datos cargados
- Los presets rápidos como chips alineados con los filtros existentes

**Impacto:** Poder investigar incidentes específicos o ver tendencias por período.
**Esfuerzo:** Bajo — filtro client-side, MUI DatePicker o inputs nativos.

### M3: Acciones sobre alertas

Agregar la posibilidad de actuar sobre una alerta desde la fila expandida:

| Acción | Descripción | Backend |
|--------|-------------|---------|
| Marcar como revisada | Agrega campo `reviewed: true` al doc | Update en `abuseLogs/{id}` |
| Descartar | Elimina el log (soft delete con `dismissed: true`) | Update en `abuseLogs/{id}` |
| Bloquear usuario | Deshabilita la cuenta Firebase Auth | Cloud Function `disableUser(uid)` |

- Badge en el tab "Alertas" del AdminLayout mostrando conteo de alertas no revisadas
- Filtro "Solo pendientes" / "Todas" para ocultar las ya revisadas

**Impacto:** Convierte el panel de solo-lectura en una herramienta de moderación accionable.
**Esfuerzo:** Medio — requiere nuevos campos en Firestore, cloud function para bloqueo, y reglas de seguridad.

### M4: Detalle de usuario inline

Cuando se expande una fila, mostrar más contexto del usuario:

- Cantidad total de alertas de ese usuario (todos los tipos)
- Primera y última alerta registrada
- Método de autenticación (anónimo vs email)
- Link directo a Firebase Console del usuario

**Impacto:** Contexto inmediato para decidir si actuar sin salir del panel.
**Esfuerzo:** Bajo-Medio — requiere query adicional por usuario y posiblemente cache.

### M5: Exportar datos

Botón para exportar los logs filtrados a CSV.

- Respeta los filtros activos (exporta lo que se ve)
- Columnas: tipo, userId, colección, detalle, fecha
- Generación client-side con descarga directa

**Impacto:** Útil para análisis offline o reportes.
**Esfuerzo:** Bajo — generación de CSV puramente client-side.

### M6: Notificación en tiempo real

Agregar listener de Firestore (`onSnapshot`) para nuevas alertas en lugar del fetch estático.

- Indicador visual cuando llegan alertas nuevas mientras el tab está abierto
- Sonido/badge opcional
- Fallback: botón "Actualizar" manual

**Impacto:** No perder alertas críticas (ej: un ataque de spam activo).
**Esfuerzo:** Bajo — Firestore onSnapshot es directo, ya se usa en otros componentes.

### M7: Agrupación por usuario (vista reincidentes)

Vista alternativa que agrupa alertas por userId:

| userId | Total alertas | Rate limits | Flagged | Última alerta | Acción |
|--------|--------------|-------------|---------|---------------|--------|
| abc123 | 15 | 12 | 3 | hace 2hs | Ver / Bloquear |

- Toggle entre vista "Por alerta" (actual) y "Por usuario"
- Ordenable por total de alertas para detectar reincidentes rápido

**Impacto:** Identificar usuarios problemáticos de un vistazo en lugar de buscar patrones en logs individuales.
**Esfuerzo:** Medio — agrupación client-side, nueva vista de tabla.

---

## Priorización sugerida

| Fase | Mejoras | Justificación |
|------|---------|---------------|
| **Fase 1** | M1 (KPIs) + M2 (fechas) + M5 (export) | Quick wins, solo frontend, valor inmediato |
| **Fase 2** | M3 (acciones) + M4 (detalle usuario) | Convierte el panel en herramienta de moderación real |
| **Fase 3** | M6 (realtime) + M7 (vista reincidentes) | Mejoras avanzadas para escala |

---

## Cambios en backend necesarios

### Fase 1: Ninguno
Todo es client-side sobre los datos existentes.

### Fase 2:
- **Nuevos campos en `abuseLogs`:** `reviewed: boolean`, `dismissed: boolean`, `reviewedAt: Timestamp`
- **Nueva Cloud Function:** `disableUser(uid)` — deshabilita cuenta en Firebase Auth
- **Firestore Rules:** permitir update de `reviewed`/`dismissed` solo a admins
- **Migración:** los docs existentes sin estos campos se tratan como `reviewed: false`

### Fase 3:
- **Cambio en fetch:** reemplazar `fetchAbuseLogs(200)` por `onSnapshot` con query limitada
- **Índice Firestore:** posible índice compuesto si se filtra por fecha + tipo simultáneamente

---

## Fuera de alcance

- Integración con Telegram para alertas push (Telegram es solo para repo/CI)
- Machine learning o detección automática de patrones
- Panel público de moderación (esto es admin-only)
- Cambios en la lógica de detección de abuso (rateLimiter, moderator)

---

## Notas técnicas

- El componente actual tiene 308 líneas; con las mejoras de Fase 1+2 estimamos ~500 líneas. Considerar extraer subcomponentes (`AbuseKPICards`, `AbuseUserDetail`, `AbuseActions`).
- El fetch actual de 200 docs es suficiente para Fase 1. Para Fase 2+ considerar paginación server-side.
- `StatCard` ya existe y se usa en `DashboardOverview` — reutilizar directamente.

---

## Para el review

- [ ] El problema esta bien definido?
- [ ] La solucion propuesta tiene sentido?
- [ ] El scope es correcto? (algo sobra o falta?)
- [ ] Las prioridades estan bien?
- [ ] Algun concern de seguridad?

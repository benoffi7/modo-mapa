# Plan: Enhanced Abuse Alerts — Fase 1

**Specs:** [Specs](./specs.md)
**Branch:** `feat/enhanced-abuse-alerts`

---

## Pasos de implementación

### Paso 1: KPI Cards

1. Agregar imports de MUI (`Card`, `CardContent`, `Tooltip`) y icons (`TrendingUp/Down/Flat`)
2. Crear `KpiCard` como componente local (acepta `label`, `value: string|number`, `secondary?: ReactNode`)
3. Crear función `computeKpis(logs)` que calcula: alertas hoy, alertas ayer, tipo más frecuente, usuario más activo
4. Agregar `useMemo` con `computeKpis` en el componente principal
5. Renderizar fila de 4 KpiCards arriba de los filtros existentes

### Paso 2: Filtro de fechas

1. Definir tipo `DatePreset` y constante `DATE_PRESETS` con labels
2. Agregar estado `datePreset` (default: `'all'`)
3. Crear función `getDateThreshold(preset)` que devuelve `Date | null`
4. Integrar filtro de fecha en el `useMemo` de `filtered` existente
5. Renderizar fila de chips de presets entre KPIs y filtros de tipo
6. Incluir `datePreset` en `hasActiveFilters` y `clearFilters`

### Paso 3: Export CSV

1. Agregar import de `FileDownloadIcon`
2. Crear función `exportToCsv(logs, filename)` con generación de Blob y descarga
3. Agregar `IconButton` con tooltip al final de la fila de filtros
4. Deshabilitar cuando `filtered.length === 0`

### Paso 4: Verificación

1. `npx tsc --noEmit` — sin errores de tipos
2. `npm run lint` — sin warnings nuevos
3. `npm run test:run` — tests existentes pasan
4. Test manual en emulador: verificar KPIs, filtros de fecha, y descarga CSV

---

## Criterios de completitud

- [ ] 4 KPI cards visibles arriba de la tabla con datos correctos
- [ ] Icono de tendencia (hoy vs ayer) funcional
- [ ] 4 presets de fecha funcionan como filtro
- [ ] Presets se resetean con "Limpiar filtros"
- [ ] Botón de export genera CSV con datos filtrados
- [ ] CSV se descarga correctamente con nombre `alertas-YYYY-MM-DD.csv`
- [ ] Compilación limpia (tsc + lint + tests)

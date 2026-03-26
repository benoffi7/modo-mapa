# Specs: Enhanced Abuse Alerts Panel

**PRD:** [Enhanced Abuse Alerts](./README.md)
**Estado:** Aprobado

---

## Fase 1: KPI Cards + Filtro de fechas + Export CSV

### S1: KPI Cards (M1)

**Componente:** `AbuseKPICards` (nuevo subcomponente)

Recibe `logs: AbuseLog[]` como prop. Calcula con `useMemo`:

| Card | Cálculo | Display |
|------|---------|---------|
| Alertas hoy | `logs.filter(l => l.timestamp >= startOfToday)` | Número + icono tendencia (vs ayer) |
| Tipo más frecuente | Max de `Object.entries(groupBy(logs, 'type'))` | Label del tipo (ej: "Rate Limit") |
| Usuario más activo | Max de `Object.entries(groupBy(logs, 'userId'))` | userId truncado (8 chars) + conteo |
| Total cargadas | `logs.length` | Número |

**Layout:** Fila de 4 cards con `Box display=flex gap=2`, responsive con `flexWrap: wrap` y `minWidth: 140`.

**Tendencia hoy vs ayer:**
- `alertsToday > alertsYesterday` → `TrendingUpIcon` en rojo
- `alertsToday < alertsYesterday` → `TrendingDownIcon` en verde
- Iguales → `TrendingFlatIcon` en gris

No se extiende `StatCard` existente (solo acepta `value: number`). Se crea `KpiCard` local que acepta `value: string | number` y un slot `secondary` para el icono de tendencia.

### S2: Filtro por rango de fechas (M2)

**Ubicación:** Fila nueva de chips entre KPI cards y los filtros de tipo existentes.

**Presets:**

| Key | Label | Threshold |
|-----|-------|-----------|
| `all` | Todo | `null` (sin filtro) |
| `today` | Hoy | `startOfToday()` |
| `week` | Última semana | `now - 7 días` |
| `month` | Último mes | `now - 1 mes` |

**Estado:** `datePreset: DatePreset` (default: `'all'`).

**Lógica de filtrado:** Se agrega al `useMemo` de `filtered` existente:
```typescript
const threshold = getDateThreshold(datePreset);
if (threshold) {
  result = result.filter(l => l.timestamp.getTime() >= threshold.getTime());
}
```

**Interacción:** Click toggle (click en el activo vuelve a `'all'`). Se incluye en `hasActiveFilters` y se resetea con "Limpiar filtros".

### S3: Export CSV (M5)

**UI:** `IconButton` con `FileDownloadIcon` + `Tooltip "Exportar CSV"`, ubicado al final de la fila de filtros (junto a "Limpiar filtros").

**Lógica:** Función `exportToCsv(logs: AbuseLog[], filename: string)`:
1. Header: `Tipo,Usuario,Colección,Detalle,Fecha`
2. Rows: mapeo de `filtered` (respeta filtros activos)
3. Escape de comillas dobles en `detail`
4. Genera `Blob` con `type: text/csv;charset=utf-8`
5. Descarga via `URL.createObjectURL` + click en `<a>` temporal

**Filename:** `alertas-YYYY-MM-DD.csv`

**Disabled:** cuando `filtered.length === 0`.

---

## Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `src/components/admin/AbuseAlerts.tsx` | Agregar KPI cards, date presets, export button, extraer subcomponentes |

**Archivos nuevos:** Ninguno. Todo dentro de `AbuseAlerts.tsx` para mantener cohesión (< 500 líneas estimadas con las 3 mejoras).

---

## Tipos nuevos

```typescript
// Dentro de AbuseAlerts.tsx (locales, no exportados)
type DatePreset = 'all' | 'today' | 'week' | 'month';
```

No se modifican tipos globales ni interfaces de `admin.ts`.

---

## Dependencias nuevas

**Imports MUI adicionales:**
- `Card`, `CardContent` (para KpiCard)
- `Tooltip` (para export button)
- `@mui/icons-material/FileDownload`
- `@mui/icons-material/TrendingUp`
- `@mui/icons-material/TrendingDown`
- `@mui/icons-material/TrendingFlat`

No se agregan dependencias npm nuevas.

---

## Tests

No se agregan tests nuevos. Las funciones helper (`computeKpis`, `getDateThreshold`, `exportToCsv`) son internas al componente. Si el componente crece más allá de Fase 1, se extraen y testean por separado.

---

## Impacto en performance

- KPIs: un `useMemo` adicional sobre los mismos 200 logs → negligible
- Date filter: se agrega al `useMemo` existente → negligible
- Export: operación one-shot on-click → sin impacto en render

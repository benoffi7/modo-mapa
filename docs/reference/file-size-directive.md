# Directiva de Tamaño de Archivos

**Aplica a:** todos los archivos `.tsx` y `.ts` en `src/`
**Referenciado en:** specs y planes técnicos

---

## Regla principal

**Ningún componente o módulo debe superar las 400 líneas.** Si un archivo se acerca a ese límite durante la implementación, debe descomponerse antes de mergear.

## Umbrales

| Líneas | Estado | Acción |
|--------|--------|--------|
| < 200 | Ideal | Ninguna |
| 200-400 | Aceptable | Monitorear |
| 400-500 | Warning | Planificar extracción de subcomponentes |
| > 500 | Bloqueante | No mergear sin descomponer |

## Patrón de descomposición

Cuando un archivo supera 400 líneas:

1. **Componentes UI**: extraer subcomponentes a archivos separados en el mismo directorio
   - Ejemplo: `BusinessComments.tsx` → `CommentInput.tsx`, `CommentRow.tsx`

2. **Paneles admin**: crear subdirectorio con helpers y subcomponentes
   - Ejemplo: `PerformancePanel.tsx` → `perf/SemaphoreCard.tsx`, `perf/perfHelpers.ts`
   - Ejemplo: `AbuseAlerts.tsx` → `alerts/KpiCard.tsx`, `alerts/alertsHelpers.ts`

3. **Componentes layout**: extraer secciones lógicas
   - Ejemplo: `SideMenu.tsx` → `SideMenuNav.tsx`

4. **Listas del menú**: extraer toolbar, stats, y items
   - Ejemplo: `CommentsList.tsx` → `CommentsStats.tsx`, `CommentsToolbar.tsx`

## Requisito en planes técnicos

Todo spec/plan debe incluir una sección de **estimación de líneas por archivo**. Si algún archivo resultante supera 400 líneas, el plan debe incluir la estrategia de descomposición.

Ejemplo en un plan:

```markdown
## Estimación de archivos

| Archivo | Líneas estimadas | Acción |
|---------|-----------------|--------|
| NewFeature.tsx | ~250 | OK |
| ExistingComponent.tsx | ~450 (actual 380 + 70 nuevas) | Extraer SubComponent.tsx |
```

## Archivos exceptuados

- `*.test.ts` / `*.test.tsx` — tests pueden ser más largos
- Páginas DEV-only (`ConstantsDashboard.tsx`, `ThemePlayground.tsx`)
- Archivos de configuración (`admin.ts` services)

# Guard: Copy / UX writing (#309)

Regression guard derivado del audit de copy ejecutado el 2026-04-18 (issue #309). Este documento fija las reglas de redaccion UI y los patrones de deteccion que deben permanecer verdes en `new-home` para evitar reintroducir la deuda cerrada en #270, #282, #292 y #309.

---

## Reglas

1. **Voseo rioplatense consistente** — ni tuteo peninsular (`tú/tienes/puedes/haz`) ni formalidad distante. Imperativo argentino: `dejame`, `contame`, `intentá`, `probá`, `sorprendeme`. Segunda persona: `tenés`, `podés`, `hacés`, `querés`.
2. **Tildes en todas las palabras con acento** — `leídas`, `Más`, `Sección`, `Distribución`, `Auditorías`, `rápidas`, etc. Excepcion explicita: `Sorprendeme` (imperativo vos sin tilde, como `dejame`/`contame`; no confundir con la forma peninsular `Sorpréndeme`).
3. **Naming unico: "Sorprendeme"** — en todo el codigo y docs (`QuickActions`, `HelpSection`, `features.md`, `ga4FeatureDefinitions.ts`). Prohibido: `Sorpresa`, `Sorpréndeme`, `Sorprendeme!` (con exclamacion).
4. **Strings UI repetidos centralizados** en `src/constants/messages/common.ts` (`MSG_COMMON`). Claves vigentes: `Cerrar`, `Cerrar aviso`, `Cargar más`, `Cargando...`, `Buscar...`. Umbral de extraccion: >= 2 call sites.
5. **Interrogaciones/exclamaciones con apertura** — `¿...?`, `¡...!`. Nunca `...?` ni `...!` sueltos en textos visibles.
6. **Mensajes de error accionables** — todo error debe recomendar el siguiente paso del usuario (`Intentá de nuevo.`, `Revisá tu conexion.`, `Recargá la página.`). Prohibido: `Error`, `Algo salió mal` sin contexto, `No se pudo guardar el cambio` sin accion siguiente.

---

## Detection patterns

Ejecutar estos `grep` como smoke test post-merge. El output esperado es el documentado junto a cada comando.

### Tildes y variantes prohibidas (debe retornar vacio)

```bash
grep -rEn "\b(leidas|Mas seguidos|Distribucion|Auditorias|rapidas|Seccion|Sorpresa|Sorpréndeme)\b" src/ --include="*.tsx" --include="*.ts"
```

Cualquier hit es una regresion de #309. Verificar contexto antes de corregir — aplica solo a strings user-facing, no a nombres de variables.

### Strings `Cerrar` hardcodeados (inspeccion manual)

```bash
grep -rn "'Cerrar'" src/components/ --include="*.tsx" | grep -v MSG_COMMON
```

Cada hit debe revisarse. Si el componente consume una etiqueta generica de cierre, migrar a `MSG_COMMON.closeAriaLabel`. Si es un cierre especifico de dominio (`Cerrar nudge de verificación`), documentar la excepcion.

### Tuteo peninsular (verificar persona y contexto)

```bash
grep -rEn "(tienes|puedes|haces|debes)" src/ --include="*.tsx"
```

Para cada match, confirmar que no sea 2da persona peninsular. Correcto: voseo (`tenés`, `podés`, `hacés`, `debés`) o 3ra persona impersonal. Incorrecto: `tú tienes`, `puedes hacer`, etc.

---

## Related

- PRD original: [`docs/fix/ux/309-copy-tildes-sorprendeme/prd.md`](../../fix/ux/309-copy-tildes-sorprendeme/prd.md)
- Issue GitHub: #309
- Guards previos del mismo dominio: #270 (copy audit inicial), #282 (copy fixes v2), #292 (copy + dark mode)
- Patron de copy centralizado: `src/constants/messages/common.ts` y `docs/reference/patterns.md` > Copywriting
- Auditor automatizado: `.claude/agents/copy-auditor.md`

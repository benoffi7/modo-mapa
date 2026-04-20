# Guard: Help docs vs features (#311)

Regression-guard contractual entre la pantalla de Ayuda (`HelpSection`) y la
documentacion de features. Busca evitar que la guia in-app vuelva a
desincronizarse de la realidad del producto (como se detecto en el
`/health-check` 2026-04-18).

## Contexto

- PRD: [`docs/feat/content/311-help-section-update/prd.md`](../../feat/content/311-help-section-update/prd.md)
- Issue: #311
- Componente: `src/components/profile/HelpSection.tsx`
- Registry: `src/components/profile/helpGroups.tsx` (extraido en #311)
- Fuente de verdad: `docs/reference/features.md`
- Guard relacionado (voseo): #309

## Reglas

1. **Cobertura 1:1.** `src/components/profile/HelpSection.tsx` (via el
   registry `helpGroups.tsx`) debe reflejar toda seccion listada en
   `docs/reference/features.md`. Si `features.md` lista una capability
   user-facing, el registry tiene un item que la menciona.
2. **Checklist de PR.** Cuando una nueva feature user-facing aterriza, el
   PR debe actualizar **o bien** `features.md` + `helpGroups.tsx`, **o
   bien** incluir un comentario explicito
   `// help-docs-out-of-scope: <justificacion>` en el diff (ej: refactor
   interno, feature flag oculta, experimento). Sin comentario y sin
   update, `/merge` bloquea.
3. **Voseo consistente.** `HelpSection` y `helpGroups.tsx` usan voseo
   rioplatense (Tocá, Andá, Activá, Registrá), alineado con el resto de la
   app. Ver guard #309.
4. **Avatares sincronizados.** Cualquier count de avatares citado en la
   Ayuda (ej. "20 opciones") debe coincidir con el length real del array
   exportado en `src/constants/avatars.ts`. Preferir derivar el numero
   dinamicamente (`AVATARS.length`) o cubrirlo con un test de integridad.
5. **Ubicacion del toggle de tema.** La referencia a "Configuracion >
   Apariencia" como hogar del toggle de modo oscuro debe coincidir con la
   estructura real de `SettingsPanel`. Si se mueve el toggle, actualizar
   los items `Configuracion` y `Modo oscuro` en el registry.

## Deteccion

### Script CI-friendly

Por cada `id` en el registry `helpGroups.tsx`, esperar un header
correspondiente en `docs/reference/features.md`. Pseudocodigo:

```bash
# Extraer ids del registry
ids=$(grep -oP "id:\s*'\K[a-z-]+" src/components/profile/helpGroups.tsx)

# Verificar que cada id tenga un header en features.md
for id in $ids; do
  if ! grep -qiE "^#+\s.*$id" docs/reference/features.md; then
    echo "MISSING in features.md: $id"
  fi
done
```

### Grep puntuales

```bash
# Si se menciona una cantidad explicita de avatares, cross-check con la constante
grep -n "20 opciones" src/components/profile/HelpSection.tsx \
  src/components/profile/helpGroups.tsx

# Luego verificar length real
grep -cE "^\s*['\"]" src/constants/avatars.ts
```

Si aparece "20 opciones" pero el array no tiene 20 entradas, fallar.

### Merge checklist

- El agente `help-docs-reviewer` corre como parte de `/merge` contra el
  diff completo (no solo archivos tocados) para detectar drift.
- El agente `copy-auditor` valida voseo en nuevos strings agregados al
  registry.

## Accion esperada cuando falla el guard

1. Actualizar `helpGroups.tsx` con el item faltante / descripcion
   corregida.
2. Si la feature no deberia estar en Ayuda (experimento, admin-only),
   agregar comentario `// help-docs-out-of-scope: <motivo>` en el PR.
3. Si el count de avatares cambia, refactorizar a
   `${AVATARS.length} opciones` y agregar test.
4. Si cambia la ubicacion del toggle de tema, actualizar ambos items
   (`Configuracion` y `Modo oscuro`) en el mismo PR.

## Relacionados

- PRD: [`docs/feat/content/311-help-section-update/prd.md`](../../feat/content/311-help-section-update/prd.md)
- Guard #309 (voseo): ver guards del mismo directorio.
- Agente: `.claude/agents/help-docs-reviewer.md`.

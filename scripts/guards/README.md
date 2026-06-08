# Regression guards — runner

Executable counterpart of `docs/reference/guards/*.md`. Each guard rule is implemented as a shell command in `checks.mjs`; the runner iterates them, counts violations, and compares against `.guards-baseline.json`.

## Usage

```bash
# Human-readable summary (default for npm run guards)
npm run guards

# Machine-readable JSON
npm run guards:json

# Compare current state against .guards-baseline.json (CI / pre-push)
npm run guards:check

# Update the baseline (only allowed when nothing regressed)
npm run guards:baseline
```

## Files

| File | Purpose |
|---|---|
| `checks.mjs` | Registry of guards and their rule commands. Edit this to add/refine rules. |
| `run.mjs` | Runs all rules, emits report (JSON or pretty). |
| `check-baseline.mjs` | Compares current vs baseline. Used by pre-push and CI. Also has `--update` mode. |
| `data/spanish-tildes.json` | Diccionario de tildes castellanas (guard 309/R2 + R3). Ver abajo. |
| `lib/check-box-onclick.mjs` | Detector multi-line de `<Box onClick>` sin a11y triplet (guard 305/R7). |
| `../.guards-baseline.json` | Locked-in counts per rule. The ceiling — pushes can lower it, never raise it. |

## How the convergence model works

1. The **baseline** stores the current ceiling (count per rule).
2. Every push runs `guards:check` (via Husky pre-push and GitHub Actions). If any rule's count INCREASED vs baseline, the push/PR fails.
3. When a rule's count goes DOWN (you fixed something), the report tells you to run `npm run guards:baseline` to lock the lower number as the new ceiling.
4. Convergence target: every count → 0. Once a rule hits 0, future commits cannot regress it (any non-zero violation is a regression vs baseline 0).

## Adding a new rule

1. Edit `docs/reference/guards/<n>-<slug>.md` first — describe the rule and the grep pattern in human-readable form.
2. Add the rule to `checks.mjs` under the matching guard, with `id`, `desc`, and a shell `cmd` that prints one violation per line (typically a `grep` chain).
3. Run `npm run guards` locally to verify the count.
4. Run `npm run guards:baseline` to lock in the current count.
5. Commit `checks.mjs` + `.guards-baseline.json` together with the docs change.

## Diccionario de tildes (guard 309)

El guard `309/R2-tildes-prohibidas` ya **no** es una lista cerrada de palabras hardcodeadas en `checks.mjs`. Es data-driven: lee `data/spanish-tildes.json`.

```jsonc
{
  "always_tilded": ["acción", "sección", "ubicación", ...],  // forma CORRECTA (con tilde)
  "whitelist":     ["Function", "useNavigation", "version", ...]  // FPs a ignorar
}
```

**Cómo funciona:**

1. `checks.mjs` lee el JSON al cargar el módulo.
2. Por cada palabra de `always_tilded` deriva la forma **sin** tilde (`acción` → `accion`) — esa es la variante que grepea en `src/`. Cualquier string con la forma sin tilde es una regresión de copy.
3. Las palabras de `whitelist` se filtran del resultado (identificadores TS/JS o términos en inglés que matchean el patrón pero no son castellano).

**Para agregar una palabra:**

1. Editá `data/spanish-tildes.json` → `always_tilded`. Agregá la forma **con tilde** (ej. `"recomendación"`).
2. **Regla de oro:** solo agregá palabras cuya forma SIN tilde NO sea a su vez otra palabra castellana válida. Evitá ambiguas:
   - `está` (verbo) vs `esta` (demostrativo) → **no agregar**.
   - `más` (cantidad) vs `mas` (conjunción) → **no agregar**.
   - `aún` (todavía) vs `aun` (incluso) → **no agregar**.
   - plurales `-ciones` que pierden la tilde (`notificaciones`, `opciones`) → **no agregar** (solo el singular `-ción`).
   - `icono`/`ícono`, `area`/`área` → ambas válidas en es-AR → **no agregar**.
3. Si una palabra inglesa o identificador genera falso positivo, agregalo a `whitelist`.
4. Corré `npm run guards -- --guard 309` y revisá los hits.
5. Re-lockeá: `npm run guards:baseline` (o `--force` si el count sube — ver más abajo).

**Heurística `R3-tildes-heuristica` (WARNING):** detecta palabras terminadas en `cion` (≥4 chars) dentro de strings JSX que **no** están ni en la whitelist ni ya cubiertas por el diccionario. Es una sugerencia: cada hit es un candidato a promover a `always_tilded` (en su forma con tilde, `-ción`). No bloquea — sirve para que el diccionario no se quede atrás del drift.

## Detector de `<Box onClick>` (guard 305/R7)

`lib/check-box-onclick.mjs` reemplaza el AWK single-line original (fallaba en JSX multi-line, el caso real más común). Lee todos los `.tsx` de `src/components/`, escanea cada apertura `<Box` con un parser que balancea `{}`/`[]`/`()` y respeta strings (para no cortar en `=>` ni en expresiones JSX), y por cada `<Box ... onClick=...>` verifica el triplet a11y WCAG 2.1.1:

- `role="button"`
- `tabIndex` con valor numérico
- `onKeyDown`

Reporta `archivo:linea: missing [...] — <snippet>`. Para exceptuar un caso justificado, agregá `guard:exempt` dentro del tag. Corré standalone con `node scripts/guards/lib/check-box-onclick.mjs`.

## Adding a cross-cutting test (when grep is too coarse)

Some invariants need parsing instead of grep — e.g. "every literal in `FeedbackCategory` union must appear in `PrivacyPolicy.tsx`". Those live as Vitest tests in `src/__tests__/guards/cross-cutting.test.ts`.

If the test is currently failing because of a known regression, mark it with `it.fails` and add an entry to `KNOWN_REGRESSIONS_TO_REMOVE` with the tracking issue. When the regression is fixed, the test passes, `it.fails` flips red, and the implementer must remove the entry.

## Updating the baseline (downward)

```bash
# After fixing some violations:
npm run guards:check
# → suggests running guards:baseline if it sees reductions

npm run guards:baseline
# → updates .guards-baseline.json to current state (only if no regressions)

git add .guards-baseline.json
git commit -m "chore(guards): ratchet baseline to N violations"
```

The `--update` flag refuses to run if any rule regressed — preventing accidental "raising" of the ceiling.

## Wired to

- **Husky pre-push hook** (`.husky/pre-push`): runs `guards:check` then `build`. Push fails if guards regress.
- **GitHub Actions** (`.github/workflows/guards.yml`): runs `guards:check` on every PR + push. Blocks merge if any rule grew.
- **`/merge` skill Phase 0a**: runs `guards:check` as the first quality gate. Aborts the merge if guards regressed.
- **Implementation agents** (`luna`, `nico`, `manu`): explicit reading list of relevant guards before writing code; final `guards:check` before commit.

## Deliberate scope decisions

- **Guards are docs first, scripts second.** The markdown explains intent and edge cases; the scripts are smoke tests. If a guard cannot be expressed as a precise grep, document it in the markdown anyway and mark the rule as "manual review" in `checks.mjs`.
- **False positives are tolerated up to a point.** A rule that cannot be cleanly automated (e.g. "Box onClick without role/tabIndex/onKeyDown" requires multi-line AST analysis) lives in the docs and as a heuristic in `checks.mjs`. The cross-cutting tests pick up the harder cases.
- **The baseline is a contract.** Raising the baseline (allowing more violations) requires team discussion and an explicit commit message — it is never a unilateral act.

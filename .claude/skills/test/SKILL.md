---
name: test
description: "Write or improve tests for the current feature branch using the testing agent. Pass optional file paths or 'coverage' to analyze gaps."
argument-hint: "[file-paths or 'coverage']"
user-invocable: true
---

# Test Writer

Write or improve tests for the current feature branch using the `testing` agent.

**Usage**:
- `/test` — write tests for all new/modified files on this branch
- `/test src/hooks/useFavorites.ts` — write tests for a specific file
- `/test coverage` — analyze coverage gaps and write tests to fill them

Arguments: $ARGUMENTS

## Process

### Step 1: Determine scope

**If `$ARGUMENTS` is empty** — detect changed files on this branch:

```bash
git diff --name-only origin/new-home -- 'src/**/*.ts' 'src/**/*.tsx' | grep -v '.test.' | grep -v '.spec.'
```

**If `$ARGUMENTS` is `coverage`** — run coverage and find gaps:

```bash
npx vitest run --coverage 2>&1 | tail -50
```

**If `$ARGUMENTS` is a file path** — use that specific file.

### Step 2: Launch testing agent

Launch a **testing** agent with the prompt:

```
Write tests for the modo-mapa project (React 19 + Vite + Vitest + Testing Library + Firebase).

Files to test:
<list of files from Step 1>

Context:
- Read `docs/reference/tests.md` for testing conventions
- Read `docs/reference/patterns.md` for project patterns
- Check existing tests for style reference
- Use `verbatimModuleSyntax: true` — use `import type` for types
- Mock Firebase with the project's existing mock patterns (check `src/test/` or existing `.test.ts` files)
- Test file naming: `<filename>.test.ts` next to the source file

Requirements:
1. Cover happy path, error cases, and edge cases
2. For hooks: test with renderHook, mock dependencies
3. For services: test function inputs/outputs, mock Firestore
4. For components: test user interactions, not implementation details
5. Aim for 80%+ branch coverage on each file

After writing tests:
1. Run `npx vitest run --dir src` to verify all tests pass
2. Run `npx vitest run --coverage` to verify coverage threshold
3. Fix any failing tests
4. Commit with: `test: add tests for <files>`
```

### Step 3: Report

Show test results:
- Number of tests written
- Coverage before/after
- Any files that still need manual testing

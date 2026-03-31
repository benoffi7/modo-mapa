# Gemini CLI - Modo Mapa Mandates

You are a senior software engineer working on the Modo Mapa project. You MUST adhere to these foundational mandates, which take precedence over any general instructions.

## Core Rules

1. **Main Branch**: The primary development branch is `new-home`. NEVER work directly on `main` for code changes.
2. **Worktree Workflow**: Always work in a separate worktree for features/fixes.
   - Root: `/home/walrus/proyectos/modo-mapa`
   - Worktrees: `.claude/worktrees/<short-name>`
   - All commands (npm, tsc, vite, tests) MUST run from the worktree directory if applicable.
3. **File Size Limit**: Keep `.ts`/`.tsx` files under **400 lines**.
   - If a file exceeds this, decompose it: extract subcomponents, hooks, or utils.
   - Exceptions: Test files, constants, config, and specific admin dashboards.
4. **Boundary Guard**: Components (in `src/components/`, except `src/components/admin/`) MUST NOT import Firebase SDK directly (`firebase/firestore`, `firebase/functions`, `firebase/storage`).
   - Use `src/services/` or `src/hooks/` instead.
5. **Testing**: 
   - Every new `.ts`/`.tsx` file in `src/services/` and `src/hooks/` MUST have a corresponding `.test.ts`.
   - Aim for 80% coverage on new code.
6. **Firestore Rules**: 
   - New collections must have `keys().hasOnly([...])` on `create`.
   - Ownership checks (`resource.data.userId == request.auth.uid`) on `update`/`delete`.
   - `affectedKeys().hasOnly([...])` on `update`.
7. **Type Safety**:
   - Use `import type` for type-only imports (required by `verbatimModuleSyntax`).
   - Avoid `as` type casts.
8. **Naming**:
   - Components: `PascalCase.tsx`.
   - Hooks: `useCamelCase.ts`.
   - Services/Utils: `camelCase.ts`.
9. **Documentation**:
   - Always update `docs/reference/project-reference.md` and other relevant docs when adding features.
   - Update `docs/reports/backlog-producto.md` and `docs/reports/changelog.md` after merging.

## Automated Procedures

When asked to "merge" or "start", follow the protocols defined in `.claude/commands/` and `.claude/skills/merge/SKILL.md`.

### Pre-merge Checklist (Phase 1)
- Sync with `new-home`.
- `npm run lint` (0 errors).
- `npx vitest run --dir src`.
- `cd functions && npm run test:run`.
- `npx vite build`.
- Check 400-line limit.
- Validate Firestore indexes and rules.
- Boundary guard check.

### Automated Audits (Phase 2)
Use sub-agents for:
- `dark-mode-auditor`
- `security`
- `architecture`
- `ui-reviewer`
- `performance`
- `privacy-policy`
- `offline-auditor`

## Communication
- Be concise and direct.
- Focus on intent and technical rationale.
- Fulfill the user's request thoroughly, including tests and documentation.

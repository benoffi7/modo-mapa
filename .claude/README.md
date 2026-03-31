# Claude Code — Setup Guide for Modo Mapa

This guide explains how to set up the Claude Code agents, commands, and workflow automation when cloning the project on a new machine.

## Prerequisites

1. **Claude Code CLI** installed:

   ```bash
   npm install -g @anthropic-ai/claude-code
   ```

2. **Node.js 22+** and **npm**
3. **Git** configured with your GitHub account
4. **Firebase CLI**: `npm install -g firebase-tools`
5. **GitHub CLI**: `brew install gh` (or equivalent) + `gh auth login`

## Quick Start

```bash
# 1. Clone the repo
git clone https://github.com/benoffi7/modo-mapa.git
cd modo-mapa

# 2. Install dependencies
npm install
cd functions && npm install && cd ..

# 3. Copy environment file
cp .env.example .env
# Edit .env with your Firebase config values

# 4. Start Claude Code
claude
```

That's it. All agents, commands, and skills are tracked in the repo under `.claude/` and will be available immediately.

## What's included in the repo

### Commands (`/.claude/commands/`)

| Command | Description | When to use |
|---------|-------------|-------------|
| `/start` | Create worktree + branch + verify env | **First command** when starting any task |
| `/bump` | Semantic version bump | After merging features/fixes |
| `/merge` | Full pre-merge checklist | When ready to merge a branch to main |
| `/release` | Git tag + CHANGELOG + GitHub Release | For formal releases |
| `/status` | Project overview (version, CI, issues) | Quick context check |
| `/test-local` | Local testing protocol with emulators | Testing features locally |
| `/modotren` | Offline mode (no network operations) | Working with unstable connectivity |

### Agents (`.claude/agents/`) — 27 agents

#### Coordination & Role-based
| Agent | Type | Model | Description |
|-------|------|-------|-------------|
| `manu` | Coordinator | Opus | Staff Engineer / Tech Lead. Orchestrates implementation, delegates to specialists. Does NOT write code |
| `luna` | Implementation (frontend) | Default | Senior Frontend Engineer. Components, UI hooks, pages, theme, map. Mobile-first. |
| `nico` | Implementation (backend) | Default | Senior Backend Engineer. Cloud Functions, Firestore rules, services, types. Security-first. |
| `orchestrator` | **DEPRECATED** | Default | Replaced by `manu`. Kept for compatibility only |

#### Read-only auditors (report only, don't modify code)
| Agent | Type | Description |
|-------|------|-------------|
| `architecture` | Read-only | Validates folder structure, patterns, separation of concerns |
| `security` | Read-only | XSS, injection, race conditions, Firestore rules, auth bypass |
| `ui-reviewer` | Read-only | 360px layout, accessibility, dark mode, empty states |
| `dark-mode-auditor` | Read-only | Detects hardcoded colors that break dark mode |
| `copy-auditor` | Read-only | Spelling, tildes, tone consistency in user-facing strings |
| `offline-auditor` | Read-only | Uncached reads, unqueued writes, missing fallbacks |
| `privacy-policy` | Read-only | Data collection vs privacy policy consistency |
| `perf-auditor` | Read-only (Opus) | Firestore query instrumentation (`measureAsync`) + Cloud Function timing (`trackFunctionTiming`) |
| `admin-metrics-auditor` | Read-only (Opus) | Verifies all data/events have admin dashboard visibility |
| `help-docs-reviewer` | Read-only | Validates HelpSection content vs features.md |
| `pr-reviewer` | Read-only | Pull Request code review (quality, security, patterns) |
| `pre-implementation-gate` | Read-only | Validates PRD/specs/plan exist before implementation |

#### Implementation agents (can modify code)
| Agent | Type | Description |
|-------|------|-------------|
| `performance` | Read/Write | Bundle size, re-renders, lazy loading, Core Web Vitals optimization |
| `ui-ux-accessibility` | Read/Write | UI/UX improvements, WCAG accessibility fixes |
| `testing` | Read/Write | Writes unit and integration tests (Vitest + Testing Library) |
| `seed-manager` | Read/Write | Keeps seed data in sync with schema changes |
| `documentation` | Read/Write | Technical documentation writer (Spanish) |
| `dependency-updater` | Read/Write | Reviews and upgrades dependencies (minor/patch auto, major reported) |

#### Operations agents
| Agent | Type | Description |
|-------|------|-------------|
| `git-expert` | Exclusive | ONLY agent authorized to run git commands |
| `ci-guardian` | Read/Write (Opus) | Diagnoses and fixes CI/CD failures |
| `changelog-writer` | Read/Write | Maintains CHANGELOG.md |
| `docs-site-maintainer` | Read/Write | Maintains Docsify site (sidebar, READMEs) |
| `continuous-improvement` | Read/Write | Analyzes workflow friction, proposes improvements |
| `prd-writer` | Read/Write | Generates PRDs from GitHub issues |
| `specs-plan-writer` | Read/Write | Generates specs and plans from approved PRDs |

**Scope clarification:** `performance` optimizes general web performance (bundle, re-renders, vitals). `perf-auditor` only audits instrumentation (measureAsync, trackFunctionTiming). They don't overlap.

### Skills (`.claude/skills/`) — 8 user-invocable + 2 modifiers

#### Workflow skills
| Skill | Description |
|-------|-------------|
| `/start` | Create worktree + branch for a new feature/fix |
| `/merge` | Full pre-merge checklist (Phase 0-8: gate, quality, 11 audits, docs, merge, bump, push, reflection) |
| `/stage` | Deploy feature branch to staging |
| `/health-check` | Full project audit (12 agents) without merging |
| `/bulk-prd` | Create PRDs in batch from GitHub issues |

#### On-demand skills (new)
| Skill | Description |
|-------|-------------|
| `/audit <type>` | Run a specific auditor (security, architecture, dark-mode, ui, performance, perf-instrumentation, privacy, offline, copy, admin-metrics, help-docs, pr-review) |
| `/review-pr <number>` | Review a GitHub PR with the pr-reviewer agent |
| `/test [files\|coverage]` | Write tests for changed files or fill coverage gaps |
| `/deps` | Review and update dependencies (minor/patch auto-upgraded) |

#### Modifier skills
| Skill | Description |
|-------|-------------|
| `read-only` | Restricts agent to read-only operations |
| `no-create-files` | Allows edits but blocks new file creation |

## What's NOT in the repo (per-user config)

These files live in your local Claude config directory (`~/.claude/projects/<project-hash>/`) and need to be set up manually on a new machine:

### Memory (`memory/`)

Memory files persist learnings across conversations. They are NOT in the repo because they contain user-specific preferences. On a fresh clone, Claude will rebuild memory over time as you work:

- `MEMORY.md` — Index of all memories
- `feedback_*.md` — Your workflow preferences (branch rules, commit style, etc.)
- `reference_*.md` — Pointers to external systems (CI matrix, etc.)

### Settings files

- `.claude/settings.json` — Tracked in repo (tool permissions)
- `.claude/settings.local.json` — NOT tracked (local overrides, env-specific paths)

## Workflow overview

### Feature development

```
1. /start 123        ← creates worktree + branch + installs deps + verifies env
2. Work              ← implement feature with small commits
3. /merge            ← runs full checklist automatically:
   - Quality gates (tsc, lint, tests, build)
   - Automated audits (dark-mode, help-docs)
   - Doc updates (project-reference, seed, privacy)
   - Merge to main (no-ff)
   - Version bump (semver)
   - Push + CI verify
   - Branch cleanup + issue close
4. /release          ← (optional) tag + CHANGELOG + GitHub Release
```

**Rule: NEVER work directly on main for code changes.** Always `/start` first.
**Exception:** Workflow docs (prd.md, specs.md, plan.md) go directly to main — no branch, no audits, no CI check. Update `_sidebar.md` when adding new docs.

### Version convention

| Commit type | Bump | Example |
|-------------|------|---------|
| `feat:` | minor (2.4.0) | New feature |
| `fix:` | patch (2.3.1) | Bug fix |
| `docs:` / `chore:` | no bump | Documentation only |
| Breaking change | major (3.0.0) | Manual decision |

### Available agent types

When Claude needs specialized help, it delegates to agents:

- **Coordinators**: `manu` (Tech Lead, orchestrates features), ~~`orchestrator`~~ (deprecated, use manu)
- **Role-based implementors**: `luna` (Senior Frontend — components, UI hooks, theme, map), `nico` (Senior Backend — functions, rules, services, types)
- **Read-only auditors** (report only): `architecture`, `security`, `ui-reviewer`, `dark-mode-auditor`, `copy-auditor`, `offline-auditor`, `privacy-policy`, `perf-auditor`, `admin-metrics-auditor`, `help-docs-reviewer`, `pr-reviewer`, `pre-implementation-gate`
- **Implementation agents**: `performance`, `ui-ux-accessibility`, `testing`, `seed-manager`, `documentation`, `dependency-updater`
- **Operations agents**: `git-expert` (exclusive git access), `ci-guardian`, `changelog-writer`, `docs-site-maintainer`, `continuous-improvement`, `prd-writer`, `specs-plan-writer`

## Troubleshooting

### Commands not showing up

Commands should appear automatically. If not:

```bash
# Verify files exist
ls .claude/commands/

# Restart Claude Code
claude
```

### Agents not found

Agents in `.claude/agents/` are available to all conversations. Agents in the memory directory (`~/.claude/projects/*/agents/`) are per-user.

### Environment setup

```bash
# Required env vars (see .env.example)
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_GOOGLE_MAPS_API_KEY=...
VITE_GOOGLE_MAPS_MAP_ID=...
VITE_SENTRY_DSN=...

# Start dev environment with emulators
./scripts/dev-env.sh start
```

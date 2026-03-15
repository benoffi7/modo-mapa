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

### Agents (`.claude/agents/`)

| Agent | Type | Model | Description |
|-------|------|-------|-------------|
| `ci-guardian` | Read/Write | Opus | Diagnoses and fixes CI/CD failures. Has solution matrix |
| `admin-metrics-auditor` | Read/Write | Opus | Audits admin dashboard completeness vs all data/events |
| `dark-mode-auditor` | Read-only | Default | Scans for hardcoded colors that break dark mode |
| `seed-manager` | Read/Write | Default | Keeps seed data in sync with schema changes |
| `changelog-writer` | Read/Write | Default | Maintains CHANGELOG.md |
| `continuous-improvement` | Read/Write | Default | Analyzes workflow, proposes improvements |

### Skills (`.claude/skills/`)

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
   - Doc updates (PROJECT_REFERENCE, seed, privacy)
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

- **Read-only agents** (report only): `dark-mode-auditor`, `architecture`, `security`, `ui-reviewer`, `pr-reviewer`, `help-docs-reviewer`, `admin-metrics-auditor`
- **Implementation agents**: `testing`, `documentation`, `performance`, `ui-ux-accessibility`, `seed-manager`, `changelog-writer`, `continuous-improvement`, `ci-guardian`
- **Exclusive agents**: `git-expert` (only agent allowed to run git commands)
- **Coordinator**: `orchestrator` (delegates to the right specialist)

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

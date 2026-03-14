# Start Feature/Fix (Worktree + Branch Setup)

Sets up an isolated worktree with a new branch for working on an issue. This is the **first command** to run when starting any new task.

**Usage**: `/start` or `/start 84` (with issue number)

## Protocol

### Step 1: Determine issue context

If an issue number was provided (or a GitHub issue URL):

```bash
gh issue view <number> --json title,body,labels
```

Parse the issue to determine:

- Branch name: `feat/<number>-<short-name>` or `fix/<number>-<short-name>`
- Use `feat/` for features, `fix/` for bugs, `chore/` for maintenance

If no issue number, ask the user for a branch name.

### Step 2: Create worktree and branch

```bash
# Create worktree in .claude/worktrees/
git worktree add .claude/worktrees/<short-name> -b <branch-name>
```

If the branch already exists:

```bash
git worktree add .claude/worktrees/<short-name> <branch-name>
```

### Step 3: Setup worktree environment

```bash
cd .claude/worktrees/<short-name>

# Copy .env (not tracked by git)
cp ../../.env .env 2>/dev/null || echo "WARNING: .env not found in repo root"

# Install dependencies
npm install
cd functions && npm install && cd ..
```

### Step 4: Verify environment

Run these checks and report results:

```bash
# 1. Node version
node --version  # Must be 22+

# 2. npm available
npm --version

# 3. Git configured
git config user.name && git config user.email

# 4. GitHub CLI authenticated
gh auth status

# 5. Firebase CLI available
firebase --version 2>/dev/null || echo "WARNING: firebase CLI not installed"

# 6. TypeScript compiles
npx tsc --noEmit -p tsconfig.app.json

# 7. Lint passes
npm run lint

# 8. .env exists and has required vars
test -f .env && grep -c "VITE_FIREBASE" .env || echo "ERROR: .env missing or incomplete"
```

### Step 5: Report

```markdown
## Worktree Ready

| Item | Status |
|------|--------|
| Branch | feat/84-auth-metrics |
| Worktree | .claude/worktrees/auth-metrics |
| Node | v22.x |
| Dependencies | installed |
| .env | copied |
| TypeScript | compiles |
| Lint | passes |
| GitHub CLI | authenticated |
| Firebase CLI | available |

Ready to work. When done, run `/merge` to merge to main.
```

### Step 6: Change to worktree directory

```bash
cd .claude/worktrees/<short-name>
```

Confirm to the user that they are now working in the worktree.

## Important notes

- **NEVER work directly on main** — always use this command first
- Background agents cannot request interactive permissions — work as main agent for implementation
- The worktree is an isolated copy of the repo; changes don't affect main until merged
- `/merge` handles worktree cleanup automatically after merging

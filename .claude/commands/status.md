# Project Status

Quick overview of the current state of the Modo Mapa project.

## Gather all info in parallel

Run these commands and compile the results:

```bash
# Version
node -p "require('./package.json').version"

# Latest tag
git describe --tags --abbrev=0 2>/dev/null || echo "no tags"

# Current branch
git branch --show-current

# Open issues
gh issue list --state open --limit 20 --json number,title,labels

# Open PRs
gh pr list --state open --json number,title,headRefName

# Last CI run on main
gh run list --branch main --limit 1 --json status,conclusion,name,createdAt,databaseId

# Remote branches (excluding main)
git branch -r | grep -v 'main\|HEAD' | wc -l

# Test count
npm run test:run 2>&1 | tail -5

# Uncommitted changes
git status --short
```

## Output format

```markdown
## Modo Mapa — Project Status

| Item | Value |
|------|-------|
| Version | X.Y.Z (tag: vX.Y.Z) |
| Branch | main |
| Last CI | passing (run #XXXXX, 2m ago) |
| Tests | 162 passed |

### Open Issues (N)
| # | Title |
|---|-------|
| 84 | Admin auth metrics |

### Open PRs (N)
| # | Title | Branch |
|---|-------|--------|

### Active Branches (N)
- feat/xxx
- fix/yyy

### Uncommitted Changes
(none or list)
```

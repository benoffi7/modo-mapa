# Bump Version (Semantic Versioning)

Automatically determine the version bump based on commits since the last git tag, then update all version references.

## Protocol

### Step 1: Determine bump type

```bash
git describe --tags --abbrev=0 2>/dev/null || echo "v0.0.0"
git log $(git describe --tags --abbrev=0 2>/dev/null || echo "HEAD~50")..HEAD --oneline
```

Analyze commit messages:

- Any `feat:` or `feat(` → **minor** bump
- Only `fix:` or `fix(` → **patch** bump
- Only `docs:`, `chore:`, `test:`, `ci:` → **no bump** (inform user and exit)
- If user passes `major` as argument → **major** bump
- If user passes `minor` or `patch` as argument → use that override

### Step 2: Calculate new version

Read current version from `package.json` → field `version`.
Apply the bump:

- major: X.0.0
- minor: X.Y+1.0
- patch: X.Y.Z+1

### Step 3: Update version in all files

1. `package.json` → `"version": "X.Y.Z"`
2. `docs/reference/PROJECT_REFERENCE.md` → `**Version:** X.Y.Z`
3. Memory file `MEMORY.md` → `**Version:** X.Y.Z`

### Step 4: Commit and tag

```bash
git add package.json docs/reference/PROJECT_REFERENCE.md
git commit -m "chore: bump version to X.Y.Z"
git tag vX.Y.Z
```

Do NOT push — the `/merge` or `/release` command handles that.

### Step 5: Report

Output a summary:

```
Version bumped: 2.3.0 → 2.4.0 (minor)
Reason: N feat commits since vX.Y.Z
Files updated: package.json, PROJECT_REFERENCE.md
Tag created: v2.4.0
```

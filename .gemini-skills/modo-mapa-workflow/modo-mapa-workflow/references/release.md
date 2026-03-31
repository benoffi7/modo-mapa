# Release (Tag + Changelog)

Creates a release with git tag and updates the global CHANGELOG.md. Run this after `/merge` if you want a formal release, or standalone to tag the current state.

## Protocol

### Step 1: Determine version

Check if there's already an untagged version bump in package.json:

```bash
current_version=$(node -p "require('./package.json').version")
latest_tag=$(git describe --tags --abbrev=0 2>/dev/null || echo "none")
```

- If `v$current_version` tag already exists → run `/bump` first
- If no tag exists yet → use current version from package.json

### Step 2: Generate changelog entry

Read commits since last tag:

```bash
git log $(git describe --tags --abbrev=0 2>/dev/null || echo "HEAD~50")..HEAD --oneline --no-merges
```

Group by type:

- `feat:` → **Added**
- `fix:` → **Fixed**
- `docs:` → **Documentation**
- `chore:`, `ci:`, `test:` → **Maintenance**
- `perf:` → **Performance**

### Step 3: Update CHANGELOG.md

If `CHANGELOG.md` doesn't exist, create it with header:

```markdown
# Changelog

All notable changes to Modo Mapa are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
```

Prepend the new entry under the header:

```markdown
## [X.Y.Z] - YYYY-MM-DD

### Added
- Feature description (PR #N)

### Fixed
- Fix description (PR #N)
```

### Step 4: Commit and tag

```bash
git add CHANGELOG.md
git commit -m "chore: release vX.Y.Z"
git tag -a vX.Y.Z -m "Release X.Y.Z"
```

### Step 5: Push

```bash
git push origin main
git push origin vX.Y.Z
```

### Step 6: Create GitHub Release

```bash
gh release create vX.Y.Z --title "vX.Y.Z" --notes "$(changelog entry)"
```

### Step 7: Report

```
## Release vX.Y.Z

- Tag: vX.Y.Z
- Commits: N
- CHANGELOG.md updated
- GitHub Release: https://github.com/benoffi7/modo-mapa/releases/tag/vX.Y.Z
```

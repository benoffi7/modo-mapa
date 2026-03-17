#!/bin/bash
# collect-worktrees.sh — Safely cherry-pick commits from worktrees into a unified branch
#
# Usage: ./scripts/collect-worktrees.sh <target-branch>
# Example: ./scripts/collect-worktrees.sh feat/v2.16.0
#
# What it does:
# 1. Creates the target branch from current HEAD
# 2. Finds all worktree branches with commits ahead of main
# 3. Cherry-picks those commits into the target branch
# 4. Runs build verification
# 5. Only then cleans up worktrees
#
# Safety: NEVER deletes worktrees before commits are cherry-picked and verified.

set -euo pipefail

TARGET_BRANCH="${1:?Usage: $0 <target-branch>}"
MAIN_BRANCH="main"
REPO_ROOT="$(git rev-parse --show-toplevel)"

echo "=== Collect Worktrees into $TARGET_BRANCH ==="

# Ensure we're on main
CURRENT=$(git branch --show-current)
if [ "$CURRENT" != "$MAIN_BRANCH" ]; then
  echo "ERROR: Must be on $MAIN_BRANCH (currently on $CURRENT)"
  exit 1
fi

# Find worktree branches with commits ahead of main
WORKTREE_COMMITS=()
WORKTREE_PATHS=()

for wt in $(git worktree list --porcelain | grep "^worktree " | sed 's/^worktree //' | grep -v "^$REPO_ROOT$"); do
  branch=$(git -C "$wt" branch --show-current 2>/dev/null || echo "")
  if [ -z "$branch" ]; then continue; fi

  commits=$(git -C "$wt" log --oneline "$MAIN_BRANCH..HEAD" 2>/dev/null | wc -l)
  if [ "$commits" -gt 0 ]; then
    echo "Found $commits commit(s) in $wt ($branch)"
    # Collect commit hashes (oldest first)
    while IFS= read -r hash; do
      WORKTREE_COMMITS+=("$hash")
    done < <(git -C "$wt" log --reverse --format="%H" "$MAIN_BRANCH..HEAD")
    WORKTREE_PATHS+=("$wt")
  fi
done

if [ ${#WORKTREE_COMMITS[@]} -eq 0 ]; then
  echo "No worktree commits found."
  exit 0
fi

echo ""
echo "Total commits to cherry-pick: ${#WORKTREE_COMMITS[@]}"
echo ""

# Create target branch
git checkout -b "$TARGET_BRANCH"

# Cherry-pick all commits
for hash in "${WORKTREE_COMMITS[@]}"; do
  msg=$(git log --oneline -1 "$hash")
  echo "Cherry-picking: $msg"
  git cherry-pick "$hash"
done

echo ""
echo "=== Verifying build ==="

# Check if functions/package.json changed
if git diff "$MAIN_BRANCH" --name-only | grep -q 'functions/package.json'; then
  echo "functions/package.json changed — running npm ci..."
  (cd functions && npm ci)
fi

# Build check
npm run build
if [ $? -ne 0 ]; then
  echo "ERROR: Build failed. Commits are safe in $TARGET_BRANCH. Fix before cleaning worktrees."
  exit 1
fi

echo ""
echo "=== Build OK. Cleaning worktrees ==="

for wt in "${WORKTREE_PATHS[@]}"; do
  echo "Removing: $wt"
  git worktree remove "$wt" --force 2>/dev/null || true
done
git worktree prune

echo ""
echo "=== Done. Branch $TARGET_BRANCH ready with ${#WORKTREE_COMMITS[@]} commits ==="

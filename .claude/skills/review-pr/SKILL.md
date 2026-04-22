---
name: review-pr
description: "Review a GitHub Pull Request using the pr-reviewer agent. Pass PR number as argument."
argument-hint: "<pr-number>"
user-invocable: true
---

# Review Pull Request

Review a GitHub Pull Request using the `pr-reviewer` agent.

**Usage**: `/review-pr <number>`

PR number: $ARGUMENTS

## Process

### Step 1: Validate argument

If `$ARGUMENTS` is empty, list open PRs and ask the user to pick one:

```bash
gh pr list --state open --limit 10
```

### Step 2: Fetch PR details

```bash
PR_NUM=$ARGUMENTS
gh pr view $PR_NUM --json title,body,headRefName,baseRefName,files,additions,deletions
gh pr diff $PR_NUM
```

### Step 3: Launch pr-reviewer agent

Launch a **pr-reviewer** agent with this prompt:

```
Review this Pull Request for the modo-mapa project (React 19 + Vite + TS + MUI 7 + Firebase).

PR #<number>: <title>
Branch: <head> -> <base>
Files changed: <count>

<PR body/description>

<Full diff>

Review for:
1. Code quality: naming, readability, DRY, SOLID
2. Security: XSS, injection, rule violations, auth bypass
3. Performance: unnecessary re-renders, missing memoization, Firestore query efficiency
4. Architecture: import boundaries (components must not import firebase directly), layer separation
5. Testing: are new hooks/services covered by tests?
6. Accessibility: aria labels, keyboard navigation, color contrast
7. Offline: will this work without network? Does it need offline support?
8. Copy: spelling, tildes, tone consistency in user-facing strings
9. Dark mode: hardcoded colors, fixed backgrounds

Output a structured review with:
- BLOCKER: must fix before merge
- WARNING: should fix, not blocking
- SUGGESTION: nice to have
- APPROVED: no issues found

End with a clear verdict: APPROVE, REQUEST_CHANGES, or COMMENT.
```

### Step 4: Post review summary

Show the agent's review to the user with the verdict.

If the user approves, optionally post as a PR comment:

```bash
gh pr comment $PR_NUM --body "<review summary>"
```

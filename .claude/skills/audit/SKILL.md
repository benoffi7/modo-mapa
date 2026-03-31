---
name: audit
description: "Run a specific audit agent on demand. Pass the auditor type as argument."
argument-hint: "<type: security|architecture|dark-mode|ui|performance|perf-instrumentation|privacy|offline|copy|admin-metrics|help-docs|pr-review>"
user-invocable: true
---

# Individual Audit

Run a specific audit agent against the codebase without a full health-check.

**Usage**: `/audit <type>`

Audit type: $ARGUMENTS

## Agent mapping

Map the argument to the correct `subagent_type`:

| Argument | Agent | Scope |
|----------|-------|-------|
| `security` | `security` | XSS, injection, rules, auth bypass |
| `architecture` | `architecture` | Separation of concerns, patterns, duplication |
| `dark-mode` | `dark-mode-auditor` | Hardcoded colors, theme issues |
| `ui` | `ui-reviewer` | 360px layout, accessibility, empty states |
| `performance` | `performance` | Bundle size, re-renders, memoization |
| `perf-instrumentation` | `perf-auditor` | Firestore query + Cloud Function instrumentation |
| `privacy` | `privacy-policy` | Data collection vs privacy policy |
| `offline` | `offline-auditor` | Uncached reads, unqueued writes, fallbacks |
| `copy` | `copy-auditor` | Spelling, tildes, tone, hardcoded strings |
| `admin-metrics` | `admin-metrics-auditor` | Data visibility in admin dashboard |
| `help-docs` | `help-docs-reviewer` | HelpSection vs features.md |
| `pr-review` | `pr-reviewer` | Full code quality review |

## Process

### Step 1: Validate argument

If `$ARGUMENTS` is empty or doesn't match any type in the table above, show the table and ask the user to pick one.

### Step 2: Launch the agent

Launch the matched agent with a prompt to audit the entire `src/` directory (full project scan, not diff-based).

For `perf-instrumentation`, also include `functions/src/` in the scan scope.

### Step 3: Report

Show the agent's findings as a structured report with severity levels.

### Step 4: Create tech debt issue (optional)

If medium+ findings exist, ask the user if they want to create a GitHub issue:

```bash
gh issue create --title "Tech debt: <type> audit findings" --body "<findings>" --label "enhancement"
```

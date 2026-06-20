# Rule 40-git-workflow.md: Git Workflow & Commit Guidelines (Timesheet Lite)

This rule governs the Git management phase. When the AI is asked to draft commit messages, organize branch checkouts, or write Pull Request descriptions, it **must** strictly apply these guidelines.

---

## 1. Trigger Scenario & Activation
- **Trigger**: When performing git commits, staging code, checking out branches, or formatting pull requests.
- **Activation Mode**: Target Match (loaded during git operations and task finalization).

---

## 2. Commit Message Standard (Conventional Commits)
All commit messages must strictly follow the **Conventional Commits** specification:

```
<type>(<scope>): <description>
```

### A. Acceptable Types
- `feat`: A new feature (e.g. adding regional workday overrides).
- `fix`: A bug fix (e.g. correcting a timesheet validation limit calculation).
- `refactor`: A code change that neither fixes a bug nor adds a feature.
- `docs`: Documentation-only adjustments (such as editing PRD or rule files).
- `style`: Visual formatting, spacing, semicolons, or CSS updates.
- `test`: Adding or correcting automated tests.
- `chore`: Auxiliary build configurations, dependency installs, or folder setups.

### B. Acceptable Scopes
- `auth` (JWT/login/encryption)
- `timesheets` (logging/upsert/verify)
- `reports` (weekly summaries/excel exporting)
- `backups` (vacuum backups/restore/cleanup)
- `workdays` (exceptions calendar)
- `users` / `projects` / `config`

### C. Description Guidelines
- Use the imperative mood (e.g. "add endpoint" instead of "added endpoint").
- Start with a lowercase letter.
- Do not add a period (`.`) at the end of the commit description.

*Example*: `feat(timesheets): add support for regional holiday overrides`

---

## 3. Branch Naming Conventions
When checking out branches for new development or hotfixes, enforce this structure:

| Branch Type | Syntax | Example |
| :--- | :--- | :--- |
| **New Features** | `feature/<short-feature-name>` | `feature/multi-region-holidays` |
| **Bug Fixes** | `bugfix/<issue-description>` | `bugfix/fix-hours-calculation` |
| **Production Hotfixes** | `hotfix/<quick-fix-description>` | `hotfix/restore-wal-locking` |

---

## 4. Pull Request Description Template
When drafting Pull Requests, the AI should generate a summary using the following layout:

```markdown
## Description
*A concise summary of what was accomplished and the rationale behind the changes.*

## Type of Change
- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Refactor / Chore

## Verification & Testing
- *Detail how the changes were verified (pytest suites run, UI manual verification).*
```

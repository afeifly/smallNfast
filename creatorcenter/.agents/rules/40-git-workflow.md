# Rule 40-git-workflow.md: Git Workflow & Commit Guidelines (Creator Center)

This rule governs the Git management phase. When the AI is asked to draft commit messages, organize branch checkouts, or write Pull Request descriptions, it **must** strictly apply these guidelines.

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
- `feat`: A new feature (e.g. adding WeasyPrint PDF export page-break overrides).
- `fix`: A bug fix (e.g. correcting a DOCX parser run-merging logic issue).
- `refactor`: A code change that neither fixes a bug nor adds a feature.
- `docs`: Documentation-only adjustments (such as editing PRD or rule files).
- `style`: Visual formatting, spacing, semicolons, or CSS updates.
- `test`: Adding or correcting automated tests.
- `chore`: Auxiliary configurations, package installs, or workspace setups.

### B. Acceptable Scopes
- `parser` (docx / markdown parsers)
- `translation` (OpenL / MiniMax provider connections)
- `export` (pdf compilation / docx rebuild / SSE task status)
- `assets` (image file uploads)
- `projects` / `segments` / `keys`
- `frontend` (react pages/components/routing)
- `config` / `database`

### C. Description Guidelines
- Use the imperative mood (e.g. "add endpoint" instead of "added endpoint").
- Start with a lowercase letter.
- Do not add a period (`.`) at the end of the commit description.

*Example*: `feat(parser): merge consecutive runs with matching styles during DOCX upload`

---

## 3. Branch Naming Conventions
When checking out branches for new development or hotfixes, enforce this structure:

| Branch Type | Syntax | Example |
| :--- | :--- | :--- |
| **New Features** | `feature/<short-feature-name>` | `feature/weasyprint-cjk-fonts` |
| **Bug Fixes** | `bugfix/<issue-description>` | `bugfix/fix-docx-header-parsing` |
| **Production Hotfixes** | `hotfix/<quick-fix-description>` | `hotfix/sanitize-filename-traversal` |

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
- *Detail how the changes were verified (pytest suites run, React Query mock tests, or UI manual verification).*
```

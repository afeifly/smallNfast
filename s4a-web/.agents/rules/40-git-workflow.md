# Rule 40-git-workflow.md - Git Workflow Guidelines

All developers and automated agents must adhere to these version control rules to maintain a clean git history and ease code reviews.

---

## 1. Commit Message Conventions
Commit messages must follow the **Conventional Commits** standard:

* **Format:** `<type>(<scope>): <subject>` followed by an optional body and footer.
* **Allowed Types:**
  - `feat`: A new user story feature or capability.
  - `fix`: A bug fix.
  - `docs`: Documentation edits (such as PRD or DDD report additions).
  - `style`: Visual layout formatting, CSS changes (no logic changes).
  - `refactor`: Restructuring code files without altering behavior.
  - `perf`: Performance enhancements (OOM prevention, downsampling logic).
  - `test`: Adding or adjusting unit/integration tests.
  - `build`: Building configuration adjustments, package dependencies updates.
  - `ci`: CI pipeline and test runner automation setups.
  - `chore`: Auxiliary actions (file housekeeping, updates to rules).

* **Subject constraints:**
  - Write subject in imperative, present tense ("add parser" rather than "added parser").
  - Do not capitalize the first letter.
  - Do not end the subject line with a period.

---

## 2. Branch Naming Guidelines
Always create a new branch for any feature, patch, or documentation modification.
* **Prefixes:**
  - `feature/[feature-name]`
  - `bugfix/[ticket-or-issue]`
  - `hotfix/[critical-patch]`
  - `docs/[documentation-topic]`
  - `refactor/[refactor-topic]`

---

## 3. Pull Request Description Template
Each PR description should follow this baseline layout:

```markdown
## Summary
*Brief summary of the goal and context.*

## Type of Change
- [ ] Bug fix (non-breaking change resolving an issue)
- [ ] New feature (non-breaking change adding functionality)
- [ ] Documentation (updates to reports, PRDs, rules)
- [ ] Performance / Security optimization

## Changes Made
- *Detailed list of file changes, functions added/modified, or layouts created.*

## Verification & Testing
- *Detail how the changes were verified (unit tests run, manual logs checked).*
```

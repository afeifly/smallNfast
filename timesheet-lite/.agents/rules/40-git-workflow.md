# Rule: Git Workflow & Conventional Commits

All changes proposed, committed, or pushed to this repository must follow these Git standards.

---

## 1. Branch Naming Scheme
* **Feature Branches:** `feature/[feature-name]`
* **Bug Fixes:** `bugfix/[bug-name]`
* **Hot Fixes:** `hotfix/[description]`
* **Refactoring:** `refactor/[description]`

---

## 2. Commit Message Structure
We enforce **Conventional Commits**. All commits must be prefixed with one of the following lowercase tags:
* `feat`: A new user feature
* `fix`: A bug fix
* `docs`: Documentation only changes
* `style`: Styling changes (formatting, white-space, missing semi-colons, etc.)
* `refactor`: A code change that neither fixes a bug nor adds a feature
* `perf`: A code change that improves performance
* `test`: Adding missing tests or correcting existing tests
* `build`: Changes that affect the build system or external dependencies
* `ci`: Changes to our CI configuration files and scripts
* `chore`: Other changes that don't modify src or test files

### Example Commit Format:
```
feat(timesheets): add dynamic weekly limits validation

Implemented check against WorkDay exceptions to calculate max allowed hours.
```

---

## 3. Pull Request (PR) Description Template
When opening a PR, populate the description with the following outline:
```markdown
## Summary
*Briefly describe the purpose of the PR and the main changes.*

## Related Issues/PRDs
*Link the feature PRD from docs/prd/ or issue number.*

## Verification Performed
*What tests were run, and how can the reviewer manual-verify this behavior?*
```

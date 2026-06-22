# 40-git-workflow.md - Git Workflow Guidelines

This document outlines version control guidelines, branching models, commit formatting specifications, and pull request structure requirements for `s4c-web`.

---

## 1. Commit Message Conventions

We enforce the **Conventional Commits** specification. Commit messages must be structured as follows:

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

### 1.1 Types
* `feat`: A new feature (e.g., adding a Virtual Channel formula editor).
* `fix`: A bug fix (e.g., fixing relay delay conversion issue).
* `docs`: Documentation changes only (e.g., updates to rules or PRDs).
* `style`: Changes that do not affect the meaning of the code (white-space, formatting, missing semi-colons).
* `refactor`: A code change that neither fixes a bug nor adds a feature.
* `test`: Adding missing tests or correcting existing tests.
* `chore`: Changes to the build process, tooling, or helper dependencies.

### 1.2 Format Rules
* Keep the subject line short (50 characters or less).
* Capitalize the subject line.
* Do not end the subject line with a period.
* Use the imperative mood in the subject line (e.g., "add Modbus parser" instead of "added Modbus parser").

---

## 2. Branch Naming Conventions

Branches must use specific prefixes followed by a short, descriptive name in kebab-case:

* **New Features**: `feature/<feature-name>` (e.g., `feature/alarm-relay-mapping`)
* **Bug Fixes**: `bugfix/<bug-name>` (e.g., `bugfix/unzip-crypto-leak`)
* **Refactoring**: `refactor/<target-module>` (e.g., `refactor/filemap-idb`)
* **Documentation**: `docs/<target-docs>` (e.g., `docs/add-ddd-manifest`)

---

## 3. Pull Request Description Template

Every PR must be opened with the following description layout:

```markdown
# Description

Describe the goal of the changes, background context, and what issue is solved.

## Type of Change

- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Refactoring (internal improvement, no public API modifications)
- [ ] Documentation update

## Detailed Changes

Provide a list of files modified and detailed explanations of major changes:
- `src/util/alarmDbUtils.js`: Modified query to fetch unit labels.
- `src/components/Alarm/AlarmEditor.jsx`: Added unit column to table rows.

## Verification & Testing

Explain how the changes were verified.

### Automated Tests
- Run `npm run test` output:
  [Insert test output or summary here]

### Manual Verification
- Describe manual steps conducted (e.g., "Imported SUTO_config_20260613095249.cfgf, edited relay 1 threshold to 12.5, exported, and re-imported to confirm the change saved").
```

---
name: ddd_workflow
description: Run the Domain-Driven Design (DDD) and Agent-Rules Guided Project Development workflow.
---
# DDD & Agent-Rules Guided Project Development Skill (Local)

> **Triggers:** `ddd`, `ddd_workflow`, `init ddd`, `domain-driven design`

This local skill defines a structured workflow for implementing new features or analyzing existing code in this project using Domain-Driven Design, guided by project rule configurations.

---

## 1. Requirement Ingest & Change Management
When a new requirement, feature request, or user story is introduced:
1. **Keyword Trigger:** If the user's request starts with or contains the keyword `ddd` (case-insensitive), the agent **must** perform the DDD Analysis Phase (Section 2) using `.agents/rules/10-domain-analysis.md` guidelines *before* proposing an implementation plan or writing code.
2. **Planning Mode Integration:** If running in Planning Mode (creating `implementation_plan.md`), draft the PRD and DDD analysis report during the Research & Planning phase, and list them under proposed changes.
3. Create a new PRD file at `docs/prd/[feature_name]_prd.md` detailing user stories and functional requirements.

---

## 2. DDD Analysis & Validation Phase
Before writing any code or API endpoints:
1. Read the newly created PRD file in `docs/prd/`.
2. **Perform Domain Analysis:** Refer to the project's domain guidelines in [.agents/rules/10-domain-analysis.md](file:///Users/ex/project/smallNfast/creatorcenter/.agents/rules/10-domain-analysis.md) for Bounded Context decomposition, Domain Entity attributes, and Business Invariants.
3. **Generate a DDD Analysis Report:** Create `docs/report/ddd_[feature_name]_prd_report.md` matching the standard analysis skeleton and Mermaid diagrams defined in [.agents/rules/10-domain-analysis.md](file:///Users/ex/project/smallNfast/creatorcenter/.agents/rules/10-domain-analysis.md).
4. **Obtain user approval** on the DDD Analysis Report before moving to the coding phase.

---

## 3. API Contract & Implementation Phase
Once the DDD report is approved:
1. **Design and write the API contracts**:
   - App payloads must use `snake_case` naming conventions.
   - Insert the warning header at the top of the contract/types files:
     ```typescript
     /**
      * @file API Contract
      * WARNING: This is a strict contract file generated according to .agents/rules/20-api-contract.md.
      * DO NOT modify manually without aligning both UI and Worker architectures.
      */
     ```
2. **Implementation**:
   - Write tests first or concurrently (following the isolation patterns in `30-testing-standards.md`).
   - Implement the backend and frontend changes.
   - Run tests and verify the code before finalizing.

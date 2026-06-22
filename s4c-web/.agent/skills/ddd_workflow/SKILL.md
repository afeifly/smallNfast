---
name: ddd_workflow
description: Auto-discover codebase structure, generate agent rules, and initialize the baseline PRD and Domain-Driven Design (DDD) report for any project type (Web, Desktop, iOS, Android, or Firmware).
---
# Universal Domain-Driven Design (DDD) & Agent-Rules Guided Project Development Skill

> **Triggers:** `/ddd_workflow`, `ddd`, `ddd init`, `init ddd`, `ddd workflow`, `domain-driven design`

This reusable skill guides the agent in conducting a comprehensive domain analysis and bootstrapping the agent rule system for any type of codebase—including Web, Desktop, iOS, Android, and Firmware/Embedded systems. When triggered, the agent must perform the following five phases sequentially and thoroughly.

---

## Phase 1: Project Auto-Discovery & Scanning
Before creating any documentation or rule files, the agent must inspect the repository to understand the target platform and technical stack:
1. **Target Platform Identification:** Analyze files to determine if the target environment is Web (browser), Desktop (Electron, Qt, C++, Rust), Mobile (Swift/iOS, Kotlin/Android, Flutter/React Native), or Firmware/Embedded (C, C++, Rust, bare-metal, RTOS).
2. **Configuration & Dependency Manifests:** Search for and inspect project files:
   - *Web/Desktop:* `package.json`, `tsconfig.json`, `vite.config.js`, `CMakeLists.txt`, `Cargo.toml`.
   - *Mobile:* `Podfile`, `build.gradle.kts`, `AndroidManifest.xml`, `project.pbxproj`.
   - *Firmware/Embedded:* `Makefile`, `Kconfig`, `platformio.ini`, linker scripts (`.ld`), C/C++ headers.
3. **Execution & Concurrency Boundaries:** Identify how the system handles runtime execution:
   - *High-Level Apps:* Main GUI/UI thread vs. Background worker threads, dispatch queues, or Web Workers.
   - *Firmware:* Bare-metal super-loops, Interrupt Service Routines (ISRs), RTOS task priorities, or DMA transfers.
4. **Existing Agent Configurations:** Detect if the agent config folder is named `.agents` or `.agent`. Adopt the detected naming convention for all generated paths.

---

## Phase 2: Rules Generation (10, 20, 30, 40, 50)
If the rules folder (`.agents/rules` or `.agent/rules`) is missing or incomplete, the agent must generate the following five standard rule documents, tailored to the discovered platform:

### 10-domain-analysis.md (Domain Analysis Guidelines)
* **Goal:** Document Bounded Contexts, Domain Models, and Invariants.
* **Key Sections Required:**
  - **Bounded Contexts:** 
    - *Apps/Web:* Distinguish UI rendering/interaction from background data processing, IO, or network sync.
    - *Firmware:* Distinguish time-critical hardware control/ISRs from lower-priority telemetry, communication stacks, or background housekeeping tasks.
  - **Core Domain Abstractions:** Define the Aggregate Roots, Entities, and Value Objects relevant to the domain.
  - **Transactional Boundaries & Invariants:** Document critical business rules, hardware limits, or state constraints that must never be violated (e.g., maximum sample rates, sensor ranges, state transition rules).

### 20-api-contract.md (API Contract Standards)
* **Goal:** Enforce serialization conventions, messaging protocols, and boundary types.
* **Key Sections Required:**
  - **Naming & Case Conventions:** Specify naming casing (e.g., `snake_case`, `camelCase`, `PascalCase`) for serialization, IPC, and internal storage.
  - **Serialization Protocols:** Specify the format (e.g., JSON, Protobuf, FlatBuffers, raw binary packets/byte-structs, or register-maps).
  - **Strict Warning Header:** Define the exact warning comment that must be prepended to all contract, schema, or API interface files.
  - **Payload Schemas:** Define the payload schema for IPC, Web Workers, network API requests, serial communication, or Bluetooth LE services.

### 30-testing-standards.md (Testing Standards)
* **Goal:** Direct testing strategies, framework usage, and hardware/runtime emulation.
* **Key Sections Required:**
  - **Testing Stack:** Identify the test runner (e.g., Vitest, PyTest, JUnit, XCTest, Unity/Ceedling for C).
  - **Target Environment:** Define if tests run locally in Node/JSDOM, in native mobile simulators, or via Hardware-in-the-Loop (HIL) / QEMU emulation for firmware.
  - **Mocking & Isolation Guidelines:** Define how to mock external APIs, OS-level sensors, Bluetooth hardware, or physical GPIO/peripherals.
  - **Execution Commands:** Provide commands to run unit, integration, or emulation tests.

### 40-git-workflow.md (Git Workflow Guidelines)
* **Goal:** Maintain version control consistency and clear histories.
* **Key Sections Required:**
  - **Commit Message Conventions:** Enforce Conventional Commits (e.g., `feat`, `fix`, `docs`, `refactor`) and subject constraints.
  - **Branch Naming:** Define prefixes for new branches (e.g., `feature/`, `bugfix/`, `firmware/`, `refactor/`).
  - **Pull Request Description Template:** Provide a structured markdown layout containing summary, type of change, changes made, and verification steps.

### 50-security-and-cleanup.md (Security & Resource Cleanup Rules)
* **Goal:** Prevent security vulnerabilities and runtime memory/resource leaks.
* **Key Sections Required:**
  - **Secrets & Credentials:** Ban hardcoded API keys, certificates, Wifi passwords, or private encryption keys.
  - **Input Sanitization:** Detail path traversal prevention, buffer overflow protection, network packet size validation, and range checks on physical inputs.
  - **Strict Resource Cleanup:**
    - *High-Level (JS/Kotlin/Swift):* Dereference large objects, tear down event listeners/subscribers, terminate background threads, and close database connections.
    - *Systems/Firmware (C/C++/Rust):* Prevent memory leaks (explicit `free`/deallocation), close file descriptors, release hardware timers, manage heap fragmentation, and clear DMA buffer descriptors.

---

## Phase 3: Baseline PRD Generation (docs/prd/prd.md)
Check if `docs/prd/prd.md` exists. If not, create it by analyzing the codebase and retroactively documenting the product specifications:
1. **Objective:** Define the user problem, target audience, and business/product goals.
2. **User Stories:** Write platform-specific user stories (e.g., GUI workflows, mobile background syncing, or physical button interactions/LED status changes).
3. **Functional Requirements:** Break down functional requirements by module or hardware subsystem.
4. **Technical & Resource Constraints:** Detail performance metrics, memory footprints, battery constraints, browser/OS compatibility, or hardware/firmware constraints (e.g., flash size, RAM limits).

---

## Phase 4: DDD Analysis Report (docs/report/ddd_prd_report.md)
Generate a comprehensive Domain-Driven Design analysis report at `docs/report/ddd_prd_report.md`:
1. **Metadata:** Record creation date, author, version, and status.
2. **Context Decomposition:** Provide a table mapping modules/subsystems to Bounded Contexts.
3. **Domain Model Catalog:**
   - **Aggregate Roots:** Define aggregates managing transactional or state boundaries.
   - **Entities:** List objects with identity (e.g., users, devices, records, sensors).
   - **Value Objects:** List immutable descriptors (e.g., status flags, coordinates, physical measurements).
4. **Business & Hardware Invariants:** List the logic checks enforced by the domain layer.
5. **Context Map Diagram:** Create a Mermaid diagram showing relationship boundaries (e.g., Shared Kernel, Customer-Supplier, Anti-Corruption Layer, Conformist).
6. **Domain Model Diagram:** Create a Mermaid class diagram illustrating aggregates, entities, value objects, and relationships.

---

## Phase 5: Verification & User Review
1. **Link Verification:** Ensure all file paths and symbols are correctly hyperlinked using absolute `file://` URIs or relative links where appropriate.
2. **Build/Flash Verification:** Run compile, build, or lint commands to verify that no syntax errors or packaging issues were introduced.
3. **User Notification:** Provide a clean summary of the bootstrapped files and prompt the user to review the generated rules, PRD, and DDD report.

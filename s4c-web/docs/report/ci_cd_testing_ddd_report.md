# DDD Analysis Report - Automated Quality Assurance Context

## 1. Bounded Context Classification
- **Name**: Automated Quality Assurance Subdomain
- **Classification**: Infrastructure / Quality Subdomain
- **Responsibility**: Automated test runner orchestration, environment diagnostics, CI pipeline execution.

## 2. Rules
1. Unit tests must mock IndexedDB and WebAssembly calls when running in headless Node CI environments.
2. PR builds must fail if any test assertion breaks.

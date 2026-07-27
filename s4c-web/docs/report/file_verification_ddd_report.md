# DDD Analysis Report - Package Verification Subdomain

## 1. Bounded Context Classification
- **Name**: Config Package Serialization & Cryptography Context
- **Classification**: Supporting Subdomain
- **Responsibility**: Integrity verification, MD5 signature auditing, reporting checksum discrepancies.

## 2. Invariants
1. File verification must compute MD5 signatures on binary Uint8Array representations in exact alphabetical path order.
2. `summary.yml` and `parser.*` files must be excluded from payload hash calculation.

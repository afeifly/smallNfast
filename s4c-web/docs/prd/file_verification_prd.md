# PRD - Configuration Package File Verification Page

## 1. Feature Overview
The File Verification page enables quality control technicians to run on-demand checksum verification on loaded `.cfgf` packages.

## 2. Technical Functionality
- Reads active file map from IndexedDB via `fileMapStorage.js`.
- Computes individual file MD5 hashes and composite package signature using `SparkMD5` via [verificationUtils.js](file:///Users/ex/project/smallNfast/s4c-web/src/util/verificationUtils.js).
- Displays pass/fail status and per-file hash breakdown.
- OEM Flag: Can be hidden via `VITE_OEM_HIDE_FILE_VERIFICATION=true`.

## 3. Location & Tests
- Page: [FileVerification.jsx](file:///Users/ex/project/smallNfast/s4c-web/src/pages/system/FileVerification.jsx)
- Unit Tests: [FileVerification.test.jsx](file:///Users/ex/project/smallNfast/s4c-web/src/pages/system/FileVerification.test.jsx), [verificationUtils.test.js](file:///Users/ex/project/smallNfast/s4c-web/src/util/verificationUtils.test.js)

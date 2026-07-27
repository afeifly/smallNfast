# PRD - OEM Multi-Tenant Theming & White-Label Customization

## 1. Feature Overview & Goals
The `s4c-web` utility supports multi-tenant white-label branding for OEMs (Original Equipment Manufacturers). Distributors such as Atlas Copco can deploy customized versions of the application with tailored branding (logos, color palettes, button border radiuses, favicons) and feature visibility without modifying core domain business logic.

## 2. Technical Architecture & Component Design
- **Theme Provider**: [ThemeContext.jsx](file:///Users/ex/project/smallNfast/s4c-web/src/context/ThemeContext.jsx) wraps the React application and injects CSS custom properties (`--primary-color`, `--accent-color`, `--sidebar-bg`, `--bg-color`, `--btn-radius`, etc.) onto `document.documentElement`.
- **Environment Driven Configuration**:
  - Baseline SUTO theme profile: `.env`
  - Atlas Copco OEM profile: `.env.atlascopco`
- **Branding Assets**:
  - SUTO Logo: `/public/logos/suto_logo.png`
  - Atlas Copco Logo: `/public/logos/atlascopco_logo.png`

## 3. Feature Flags & View Visibility
Feature visibility is controlled dynamically in [Sidebar.jsx](file:///Users/ex/project/smallNfast/s4c-web/src/components/Sidebar.jsx) using environment feature flags:
- `VITE_OEM_HIDE_FILE_VERIFICATION`: Toggles visibility of the File Verification page.
- `VITE_OEM_HIDE_DATA_ANALYSIS`: Toggles visibility of the Data Analysis page.
- `VITE_OEM_HIDE_SUPPORT`: Toggles visibility of the Support page.

## 4. Verification & Testing
- Unit tests in [OnlineValueCard.test.jsx](file:///Users/ex/project/smallNfast/s4c-web/src/components/OnlineValueCard.test.jsx) and [env.test.js](file:///Users/ex/project/smallNfast/s4c-web/src/test/env.test.js) verify that `ThemeContext` provides default values and correctly reads Vite environment variables.

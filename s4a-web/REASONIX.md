# s4a-web — Reasonix working knowledge

## Stack

- **React 19** — UI framework, JSX in `.jsx` files.
- **Vite 8** — bundler, dev server, test runner integration (vitest).
- **MUI 6** (`@mui/material`, `@mui/icons-material`, `@mui/lab`) — component library.
- **d3 7** — graphic view (time-series charting).
- **vitest + jsdom** — test runner, runs in Node (no browser).
- **react-intl-universal** — i18n; locale strings at `src/locales/en-US.js`.

## Layout

```
src/
  api/          — data sources (CsdAPI.js, CsvAPI.js, MockAPI.js, etc.)
  components/   — reusable UI (color/, loading/)
  modules/      — feature modules (channel/, consumption/, fileinfo/,
                  graphicview/, tableview/)
  util/         — helpers (DataUtil.js, RequestUtil.js, SystemConstant.js)
  locales/      — i18n key→value maps
public/         — static assets + legacy Wasm CSD parser binaries
reference/      — external Java CSD analyzer (not part of the web app build)
```

## Commands

| Action | Command |
|--------|---------|
| Dev (mock data) | `npm run dev:mock` |
| Dev (CSD file) | `npm run dev:csd` |
| Dev (live API) | `VITE_API_HOST=http://... npm run dev` |
| Build | `npm run build` |
| Test | `npm test` |
| Lint | `npm run lint` |
| Preview | `npm run preview` |

## Conventions

- **`.jsx` for components**, **`.js` for utility/data modules** (no `.ts`).
- **Tests colocated** — `*.test.js` / `*.test.jsx` beside the source file (e.g. `CsdAPI.test.js` beside `CsdAPI.js`).
- **MUI imports** are per-component, one import per line (e.g. `import Button from '@mui/material/Button'`).
- **CSS co-located** — component directories carry `./css/style.css`.
- **APIs export classes/functions as named exports** — `CsdAPI` default-exported as a singleton instance, `MockAPI` default-exported as a class.
- **Locale keys** are `SCREAMING_SNAKE_CASE` (e.g. `"GRAPHIC_VIEW"`, `"MAX_SELECTED_CHANNELS_TITLE"`).

## Watch out for

- **`vite-plugin-singlefile`** is active in mock/real modes but **disabled in CSD mode** (`.wasm must be served separately). Edits that touch `vite.config.js` must respect `VITE_USE_CSD` branching.
- **`public/csd_handler.*`** (`.wasm` + `.mjs` + `.js`) are **legacy** — the current CSD parser is pure JS in `src/api/CsdAPI.js`. Do not treat these as the primary parser.
- **`reference/`** is an external Java tool, not part of the web app. Edits there do not affect the build.
- **PM2 config** at `ecosystem.config.cjs` runs `npm run dev:csd -- --port 9018`.

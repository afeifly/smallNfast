# Product Requirement Document (PRD) - Mermaid Rendering Support

## 1. Objectives & Business Goals
- **User Problem**: Users write Markdown documents containing Mermaid syntax code blocks (e.g., flowchart, sequence diagram) to represent architectural and domain flows. Currently, the preview shows the raw text block, and PDF exports do not render them as charts.
- **Key Objectives**:
  - Automatically parse and render Mermaid syntax into high-fidelity visual diagrams inside the frontend's Markdown preview pane (both in standalone preview and inside the editor split-preview).
  - Convert Mermaid code blocks into inline vector SVGs during PDF generation so WeasyPrint can compile and display them natively.
  - Gracefully handle situations where rendering fails or internet connectivity is unavailable, falling back to clean text-based code block presentation.

---

## 2. User Stories & Acceptance Criteria
- **User Story**: As a document creator, I want my Mermaid code blocks to automatically render as diagrams when I view the document preview or export it to PDF, so that readers can visually comprehend the processes.
- **Acceptance Criteria**:
  1. Fenced code blocks of type `mermaid` are rendered as visual charts in the document preview tab.
  2. If the Mermaid syntax contains errors, a helpful error message is displayed along with the raw code.
  3. Fenced code blocks of type `mermaid` are exported as vector SVGs in generated PDFs.
  4. PDF export does not hang or crash if the network/rendering service is offline; it falls back to displaying the text code block.
  5. The Mermaid diagrams must be styled to fit page dimensions without overflowing.

---

## 3. Functional Requirements
### 3.1 Frontend Preview Customization
- Intercept code blocks marked with `language-mermaid`.
- Render the diagram asynchronously using the `mermaid` package.
- If rendering fails, show the code block and a localized error log.

### 3.2 Backend PDF Generation Customization
- In `_generate_pdf()`, parse the HTML content before sending to WeasyPrint.
- Extract any `code` blocks with the class `language-mermaid`.
- Encode the raw mermaid syntax to base64, query the rendering endpoint `https://mermaid.ink/svg/<base64>`, and fetch the compiled SVG.
- Inline the retrieved SVG in place of the raw code block.
- Add CSS page rules to prevent mermaid diagrams from overflowing page boundaries and breaking across pages.

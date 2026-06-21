"""
PDF export module using WeasyPrint for high-quality HTML/CSS → PDF rendering.

WeasyPrint supports:
  - Full CSS2/3 (Flexbox-lite, colors, fonts, borders, padding…)
  - @page rules for margins, page numbers, page breaks
  - System fonts + @font-face for CJK via Noto
  - Native table rendering
"""

import os
import re
import json
import markdown
import logging
import base64
import html
import httpx
from weasyprint import HTML, CSS
from backend.config import UPLOADS_DIR
from backend.job_manager import update_job_progress

IMAGES_DIR = UPLOADS_DIR / "images"


def _resolve_images(html: str) -> str:
    """
    Two-pass image normalisation for WeasyPrint:

    Pass 1 – Rewrite src="/api/images/<file>" to src="file:///absolute/path"
             so WeasyPrint can load images from disk.

    Pass 2 – Convert HTML presentational attributes (width, height) on every
             <img> tag into inline CSS styles.  WeasyPrint honours CSS but
             largely ignores legacy HTML width/height attributes.

    Supported width values coming from the editor toolbar:
      width="400"    → style="width:400px; max-width:100%; height:auto"
      width="50%"    → style="width:50%;   max-width:100%; height:auto"
    """

    # ── Pass 1: src path rewrite ──────────────────────────────────────────
    def _rewrite_src(m: re.Match) -> str:
        quote = m.group(1)
        filename = m.group(2)
        abs_path = IMAGES_DIR / filename
        if abs_path.exists():
            return f'src={quote}file://{abs_path}{quote}'
        return m.group(0)  # file missing – leave unchanged, don't crash

    html = re.sub(
        r'src=([\'"])(?:/api/images/|/uploads/images/)([^\'"]+)\1',
        _rewrite_src,
        html,
    )

    # ── Pass 2: width/height → inline style ──────────────────────────────
    def _normalise_img(m: re.Match) -> str:
        tag = m.group(0)          # full <img ...> tag

        # Extract user-supplied width (pixels or percent)
        w_match = re.search(r'\bwidth=[\'"]?(\d+%?)[\'"]?', tag)
        h_match = re.search(r'\bheight=[\'"]?(\d+%?)[\'"]?', tag)

        w_val = w_match.group(1) if w_match else None
        h_val = h_match.group(1) if h_match else None

        # Remove old width/height attrs (we'll replace them with CSS instead)
        # Handles: width="400", width='50%', width=400 (unquoted)
        tag = re.sub(r'''\s*\bwidth=(?:"[^"]*"|'[^']*'|\S+)''', '', tag)
        tag = re.sub(r'''\s*\bheight=(?:"[^"]*"|'[^']*'|\S+)''', '', tag)


        # Pull existing style attr if present
        style_match = re.search(r'\bstyle=[\'"]([^\'"]*)[\'"]', tag)
        existing_style = style_match.group(1).rstrip(';') if style_match else ''
        if style_match:
            tag = re.sub(r'\s*\bstyle=[\'"][^\'"]*[\'"]', '', tag)

        # Build new style
        css_parts = []
        if existing_style:
            css_parts.append(existing_style)

        if w_val:
            px = f'{w_val}px' if not w_val.endswith('%') else w_val
            css_parts.append(f'width:{px}')
        css_parts.append('max-width:100%')

        if h_val:
            px = f'{h_val}px' if not h_val.endswith('%') else h_val
            css_parts.append(f'height:{px}')
        else:
            css_parts.append('height:auto')

        new_style = '; '.join(css_parts)

        # Inject style into the tag (before the closing >)
        tag = re.sub(r'\s*/?>$', f' style="{new_style}" />', tag.rstrip())
        return tag

    html = re.sub(r'<img\b[^>]*/?>', _normalise_img, html, flags=re.IGNORECASE)
    return html


def _render_mermaid_charts_in_html(html_string: str) -> str:
    """
    Finds <pre><code class="language-mermaid">...</code></pre> blocks in the HTML,
    extracts the Mermaid code, unescapes it, base64 encodes it, fetches the compiled
    SVG from mermaid.ink, and replaces the block with the SVG inline.
    """
    pattern = re.compile(
        r'<pre(?:\s+class="[^"]*")?\s*><code\s+class="language-mermaid"\s*>(.*?)</code></pre>',
        re.DOTALL | re.IGNORECASE
    )

    def replacer(match):
        escaped_code = match.group(1)
        mermaid_code = html.unescape(escaped_code).strip()
        if not mermaid_code:
            return match.group(0)

        try:
            code_bytes = mermaid_code.encode("utf-8")
            base64_str = base64.b64encode(code_bytes).decode("utf-8")
            url = f"https://mermaid.ink/svg/{base64_str}"

            response = httpx.get(url, timeout=10.0)
            if response.status_code == 200 and response.text.strip().startswith("<svg"):
                svg_content = response.text.strip()
                # Wrap the SVG in a styled div so WeasyPrint centers it and doesn't break pages
                return (
                    f'<div class="mermaid-chart" style="display: block; margin: 12pt 0; text-align: center; page-break-inside: avoid;">'
                    f'{svg_content}'
                    f'</div>'
                )
        except Exception as e:
            # Fallback gracefully to raw code on any fetch failure or timeout
            print(f"Failed to fetch/render mermaid chart from mermaid.ink: {e}", flush=True)

        return match.group(0)

    return pattern.sub(replacer, html_string)


# ---------------------------------------------------------------------------
# Font detection
# ---------------------------------------------------------------------------

def _find_font(*paths: str) -> str:
    for p in paths:
        if p and os.path.exists(p):
            return p
    return ""


def _get_font_css(target_lang: str = "en") -> str:
    """
    Build @font-face CSS blocks for regular, bold, italic, bold-italic, and CJK fonts.
    Falls back gracefully when individual weights are missing.
    """
    # --- Latin / sans-serif ---
    regular = _find_font(
        "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/Library/Fonts/Arial.ttf",
        "/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
    )
    bold = _find_font(
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
        "/Library/Fonts/Arial Bold.ttf",
        "/usr/share/fonts/truetype/noto/NotoSans-Bold.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
    )
    italic = _find_font(
        "/System/Library/Fonts/Supplemental/Arial Italic.ttf",
        "/Library/Fonts/Arial Italic.ttf",
        "/usr/share/fonts/truetype/noto/NotoSans-Italic.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Italic.ttf",
    )
    bold_italic = _find_font(
        "/System/Library/Fonts/Supplemental/Arial Bold Italic.ttf",
        "/Library/Fonts/Arial Bold Italic.ttf",
        "/usr/share/fonts/truetype/noto/NotoSans-BoldItalic.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-BoldItalic.ttf",
    )
    # Fall back missing weights to regular
    bold = bold or regular
    italic = italic or regular
    bold_italic = bold_italic or bold or regular

    # --- Monospace ---
    mono_regular = _find_font(
        "/System/Library/Fonts/Supplemental/Courier New.ttf",
        "/Library/Fonts/Courier New.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationMono-Regular.ttf",
        "/usr/share/fonts/truetype/noto/NotoSansMono-Regular.ttf",
    )
    mono_bold = _find_font(
        "/System/Library/Fonts/Supplemental/Courier New Bold.ttf",
        "/Library/Fonts/Courier New Bold.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationMono-Bold.ttf",
        "/usr/share/fonts/truetype/noto/NotoSansMono-Bold.ttf",
    ) or mono_regular

    # --- CJK fallback ---
    cjk = _find_font(
        "/System/Library/Fonts/Supplemental/Arial Unicode.ttf",
        "/Library/Fonts/Arial Unicode.ttf",
        "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
        "/usr/share/fonts/opentype/noto/NotoSansCJK.ttc",
        "/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc",
    )

    def face(family, weight, style, path):
        if not path:
            return ""
        return (
            f"@font-face {{"
            f"  font-family: '{family}';"
            f"  font-weight: {weight};"
            f"  font-style: {style};"
            f"  src: url('file://{path}');"
            f"}}\n"
        )

    css = ""
    css += face("DocSans", "normal", "normal", regular)
    css += face("DocSans", "bold",   "normal", bold)
    css += face("DocSans", "normal", "italic", italic)
    css += face("DocSans", "bold",   "italic", bold_italic)
    css += face("DocMono", "normal", "normal", mono_regular)
    css += face("DocMono", "bold",   "normal", mono_bold)
    
    needs_cjk = target_lang.lower().startswith(("zh", "ja", "ko"))
    if cjk and needs_cjk:
        css += face("DocCJK", "normal", "normal", cjk)

    return css


# ---------------------------------------------------------------------------
# Master stylesheet
# ---------------------------------------------------------------------------

def _build_css(extra_font_css: str = "", include_cjk: bool = True) -> str:
    font_stack = "'DocSans', 'DocCJK', sans-serif" if include_cjk else "'DocSans', sans-serif"
    mono_stack = "'DocMono', 'Courier New', monospace"

    return f"""
{extra_font_css}

@page {{
    size: A4;
    margin: 20mm 22mm 22mm 22mm;

    @bottom-center {{
        content: "Page " counter(page) " of " counter(pages);
        font-family: {font_stack};
        font-size: 8pt;
        color: #94a3b8;
    }}
}}

/* ── Base ── */
body {{
    font-family: {font_stack};
    font-size: 10.5pt;
    line-height: 1.65;
    color: #334155;
    background: white;
    margin: 0;
    padding: 0;
    word-wrap: break-word;
}}

/* ── Page breaks ── */
.page-break {{ page-break-after: always; }}

/* ── Headings ── */
h1 {{
    font-size: 22pt;
    font-weight: bold;
    color: #0f172a;
    margin: 0 0 10pt 0;
    padding-bottom: 5pt;
    border-bottom: 2px solid #e2e8f0;
    page-break-after: avoid;
}}
h2 {{
    font-size: 16pt;
    font-weight: bold;
    color: #1e293b;
    margin: 14pt 0 7pt 0;
    padding-bottom: 3pt;
    border-bottom: 1px solid #e2e8f0;
    page-break-after: avoid;
}}
h3 {{
    font-size: 13pt;
    font-weight: bold;
    color: #334155;
    margin: 12pt 0 5pt 0;
    page-break-after: avoid;
}}
h4, h5, h6 {{
    font-size: 11pt;
    font-weight: bold;
    color: #475569;
    margin: 10pt 0 4pt 0;
    page-break-after: avoid;
}}

/* ── Paragraphs ── */
p {{
    margin: 0 0 8pt 0;
    orphans: 2;
    widows: 2;
}}

/* ── Links ── */
a {{
    color: #2563eb;
    text-decoration: underline;
}}

/* ── Inline code ── */
code {{
    font-family: {mono_stack};
    font-size: 9pt;
    color: #be185d;
    background: #fdf2f8;
    padding: 1px 4px;
    border-radius: 3px;
}}

/* ── Code blocks ── */
pre {{
    font-family: {mono_stack};
    font-size: 8.5pt;
    color: #334155;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-left: 3px solid #6366f1;
    padding: 8pt 10pt;
    margin: 8pt 0;
    white-space: pre-wrap;
    word-break: break-all;
    page-break-inside: avoid;
}}
pre code {{
    font-size: inherit;
    color: inherit;
    background: none;
    padding: 0;
    border: none;
    border-radius: 0;
}}

/* ── Blockquote ── */
blockquote {{
    border-left: 3px solid #cbd5e1;
    margin: 8pt 0 8pt 0;
    padding: 4pt 0 4pt 12pt;
    color: #64748b;
    font-style: italic;
}}

/* ── Lists ── */
ul, ol {{
    margin: 0 0 8pt 0;
    padding-left: 18pt;
}}
li {{
    margin-bottom: 2pt;
}}

/* ── Horizontal rule ── */
hr {{
    border: none;
    border-top: 1px solid #e2e8f0;
    margin: 12pt 0;
}}

/* ── Images ── */
img {{
    max-width: 100%;
    height: auto;
    display: block;
    margin: 8pt 0;
    page-break-inside: avoid;
}}


/* ── Tables ── */
table {{
    width: 100%;
    border-collapse: collapse;
    margin: 10pt 0;
    font-size: 9.5pt;
    page-break-inside: auto;
}}
thead {{
    background-color: #1e293b;
    color: white;
}}
thead th {{
    padding: 6pt 8pt;
    font-weight: bold;
    text-align: left;
    border: 1px solid #334155;
    color: white;
}}
tbody tr:nth-child(even) {{
    background-color: #f8fafc;
}}
tbody tr:nth-child(odd) {{
    background-color: #ffffff;
}}
td {{
    padding: 5pt 8pt;
    border: 1px solid #e2e8f0;
    vertical-align: top;
    color: #334155;
}}

/* ── Mermaid Charts ── */
.mermaid-chart {{
    display: block;
    margin: 12pt 0;
    text-align: center;
    page-break-inside: avoid;
}}
.mermaid-chart svg {{
    max-width: 100%;
    height: auto;
}}
"""


# ---------------------------------------------------------------------------
# HTML wrapper
# ---------------------------------------------------------------------------

def _wrap_html(body_html: str, font_css: str, include_cjk: bool = True) -> str:
    css = _build_css(font_css, include_cjk)
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
{css}
</style>
</head>
<body>
{body_html}
</body>
</html>"""


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

class JobProgressHandler(logging.Handler):
    def __init__(self, job_id: str):
        super().__init__()
        self.job_id = job_id
        # WeasyPrint typically logs steps 1 through 7
        self.step = 0

    def emit(self, record):
        msg = record.getMessage()
        if msg.startswith("Step"):
            self.step += 1
            progress = min(95, int((self.step / 7.0) * 100))
            update_job_progress(self.job_id, progress)

def _generate_pdf(html_string: str, output_path: str, job_id: str = None):
    # Render mermaid diagrams in the HTML prior to compiling to PDF
    html_string = _render_mermaid_charts_in_html(html_string)

    handler = None
    logger = logging.getLogger('weasyprint.progress')
    if job_id:
        handler = JobProgressHandler(job_id)
        logger.setLevel(logging.DEBUG)
        logger.addHandler(handler)

    try:
        HTML(string=html_string).write_pdf(output_path, stylesheets=[CSS(string="")])
    finally:
        if handler:
            logger.removeHandler(handler)

def markdown_to_pdf(md_text: str, output_path: str, target_lang: str = "en", job_id: str = None) -> str:
    """Convert a Markdown string to a PDF file at output_path."""
    font_css = _get_font_css(target_lang)
    needs_cjk = target_lang.lower().startswith(("zh", "ja", "ko"))

    # Split on custom page-break markers
    parts = re.split(r"\n*---\s*newpage\s*---\n*", md_text)

    html_parts = []
    for i, part in enumerate(parts):
        if not part.strip():
            continue
        converted = markdown.markdown(
            part.strip(),
            extensions=["tables", "fenced_code", "nl2br"],
        )
        if i > 0:
            html_parts.append('<div class="page-break"></div>')
        html_parts.append(converted)

    body_html = _resolve_images("\n".join(html_parts))
    full_html = _wrap_html(body_html, font_css, needs_cjk)
    _generate_pdf(full_html, output_path, job_id)
    return output_path


def segments_to_pdf(segments, output_path: str, target_lang: str = "en", job_id: str = None) -> str:
    """Build a PDF from DOCX segments, including proper table cell rendering."""
    font_css = _get_font_css(target_lang)
    needs_cjk = target_lang.lower().startswith(("zh", "ja", "ko"))

    # ── Group segments into structural blocks ──────────────────────────────
    blocks = []
    current_table_idx = None
    current_table = None
    current_row_idx = None
    current_row = None
    current_col_idx = None
    current_cell = None
    current_cell_para_idx = None

    current_para_idx = None
    current_para = None

    for seg in segments:
        fmt = seg.get("formatting_json", {})
        if isinstance(fmt, str):
            try:
                fmt = json.loads(fmt)
            except Exception:
                fmt = {}

        text = (seg.get("translated_text") or seg.get("source_text", "")).strip()
        if not text:
            continue

        # Escape HTML special characters
        text = (
            text.replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
        )

        c_type = seg.get("container_type", "paragraph")
        is_heading = c_type == "heading"
        is_cell = c_type in ("table_cell", "header_table_cell", "footer_table_cell")

        # Apply inline formatting
        if fmt.get("bold") and fmt.get("italic"):
            text = f"<strong><em>{text}</em></strong>"
        elif fmt.get("bold"):
            text = f"<strong>{text}</strong>"
        elif fmt.get("italic"):
            text = f"<em>{text}</em>"

        # Heading level from formatting_json
        heading_level = fmt.get("heading_level") or (
            seg.get("style_name", "").lower().replace("heading ", "").strip()
            if "heading" in seg.get("style_name", "").lower()
            else None
        )

        # ── Table cell ──
        if is_cell:
            tbl_idx = seg.get("container_index", 0)
            row_idx = seg.get("table_row", 0)
            col_idx = seg.get("table_col", 0)

            # Flush any open paragraph
            if current_para is not None:
                blocks.append(current_para)
                current_para = None
                current_para_idx = None

            # New table?
            if current_table_idx != tbl_idx:
                if current_table is not None:
                    blocks.append(current_table)
                current_table = {"type": "table", "rows": []}
                current_table_idx = tbl_idx
                current_row_idx = None

            # New row?
            if current_row_idx != row_idx:
                current_row = []
                current_table["rows"].append(current_row)
                current_row_idx = row_idx
                current_col_idx = None

            # New cell?
            if current_col_idx != col_idx:
                current_cell = {"paragraphs": [], "is_header": c_type == "header_table_cell"}
                current_row.append(current_cell)
                current_col_idx = col_idx
                current_cell_para_idx = None

            cell_p_idx = seg.get("container_paragraph_index", 0)
            if not current_cell["paragraphs"] or current_cell_para_idx != cell_p_idx:
                current_cell["paragraphs"].append({"runs": []})
                current_cell_para_idx = cell_p_idx

            current_cell["paragraphs"][-1]["runs"].append(text)

        else:
            # Flush any open table
            if current_table is not None:
                blocks.append(current_table)
                current_table = None
                current_table_idx = None
                current_row = None
                current_row_idx = None
                current_cell = None
                current_col_idx = None

            p_idx = seg.get("paragraph_index", 0)
            if current_para_idx != p_idx:
                if current_para is not None:
                    blocks.append(current_para)

                style = "heading"
                level = 1
                if is_heading and heading_level:
                    try:
                        level = int(heading_level)
                    except (ValueError, TypeError):
                        level = 1
                    style = "heading"
                else:
                    style = "paragraph"

                current_para = {"type": style, "level": level, "runs": []}
                current_para_idx = p_idx

            current_para["runs"].append(text)

    # Flush remaining
    if current_para is not None:
        blocks.append(current_para)
    if current_table is not None:
        blocks.append(current_table)

    # ── Render blocks to HTML ──────────────────────────────────────────────
    html_parts = []
    for b in blocks:
        btype = b.get("type")

        if btype == "heading":
            level = max(1, min(6, b.get("level", 1)))
            content = " ".join(b["runs"]).strip()
            if content:
                html_parts.append(f"<h{level}>{content}</h{level}>")

        elif btype == "paragraph":
            content = " ".join(b["runs"]).strip()
            if content:
                html_parts.append(f"<p>{content}</p>")

        elif btype == "table":
            rows = b.get("rows", [])
            if not rows:
                continue
            html_parts.append("<table>")
            for ri, row in enumerate(rows):
                html_parts.append("<tr>")
                for cell in row:
                    tag = "th" if cell.get("is_header") else "td"
                    para_texts = []
                    for para in cell["paragraphs"]:
                        t = " ".join(para["runs"]).strip()
                        if t:
                            para_texts.append(t)
                    cell_content = " ".join(para_texts)
                    html_parts.append(f"<{tag}>{cell_content}</{tag}>")
                html_parts.append("</tr>")
            html_parts.append("</table>")

    body_html = _resolve_images("\n".join(html_parts))
    full_html = _wrap_html(body_html, font_css, needs_cjk)
    _generate_pdf(full_html, output_path, job_id)
    return output_path


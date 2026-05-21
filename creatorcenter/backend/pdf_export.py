import re
import os
import markdown
from fpdf import FPDF
from fpdf.fonts import FontFace
from backend.config import UPLOADS_DIR

IMAGES_DIR = UPLOADS_DIR / "images"


def _get_font_path() -> str:
    for p in [
        "/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf",
        "/Library/Fonts/Arial Unicode.ttf",
    ]:
        if os.path.exists(p):
            return p
    return "/Library/Fonts/Arial Unicode.ttf"


FONT_PATH = _get_font_path()


def markdown_to_pdf(md_text: str, output_path: str) -> str:
    pdf = FPDF()
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.add_page()
    pdf.add_font("Sans", "", FONT_PATH, uni=True)
    pdf.add_font("Sans", "B", FONT_PATH, uni=True)
    pdf.add_font("Sans", "I", FONT_PATH, uni=True)
    pdf.add_font("Sans", "BI", FONT_PATH, uni=True)
    pdf.set_fallback_fonts(["Sans"])

    # Replace page break markers with HTML <br> (we'll handle with add_page)
    parts = re.split(r"\n*---\s*newpage\s*---\n*", md_text)

    for pi, part in enumerate(parts):
        if pi > 0:
            pdf.add_page()

        if not part.strip():
            continue

        html = markdown.markdown(
            part.strip(),
            extensions=["tables", "fenced_code"],
        )

        pdf.set_font("Sans", "", 11)
        pdf.write_html(
            html,
            table_line_separators=True,
            ul_bullet_char="•",
            tag_styles={
                "h1": FontFace(size_pt=20),
                "h2": FontFace(size_pt=16),
                "h3": FontFace(size_pt=14),
                "h4": FontFace(size_pt=12),
            },
        )

    pdf.output(output_path)
    return output_path


def segments_to_pdf(segments, output_path: str) -> str:
    """Build PDF from DOCX segments."""
    pdf = FPDF()
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.add_page()
    pdf.add_font("Sans", "", FONT_PATH, uni=True)
    pdf.add_font("Sans", "B", FONT_PATH, uni=True)
    pdf.add_font("Sans", "I", FONT_PATH, uni=True)
    pdf.add_font("Sans", "BI", FONT_PATH, uni=True)
    pdf.set_fallback_fonts(["Sans"])

    html_parts = []
    last_para = -1

    for seg in segments:
        fmt = seg.get("formatting_json", {})
        if isinstance(fmt, str):
            import json
            fmt = json.loads(fmt)

        text = (seg.get("translated_text") or seg.get("source_text", "")).strip()
        if not text:
            continue
        if seg.get("container_type") == "table_cell":
            continue

        if seg.get("paragraph_index") != last_para and last_para >= 0:
            html_parts.append("</p>")
        if seg.get("paragraph_index") != last_para:
            html_parts.append("<p>")

        if fmt.get("bold"):
            text = f"<b>{text}</b>"
        if fmt.get("italic"):
            text = f"<i>{text}</i>"

        html_parts.append(text)
        last_para = seg.get("paragraph_index")

    html_parts.append("</p>")
    pdf.set_font("Sans", "", 11)
    pdf.write_html("".join(html_parts))
    pdf.output(output_path)
    return output_path

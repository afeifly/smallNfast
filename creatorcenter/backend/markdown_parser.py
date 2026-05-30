import json
import re
from typing import List, Tuple


def parse_markdown(md_text: str) -> Tuple[List[dict], str]:
    """
    Extract translatable text from markdown, return segments + placeholder-ized markdown.
    Each segment gets a {{SEG_N}} placeholder in the output markdown.
    """
    segments = []
    placeholder_md = []
    seg_idx = 0

    # Split into lines for processing
    lines = md_text.split("\n")
    i = 0

    while i < len(lines):
        line = lines[i]

        # Skip empty lines
        if not line.strip():
            placeholder_md.append(line)
            i += 1
            continue

        # Skip code blocks (fenced) — preserve entirely
        if line.strip().startswith("```"):
            placeholder_md.append(line)
            i += 1
            while i < len(lines) and not lines[i].strip().startswith("```"):
                placeholder_md.append(lines[i])
                i += 1
            if i < len(lines):
                placeholder_md.append(lines[i])  # closing ```
            i += 1
            continue

        # Page break marker — passthrough
        if re.match(r"^---\s*newpage\s*---$", line.strip(), re.IGNORECASE):
            placeholder_md.append(line)
            i += 1
            continue

        # Horizontal rules
        if re.match(r"^(---|\*\*\*|___)\s*$", line.strip()):
            placeholder_md.append(line)
            i += 1
            continue

        # Skip image-only lines — markdown ![]() syntax
        if re.match(r"^!\[.*\]\(.*\)\s*$", line.strip()):
            placeholder_md.append(line)
            i += 1
            continue

        # Skip image-only lines — HTML <img ...> tags
        if re.match(r"^<img\b[^>]*/?>\s*$", line.strip(), re.IGNORECASE):
            placeholder_md.append(line)
            i += 1
            continue


        # Table rows — extract cell text
        if "|" in line and line.strip().startswith("|"):
            # Check if separator row
            if re.match(r"^\|[\s\-:|]+\|$", line.strip()):
                placeholder_md.append(line)
                i += 1
                continue
            cells = [c.strip() for c in line.split("|")[1:-1]]
            placeholder_cells = []
            for cell in cells:
                clean, ph = _extract_inline(cell, seg_idx)
                seg_idx += len(clean)
                segments.extend(clean)
                placeholder_cells.append(ph)
            placeholder_md.append("| " + " | ".join(placeholder_cells) + " |")
            i += 1
            continue

        # Headings — extract heading text, preserve # markers
        heading_match = re.match(r"^(#{1,6})\s+(.+)", line)
        if heading_match:
            hashes = heading_match.group(1)
            text = heading_match.group(2)
            clean, ph = _extract_inline(text, seg_idx)
            seg_idx += len(clean)
            segments.extend(clean)
            placeholder_md.append(f"{hashes} {ph}")
            i += 1
            continue

        # List items — extract text, preserve markers
        list_match = re.match(r"^(\s*[-*+]\s+|\s*\d+\.\s+)(.+)", line)
        if list_match:
            marker = list_match.group(1)
            text = list_match.group(2)
            clean, ph = _extract_inline(text, seg_idx)
            seg_idx += len(clean)
            segments.extend(clean)
            placeholder_md.append(f"{marker}{ph}")
            i += 1
            continue

        # Blockquote
        quote_match = re.match(r"^(>\s*)(.+)", line)
        if quote_match:
            prefix = quote_match.group(1)
            text = quote_match.group(2)
            clean, ph = _extract_inline(text, seg_idx)
            seg_idx += len(clean)
            segments.extend(clean)
            placeholder_md.append(f"{prefix}{ph}")
            i += 1
            continue

        # Regular paragraph
        clean, ph = _extract_inline(line, seg_idx)
        seg_idx += len(clean)
        segments.extend(clean)
        placeholder_md.append(ph)
        i += 1

    return segments, "\n".join(placeholder_md)


def _extract_inline(text: str, start_idx: int) -> Tuple[List[dict], str]:
    """
    Extract translatable text from inline content, accounting for markdown formatting.
    Returns list of segment dicts and a placeholder-ized version of the text.
    """
    segments = []
    result_parts = []
    idx = start_idx
    pos = 0

    # Regex for inline elements to preserve
    pattern = re.compile(
        r"(\*\*([^*]+)\*\*)"          # bold
        r"|(\*([^*]+)\*)"             # italic
        r"|(`([^`]+)`)"              # inline code — skip
        r"|(\[([^\]]+)\]\([^)]+\))"  # link [text](url)
        r"|(!\[[^\]]*\]\([^)]+\))"   # markdown image — skip
        r"|(\$\$?[^$]+\$\$?)"        # math — skip
        r"|(<img\b[^>]*/?>)"          # HTML <img> tag — skip
    )

    while pos < len(text):
        m = pattern.search(text, pos)
        if not m:
            # Remaining plain text
            plain = text[pos:]
            if plain.strip():
                seg = {
                    "source_text": plain,
                    "formatting_json": "{}",
                    "paragraph_formatting_json": "{}",
                    "container_type": "markdown",
                    "container_index": None,
                    "container_paragraph_index": None,
                    "table_row": None,
                    "table_col": None,
                    "section_index": None,
                    "run_index": 0,
                    "run_count": 1,
                    "paragraph_index": idx,
                }
                segments.append(seg)
                result_parts.append(f"{{{{SEG_{idx}}}}}")
                idx += 1
            else:
                result_parts.append(plain)
            break

        # Text before the match (plain)
        before = text[pos : m.start()]
        if before.strip():
            seg = {
                "source_text": before,
                "formatting_json": "{}",
                "paragraph_formatting_json": "{}",
                "container_type": "markdown",
                "container_index": None,
                "container_paragraph_index": None,
                "table_row": None,
                "table_col": None,
                "section_index": None,
                "run_index": 0,
                "run_count": 1,
                "paragraph_index": idx,
            }
            segments.append(seg)
            result_parts.append(f"{{{{SEG_{idx}}}}}")
            idx += 1
        elif text[pos : m.start()]:
            result_parts.append(text[pos : m.start()])

        if m.group(1):  # bold **text**
            inner = m.group(2)
            result_parts.append(f"**{{{{SEG_{idx}}}}}**")
            seg = {
                "source_text": inner,
                "formatting_json": json.dumps({"bold": True}),
                "paragraph_formatting_json": "{}",
                "container_type": "markdown",
                "container_index": None,
                "container_paragraph_index": None,
                "table_row": None,
                "table_col": None,
                "section_index": None,
                "run_index": 0,
                "run_count": 1,
                "paragraph_index": idx,
            }
            segments.append(seg)
            idx += 1
        elif m.group(3):  # italic *text*
            inner = m.group(4)
            result_parts.append(f"*{{{{SEG_{idx}}}}}*")
            seg = {
                "source_text": inner,
                "formatting_json": json.dumps({"italic": True}),
                "paragraph_formatting_json": "{}",
                "container_type": "markdown",
                "container_index": None,
                "container_paragraph_index": None,
                "table_row": None,
                "table_col": None,
                "section_index": None,
                "run_index": 0,
                "run_count": 1,
                "paragraph_index": idx,
            }
            segments.append(seg)
            idx += 1
        elif m.group(5):  # inline code — preserve, don't translate
            result_parts.append(m.group(5))
        elif m.group(7):  # link [text](url) — translate link text
            inner = m.group(8)
            result_parts.append(f"[{{{{SEG_{idx}}}}}](link)")
            seg = {
                "source_text": inner,
                "formatting_json": json.dumps({"is_hyperlink": True}),
                "paragraph_formatting_json": "{}",
                "container_type": "markdown",
                "container_index": None,
                "container_paragraph_index": None,
                "table_row": None,
                "table_col": None,
                "section_index": None,
                "run_index": 0,
                "run_count": 1,
                "paragraph_index": idx,
            }
            segments.append(seg)
            idx += 1
        elif m.group(9):  # markdown image — preserve entirely
            result_parts.append(m.group(9))
        elif m.group(10):  # math — preserve entirely
            result_parts.append(m.group(10))
        elif m.group(11):  # HTML <img> tag — preserve entirely, never segment
            result_parts.append(m.group(11))


        pos = m.end()

    return segments, "".join(result_parts)

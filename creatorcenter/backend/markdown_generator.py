import re
import json


def rebuild_markdown(placeholder_md: str, db, project_id: int, target_lang: str) -> str:
    """
    Replace {{SEG_N}} placeholders with translated text.
    Uses translation_values for each segment's key.
    """
    result = placeholder_md

    # Find all placeholders
    placeholders = re.findall(r"\{\{SEG_(\d+)\}\}", placeholder_md)
    if not placeholders:
        return placeholder_md

    seg_indices = sorted(set(int(p) for p in placeholders))

    # Get segments ordered by paragraph_index
    rows = db.execute(
        """SELECT s.*, tv.translated_text
           FROM segments s
           LEFT JOIN translation_values tv ON tv.key_id = s.key_id AND tv.target_lang = ?
           WHERE s.project_id = ? AND s.container_type = 'markdown'
           AND s.ignored = 0
           ORDER BY s.paragraph_index""",
        (target_lang, project_id),
    ).fetchall()

    idx_to_translation = {}
    for row in rows:
        d = dict(row)
        trans = d.get("translated_text") or d.get("source_text", "")
        idx_to_translation[d["paragraph_index"]] = trans

    # Replace each placeholder
    for idx in seg_indices:
        translated = idx_to_translation.get(idx) or ""
        result = result.replace(f"{{{{SEG_{idx}}}}}", translated, 1)

    return result

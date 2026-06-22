import json
from fastapi import APIRouter, Depends, HTTPException
from backend.database import get_db
from backend.models import PublishedProjectOut
from backend.markdown_generator import rebuild_markdown

router = APIRouter(prefix="/share", tags=["share"])

@router.get("/{share_code}", response_model=PublishedProjectOut)
def get_shared_project(share_code: str, db=Depends(get_db)):
    proj = db.execute(
        "SELECT * FROM projects WHERE share_code = ? AND is_published = 1",
        (share_code,),
    ).fetchone()
    
    if not proj:
        raise HTTPException(status_code=404, detail="Shared project not found or not published")
        
    project_id = proj["id"]
    content_type = proj["content_type"]
    target_lang = proj["target_lang"] or proj["source_lang"]

    if content_type == "markdown":
        # Rebuild the translated markdown
        placeholder_md = proj["placeholder_md"] or ""
        rebuilt = rebuild_markdown(placeholder_md, db, project_id, target_lang)
        content = rebuilt
    else:
        # Reconstruct docx text run segments
        rows = db.execute(
            """SELECT s.paragraph_index, s.container_type, s.table_row, s.table_col,
                      s.source_text, s.formatting_json, tv.translated_text
               FROM segments s
               LEFT JOIN translation_values tv ON tv.key_id = s.key_id AND tv.target_lang = ?
               WHERE s.project_id = ? AND s.ignored = 0
               ORDER BY s.sequence""",
            (target_lang, project_id),
        ).fetchall()
        
        segments_list = []
        for r in rows:
            d = dict(r)
            text = d["translated_text"] or d["source_text"]
            fmt = d["formatting_json"] or "{}"
            if isinstance(fmt, str):
                try:
                    fmt = json.loads(fmt)
                except Exception:
                    fmt = {}
            segments_list.append({
                "paragraph_index": d["paragraph_index"],
                "container_type": d["container_type"],
                "table_row": d["table_row"],
                "table_col": d["table_col"],
                "text": text,
                "formatting": fmt
            })
        content = json.dumps(segments_list, ensure_ascii=False)

    return PublishedProjectOut(
        name=proj["name"],
        content_type=content_type,
        source_lang=proj["source_lang"],
        target_lang=target_lang,
        content=content
    )

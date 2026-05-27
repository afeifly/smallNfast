from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Dict
from pydantic import BaseModel
from backend.database import get_db
from backend.models import SegmentOut, PaginatedSegments, EditTranslationRequest, BatchEditRequest


class IgnoreSegmentRequest(BaseModel):
    ignored: bool


router = APIRouter(prefix="/projects/{project_id}/segments", tags=["segments"])


def _project_exists(project_id: int, db) -> bool:
    return db.execute(
        "SELECT 1 FROM projects WHERE id = ?", (project_id,)
    ).fetchone() is not None


@router.get("")
def list_segments(
    project_id: int,
    page: int = Query(1, ge=1),
    page_size: int = Query(200, ge=1, le=1000),
    db=Depends(get_db),
):
    if not _project_exists(project_id, db):
        raise HTTPException(404, "Project not found")
    offset = (page - 1) * page_size
    total = db.execute(
        "SELECT COUNT(*) FROM segments WHERE project_id = ?", (project_id,)
    ).fetchone()[0]
    rows = db.execute(
        """SELECT * FROM segments WHERE project_id = ?
           ORDER BY sequence LIMIT ? OFFSET ?""",
        (project_id, page_size, offset),
    ).fetchall()

    # Batch-fetch all translations for these segments' key_ids
    key_ids = list({r["key_id"] for r in rows if r["key_id"] is not None})
    translations_map: Dict[int, Dict[str, str]] = {}
    if key_ids:
        placeholders = ",".join("?" for _ in key_ids)
        trans_rows = db.execute(
            f"""SELECT tv.key_id, tv.target_lang, tv.translated_text
                FROM translation_values tv
                WHERE tv.key_id IN ({placeholders})""",
            key_ids,
        ).fetchall()
        for tr in trans_rows:
            translations_map.setdefault(tr["key_id"], {})[tr["target_lang"]] = tr["translated_text"]

    items = []
    for r in rows:
        d = dict(r)
        d["translated_langs"] = translations_map.get(d["key_id"], {})
        items.append(SegmentOut.from_row(d))
    return PaginatedSegments(items=items, total=total, page=page, page_size=page_size)


@router.get("/{segment_id}")
def get_segment(project_id: int, segment_id: int, db=Depends(get_db)):
    row = db.execute(
        "SELECT * FROM segments WHERE id = ? AND project_id = ?",
        (segment_id, project_id),
    ).fetchone()
    if not row:
        raise HTTPException(404, "Segment not found")
    return SegmentOut.from_row(row)


@router.put("/{segment_id}")
def edit_segment(
    project_id: int, segment_id: int, req: EditTranslationRequest, db=Depends(get_db)
):
    row = db.execute(
        "SELECT * FROM segments WHERE id = ? AND project_id = ?",
        (segment_id, project_id),
    ).fetchone()
    if not row:
        raise HTTPException(404, "Segment not found")
    db.execute(
        "UPDATE segments SET translated_text = ?, is_translated = 1 WHERE id = ?",
        (req.translated_text, segment_id),
    )
    db.execute(
        "UPDATE projects SET updated_at = datetime('now') WHERE id = ?", (project_id,)
    )
    # Also update the translation_values for this key+lang
    if row["key_id"]:
        proj = db.execute(
            "SELECT target_lang FROM projects WHERE id = ?", (project_id,)
        ).fetchone()
        if proj and proj["target_lang"]:
            db.execute(
                """UPDATE translation_values SET translated_text = ?, is_edited = 1
                   WHERE key_id = ? AND target_lang = ?""",
                (req.translated_text, row["key_id"], proj["target_lang"]),
            )
    db.commit()
    row = db.execute(
        "SELECT * FROM segments WHERE id = ?", (segment_id,)
    ).fetchone()
    return SegmentOut.from_row(row)


@router.put("/{segment_id}/ignore")
def toggle_ignore_segment(
    project_id: int, segment_id: int, req: IgnoreSegmentRequest, db=Depends(get_db)
):
    row = db.execute(
        "SELECT * FROM segments WHERE id = ? AND project_id = ?",
        (segment_id, project_id),
    ).fetchone()
    if not row:
        raise HTTPException(404, "Segment not found")
    db.execute(
        "UPDATE segments SET ignored = ? WHERE id = ?",
        (1 if req.ignored else 0, segment_id),
    )
    db.execute(
        "UPDATE projects SET updated_at = datetime('now') WHERE id = ?", (project_id,)
    )
    db.commit()
    row = db.execute(
        "SELECT * FROM segments WHERE id = ?", (segment_id,)
    ).fetchone()
    return SegmentOut.from_row(row)


@router.put("/batch")
def batch_edit_segments(
    project_id: int, req: BatchEditRequest, db=Depends(get_db)
):
    updated = 0
    for edit in req.edits:
        seg_id = edit.get("segment_id")
        text = edit.get("translated_text")
        if seg_id is None or text is None:
            continue
        db.execute(
            "UPDATE segments SET translated_text = ?, is_translated = 1 WHERE id = ? AND project_id = ?",
            (text, seg_id, project_id),
        )
        updated += db.total_changes
    db.execute(
        "UPDATE projects SET updated_at = datetime('now') WHERE id = ?", (project_id,)
    )
    db.commit()
    return {"updated": updated}

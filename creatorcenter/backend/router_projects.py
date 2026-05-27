import os
import uuid
import json
from typing import List
from pathlib import Path
from fastapi import APIRouter, UploadFile, File, Depends, HTTPException, Form
from backend.database import get_db
from backend.config import UPLOADS_DIR, MAX_FILE_SIZE_BYTES
from backend.models import (
    ProjectOut, ProjectDetail, UpdateProjectRequest,
    CreateMarkdownRequest, UpdateContentRequest,
)
from backend.docx_parser import parse_docx
from backend.markdown_parser import parse_markdown

router = APIRouter(prefix="/projects", tags=["projects"])


def _project_out_row(project_id: int, db) -> dict:
    row = db.execute(
        """SELECT p.*, COUNT(s.id) as segment_count
           FROM projects p LEFT JOIN segments s ON s.project_id = p.id
           WHERE p.id = ? GROUP BY p.id""",
        (project_id,),
    ).fetchone()
    return row


@router.post("", status_code=201)
def upload_project(
    file: UploadFile = File(...),
    source_lang: str = Form("EN"),
    db=Depends(get_db),
):
    if not file.filename or not file.filename.endswith(".docx"):
        raise HTTPException(400, "Only .docx files are accepted")

    contents = file.file.read()
    if len(contents) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(400, f"File exceeds {MAX_FILE_SIZE_BYTES // 1024 // 1024}MB limit")

    file_id = uuid.uuid4().hex[:8]
    safe_name = f"{file_id}_{file.filename}"
    file_path = UPLOADS_DIR / safe_name
    with open(file_path, "wb") as f:
        f.write(contents)

    cursor = db.execute(
        "INSERT INTO projects (name, content_type, original_file, source_lang, status) VALUES (?, 'docx', ?, ?, 'uploaded')",
        (file.filename, str(file_path), source_lang),
    )
    project_id = cursor.lastrowid

    # Parse immediately
    try:
        parsed = parse_docx(str(file_path))
    except Exception as e:
        db.execute("UPDATE projects SET status = 'error' WHERE id = ?", (project_id,))
        db.commit()
        raise HTTPException(400, f"Failed to parse document: {str(e)}")

    if not parsed:
        db.execute("UPDATE projects SET status = 'error' WHERE id = ?", (project_id,))
        db.commit()
        raise HTTPException(400, "No translatable text found in document")

    _create_segments_and_keys(project_id, parsed, db)

    db.execute(
        "UPDATE projects SET status = 'parsed', updated_at = datetime('now') WHERE id = ?",
        (project_id,),
    )
    db.commit()

    row = _project_out_row(project_id, db)
    return ProjectOut.from_row(row)


def _create_segments_and_keys(project_id: int, parsed: List[dict], db):
    """Insert segments and link to translation keys (shared by docx and markdown)."""
    for seg in parsed:
        db.execute(
            """INSERT INTO segments
               (project_id, sequence, paragraph_index, container_paragraph_index,
                run_index, run_count, source_text, formatting_json, paragraph_formatting_json,
                container_type, container_index, table_row, table_col, section_index)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                project_id,
                seg["sequence"],
                seg.get("paragraph_index", 0),
                seg.get("container_paragraph_index"),
                seg.get("run_index", 0),
                seg.get("run_count", 1),
                seg["source_text"],
                seg.get("formatting_json", "{}"),
                seg.get("paragraph_formatting_json", "{}"),
                seg.get("container_type", "markdown"),
                seg.get("container_index"),
                seg.get("table_row"),
                seg.get("table_col"),
                seg.get("section_index"),
            ),
        )

    db.execute(
        """INSERT OR IGNORE INTO translation_keys (source_text)
           SELECT DISTINCT source_text FROM segments
           WHERE project_id = ? AND TRIM(source_text) != '' AND ignored = 0""",
        (project_id,),
    )
    db.execute(
        """UPDATE segments SET key_id = (
             SELECT tk.id FROM translation_keys tk
             WHERE tk.source_text = segments.source_text
           )
           WHERE project_id = ?""",
        (project_id,),
    )


@router.post("/markdown", status_code=201)
def create_markdown_project(req: CreateMarkdownRequest, db=Depends(get_db)):
    cursor = db.execute(
        "INSERT INTO projects (name, content_type, markdown_content, source_lang, status) VALUES (?, 'markdown', ?, ?, 'uploaded')",
        (req.name, req.markdown_content, req.source_lang),
    )
    project_id = cursor.lastrowid

    try:
        parsed, placeholder_md = parse_markdown(req.markdown_content)
    except Exception as e:
        db.execute("UPDATE projects SET status = 'error' WHERE id = ?", (project_id,))
        db.commit()
        raise HTTPException(400, f"Failed to parse markdown: {e}")

    if parsed:
        for i, seg in enumerate(parsed):
            seg["sequence"] = i
        _create_segments_and_keys(project_id, parsed, db)

    db.execute(
        "UPDATE projects SET placeholder_md = ?, status = 'parsed', updated_at = datetime('now') WHERE id = ?",
        (placeholder_md, project_id),
    )
    db.commit()

    row = _project_out_row(project_id, db)
    return ProjectOut.from_row(row)


@router.put("/{project_id}/content")
def update_markdown_content(project_id: int, req: UpdateContentRequest, db=Depends(get_db)):
    proj = db.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()
    if not proj:
        raise HTTPException(404, "Project not found")
    if proj["content_type"] != "markdown":
        raise HTTPException(400, "Only markdown projects can update content")

    # Clear old segments
    db.execute("DELETE FROM segments WHERE project_id = ?", (project_id,))

    try:
        parsed, placeholder_md = parse_markdown(req.markdown_content)
    except Exception as e:
        db.execute("UPDATE projects SET status = 'error' WHERE id = ?", (project_id,))
        db.commit()
        raise HTTPException(400, f"Failed to parse markdown: {e}")

    if parsed:
        for i, seg in enumerate(parsed):
            seg["sequence"] = i
        _create_segments_and_keys(project_id, parsed, db)

    db.execute(
        "UPDATE projects SET placeholder_md = ?, status = 'parsed', updated_at = datetime('now') WHERE id = ?",
        (placeholder_md, project_id),
    )
    db.commit()

    row = _project_out_row(project_id, db)
    return ProjectOut.from_row(row)


@router.get("")
def list_projects(db=Depends(get_db)):
    rows = db.execute(
        """SELECT p.*, COUNT(s.id) as segment_count
           FROM projects p LEFT JOIN segments s ON s.project_id = p.id
           GROUP BY p.id ORDER BY p.created_at DESC"""
    ).fetchall()
    return [ProjectOut.from_row(r) for r in rows]


@router.get("/{project_id}")
def get_project(project_id: int, db=Depends(get_db)):
    row = _project_out_row(project_id, db)
    if not row:
        raise HTTPException(404, "Project not found")

    # Get available languages (languages with at least some translation values)
    lang_rows = db.execute(
        """SELECT DISTINCT tv.target_lang FROM translation_values tv
           WHERE tv.key_id IN (
             SELECT DISTINCT key_id FROM segments WHERE project_id = ?
           )""",
        (project_id,),
    ).fetchall()
    langs = [r["target_lang"] for r in lang_rows]

    d = dict(row)
    return ProjectDetail(
        id=d["id"],
        name=d["name"],
        content_type=d.get("content_type", "docx"),
        source_lang=d["source_lang"],
        target_lang=d["target_lang"],
        status=d["status"],
        segment_count=d["segment_count"],
        created_at=d["created_at"],
        original_file=d.get("original_file"),
        markdown_content=d.get("markdown_content"),
        updated_at=d["updated_at"],
        available_languages=langs,
    )


@router.patch("/{project_id}")
def update_project(project_id: int, req: UpdateProjectRequest, db=Depends(get_db)):
    existing = db.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()
    if not existing:
        raise HTTPException(404, "Project not found")
    if req.name is not None:
        db.execute(
            "UPDATE projects SET name = ?, updated_at = datetime('now') WHERE id = ?",
            (req.name, project_id),
        )
    if req.target_lang is not None:
        db.execute(
            "UPDATE projects SET target_lang = ?, updated_at = datetime('now') WHERE id = ?",
            (req.target_lang, project_id),
        )
    if req.source_lang is not None:
        db.execute(
            "UPDATE projects SET source_lang = ?, updated_at = datetime('now') WHERE id = ?",
            (req.source_lang, project_id),
        )
    db.commit()
    row = _project_out_row(project_id, db)
    return ProjectOut.from_row(row)


@router.delete("/{project_id}", status_code=204)
def delete_project(project_id: int, db=Depends(get_db)):
    existing = db.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()
    if not existing:
        raise HTTPException(404, "Project not found")
    # Clean up file
    try:
        os.remove(existing["original_file"])
    except Exception:
        pass
    db.execute("DELETE FROM projects WHERE id = ?", (project_id,))
    db.commit()

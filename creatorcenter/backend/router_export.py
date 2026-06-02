import traceback
import json
import asyncio
import sqlite3
from typing import Any
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from fastapi.responses import FileResponse, StreamingResponse
from backend.database import get_db
from backend.config import OUTPUTS_DIR
from backend.models import ExportRequest
from backend.docx_generator import generate_translated_docx
from backend.markdown_generator import rebuild_markdown
from backend.pdf_export import markdown_to_pdf, segments_to_pdf
from backend.job_manager import create_job, complete_job, fail_job, get_job, remove_job

router = APIRouter(prefix="/projects/{project_id}/export", tags=["export"])

def _run_export_task(job_id: str, is_markdown: bool, content: Any, output_path: str, target_lang: str, project_id: int):
    try:
        if is_markdown:
            markdown_to_pdf(content, output_path, target_lang, job_id)
        else:
            segments_to_pdf(content, output_path, target_lang, job_id)
            
        # Update db status to exported
        try:
            from backend.config import DB_PATH
            with sqlite3.connect(DB_PATH) as conn:
                conn.execute("UPDATE projects SET status = 'exported', updated_at = datetime('now') WHERE id = ?", (project_id,))
                conn.commit()
        except Exception as e:
            print(f"Failed to update db: {e}")

        complete_job(job_id)
    except Exception as e:
        tb = traceback.format_exc()
        print(f"PDF export error: {tb}", flush=True)
        fail_job(job_id, str(e))

@router.post("")
def export_project(project_id: int, req: ExportRequest, background_tasks: BackgroundTasks, db=Depends(get_db)):
    proj = db.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()
    if not proj:
        raise HTTPException(404, "Project not found")

    is_source = req.target_lang == proj["source_lang"]

    if not is_source:
        key_count = db.execute(
            """SELECT COUNT(*) FROM segments s
               WHERE s.project_id = ? AND s.key_id IN (
                 SELECT tv.key_id FROM translation_values tv WHERE tv.target_lang = ?
               )""",
            (project_id, req.target_lang),
        ).fetchone()[0]
        if key_count == 0:
            raise HTTPException(400, "No translations found for this language. Run translate first.")

    pdf_name = f"{project_id}_{req.target_lang}.pdf"
    output_path = OUTPUTS_DIR / pdf_name
    download_name = f"{proj['name'].rsplit('.', 1)[0]}_{req.target_lang}.pdf"
    job_id = create_job(str(output_path), download_name)

    try:
        if proj["content_type"] == "markdown":
            if is_source:
                md_text = proj["markdown_content"] or ""
            else:
                placeholder_md = proj["placeholder_md"] or ""
                md_text = rebuild_markdown(placeholder_md, db, project_id, req.target_lang)
            background_tasks.add_task(_run_export_task, job_id, True, md_text, str(output_path), req.target_lang, project_id)
        else:
            rows = db.execute(
                """SELECT s.*, tv.translated_text FROM segments s
                   LEFT JOIN translation_values tv ON tv.key_id = s.key_id AND tv.target_lang = ?
                   WHERE s.project_id = ? AND s.is_translated = 1 AND s.ignored = 0
                   ORDER BY s.sequence""",
                (req.target_lang, project_id),
            ).fetchall()
            segments = [dict(r) for r in rows]
            background_tasks.add_task(_run_export_task, job_id, False, segments, str(output_path), req.target_lang, project_id)
    except Exception as e:
        tb = traceback.format_exc()
        print(f"PDF export setup error: {tb}", flush=True)
        remove_job(job_id)
        raise HTTPException(500, f"Failed to start PDF export: {type(e).__name__}: {e}")

    return {"job_id": job_id}

@router.get("/progress/{job_id}")
async def export_progress(job_id: str):
    async def event_generator():
        while True:
            job = get_job(job_id)
            if not job:
                yield f"data: {json.dumps({'error': 'Job not found'})}\n\n"
                break
            
            yield f"data: {json.dumps(job)}\n\n"
            
            if job["status"] in ("completed", "failed"):
                break
            await asyncio.sleep(0.5)
    
    return StreamingResponse(event_generator(), media_type="text/event-stream")

@router.get("/download/{job_id}")
def export_download(job_id: str):
    job = get_job(job_id)
    if not job or job["status"] != "completed":
        raise HTTPException(400, "Job not completed or not found")
    
    output_path = job["output_path"]
    download_name = job["download_name"]
    remove_job(job_id)
    
    return FileResponse(
        path=output_path,
        filename=download_name,
        media_type="application/pdf",
    )

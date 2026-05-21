import traceback
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from backend.database import get_db
from backend.config import OUTPUTS_DIR
from backend.models import ExportRequest
from backend.docx_generator import generate_translated_docx
from backend.markdown_generator import rebuild_markdown
from backend.pdf_export import markdown_to_pdf, segments_to_pdf

router = APIRouter(prefix="/projects/{project_id}/export", tags=["export"])


@router.post("")
def export_project(project_id: int, req: ExportRequest, db=Depends(get_db)):
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

    try:
        if proj["content_type"] == "markdown":
            if is_source:
                # Use original content directly — no placeholders, no translation needed
                md_text = proj["markdown_content"] or ""
            else:
                placeholder_md = proj["placeholder_md"] or ""
                md_text = rebuild_markdown(placeholder_md, db, project_id, req.target_lang)
            markdown_to_pdf(md_text, str(output_path))
        else:
            # DOCX: build segments-based PDF
            rows = db.execute(
                """SELECT s.*, tv.translated_text FROM segments s
                   LEFT JOIN translation_values tv ON tv.key_id = s.key_id AND tv.target_lang = ?
                   WHERE s.project_id = ? AND s.is_translated = 1 AND s.ignored = 0
                   ORDER BY s.sequence""",
                (req.target_lang, project_id),
            ).fetchall()
            segments = [dict(r) for r in rows]
            segments_to_pdf(segments, str(output_path))
    except Exception as e:
        tb = traceback.format_exc()
        print(f"PDF export error: {tb}", flush=True)
        raise HTTPException(500, f"Failed to generate PDF: {type(e).__name__}: {e}")

    db.execute(
        "UPDATE projects SET status = 'exported', updated_at = datetime('now') WHERE id = ?",
        (project_id,),
    )
    db.commit()

    download_name = f"{proj['name'].rsplit('.', 1)[0]}_{req.target_lang}.pdf"

    return FileResponse(
        path=str(output_path),
        filename=download_name,
        media_type="application/pdf",
    )

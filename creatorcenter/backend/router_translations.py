import time
from fastapi import APIRouter, Depends, HTTPException, Query
from backend.database import get_db
from backend.models import (
    TranslationPair,
    TranslateRequest,
    TranslateStatus,
    EditTranslationRequest,
)
from backend.config import TRANSLATION_API_KEY, MINIMAX_API_KEY, MINIMAX_MODEL
from backend.translation.factory import get_provider

router = APIRouter(
    prefix="/projects/{project_id}", tags=["translations"]
)


@router.get("/keys")
def list_translation_keys(
    project_id: int,
    lang: str = Query(..., description="Target language code e.g. DE, CN, JP"),
    db=Depends(get_db),
):
    if not db.execute("SELECT 1 FROM projects WHERE id = ?", (project_id,)).fetchone():
        raise HTTPException(404, "Project not found")

    rows = db.execute(
        """SELECT
             tk.id as key_id,
             tk.source_text,
             tv.translated_text,
             tv.is_edited,
             COUNT(s.id) as occurrence_count
           FROM translation_keys tk
           JOIN segments s ON s.key_id = tk.id AND s.project_id = ?
           LEFT JOIN translation_values tv ON tv.key_id = tk.id AND tv.target_lang = ?
           GROUP BY tk.id
           ORDER BY tk.id""",
        (project_id, lang),
    ).fetchall()

    return [
        TranslationPair(
            key_id=r["key_id"],
            source_text=r["source_text"],
            translated_text=r["translated_text"],
            is_edited=bool(r["is_edited"]),
            occurrence_count=r["occurrence_count"],
        )
        for r in rows
    ]


@router.put("/keys/{key_id}")
def edit_translation_key(
    project_id: int,
    key_id: int,
    req: EditTranslationRequest,
    db=Depends(get_db),
):
    key = db.execute(
        "SELECT * FROM translation_keys WHERE id = ?", (key_id,)
    ).fetchone()
    if not key:
        raise HTTPException(404, "Translation key not found")

    proj = db.execute(
        "SELECT target_lang FROM projects WHERE id = ?", (project_id,)
    ).fetchone()
    target_lang = proj["target_lang"] if proj else None
    if not target_lang:
        raise HTTPException(400, "Set target_lang on the project first")

    # Upsert translation_value
    db.execute(
        """INSERT INTO translation_values (key_id, target_lang, translated_text, is_edited)
           VALUES (?, ?, ?, 1)
           ON CONFLICT(key_id, target_lang) DO UPDATE SET
             translated_text = excluded.translated_text, is_edited = 1""",
        (key_id, target_lang, req.translated_text),
    )

    # Propagate to all non-ignored segments via key_id
    db.execute(
        """UPDATE segments
           SET translated_text = ?, is_translated = 1
           WHERE key_id = ? AND ignored = 0""",
        (req.translated_text, key_id),
    )
    propagated = db.total_changes

    db.execute(
        "UPDATE projects SET updated_at = datetime('now') WHERE id = ?", (project_id,)
    )
    db.commit()

    return {"key_id": key_id, "propagated_to_n_segments": propagated}


@router.post("/translate", status_code=202)
def trigger_translation(
    project_id: int,
    req: TranslateRequest,
    db=Depends(get_db),
):
    proj = db.execute(
        "SELECT * FROM projects WHERE id = ?", (project_id,)
    ).fetchone()
    if not proj:
        raise HTTPException(404, "Project not found")

    db.execute(
        "UPDATE projects SET target_lang = ?, status = 'translating', updated_at = datetime('now') WHERE id = ?",
        (req.target_lang, project_id),
    )
    db.commit()

    # Find keys used by this project that lack a translation for this language
    keys = db.execute(
        """SELECT tk.id, tk.source_text
           FROM translation_keys tk
           WHERE tk.id IN (
             SELECT DISTINCT s.key_id FROM segments s
             WHERE s.project_id = ? AND s.ignored = 0
           )
           AND NOT EXISTS (
             SELECT 1 FROM translation_values tv
             WHERE tv.key_id = tk.id AND tv.target_lang = ?
           )""",
        (project_id, req.target_lang),
    ).fetchall()

    total = len(keys)
    if total == 0:
        # All keys already translated — propagate cached translations
        db.execute(
            """UPDATE segments SET
                 translated_text = (
                   SELECT tv.translated_text FROM translation_values tv
                   WHERE tv.key_id = segments.key_id AND tv.target_lang = ?
                 ),
                 is_translated = 1
               WHERE project_id = ? AND ignored = 0
               AND key_id IN (
                 SELECT tk.id FROM translation_keys tk
                 JOIN translation_values tv ON tv.key_id = tk.id AND tv.target_lang = ?
               )""",
            (req.target_lang, project_id, req.target_lang),
        )
        db.execute(
            "UPDATE projects SET status = 'translated', updated_at = datetime('now') WHERE id = ?",
            (project_id,),
        )
        db.commit()
        return {"status": "completed", "translated_count": 0, "total_count": 0}

    if req.provider == "minimax":
        api_key = MINIMAX_API_KEY
        extra = {"model": MINIMAX_MODEL}
        batch_size = 25
    else:
        api_key = TRANSLATION_API_KEY
        extra = {}
        batch_size = 3  # RapidAPI free plan limit
    provider = get_provider(req.provider, api_key, **extra)

    try:
        for i in range(0, total, batch_size):
            batch = keys[i : i + batch_size]
            texts = [k["source_text"] for k in batch]
            try:
                translations = provider.translate_batch(
                    texts, proj["source_lang"], req.target_lang
                )
            except Exception as e:
                db.execute(
                    "UPDATE projects SET status = 'error', updated_at = datetime('now') WHERE id = ?",
                    (project_id,),
                )
                db.commit()
                raise HTTPException(502, f"Translation API request failed: {e}")

            for key_row, translated in zip(batch, translations):
                db.execute(
                    """INSERT INTO translation_values (key_id, target_lang, translated_text, is_edited)
                       VALUES (?, ?, ?, 0)
                       ON CONFLICT(key_id, target_lang) DO NOTHING""",
                    (key_row["id"], req.target_lang, translated),
                )
                # Propagate to all segments with this key_id
                db.execute(
                    """UPDATE segments
                       SET translated_text = ?, is_translated = 1
                       WHERE key_id = ? AND ignored = 0""",
                    (translated, key_row["id"]),
                )

            db.execute(
                "UPDATE projects SET updated_at = datetime('now') WHERE id = ?",
                (project_id,),
            )
            db.commit()

            if i + batch_size < total:
                time.sleep(2.0)

    except HTTPException:
        raise
    except Exception as e:
        db.execute(
            "UPDATE projects SET status = 'error', updated_at = datetime('now') WHERE id = ?",
            (project_id,),
        )
        db.commit()
        raise HTTPException(502, f"Translation failed: {type(e).__name__}: {e}")

    db.execute(
        "UPDATE projects SET status = 'translated', updated_at = datetime('now') WHERE id = ?",
        (project_id,),
    )
    db.commit()

    return {"status": "completed", "translated_count": total, "total_count": total}


@router.get("/translate/status")
def translation_status(project_id: int, db=Depends(get_db)):
    proj = db.execute(
        "SELECT status, target_lang FROM projects WHERE id = ?", (project_id,)
    ).fetchone()
    if not proj:
        raise HTTPException(404, "Project not found")

    if proj["target_lang"]:
        translated = db.execute(
            """SELECT COUNT(DISTINCT s.key_id) FROM segments s
               WHERE s.project_id = ?
               AND s.key_id IN (
                 SELECT tv.key_id FROM translation_values tv
                 WHERE tv.target_lang = ?
               )""",
            (project_id, proj["target_lang"]),
        ).fetchone()[0]
        total = db.execute(
            "SELECT COUNT(DISTINCT key_id) FROM segments WHERE project_id = ? AND key_id IS NOT NULL",
            (project_id,),
        ).fetchone()[0]
    else:
        translated = 0
        total = 0

    return TranslateStatus(
        status=proj["status"],
        translated_count=translated,
        total_count=total,
    )

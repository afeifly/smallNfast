from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Dict
from backend.database import get_db

router = APIRouter(prefix="/keys", tags=["keys"])


@router.get("")
def list_all_keys(db=Depends(get_db)):
    # Get all keys with occurrence counts
    keys = db.execute(
        """SELECT tk.id, tk.source_text,
             (SELECT COUNT(*) FROM segments s WHERE s.key_id = tk.id) as occurrence_count
           FROM translation_keys tk
           ORDER BY tk.id"""
    ).fetchall()

    # Batch-fetch all translations for all keys
    key_ids = [k["id"] for k in keys]
    translations_map: Dict[int, Dict[str, str]] = {}
    if key_ids:
        placeholders = ",".join("?" for _ in key_ids)
        trans_rows = db.execute(
            f"""SELECT key_id, target_lang, translated_text
                FROM translation_values WHERE key_id IN ({placeholders})""",
            key_ids,
        ).fetchall()
        for tr in trans_rows:
            translations_map.setdefault(tr["key_id"], {})[tr["target_lang"]] = tr["translated_text"]

    return [
        {
            "key_id": k["id"],
            "source_text": k["source_text"],
            "occurrence_count": k["occurrence_count"],
            "translations": translations_map.get(k["id"], {}),
        }
        for k in keys
    ]


@router.get("/{key_id}")
def get_key(key_id: int, db=Depends(get_db)):
    key = db.execute(
        "SELECT * FROM translation_keys WHERE id = ?", (key_id,)
    ).fetchone()
    if not key:
        raise HTTPException(404, "Key not found")

    translations = db.execute(
        "SELECT target_lang, translated_text, is_edited FROM translation_values WHERE key_id = ?",
        (key_id,),
    ).fetchall()

    occurrence = db.execute(
        "SELECT COUNT(*) FROM segments WHERE key_id = ?", (key_id,)
    ).fetchone()[0]

    return {
        "key_id": key["id"],
        "source_text": key["source_text"],
        "occurrence_count": occurrence,
        "translations": {
            t["target_lang"]: {"text": t["translated_text"], "edited": bool(t["is_edited"])}
            for t in translations
        },
    }


@router.delete("/{key_id}", status_code=204)
def delete_key(key_id: int, db=Depends(get_db)):
    key = db.execute(
        "SELECT * FROM translation_keys WHERE id = ?", (key_id,)
    ).fetchone()
    if not key:
        raise HTTPException(404, "Key not found")

    # Find affected project IDs before unlinking
    affected_projects = db.execute(
        "SELECT DISTINCT project_id FROM segments WHERE key_id = ?", (key_id,)
    ).fetchall()

    db.execute("UPDATE segments SET key_id = NULL, translated_text = NULL, is_translated = 0 WHERE key_id = ?", (key_id,))
    db.execute("DELETE FROM translation_values WHERE key_id = ?", (key_id,))
    db.execute("DELETE FROM translation_keys WHERE id = ?", (key_id,))

    # Re-create keys for the unlinked segments so they can be translated again
    for (pid,) in affected_projects:
        db.execute(
            """INSERT OR IGNORE INTO translation_keys (source_text)
               SELECT DISTINCT source_text FROM segments
               WHERE project_id = ? AND key_id IS NULL AND TRIM(source_text) != '' AND ignored = 0""",
            (pid,),
        )
        db.execute(
            """UPDATE segments SET key_id = (
                 SELECT tk.id FROM translation_keys tk
                 WHERE tk.source_text = segments.source_text
               )
               WHERE project_id = ? AND key_id IS NULL""",
            (pid,),
        )

    db.commit()

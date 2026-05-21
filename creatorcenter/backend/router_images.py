import uuid
from pathlib import Path
from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import FileResponse
from backend.config import UPLOADS_DIR

IMAGES_DIR = UPLOADS_DIR / "images"
IMAGES_DIR.mkdir(parents=True, exist_ok=True)

router = APIRouter(prefix="/images", tags=["images"])

ALLOWED_TYPES = {"image/png", "image/jpeg", "image/gif", "image/webp", "image/svg+xml"}


@router.post("/upload")
async def upload_image(file: UploadFile = File(...)):
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(400, f"Unsupported image type: {file.content_type}")

    ext = Path(file.filename).suffix or ".png"
    safe_name = f"{uuid.uuid4().hex[:8]}{ext}"
    file_path = IMAGES_DIR / safe_name

    contents = await file.read()
    if len(contents) > 10 * 1024 * 1024:  # 10MB limit
        raise HTTPException(400, "Image too large (max 10MB)")

    with open(file_path, "wb") as f:
        f.write(contents)

    return {"url": f"/api/images/{safe_name}", "filename": safe_name}


@router.get("/{filename}")
def get_image(filename: str):
    file_path = IMAGES_DIR / filename
    if not file_path.exists():
        raise HTTPException(404, "Image not found")
    return FileResponse(str(file_path))

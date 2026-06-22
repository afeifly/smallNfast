import os
from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from backend.database import init_db
from backend.router_projects import router as projects_router
from backend.router_segments import router as segments_router
from backend.router_translations import router as translations_router
from backend.router_export import router as export_router
from backend.router_keys import router as keys_router
from backend.router_images import router as images_router
from backend.router_share import router as share_router

FRONTEND_DIST = Path(__file__).resolve().parent.parent / "frontend" / "dist"


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(title="Creator Center", version="0.2.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from fastapi import Depends
from backend.router_auth import router as auth_router, verify_session

app.include_router(auth_router, prefix="/api")
app.include_router(share_router, prefix="/api")
app.include_router(projects_router, prefix="/api", dependencies=[Depends(verify_session)])
app.include_router(segments_router, prefix="/api", dependencies=[Depends(verify_session)])
app.include_router(translations_router, prefix="/api", dependencies=[Depends(verify_session)])
app.include_router(export_router, prefix="/api", dependencies=[Depends(verify_session)])
app.include_router(keys_router, prefix="/api", dependencies=[Depends(verify_session)])
app.include_router(images_router, prefix="/api", dependencies=[Depends(verify_session)])


# Serve frontend static files in production
if FRONTEND_DIST.exists() and (FRONTEND_DIST / "index.html").exists():
    app.mount("/assets", StaticFiles(directory=FRONTEND_DIST / "assets"), name="assets")

    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        from fastapi.responses import FileResponse
        file_path = FRONTEND_DIST / full_path
        if file_path.exists() and file_path.is_file():
            return FileResponse(str(file_path))
        return FileResponse(str(FRONTEND_DIST / "index.html"))


@app.get("/health")
def health():
    return {"status": "ok"}

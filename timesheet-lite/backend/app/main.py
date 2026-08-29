from pathlib import Path
from starlette.responses import FileResponse

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.database import create_db_and_tables, get_session, engine
from app.api import auth, projects, timesheets, reports, activity_logs, users, settings, cost_centers

from app.models import Project, User, Role, CostCenter, WorkDaySetting
from app.core.security import get_password_hash
from sqlmodel import Session, select
from sqlalchemy import text

app = FastAPI(title="Timesheet System")

origins = [
    "*",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# The built frontend calls /api/... but the backend routes are mounted without
# the /api prefix. Strip it here so the FastAPI app can serve both the API and
# the static frontend from a single port/process (no vite proxy needed).
@app.middleware("http")
async def strip_api_prefix(request: Request, call_next):
    path = request.url.path
    if path.startswith("/api/"):
        request.scope["path"] = path[len("/api"):] or "/"
        request.scope["raw_path"] = request.scope["raw_path"][len(b"/api"):]
    return await call_next(request)


FRONTEND_DIST = Path(__file__).resolve().parent.parent.parent / "frontend" / "dist"

app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(projects.router, prefix="/projects", tags=["projects"])
app.include_router(timesheets.router, prefix="/timesheets", tags=["timesheets"])
app.include_router(reports.router, prefix="/reports", tags=["reports"])
app.include_router(activity_logs.router, prefix="/activity_logs", tags=["activity_logs"])
app.include_router(users.router, prefix="/users", tags=["users"])
app.include_router(settings.router, prefix="/settings", tags=["settings"])
app.include_router(cost_centers.router, prefix="/cost-centers", tags=["cost_centers"])

from app.api import workdays
app.include_router(workdays.router, prefix="/workdays", tags=["workdays"])

from app.api import backup
app.include_router(backup.router, prefix="/backups", tags=["backups"])


@app.on_event("startup")
def on_startup():
    from app.core.scheduler import start_scheduler
    start_scheduler()
    
    # Check if we need to drop old workday table to update schema
    from sqlalchemy import inspect
    inspector = inspect(engine)
    if "workday" in inspector.get_table_names():
        columns = [c["name"] for c in inspector.get_columns("workday")]
        if "setting_id" not in columns:
            # Drop old table to allow recreation with composite primary key
            with engine.begin() as conn:
                conn.execute(text("DROP TABLE workday"))

    if "costcenter" in inspector.get_table_names():
        columns = [c["name"] for c in inspector.get_columns("costcenter")]
        if "workday_setting_id" not in columns:
            # Drop old table to allow recreation with new columns
            with engine.begin() as conn:
                conn.execute(text("DROP TABLE costcenter"))

    create_db_and_tables()
    
    # Initialize default projects, admin user, and default workday setting
    with Session(engine) as session:
        # Default Projects
        default_projects = ["Research", "Maintenance", "Others"]
        for p_name in default_projects:
            project = session.exec(select(Project).where(Project.name == p_name)).first()
            if not project:
                session.add(Project(name=p_name, description=f"Default {p_name} project", is_default=True))
        
        # Default Admin
        admin = session.exec(select(User).where(User.username == "admin")).first()
        if not admin:
            session.add(User(
                username="admin", 
                password_hash=get_password_hash("admin123"), 
                role=Role.ADMIN
            ))

        # Default Cost Centers
        default_ccs = ["R&D-SZ", "R&D-XA"]
        for cc_name in default_ccs:
            cc = session.exec(select(CostCenter).where(CostCenter.name == cc_name)).first()
            if not cc:
                session.add(CostCenter(name=cc_name))

        # Default WorkDaySetting
        default_setting = session.exec(select(WorkDaySetting).where(WorkDaySetting.is_default == True)).first()
        if not default_setting:
            default_setting = session.exec(select(WorkDaySetting).where(WorkDaySetting.name == "Default")).first()
            if not default_setting:
                default_setting = WorkDaySetting(name="Default", description="Default workday settings profile", is_default=True)
                session.add(default_setting)
        
        session.commit()

@app.get("/")
def read_root():
    if FRONTEND_DIST.exists() and (FRONTEND_DIST / "index.html").exists():
        return FileResponse(str(FRONTEND_DIST / "index.html"))
    return {"message": "Welcome to the Timesheet System API"}


# Serve the built frontend in production (single app serving both API + UI)
if FRONTEND_DIST.exists() and (FRONTEND_DIST / "index.html").exists():
    app.mount("/assets", StaticFiles(directory=FRONTEND_DIST / "assets"), name="assets")

    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        file_path = FRONTEND_DIST / full_path
        if file_path.exists() and file_path.is_file():
            return FileResponse(str(file_path))
        return FileResponse(str(FRONTEND_DIST / "index.html"))

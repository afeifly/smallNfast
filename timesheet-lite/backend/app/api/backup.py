from fastapi import APIRouter, Depends, HTTPException, status
from typing import List
import os
from pydantic import BaseModel
from app.api.deps import get_current_admin_user
from app.services.backup_service import backup_database, restore_database, verify_super_code, BACKUP_DIR
from app.models import User

router = APIRouter()

class BackupFile(BaseModel):
    filename: str
    size: int
    created_at: str

class RestoreRequest(BaseModel):
    filename: str
    super_code: str

@router.get("/", response_model=List[BackupFile])
def list_backups(current_user: User = Depends(get_current_admin_user)):
    """List available backup files."""
    if not os.path.exists(BACKUP_DIR):
        return []
        
    backups = []
    for filename in sorted(os.listdir(BACKUP_DIR), reverse=True):
        if filename.endswith(".sqlite"):
            filepath = os.path.join(BACKUP_DIR, filename)
            stats = os.stat(filepath)
            backups.append(BackupFile(
                filename=filename,
                size=stats.st_size,
                created_at=str(stats.st_ctime) # Client can format this
            ))
    return backups

@router.post("/run", status_code=201)
def run_manual_backup(current_user: User = Depends(get_current_admin_user)):
    """Trigger a manual backup immediately."""
    path = backup_database()
    if path:
        return {"message": "Backup created successfully", "path": path}
    raise HTTPException(status_code=500, detail="Backup failed")

@router.post("/restore")
def restore_backup(
    request: RestoreRequest,
    current_user: User = Depends(get_current_admin_user)
):
    """Restore database from backup using Super Pass Code."""
    # Verify Super Code
    if not verify_super_code(request.super_code, current_user.password_hash):
        raise HTTPException(status_code=403, detail="Invalid Super Pass Code")
        
    try:
        restore_database(request.filename)
        return {"message": "Database restored successfully. Please restart the backend server to ensure consistence."}
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Backup file not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends
from sqlmodel import Session, select, SQLModel, Field
from app.database import get_session
from app.models import ActivityLog, User
from app.api.deps import get_current_admin_user, get_current_user

router = APIRouter()

class ActivityLogRead(SQLModel):
    id: int
    user_id: int
    action: str
    details: Optional[str] = None
    timestamp: datetime
    username: str

@router.get("/", response_model=List[ActivityLogRead])
def read_activity_logs(
    skip: int = 0, 
    limit: int = 50, 
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    logs = session.exec(select(ActivityLog).order_by(ActivityLog.timestamp.desc()).offset(skip).limit(limit)).all()
    return [
        ActivityLogRead(
            **log.dict(), 
            username=log.user.username if log.user else "Unknown"
        ) for log in logs
    ]

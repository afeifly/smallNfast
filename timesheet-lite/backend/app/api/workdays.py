from typing import List, Optional
from datetime import date
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from app.database import get_session
from app.models import WorkDay, WorkDayType, Role, User
from app.api.deps import get_current_user

router = APIRouter()

@router.get("/", response_model=List[WorkDay])
def read_workdays(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    query = select(WorkDay)
    if start_date:
        query = query.where(WorkDay.date >= start_date)
    if end_date:
        query = query.where(WorkDay.date <= end_date)
    return session.exec(query).all()

@router.post("/", response_model=WorkDay)
def update_workday(
    workday: WorkDay,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    if current_user.role != Role.ADMIN:
        raise HTTPException(status_code=403, detail="Only Admins can manage work days")
    
    # Ensure date is a python date object (fix for SQLite type error)
    if isinstance(workday.date, str):
        workday.date = date.fromisoformat(workday.date)

    existing = session.get(WorkDay, workday.date)
    
    # If explicit status is WORK, we treat it as "Normal" -> Delete the DB entry
    # UPSERT Logic
    if existing:
        existing.day_type = workday.day_type
        existing.remark = workday.remark
        session.add(existing)
        session.commit()
        session.refresh(existing)
        return existing
    else:
        session.add(workday)
        session.commit()
        session.refresh(workday)
        return workday

@router.delete("/{date_str}")
def delete_workday(
    date_str: str,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    if current_user.role != Role.ADMIN:
        raise HTTPException(status_code=403, detail="Only Admins can manage work days")
    
    try:
        d = date.fromisoformat(date_str)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format")

    existing = session.get(WorkDay, d)
    if existing:
        session.delete(existing)
        session.commit()
    return {"ok": True}

    # UPSERT Logic for Exceptions (OFF, HALF_OFF)


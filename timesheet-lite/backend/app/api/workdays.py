# -*- coding: utf-8 -*-
# API Contract
# WARNING: This is a strict contract file generated according to .agents/rules/20-api-contract.md.
# DO NOT modify manually without aligning both UI and Worker architectures.

from typing import List, Optional
from datetime import date
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select, func
from app.database import get_session
from app.models import WorkDay, WorkDayType, Role, User, WorkDaySetting, WorkDaySettingUserLink, CostCenter
from app.api.deps import get_current_user

router = APIRouter()

# Input Models
class WorkDaySettingCreate(BaseModel):
    name: str
    description: Optional[str] = None

class SettingUserAssign(BaseModel):
    user_id: int

class WorkDayExceptionCreate(BaseModel):
    setting_id: int
    date: date
    day_type: WorkDayType
    remark: Optional[str] = None


def check_workday_modify_permission(session: Session, user: User, setting_id: int):
    """
    Returns True if user has permission to modify the setting_id, else raises 403.
    """
    if user.role == Role.ADMIN:
        return True
    
    # Check link
    link = session.exec(
        select(WorkDaySettingUserLink)
        .where(WorkDaySettingUserLink.setting_id == setting_id)
        .where(WorkDaySettingUserLink.user_id == user.id)
    ).first()
    
    if not link:
        raise HTTPException(
            status_code=403,
            detail="You do not have permission to modify this workday setting profile."
        )
    return True


# ==========================================
# WORKDAY SETTING PROFILE MANAGEMENT (Admin)
# ==========================================

@router.get("/settings")
def list_workday_settings(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    settings = session.exec(select(WorkDaySetting)).all()
    
    # Enrich settings with can_edit flag
    result = []
    for s in settings:
        can_edit = False
        if current_user.role == Role.ADMIN:
            can_edit = True
        else:
            link = session.exec(
                select(WorkDaySettingUserLink)
                .where(WorkDaySettingUserLink.setting_id == s.id)
                .where(WorkDaySettingUserLink.user_id == current_user.id)
            ).first()
            can_edit = link is not None
            
        result.append({
            "id": s.id,
            "name": s.name,
            "description": s.description,
            "is_default": s.is_default,
            "can_edit": can_edit
        })
    return result

@router.post("/settings", response_model=WorkDaySetting)
def create_workday_setting(
    data: WorkDaySettingCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    if current_user.role != Role.ADMIN:
        raise HTTPException(status_code=403, detail="Only Admins can create workday profiles")
        
    name_stripped = data.name.strip()
    if not name_stripped:
        raise HTTPException(status_code=400, detail="Profile name cannot be empty")
        
    existing = session.exec(select(WorkDaySetting).where(WorkDaySetting.name == name_stripped)).first()
    if existing:
        raise HTTPException(status_code=400, detail="A profile with this name already exists")
        
    new_setting = WorkDaySetting(name=name_stripped, description=data.description)
    session.add(new_setting)
    session.commit()
    session.refresh(new_setting)
    return new_setting

@router.delete("/settings/{setting_id}")
def delete_workday_setting(
    setting_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    if current_user.role != Role.ADMIN:
        raise HTTPException(status_code=403, detail="Only Admins can delete workday profiles")
        
    profile = session.get(WorkDaySetting, setting_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Workday profile not found")
        
    if profile.is_default:
        raise HTTPException(status_code=400, detail="Cannot delete the default workday profile")
        
    # Unlink any cost centers using this setting
    ccs = session.exec(select(CostCenter).where(CostCenter.workday_setting_id == setting_id)).all()
    for cc in ccs:
        cc.workday_setting_id = None
        session.add(cc)
        
    # Delete associated workday exceptions
    exceptions = session.exec(select(WorkDay).where(WorkDay.setting_id == setting_id)).all()
    for ex in exceptions:
        session.delete(ex)
        
    # Delete modify link permissions
    links = session.exec(select(WorkDaySettingUserLink).where(WorkDaySettingUserLink.setting_id == setting_id)).all()
    for l in links:
        session.delete(l)
        
    session.delete(profile)
    session.commit()
    return {"ok": True}


# ==========================================
# MODIFY RIGHTS DELEGATION (Admin)
# ==========================================

@router.get("/settings/{setting_id}/users")
def get_modify_rights_users(
    setting_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    # Retrieve users linked to this setting
    links = session.exec(select(WorkDaySettingUserLink).where(WorkDaySettingUserLink.setting_id == setting_id)).all()
    user_ids = [l.user_id for l in links]
    if not user_ids:
        return []
    users = session.exec(select(User).where(User.id.in_(user_ids))).all()
    return [{"id": u.id, "username": u.username, "full_name": u.full_name} for u in users]

@router.post("/settings/{setting_id}/users")
def grant_modify_rights(
    setting_id: int,
    data: SettingUserAssign,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    if current_user.role != Role.ADMIN:
        raise HTTPException(status_code=403, detail="Only Admins can delegate modify rights")
        
    profile = session.get(WorkDaySetting, setting_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Workday profile not found")
        
    target_user = session.get(User, data.user_id)
    if not target_user or target_user.is_deleted:
        raise HTTPException(status_code=404, detail="User not found")
        
    existing = session.exec(
        select(WorkDaySettingUserLink)
        .where(WorkDaySettingUserLink.setting_id == setting_id)
        .where(WorkDaySettingUserLink.user_id == data.user_id)
    ).first()
    
    if not existing:
        link = WorkDaySettingUserLink(setting_id=setting_id, user_id=data.user_id)
        session.add(link)
        session.commit()
        
    return {"ok": True}

@router.delete("/settings/{setting_id}/users/{user_id}")
def revoke_modify_rights(
    setting_id: int,
    user_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    if current_user.role != Role.ADMIN:
        raise HTTPException(status_code=403, detail="Only Admins can revoke modify rights")
        
    link = session.exec(
        select(WorkDaySettingUserLink)
        .where(WorkDaySettingUserLink.setting_id == setting_id)
        .where(WorkDaySettingUserLink.user_id == user_id)
    ).first()
    
    if link:
        session.delete(link)
        session.commit()
        
    return {"ok": True}


# ==========================================
# WORKDAY EXCEPTION MANAGEMENT (Delegated)
# ==========================================

@router.get("/", response_model=List[WorkDay])
def read_workdays(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    setting_id: Optional[int] = None,
    user_id: Optional[int] = None,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    # If setting_id is not provided, resolve based on user_id or current_user
    if setting_id is None:
        from app.api.timesheets import get_workday_setting_id_for_user
        target_user_id = user_id if user_id is not None else current_user.id
        setting_id = get_workday_setting_id_for_user(session, target_user_id)

    query = select(WorkDay).where(WorkDay.setting_id == setting_id)
    if start_date:
        query = query.where(WorkDay.date >= start_date)
    if end_date:
        query = query.where(WorkDay.date <= end_date)
    return session.exec(query).all()

@router.post("/", response_model=WorkDay)
def update_workday(
    data: WorkDayExceptionCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    # Verify permission for target setting profile
    check_workday_modify_permission(session, current_user, data.setting_id)
    
    # Ensure date format is correct
    target_date = data.date
    if isinstance(target_date, str):
        target_date = date.fromisoformat(target_date)

    existing = session.exec(
        select(WorkDay)
        .where(WorkDay.setting_id == data.setting_id)
        .where(WorkDay.date == target_date)
    ).first()
    
    if existing:
        existing.day_type = data.day_type
        existing.remark = data.remark
        session.add(existing)
        session.commit()
        session.refresh(existing)
        return existing
    else:
        new_exception = WorkDay(
            setting_id=data.setting_id,
            date=target_date,
            day_type=data.day_type,
            remark=data.remark
        )
        session.add(new_exception)
        session.commit()
        session.refresh(new_exception)
        return new_exception

@router.delete("/{setting_id}/{date_str}")
def delete_workday(
    setting_id: int,
    date_str: str,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    check_workday_modify_permission(session, current_user, setting_id)
    
    try:
        d = date.fromisoformat(date_str)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format")

    existing = session.exec(
        select(WorkDay)
        .where(WorkDay.setting_id == setting_id)
        .where(WorkDay.date == d)
    ).first()
    
    if existing:
        session.delete(existing)
        session.commit()
    return {"ok": True}

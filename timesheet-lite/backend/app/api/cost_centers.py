# -*- coding: utf-8 -*-
# API Contract
# WARNING: This is a strict contract file generated according to .agents/rules/20-api-contract.md.
# DO NOT modify manually without aligning both UI and Worker architectures.

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional
from sqlmodel import Session, select, func
from app.database import get_session
from app.api.deps import get_current_user
from app.models import User, Role, CostCenter, WorkDaySetting

router = APIRouter()

class CostCenterAdd(BaseModel):
    name: str

class CostCenterSettingUpdate(BaseModel):
    workday_setting_id: Optional[int] = None

@router.get("/", response_model=List[CostCenter])
def get_cost_centers(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    # Any authenticated user can read the list of cost centers
    return session.exec(select(CostCenter)).all()

@router.post("/", response_model=List[CostCenter])
def add_cost_center(
    item: CostCenterAdd,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    if current_user.role != Role.ADMIN:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    name_stripped = item.name.strip()
    if not name_stripped:
        raise HTTPException(status_code=400, detail="Cost center name cannot be empty")
        
    existing = session.exec(select(CostCenter).where(CostCenter.name == name_stripped)).first()
    if not existing:
        session.add(CostCenter(name=name_stripped))
        session.commit()
    
    return session.exec(select(CostCenter)).all()

@router.delete("/{name}", response_model=List[CostCenter])
def delete_cost_center(
    name: str,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    if current_user.role != Role.ADMIN:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    total_count = session.exec(select(func.count(CostCenter.id))).one()
    if total_count <= 1:
        raise HTTPException(status_code=400, detail="Cannot delete the last cost center")
        
    # Check if in use
    user_using = session.exec(
        select(User)
        .where(User.cost_center == name)
        .where(User.is_deleted == False)
    ).first()
    if user_using:
        raise HTTPException(status_code=400, detail="Cannot delete a cost center that is currently assigned to users")
        
    cc = session.exec(select(CostCenter).where(CostCenter.name == name)).first()
    if cc:
        session.delete(cc)
        session.commit()
        
    return session.exec(select(CostCenter)).all()

@router.put("/{name}/setting", response_model=List[CostCenter])
def update_cost_center_setting(
    name: str,
    data: CostCenterSettingUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    if current_user.role != Role.ADMIN:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    cc = session.exec(select(CostCenter).where(CostCenter.name == name)).first()
    if not cc:
        raise HTTPException(status_code=404, detail="Cost Center not found")
        
    if data.workday_setting_id is not None:
        profile = session.get(WorkDaySetting, data.workday_setting_id)
        if not profile:
            raise HTTPException(status_code=400, detail="Invalid workday setting profile ID")
            
    cc.workday_setting_id = data.workday_setting_id
    session.add(cc)
    session.commit()
    
    return session.exec(select(CostCenter)).all()

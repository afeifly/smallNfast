from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List
import json
import os
from app.api.deps import get_current_user
from app.models import User, Role

router = APIRouter()

DATA_FILE = "backend/data/cost_centers.json"

class CostCenterAdd(BaseModel):
    name: str

def load_cost_centers():
    if not os.path.exists(DATA_FILE):
        return []
    with open(DATA_FILE, "r") as f:
        return json.load(f)

def save_cost_centers(data):
    # Ensure directory exists
    os.makedirs(os.path.dirname(DATA_FILE), exist_ok=True)
    with open(DATA_FILE, "w") as f:
        json.dump(data, f, indent=4)

@router.get("/", response_model=List[str])
def get_cost_centers(current_user: User = Depends(get_current_user)):
    # Any authenticated user can read the list
    return load_cost_centers()

@router.post("/", response_model=List[str])
def add_cost_center(
    item: CostCenterAdd,
    current_user: User = Depends(get_current_user)
):
    if current_user.role != Role.ADMIN:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    data = load_cost_centers()
    if item.name not in data:
        data.append(item.name)
        save_cost_centers(data)
    return data

@router.delete("/{name}", response_model=List[str])
def delete_cost_center(
    name: str,
    current_user: User = Depends(get_current_user)
):
    if current_user.role != Role.ADMIN:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    data = load_cost_centers()
    
    if len(data) <= 1:
        raise HTTPException(status_code=400, detail="Cannot delete the last cost center")
        
    if name in data:
        data.remove(name)
        save_cost_centers(data)
        
    return data

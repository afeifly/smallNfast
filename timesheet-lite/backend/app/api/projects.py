from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select, col, func
from app.database import get_session
from app.models import Project, User, ActivityLog, Role, Timesheet
from app.api.deps import get_current_user, get_current_admin_user

router = APIRouter()

@router.get("/", response_model=List[Project])
def read_projects(
    skip: int = 0, 
    limit: int = 100, 
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    query = select(Project).where(Project.is_deleted == False)
    
    # Allow all users to see all projects (read-only for non-admins handled in frontend/backend write ops)
    # if current_user.role != Role.ADMIN:
    #     # Filter: Default projects OR Assigned projects
    #     # We need to join with UserProjectLink or check ID in list
    #     # Easiest way with SQLModel/SQLAlchemy:
    #     # WHERE is_default = True OR id IN (select project_id from userprojectlink where user_id = current_user.id)
        
    #     # Since SQLModel relationships load objects, we can also use python filtering if list is small, 
    #     # but better to do in DB.
    #     # Let's use the relationship.
        
    #     # Actually, simpler query:
    #     # Select projects where is_default is True
    #     # UNION
    #     # Select projects joined with current_user
        
    #     # Let's try to construct a single query if possible, or just fetch both and merge in python (easier for now given complexity)
    #     # But for pagination, DB query is better.
        
    #     # Using `user.projects` relationship from the model
    #     # But we need to combine with default projects.
        
    #     # Let's do it via IDs
    #     assigned_project_ids = [p.id for p in current_user.projects]
        
    #     query = query.where(
    #         (Project.is_default == True) | 
    #         (col(Project.id).in_(assigned_project_ids))
    #     )
        
    return session.exec(query.offset(skip).limit(limit)).all()

@router.post("/", response_model=Project)
def create_project(
    project: Project, 
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_admin_user)
):
    db_project = session.exec(select(Project).where(Project.name == project.name)).first()
    if db_project:
        raise HTTPException(status_code=400, detail="Project already exists")
    
    # Manually convert date strings to date objects if needed
    # This is needed because SQLite driver is strict and Pydantic/SQLModel might pass strings if not validated strictly enough or if using mixed types
    from datetime import datetime
    
    if isinstance(project.start_date, str):
        project.start_date = datetime.strptime(project.start_date, "%Y-%m-%d").date()
    if isinstance(project.plan_closed_date, str):
        project.plan_closed_date = datetime.strptime(project.plan_closed_date, "%Y-%m-%d").date()
    if isinstance(project.actual_closed_date, str):
        project.actual_closed_date = datetime.strptime(project.actual_closed_date, "%Y-%m-%d").date()
        
    session.add(project)
    session.commit()
    session.refresh(project)
    
    # Log activity
    log = ActivityLog(user_id=current_user.id, action="CREATE_PROJECT", details=f"Created project {project.name}")
    session.add(log)
    session.commit()
    
    return project

@router.delete("/{project_id}")
def delete_project(
    project_id: int, 
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_admin_user)
):
    project = session.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    if project.is_default:
        raise HTTPException(status_code=400, detail="Cannot delete default projects")
        
    project.is_deleted = True
    session.add(project)
    session.commit()
    
    # Log activity
    log = ActivityLog(user_id=current_user.id, action="DELETE_PROJECT", details=f"Soft deleted project {project.name}")
    session.add(log)
    session.commit()
    
    return {"ok": True}

@router.put("/{project_id}", response_model=Project)
def update_project(
    project_id: int,
    project_update: Project,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_admin_user)
):
    db_project = session.get(Project, project_id)
    if not db_project:
        raise HTTPException(status_code=404, detail="Project not found")
        
    project_data = project_update.dict(exclude_unset=True)
    
    # Handle date conversion for updates too
    from datetime import datetime
    for date_field in ['start_date', 'plan_closed_date', 'actual_closed_date']:
        if date_field in project_data and isinstance(project_data[date_field], str):
             project_data[date_field] = datetime.strptime(project_data[date_field], "%Y-%m-%d").date()

    for key, value in project_data.items():
        setattr(db_project, key, value)
        
    session.add(db_project)
    session.commit()
    session.refresh(db_project)
    
    log = ActivityLog(user_id=current_user.id, action="UPDATE_PROJECT", details=f"Updated project {db_project.name}")
    session.add(log)
    session.commit()
    
    return db_project

@router.get("/{project_id}/stats")
def get_project_stats(
    project_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    project = session.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
        
    # Get all verified timesheets for this project
    timesheets = session.exec(
        select(Timesheet)
        .where(Timesheet.project_id == project_id)
        .where(Timesheet.verify == True)
    ).all()
    
    # Aggregate by user
    user_hours = {}
    for t in timesheets:
        if t.user_id not in user_hours:
            user_hours[t.user_id] = 0
        user_hours[t.user_id] += t.hours
        
    # Get user details
    result = []
    total_all = 0
    for uid, hours in user_hours.items():
        user = session.get(User, uid)
        if user:
            result.append({
                "user_id": user.id,
                "username": user.username,
                "full_name": user.full_name,
                "hours": hours
            })
            total_all += hours
            
    # Sort by hours desc
    result.sort(key=lambda x: x["hours"], reverse=True)
            
    return {
        "project_name": project.name,
        "users": result,
        "total_all": total_all
    }

@router.get("/{project_id}/monthly-stats")
def get_project_monthly_stats(
    project_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    project = session.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    rows = session.exec(
        select(
            func.strftime('%Y-%m', Timesheet.date).label('year_month'),
            func.sum(Timesheet.hours).label('hours')
        )
        .where(Timesheet.project_id == project_id)
        .where(Timesheet.verify == True)
        .group_by(func.strftime('%Y-%m', Timesheet.date))
        .order_by(func.strftime('%Y-%m', Timesheet.date).desc())
    ).all()

    result = [{"year_month": row.year_month, "hours": row.hours} for row in rows]
    total_all = sum(row.hours for row in rows)

    return {
        "project_name": project.name,
        "months": result,
        "total_all": total_all
    }

@router.get("/{project_id}/users/{user_id}/stats-breakdown")
def get_project_user_stats_breakdown(
    project_id: int,
    user_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    project = session.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    weekly_rows = session.exec(
        select(
            func.strftime('%Y-%W', Timesheet.date).label('year_week'),
            func.sum(Timesheet.hours).label('hours')
        )
        .where(Timesheet.project_id == project_id)
        .where(Timesheet.user_id == user_id)
        .where(Timesheet.verify == True)
        .group_by(func.strftime('%Y-%W', Timesheet.date))
        .order_by(func.strftime('%Y-%W', Timesheet.date).desc())
    ).all()

    monthly_rows = session.exec(
        select(
            func.strftime('%Y-%m', Timesheet.date).label('year_month'),
            func.sum(Timesheet.hours).label('hours')
        )
        .where(Timesheet.project_id == project_id)
        .where(Timesheet.user_id == user_id)
        .where(Timesheet.verify == True)
        .group_by(func.strftime('%Y-%m', Timesheet.date))
        .order_by(func.strftime('%Y-%m', Timesheet.date).desc())
    ).all()

    weekly = []
    for row in weekly_rows:
        try:
            year, week = row.year_week.split('-')
            # strftime('%W') is 0-indexed (00-53), shift by 1 to make it 1-indexed (01-54)
            adjusted_week = f"{year}-{int(week) + 1:02d}"
        except:
            adjusted_week = row.year_week
        weekly.append({"year_week": adjusted_week, "hours": row.hours})
        
    monthly = [{"year_month": row.year_month, "hours": row.hours} for row in monthly_rows]

    return {
        "weekly": weekly,
        "monthly": monthly
    }

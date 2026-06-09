from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select
from app.database import get_session
from app.models import User, Role, Project, UserProjectLink, ActivityLog
from app.api.deps import get_current_admin_user, get_current_user
from app.core.security import get_password_hash
from app.services.email_service import check_timesheet_compliance
from datetime import date, timedelta
from sqlalchemy import func
from app.models import Timesheet
from pydantic import BaseModel, Field
from datetime import datetime
from typing import List

router = APIRouter()

class PasswordChange(BaseModel):
    current_password: str
    new_password: str = Field(min_length=6, max_length=16)

@router.get("/", response_model=List[User])
def read_users(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    query = select(User).where(User.is_deleted == False)
    if current_user.role == Role.TEAM_LEADER:
        query = query.where(User.team_leader_id == current_user.id)
    
    users = session.exec(query).all()
    return users

@router.post("/", response_model=User)
def create_user(
    user: User,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    # Permission check
    if current_user.role != Role.ADMIN and current_user.role != Role.TEAM_LEADER:
        raise HTTPException(status_code=403, detail="Not authorized to create users")
    
    if current_user.role == Role.TEAM_LEADER:
        if user.role != Role.EMPLOYEE:
            raise HTTPException(status_code=403, detail="Team Leaders can only create Employees")
        # Force team assignment
        user.team_leader_id = current_user.id

    existing_user = session.exec(select(User).where(User.username == user.username)).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Username already registered")
    
    # Parse date strings if needed
    if isinstance(user.start_date, str):
        user.start_date = datetime.strptime(user.start_date, "%Y-%m-%d").date()
    if isinstance(user.end_date, str):
        user.end_date = datetime.strptime(user.end_date, "%Y-%m-%d").date()
    
    user.password_hash = get_password_hash(user.password_hash)
    session.add(user)
    session.commit()
    session.refresh(user)
    
    # Log activity
    log = ActivityLog(user_id=current_user.id, action="CREATE_USER", details=f"Created user {user.username}")
    session.add(log)
    session.commit()
    
    return user

@router.delete("/{user_id}")
def delete_user(
    user_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_admin_user),
):
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    
    user.is_deleted = True
    session.add(user)
    session.commit()
    
    # Log activity
    log = ActivityLog(user_id=current_user.id, action="DELETE_USER", details=f"Soft deleted user {user.username}")
    session.add(log)
    session.commit()
    
    return {"ok": True}

@router.put("/{user_id}", response_model=User)
def update_user(
    user_id: int,
    user_update: User,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    db_user = session.get(User, user_id)
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")

    # Permission check
    is_admin = current_user.role == Role.ADMIN
    is_team_leader = current_user.role == Role.TEAM_LEADER
    
    if not is_admin and not is_team_leader:
        raise HTTPException(status_code=403, detail="Not authorized")

    if is_team_leader:
        # Check target user role
        if db_user.role != Role.EMPLOYEE:
             raise HTTPException(status_code=403, detail="Team Leaders can only edit Employees")
        
        # Check ownership
        if db_user.team_leader_id != current_user.id:
             raise HTTPException(status_code=403, detail="Can only edit your own team members")

        # Check if trying to change role
        user_data_check = user_update.dict(exclude_unset=True)
        if 'role' in user_data_check and user_data_check['role'] != Role.EMPLOYEE:
             raise HTTPException(status_code=403, detail="Team Leaders cannot change user roles")
             
        # Prevent changing team_leader_id (transferring out)
        if 'team_leader_id' in user_data_check and user_data_check['team_leader_id'] != current_user.id:
             # Allow setting to None? Or restrict strictly?
             # For now, restrict strictly to self.
             raise HTTPException(status_code=403, detail="Cannot transfer users out of team")
        
    user_data = user_update.dict(exclude_unset=True, exclude={'id', 'password_hash'})
    
    # Handle team_leader_id update if present
    if 'team_leader_id' in user_data:
        # Verify TL exists and has correct role
        if user_data['team_leader_id'] is not None:
             tl = session.get(User, user_data['team_leader_id'])
             if not tl or tl.role != Role.TEAM_LEADER:
                 raise HTTPException(status_code=400, detail="Invalid Team Leader")
    
    # Handle date conversion for updates
    for date_field in ['start_date', 'end_date']:
        if date_field in user_data and isinstance(user_data[date_field], str):
            user_data[date_field] = datetime.strptime(user_data[date_field], "%Y-%m-%d").date()

    for key, value in user_data.items():
        setattr(db_user, key, value)
        
    session.add(db_user)
    session.commit()
    session.refresh(db_user)
    
    log = ActivityLog(user_id=current_user.id, action="UPDATE_USER", details=f"Updated user {db_user.username}")
    session.add(log)
    session.commit()
    
    return db_user

@router.put("/me/password")
def change_password(
    password_data: PasswordChange,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    from app.core.security import verify_password
    if not verify_password(password_data.current_password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="Incorrect current password")
    
    current_user.password_hash = get_password_hash(password_data.new_password)
    session.add(current_user)
    session.commit()
    return {"ok": True}

@router.get("/me/compliance")
def get_my_compliance(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    # Calculate date range (last 2 full weeks)
    today = date.today()
    start_of_current_week = today - timedelta(days=today.weekday())
    start_date = start_of_current_week - timedelta(days=14)
    end_date = start_of_current_week - timedelta(days=3) # Friday of last week
    
    first_incomplete_date = None
    is_compliant = True
    
    current_check_date = start_date
    while current_check_date <= end_date:
        # Check only weekdays (Mon-Fri)
        if current_check_date.weekday() < 5:
            total_hours = session.exec(
                select(func.sum(Timesheet.hours))
                .where(Timesheet.user_id == current_user.id)
                .where(Timesheet.date == current_check_date)
            ).one()
            
            if total_hours is None:
                total_hours = 0
            
            if total_hours < 8:
                is_compliant = False
                first_incomplete_date = current_check_date
                break
        
        current_check_date += timedelta(days=1)
        
    return {
        "compliant": is_compliant,
        "first_incomplete_date": first_incomplete_date
    }

@router.get("/me/pending-approvals")
def get_pending_approvals(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    # Only for team leaders
    if current_user.role != Role.TEAM_LEADER:
        return {"has_pending": False}
    
    # Check if any employee has unapproved timesheets
    has_pending = session.exec(
        select(Timesheet)
        .join(User)
        .where(User.team_leader_id == current_user.id)
        .where(Timesheet.hours > 0)
        .where(Timesheet.verify == False)
    ).first()
    
    return {"has_pending": has_pending is not None}

@router.post("/{user_id}/projects/{project_id}")
def assign_project(
    user_id: int,
    project_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    user = session.get(User, user_id)
    project = session.get(Project, project_id)
    if not user or not project:
        raise HTTPException(status_code=404, detail="User or Project not found")
        
    # Permission check
    is_admin = current_user.role == Role.ADMIN
    is_team_leader = current_user.role == Role.TEAM_LEADER and user.team_leader_id == current_user.id
    
    if not (is_admin or is_team_leader):
        raise HTTPException(status_code=403, detail="Not authorized to assign projects")
    
    # Check if already assigned
    link = session.exec(select(UserProjectLink).where(
        UserProjectLink.user_id == user_id,
        UserProjectLink.project_id == project_id
    )).first()
    
    if link:
        return {"ok": True, "message": "Already assigned"}
        
    link = UserProjectLink(user_id=user_id, project_id=project_id)
    session.add(link)
    session.commit()
    
    # Log activity
    log = ActivityLog(user_id=current_user.id, action="ASSIGN_PROJECT", details=f"Assigned project {project.name} to {user.username}")
    session.add(log)
    session.commit()
    
    return {"ok": True}

@router.delete("/{user_id}/projects/{project_id}")
def unassign_project(
    user_id: int,
    project_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    # Permission check (Need to fetch user first to check TL)
    user = session.get(User, user_id)
    if not user:
         raise HTTPException(status_code=404, detail="User not found")

    is_admin = current_user.role == Role.ADMIN
    is_team_leader = current_user.role == Role.TEAM_LEADER and user.team_leader_id == current_user.id
    
    if not (is_admin or is_team_leader):
        raise HTTPException(status_code=403, detail="Not authorized to unassign projects")

    link = session.exec(select(UserProjectLink).where(
        UserProjectLink.user_id == user_id,
        UserProjectLink.project_id == project_id
    )).first()
    
    if not link:
        raise HTTPException(status_code=404, detail="Assignment not found")
        
    # Get names for logging before delete
    user = session.get(User, user_id)
    project = session.get(Project, project_id)
        
    session.delete(link)
    session.commit()
    
    # Log activity
    if user and project:
        log = ActivityLog(user_id=current_user.id, action="UNASSIGN_PROJECT", details=f"Unassigned project {project.name} from {user.username}")
        session.add(log)
        session.commit()
        
    return {"ok": True}

@router.get("/{user_id}/projects", response_model=List[Project])
def get_user_projects(
    user_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    # Permission check
    is_self = current_user.id == user_id
    is_admin = current_user.role == Role.ADMIN
    is_team_leader = current_user.role == Role.TEAM_LEADER and user.team_leader_id == current_user.id
    
    if not (is_self or is_admin or is_team_leader):
        raise HTTPException(status_code=403, detail="Not authorized to view these projects")
        
    return user.projects

class ManagerUpdate(BaseModel):
    manager_id: int

@router.put("/{user_id}/manager", response_model=User)
def update_user_manager(
    user_id: int,
    manager_data: ManagerUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """
    Update the manager (team leader) for a user.
    Permissions:
    - Admin: Can assign manager for any user.
    - Team Leader:
        - Can assign a manager for THEMSELVES (Self-management).
        - Can assign a manager for their current subordinates (Transfer).
    """
    # 1. Get the target user
    db_user = session.get(User, user_id)
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")

    # 2. Get the new manager
    new_manager = session.get(User, manager_data.manager_id)
    if not new_manager:
        raise HTTPException(status_code=404, detail="New manager not found")
    
    if new_manager.role != Role.TEAM_LEADER and new_manager.role != Role.ADMIN:
        # Note: Usually managers are Team Leaders. Admins can also be managers technically if logic allows, 
        # but the request specifically focuses on Team Leader hierarchy. 
        # For safety/strictness based on "designate a team leader", we enforce TL role (or potential Admin if acts as TL).
        # Let's stick to 'must be TEAM_LEADER' based on 'designate a team leader'.
        if new_manager.role != Role.TEAM_LEADER:
             raise HTTPException(status_code=400, detail="Selected user is not a Team Leader")

    # 3. Check Permissions
    is_admin = current_user.role == Role.ADMIN
    is_self = current_user.id == user_id
    # Is the current user the EXISTING manager of the target user?
    is_current_manager = (
        current_user.role == Role.TEAM_LEADER 
        and db_user.team_leader_id == current_user.id
    )

    if not (is_admin or (is_self and current_user.role == Role.TEAM_LEADER) or is_current_manager):
        raise HTTPException(status_code=403, detail="Not authorized to assign manager for this user")
    
    # 4. Prevent circular dependency (Basic check: A cannot report to A, A cannot report to someone who reports to A)
    # Simple check: User cannot be their own manager
    if db_user.id == new_manager.id:
        raise HTTPException(status_code=400, detail="Cannot be your own manager")
        
    # Deeper circular check could be implemented here (A->B->A), skipping for now as per plan/req unless complexity needed.

    old_manager_id = db_user.team_leader_id
    db_user.team_leader_id = new_manager.id
    
    session.add(db_user)
    session.commit()
    session.refresh(db_user)
    
    # Log activity
    log = ActivityLog(
        user_id=current_user.id, 
        action="UPDATE_MANAGER", 
        details=f"Changed manager for {db_user.username} from ID {old_manager_id} to {new_manager.username}"
    )
    session.add(log)
    session.commit()
    
    return db_user

@router.get("/{user_id}/team-stats")
def get_user_team_stats(
    user_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user.role != Role.TEAM_LEADER:
        pass # allow viewing anyway, or keep it only for TLs. Wait, if it's "every one can see that" they mean everyone can see the Team Stats for team leaders.

    # Get team member IDs including the TL
    team_members = session.exec(select(User).where(User.team_leader_id == user_id)).all()
    team_ids = [m.id for m in team_members]
    team_ids.append(user_id)
    
    timesheets = session.exec(
        select(Timesheet)
        .where(Timesheet.user_id.in_(team_ids))
        .where(Timesheet.verify == True)
    ).all()
    
    project_stats = {}
    for ts in timesheets:
        if ts.project_id not in project_stats:
            proj = session.get(Project, ts.project_id)
            if not proj:
                continue
            project_stats[ts.project_id] = {
                "project_id": proj.id,
                "project_name": proj.name,
                "total_hours": 0,
                "weekly": {},
                "monthly": {}
            }
        
        project_stats[ts.project_id]["total_hours"] += ts.hours
        
    total_team_hours = sum(p["total_hours"] for p in project_stats.values())
    
    projects_list = []
    for p_id, p_data in project_stats.items():
        projects_list.append({
            "project_name": p_data["project_name"],
            "project_id": p_data["project_id"],
            "total_hours": round(p_data["total_hours"], 2)
        })
        
    projects_list.sort(key=lambda x: x["total_hours"], reverse=True)

    return {
        "total_team_hours": round(total_team_hours, 2),
        "projects": projects_list
    }

@router.get("/{user_id}/team-stats/projects/{project_id}/breakdown")
def get_team_stats_breakdown(
    user_id: int,
    project_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    team_members = session.exec(select(User).where(User.team_leader_id == user_id)).all()
    team_ids = [m.id for m in team_members]
    team_ids.append(user_id)

    timesheets = session.exec(
        select(Timesheet)
        .where(Timesheet.user_id.in_(team_ids))
        .where(Timesheet.project_id == project_id)
        .where(Timesheet.verify == True)
    ).all()
    
    weekly_stats = {}
    monthly_stats = {}
    
    for ts in timesheets:
        try:
            year, week = ts.date.strftime('%Y-%W').split('-')
            year_week = f"{year}-{int(week) + 1:02d}"
        except:
            year_week = ts.date.strftime('%Y-%W')
            
        if year_week not in weekly_stats:
            weekly_stats[year_week] = 0
        weekly_stats[year_week] += ts.hours
        
        year_month = ts.date.strftime('%Y-%m')
        if year_month not in monthly_stats:
            monthly_stats[year_month] = 0
        monthly_stats[year_month] += ts.hours

    weekly_list = [{"year_week": k, "hours": round(v, 2)} for k, v in sorted(weekly_stats.items(), reverse=True)]
    monthly_list = [{"year_month": k, "hours": round(v, 2)} for k, v in sorted(monthly_stats.items(), reverse=True)]

    return {
        "weekly": weekly_list,
        "monthly": monthly_list
    }


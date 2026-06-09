from typing import List, Optional
from datetime import date, timedelta
from fastapi import APIRouter, Depends
from sqlmodel import Session, select, func
from app.database import get_session
from app.models import Timesheet, User, Project, Role
from app.api.deps import get_current_admin_user, get_current_user

router = APIRouter()

@router.get("/weekly")
def get_weekly_report(
    start_date: date,
    end_date: date,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    # Get all users (exclude admins since they cannot log work)
    users = session.exec(
        select(User)
        .where(User.is_deleted == False)
        .where(User.role != Role.ADMIN)
    ).all()
    
    # Get all projects
    projects = session.exec(select(Project).where(Project.is_deleted == False)).all()
    
    # Get all VERIFIED timesheets for the date range
    timesheets = session.exec(
        select(Timesheet)
        .where(Timesheet.date >= start_date)
        .where(Timesheet.date <= end_date)
        .where(Timesheet.verify == True)
    ).all()
    
    # Build report data: users as rows, projects as columns
    report_data = []
    for user in users:
        user_row = {
            "user_id": user.id,
            "username": user.username,
            "full_name": user.full_name or "",
            "cost_center": user.cost_center or "",
            "remark": user.remark or "",
            "start_date": user.start_date.isoformat() if user.start_date else "",
            "end_date": user.end_date.isoformat() if user.end_date else "",
            "projects": {},
            "total_hours": 0
        }
        
        # Calculate hours per project for this user
        user_timesheets = [t for t in timesheets if t.user_id == user.id]
        for timesheet in user_timesheets:
            project_id = timesheet.project_id
            project = next((p for p in projects if p.id == project_id), None)
            if project:
                project_name = project.name
                if project_name not in user_row["projects"]:
                    user_row["projects"][project_name] = 0
                user_row["projects"][project_name] += timesheet.hours
                user_row["total_hours"] += timesheet.hours
        
        report_data.append(user_row)
    
    # Get list of all projects with details, sorted: custom projects first, default last
    sorted_projects = sorted(projects, key=lambda p: (p.is_default, p.name))
    project_details = []
    for p in sorted_projects:
        project_details.append({
            "name": p.name,
            "full_name": p.full_name or "",
            "chinese_name": p.chinese_name or "",
            "id": p.id,
            "custom_id": p.custom_id,
            "start_date": p.start_date.isoformat() if p.start_date else "",
            "plan_closed_date": p.plan_closed_date.isoformat() if p.plan_closed_date else "",
            "is_default": p.is_default
        })
    
    return {
        "users": report_data,
        "projects": project_details
    }


@router.get("/stats")
def get_dashboard_stats(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_admin_user)
):
    total_users = session.exec(select(func.count(User.id)).where(User.is_deleted == False)).one()
    total_projects = session.exec(select(func.count(Project.id)).where(Project.is_deleted == False).where(Project.is_default == False)).one()
    
    # Recent activity?
    # We can add more stats here.
    
    return {
        "total_users": total_users,
        "total_projects": total_projects
    }

@router.get("/user_stats")
def get_user_stats(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    # Get all VERIFIED timesheets for the current user
    timesheets = session.exec(
        select(Timesheet)
        .where(Timesheet.user_id == current_user.id)
        .where(Timesheet.verify == True)
    ).all()
    
    total_hours = sum(t.hours for t in timesheets)
    
    # Calculate hours per project
    project_hours = {}
    for t in timesheets:
        if t.project_id not in project_hours:
            project_hours[t.project_id] = 0
        project_hours[t.project_id] += t.hours
        
    # Get project details - include ALL projects for the chart
    all_projects_data = []
    custom_projects_count = 0
    
    for pid, hours in project_hours.items():
        project = session.get(Project, pid)
        if project:
            percentage = (hours / total_hours * 100) if total_hours > 0 else 0
            all_projects_data.append({
                "name": project.name,
                "full_name": project.full_name,
                "hours": hours,
                "percentage": round(percentage, 1),
                "is_default": project.is_default
            })
            # Count only custom projects
            if not project.is_default:
                custom_projects_count += 1
            
    # Sort by hours desc
    all_projects_data.sort(key=lambda x: x["hours"], reverse=True)
    
    return {
        "total_hours": total_hours,
        "projects_count": custom_projects_count,  # Only custom projects
        "projects": all_projects_data  # All projects for chart
    }

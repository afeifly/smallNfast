from typing import List, Optional
from datetime import date, timedelta, datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select, func
from app.database import get_session
from app.models import Timesheet, User, ActivityLog, Role, Project, WorkDay, WorkDayType
from app.api.deps import get_current_user

router = APIRouter()

@router.get("/", response_model=List[Timesheet])
def read_timesheets(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    user_id: Optional[int] = None,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    query = select(Timesheet)
    
    # If employee, can only see own. If admin, can see specified user_id or all.
    if current_user.role == Role.EMPLOYEE:
        query = query.where(Timesheet.user_id == current_user.id)
    elif user_id:
        query = query.where(Timesheet.user_id == user_id)
    else:
        # Default to current user's timesheets if no user_id specified (even for Admin/TL)
        # Unless we want a specific "get all" endpoint, but usually /timesheets/ is for the current context.
        # If Admin wants to see all, they should probably use a specific filter or we assume they want their own.
        # Given the bug report "login as TL, see employee work", this is the fix.
        query = query.where(Timesheet.user_id == current_user.id)
        
    if start_date:
        query = query.where(Timesheet.date >= start_date)
    if end_date:
        query = query.where(Timesheet.date <= end_date)
        
    return session.exec(query).all()

def upsert_timesheet_logic(session: Session, timesheet: Timesheet, current_user: User):
    # Validate user permissions
    if current_user.role == Role.ADMIN:
        raise HTTPException(status_code=403, detail="Admins cannot log work")

    if current_user.role == Role.EMPLOYEE and timesheet.user_id != current_user.id:
         raise HTTPException(status_code=403, detail="Cannot log time for others")
    
    # Auto-verify logic: Employee always False. TL/Admin can set it (default from input).
    if current_user.role == Role.EMPLOYEE:
        timesheet.verify = False
    
    # Check if entry exists for this project/date/user
    if isinstance(timesheet.date, str):
        timesheet.date = datetime.strptime(timesheet.date, "%Y-%m-%d").date()
        
    existing_entries = session.exec(
        select(Timesheet)
        .where(Timesheet.user_id == timesheet.user_id)
        .where(Timesheet.project_id == timesheet.project_id)
        .where(Timesheet.date == timesheet.date)
    ).all()
    
    # Check Weekly Limit
    start_of_week = timesheet.date - timedelta(days=timesheet.date.weekday())
    end_of_week = start_of_week + timedelta(days=6)
    
    # Check for OFF day
    current_workday = session.get(WorkDay, timesheet.date)
    if current_workday and current_workday.day_type == WorkDayType.OFF:
        raise HTTPException(status_code=400, detail="Cannot log work on an off day")
    
    # Calculate Dynamic Weekly Limit
    limit = 0.0
    
    week_exceptions = session.exec(
        select(WorkDay)
        .where(WorkDay.date >= start_of_week)
        .where(WorkDay.date <= end_of_week)
    ).all()

    # Create a map of exceptions for easy lookup
    exceptions_map = {ex.date: ex.day_type for ex in week_exceptions}
    
    # Iterate through each day of the week (0=Mon, 6=Sun)
    current_day_date = start_of_week
    for i in range(7):
        day_type = exceptions_map.get(current_day_date)
        
        # Default Logic if no exception
        if not day_type:
            if i < 5: # Mon-Fri
                day_type = WorkDayType.WORK
            else: # Sat-Sun
                day_type = WorkDayType.OFF
        
        # Add hours based on type
        if day_type == WorkDayType.WORK:
            limit += 8.0
        elif day_type == WorkDayType.HALF_OFF:
            limit += 4.0
        # OFF adds 0
        
        current_day_date += timedelta(days=1)
            
    # Calculate current weekly hours
    weekly_hours = session.exec(
        select(func.sum(Timesheet.hours))
        .where(Timesheet.user_id == timesheet.user_id)
        .where(Timesheet.date >= start_of_week)
        .where(Timesheet.date <= end_of_week)
    ).one() or 0

    # If updating existing entry, subtract its current hours from weekly total
    if existing_entries:
        for entry in existing_entries:
            weekly_hours -= entry.hours
    
    if weekly_hours + timesheet.hours > limit:
        raise HTTPException(status_code=400, detail=f"Weekly limit exceeded. Limit: {limit}h, Current: {weekly_hours}h, Requested: {timesheet.hours}h")

    # Pre-planning check
    today = date.today()
    start_of_current_week = today - timedelta(days=today.weekday())
    # Allow editing for current week AND previous 2 weeks.
    cutoff_date = start_of_current_week - timedelta(weeks=2)
    
    if timesheet.date < cutoff_date and current_user.role not in [Role.ADMIN, Role.TEAM_LEADER]:
        raise HTTPException(status_code=403, detail="Cannot modify timesheets older than 2 weeks")
    
    # Fetch project name for logging
    project = session.get(Project, timesheet.project_id)
    project_name = project.name if project else "Unknown"

    if existing_entries:
        # Update existing
        target_entry = existing_entries[0]
        duplicates = existing_entries[1:]
        
        for dup in duplicates:
             session.delete(dup)
        
        # Check verification status
        if target_entry.verify:
            if current_user.role == Role.EMPLOYEE:
                raise HTTPException(status_code=403, detail="Cannot modify verified timesheet")
            
        target_entry.hours = timesheet.hours
        # Update verify status if provided (and allowed)
        if current_user.role in [Role.TEAM_LEADER, Role.ADMIN]:
             target_entry.verify = timesheet.verify
             
        target_entry.updated_at = datetime.utcnow()
        session.add(target_entry)
        session.refresh(target_entry)
        
        log = ActivityLog(user_id=current_user.id, action="UPDATE_TIMESHEET", details=f"Updated {timesheet.hours}h for project '{project_name}' (ID: {timesheet.project_id}) on {timesheet.date}")
        session.add(log)
        return target_entry
    else:
        session.add(timesheet)
        # We need to flush here to ensure the ID is generated if we need it,
        # and more importantly, so subsequent queries in this transaction see it.
        session.flush() 
        session.refresh(timesheet)
        
        log = ActivityLog(user_id=current_user.id, action="CREATE_TIMESHEET", details=f"Logged {timesheet.hours}h for project '{project_name}' (ID: {timesheet.project_id}) on {timesheet.date}")
        session.add(log)
        return timesheet

@router.post("/", response_model=Timesheet)
def create_timesheet(
    timesheet: Timesheet,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    result = upsert_timesheet_logic(session, timesheet, current_user)
    session.commit()
    session.refresh(result)
    return result

@router.post("/batch", response_model=List[Timesheet])
def batch_create_timesheet(
    timesheets: List[Timesheet],
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    if not timesheets:
        return []
        
    # All timesheets must differ only by project/date, must be same user
    # Actually payload can be whatever, but we enforce same user check if employee
    target_user_id = timesheets[0].user_id
    if any(t.user_id != target_user_id for t in timesheets):
        raise HTTPException(status_code=400, detail="Batch must be for single user")
        
    if current_user.role == Role.EMPLOYEE and target_user_id != current_user.id:
         raise HTTPException(status_code=403, detail="Cannot log time for others")

    # Limit Validation: 30 days
    if current_user.role == Role.EMPLOYEE:
        cutoff_date = date.today() - timedelta(days=30)
        for t in timesheets:
             # Normalize date if needed (it's done below too, but we need it now)
             check_date = t.date
             if isinstance(check_date, str):
                 check_date = datetime.strptime(check_date, "%Y-%m-%d").date()
             
             if check_date < cutoff_date:
                  raise HTTPException(status_code=400, detail="Cannot log work older than 30 days")

    # Group by week to validate limits per week
    # Assuming standard ISO week Monday start.
    # We can handle multiple weeks by iterating.
    
    # Map: week_start_date -> list of updates
    updates_by_week = {}
    
    for ts in timesheets:
        # Normalize date
        if isinstance(ts.date, str):
            ts.date = datetime.strptime(ts.date, "%Y-%m-%d").date()
            
        start_of_week = ts.date - timedelta(days=ts.date.weekday())
        if start_of_week not in updates_by_week:
            updates_by_week[start_of_week] = []
        updates_by_week[start_of_week].append(ts)
        
    # Process each week
    final_results = []
    
    for start_of_week, batch_updates in updates_by_week.items():
        end_of_week = start_of_week + timedelta(days=6)
        
        # 1. Fetch WorkDay Exceptions for this week
        week_exceptions = session.exec(
            select(WorkDay)
            .where(WorkDay.date >= start_of_week)
            .where(WorkDay.date <= end_of_week)
        ).all()
        exceptions_map = {ex.date: ex.day_type for ex in week_exceptions}
        
        # 2. Calculate Weekly Limit for this week
        limit = 0.0
        current_day = start_of_week
        for i in range(7):
            d_type = exceptions_map.get(current_day)
            if not d_type:
                d_type = WorkDayType.WORK if i < 5 else WorkDayType.OFF
            
            if d_type == WorkDayType.WORK:
                limit += 8.0
            elif d_type == WorkDayType.HALF_OFF:
                limit += 4.0
            current_day += timedelta(days=1)
            
        # 3. Fetch ALL existing timesheets for this user/week
        existing_logs = session.exec(
            select(Timesheet)
            .where(Timesheet.user_id == target_user_id)
            .where(Timesheet.date >= start_of_week)
            .where(Timesheet.date <= end_of_week)
        ).all()

        # 3a. Cleanup: Remove any existing 0-hour records for this week
        # This fixes the issue where 0-hour records prevent verification
        zero_hour_records = [t for t in existing_logs if t.hours == 0]
        for zr in zero_hour_records:
             session.delete(zr)
             # Remove from our local list so we don't process them below
             existing_logs.remove(zr)
        
        
        # 4. Simulate State
        # Map: (date, project_id) -> hours
        # Use a dict to represent the week's state
        # Initialize with existing
        week_state = {} #(date, project_id) -> entry object (or dict)
        
        existing_entries_map = {} # To track actual DB objects for updates
        
        for entry in existing_logs:
            key = (entry.date, entry.project_id)
            week_state[key] = entry.hours
            existing_entries_map[key] = entry
            
        # Apply updates
        for update in batch_updates:
            # Validate OFF day
            day_type = exceptions_map.get(update.date)
            if not day_type:
                day_type = WorkDayType.WORK if update.date.weekday() < 5 else WorkDayType.OFF
            
            if day_type == WorkDayType.OFF and update.hours > 0:
                 raise HTTPException(status_code=400, detail=f"Cannot log work on an off day ({update.date})")
            
            key = (update.date, update.project_id)
            week_state[key] = update.hours # value from batch overwrites existing
            
        # 5. Calculate Total
        total_hours = sum(week_state.values())
        
        if total_hours > limit:
            debug_info = ", ".join([f"{k[0]}:{k[1]}={v}" for k, v in week_state.items() if v > 0])
            raise HTTPException(status_code=400, detail=f"Weekly limit exceeded. Limit: {limit}h, Current: {total_hours}h. Breakdown: {debug_info}")

        # 6. Apply to DB
        for update in batch_updates:
            key = (update.date, update.project_id)
            existing = existing_entries_map.get(key)
            
            if existing:
                # Update
                # Check verifications
                if existing.verify and current_user.role == Role.EMPLOYEE:
                     raise HTTPException(status_code=403, detail="Cannot modify verified timesheet")
                
                # If hours is 0, DELETE the record
                if update.hours == 0:
                    session.delete(existing)
                    # We don't append to final_results as it's gone
                else:
                    existing.hours = update.hours
                    if current_user.role in [Role.TEAM_LEADER, Role.ADMIN]:
                        existing.verify = update.verify
                    existing.updated_at = datetime.utcnow()
                    session.add(existing)
                    final_results.append(existing)
            else:
                # Create
                if update.hours > 0:
                    # Auto verify logic from upsert_timesheet_logic
                    if current_user.role == Role.EMPLOYEE:
                        update.verify = False
                    
                    session.add(update)
                    final_results.append(update)
                # Add to existing map if we process duplicates in same batch? 
                # Our week_state logic handles 'last one wins' for duplicates in batch.
                # But we should be careful if batch has multiple updates to same key.
                # The loop "for update in batch_updates" processes all.
                # If batch has 2 updates for same key, both try to update 'existing'. 
                # If 'existing' was null, first creates, second should update THE NEW ONE.
                # This complex case suggests we should deduplicate batch_updates by key first.
                
                # Update existing_entries_map so subsequent batch items see the new object
                existing_entries_map[key] = update
                
    session.commit()
    for res in final_results:
        session.refresh(res)
    return final_results

# Need to import datetime for updated_at
from datetime import datetime

from pydantic import BaseModel

class VerifyRequest(BaseModel):
    user_id: int
    date: date

@router.post("/verify")
def verify_day(
    request: VerifyRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    if current_user.role != Role.TEAM_LEADER:
        raise HTTPException(status_code=403, detail="Only Team Leaders can verify")
    
    # Check if user is assigned to this TL
    target_user = session.get(User, request.user_id)
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
        
    if target_user.team_leader_id != current_user.id:
        raise HTTPException(status_code=403, detail="User is not assigned to you")
        
    # Calculate total hours for that day
    if isinstance(request.date, str):
        request.date = datetime.strptime(request.date, "%Y-%m-%d").date()
        
    daily_hours = session.exec(
        select(func.sum(Timesheet.hours))
        .where(Timesheet.user_id == request.user_id)
        .where(Timesheet.date == request.date)
    ).one() or 0
    
    if daily_hours > 8:
        raise HTTPException(status_code=400, detail=f"Cannot verify > 8 hours (Current: {daily_hours}h)")
        
    # Update all entries to verify=True
    timesheets = session.exec(
        select(Timesheet)
        .where(Timesheet.user_id == request.user_id)
        .where(Timesheet.date == request.date)
    ).all()
    
    for t in timesheets:
        t.verify = True
        session.add(t)
        
    session.commit()
    return {"message": "Verified successfully"}


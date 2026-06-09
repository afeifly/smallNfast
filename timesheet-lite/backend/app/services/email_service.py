from sqlmodel import Session, select
from app.models import User, Role, SMTPSettings, Timesheet
from datetime import date, timedelta
from sqlalchemy import func
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

def check_timesheet_compliance(session: Session):
    settings = session.exec(select(SMTPSettings)).first()
    if not settings:
        return {"message": "SMTP settings not configured"}

    # Calculate date range (last 2 full weeks)
    today = date.today()
    start_of_current_week = today - timedelta(days=today.weekday())
    start_date = start_of_current_week - timedelta(days=14)
    end_date = start_of_current_week - timedelta(days=3) # Friday of last week
    
    # Get all non-admin users
    users = session.exec(select(User).where(User.role != Role.ADMIN, User.is_deleted == False)).all()
    
    incomplete_users = []
    
    for user in users:
        if not user.email:
            continue
            
        has_incomplete_day = False
        current_check_date = start_date
        while current_check_date <= end_date:
            # Check only weekdays (Mon-Fri)
            if current_check_date.weekday() < 5:
                # Check total hours for this day
                total_hours = session.exec(
                    select(func.sum(Timesheet.hours))
                    .where(Timesheet.user_id == user.id)
                    .where(Timesheet.date == current_check_date)
                ).one()
                
                if total_hours is None:
                    total_hours = 0
                
                if total_hours < 8:
                    has_incomplete_day = True
                    break
            
            current_check_date += timedelta(days=1)
            
        if has_incomplete_day:
            incomplete_users.append(user.email)
            
    if not incomplete_users:
        return {"message": "All users have completed their timesheets."}
        
    # Send email
    try:
        msg = MIMEMultipart()
        msg['From'] = settings.sender_email
        msg['To'] = settings.sender_email
        msg['Bcc'] = ", ".join(incomplete_users)
        msg['Subject'] = "Timesheet Reminder: Incomplete Timesheets"
        
        body = (
            "Dear friend,\n\n"
            "You have not completed your timesheet within the past two weeks. "
            "Please log in to https://timesheet.suto-portal.com to complete your timesheet.\n\n"
            "This is an automated reminder."
        )
        msg.attach(MIMEText(body, 'plain'))
        
        server = smtplib.SMTP(settings.smtp_server, settings.smtp_port)
        server.starttls()
        server.login(settings.smtp_username, settings.smtp_password)
        text = msg.as_string()
        recipients = [settings.sender_email] + incomplete_users
        server.sendmail(settings.sender_email, recipients, text)
        server.quit()
        
        return {"message": f"Reminder sent to {len(incomplete_users)} employees."}
    except Exception as e:
        return {"error": str(e)}

def check_approval_compliance(session: Session):
    settings = session.exec(select(SMTPSettings)).first()
    if not settings:
        return {"message": "SMTP settings not configured"}

    # Calculate date range (last 2 full weeks)
    today = date.today()
    start_of_current_week = today - timedelta(days=today.weekday())
    start_date = start_of_current_week - timedelta(days=14)
    end_date = start_of_current_week - timedelta(days=3) # Friday of last week
    
    # Get all Team Leaders
    team_leaders = session.exec(select(User).where(User.role == Role.TEAM_LEADER, User.is_deleted == False)).all()
    
    notify_list = []
    
    for tl in team_leaders:
        if not tl.email:
            continue
            
        has_unapproved = session.exec(
            select(Timesheet)
            .join(User)
            .where(User.team_leader_id == tl.id)
            .where(Timesheet.date >= start_date)
            .where(Timesheet.date <= end_date)
            .where(Timesheet.hours > 0)
            .where(Timesheet.verify == False)
        ).first()
        
        if has_unapproved:
            notify_list.append(tl.email)
            
    if not notify_list:
        return {"message": "All timesheets are approved."}
        
    # Send email
    try:
        msg = MIMEMultipart()
        msg['From'] = settings.sender_email
        msg['To'] = settings.sender_email
        msg['Bcc'] = ", ".join(notify_list)
        msg['Subject'] = "Timesheet Reminder: Pending Approvals"
        
        body = (
            "Dear friend,\n\n"
            "Your team has some time sheet records from the past two weeks that are waiting for your approval. "
            "Please log in to https://timesheet.suto-portal.com to complete the process.\n\n"
            "This is an automated reminder."
        )
        msg.attach(MIMEText(body, 'plain'))
        
        server = smtplib.SMTP(settings.smtp_server, settings.smtp_port)
        server.starttls()
        server.login(settings.smtp_username, settings.smtp_password)
        text = msg.as_string()
        recipients = [settings.sender_email] + notify_list
        server.sendmail(settings.sender_email, recipients, text)
        server.quit()
        
        return {"message": f"Reminder sent to {len(notify_list)} Team Leaders."}
    except Exception as e:
        return {"error": str(e)}

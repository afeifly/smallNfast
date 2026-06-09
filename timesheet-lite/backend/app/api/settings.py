from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from app.database import get_session
from app.models import SMTPSettings, User, Role
from app.api.deps import get_current_user
from pydantic import BaseModel
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import date, timedelta
from sqlalchemy import func, and_
from app.models import Timesheet
from app.services.email_service import check_timesheet_compliance as service_check_timesheet
from app.services.email_service import check_approval_compliance as service_check_approval

router = APIRouter()

class EmailTestRequest(BaseModel):
    recipient: str

@router.get("/email", response_model=SMTPSettings)
def get_email_settings(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    if current_user.role != Role.ADMIN:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    settings = session.exec(select(SMTPSettings)).first()
    if not settings:
        # Return empty settings if not configured
        return SMTPSettings(
            smtp_server="",
            smtp_port=587,
            smtp_username="",
            smtp_password="",
            sender_email=""
        )
    return settings

@router.put("/email", response_model=SMTPSettings)
def update_email_settings(
    settings: SMTPSettings,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    if current_user.role != Role.ADMIN:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    existing_settings = session.exec(select(SMTPSettings)).first()
    
    if existing_settings:
        existing_settings.smtp_server = settings.smtp_server
        existing_settings.smtp_port = settings.smtp_port
        existing_settings.smtp_username = settings.smtp_username
        existing_settings.smtp_password = settings.smtp_password
        existing_settings.sender_email = settings.sender_email
        existing_settings.checking_service_enabled = settings.checking_service_enabled
        session.add(existing_settings)
        session.commit()
        session.refresh(existing_settings)
        return existing_settings
    else:
        session.add(settings)
        session.commit()
        session.refresh(settings)
        return settings

@router.post("/email/test")
def send_test_email(
    request: EmailTestRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    if current_user.role != Role.ADMIN:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    settings = session.exec(select(SMTPSettings)).first()
    if not settings:
        raise HTTPException(status_code=400, detail="SMTP settings not configured")
        
    try:
        msg = MIMEMultipart()
        msg['From'] = settings.sender_email
        msg['To'] = request.recipient
        msg['Subject'] = "Test Email from Timesheet System"
        
        body = "This is a test email to verify your SMTP settings."
        msg.attach(MIMEText(body, 'plain'))
        
        server = smtplib.SMTP(settings.smtp_server, settings.smtp_port)
        server.starttls()
        server.login(settings.smtp_username, settings.smtp_password)
        text = msg.as_string()
        server.sendmail(settings.sender_email, request.recipient, text)
        server.quit()
        
        return {"message": "Test email sent successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/email/test-no-finish-timesheet")
def check_timesheet_compliance(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    if current_user.role != Role.ADMIN:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    result = service_check_timesheet(session)
    if "error" in result:
        raise HTTPException(status_code=500, detail=result["error"])
    return result

@router.post("/email/test-no-approval-notify")
def check_approval_compliance(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    if current_user.role != Role.ADMIN:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    result = service_check_approval(session)
    if "error" in result:
        raise HTTPException(status_code=500, detail=result["error"])
    return result

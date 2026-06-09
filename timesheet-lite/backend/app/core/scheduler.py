from apscheduler.schedulers.background import BackgroundScheduler
from app.database import engine
from sqlmodel import Session, select
from app.services.email_service import check_timesheet_compliance, check_approval_compliance
import logging

logging.basicConfig()
logging.getLogger('apscheduler').setLevel(logging.DEBUG)

def run_timesheet_check():
    with Session(engine) as session:
        from app.models import SMTPSettings
        settings = session.exec(select(SMTPSettings)).first()
        if settings and settings.checking_service_enabled:
            print("Running scheduled timesheet compliance check...")
            result = check_timesheet_compliance(session)
            print(f"Timesheet check result: {result}")
        else:
            print("Skipping scheduled timesheet check (disabled)")

def run_approval_check():
    with Session(engine) as session:
        from app.models import SMTPSettings
        settings = session.exec(select(SMTPSettings)).first()
        if settings and settings.checking_service_enabled:
            print("Running scheduled approval compliance check...")
            result = check_approval_compliance(session)
            print(f"Approval check result: {result}")
        else:
            print("Skipping scheduled approval check (disabled)")

def start_scheduler():
    scheduler = BackgroundScheduler()
    
    # Schedule jobs for Monday at 10:00 AM
    scheduler.add_job(run_timesheet_check, 'cron', day_of_week='mon', hour=10, minute=0)
    scheduler.add_job(run_approval_check, 'cron', day_of_week='mon', hour=10, minute=0)
    
    # Backup database every day at 3 Midnight (03:00)
    from app.services.backup_service import backup_database, clean_old_backups
    scheduler.add_job(backup_database, 'cron', hour=3, minute=0)
    # Cleanup old backups once a day at 03:30
    scheduler.add_job(clean_old_backups, 'cron', hour=3, minute=30, kwargs={'days': 30})
    
    scheduler.start()
    print("Scheduler started. Jobs scheduled for Monday 10:00 AM.")

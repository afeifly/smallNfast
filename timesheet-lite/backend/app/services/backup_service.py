import shutil
import os
from datetime import datetime, timedelta, date
import logging
from app.core.config import settings
from app.core.security import verify_password
from app.database import engine
from sqlmodel import Session, text
import base64

# Configure logging
logger = logging.getLogger(__name__)

BACKUP_DIR = "backups"
DB_FILE = "database.db"

def ensure_backup_dir():
    if not os.path.exists(BACKUP_DIR):
        os.makedirs(BACKUP_DIR)

def backup_database():
    """Creates a timestamped copy of the database."""
    ensure_backup_dir()
    timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    backup_filename = f"db_{timestamp}.sqlite"
    backup_path = os.path.join(BACKUP_DIR, backup_filename)
    
    try:
        # For SQLite, a simple file copy works, though WAL mode might have separate files.
        # Ideally we use the SQLite backup API, but for simple usage shutil.copy2 is often "good enough" 
        # if the DB isn't under extremely heavy write load. 
        # With WAL enabled, we should also grab -wal and -shm if they exist, or use the VACUUM INTO command.
        # VACUUM INTO is cleaner for live backups.
        
        with Session(engine) as session:
            # Requires SQLite 3.27+
            session.exec(text(f"VACUUM INTO '{backup_path}'"))
            
        logger.info(f"Database backed up successfully to {backup_path}")
        return backup_path
    except Exception as e:
        logger.error(f"Backup failed: {e}")
        # Fallback to copy if VACUUM INTO fails (e.g. old sqlite version)
        try:
            shutil.copy2(DB_FILE, backup_path)
            logger.info(f"Database backed up (fallback copy) to {backup_path}")
            return backup_path
        except Exception as copy_error:
            logger.error(f"Fallback backup failed: {copy_error}")
            return None

def clean_old_backups(days=30):
    """Deletes backups older than `days`."""
    ensure_backup_dir()
    cutoff_date = datetime.now() - timedelta(days=days)
    
    for filename in os.listdir(BACKUP_DIR):
        if not filename.endswith(".sqlite"):
            continue
            
        file_path = os.path.join(BACKUP_DIR, filename)
        file_mtime = datetime.fromtimestamp(os.path.getmtime(file_path))
        
        if file_mtime < cutoff_date:
            try:
                os.remove(file_path)
                logger.info(f"Deleted old backup: {filename}")
            except Exception as e:
                logger.error(f"Failed to delete {filename}: {e}")

def verify_super_code(super_code: str, admin_hash: str) -> bool:
    """
    Verifies the super code: Base64(password + date).
    Returns True if valid.
    """
    try:
        decoded_bytes = base64.b64decode(super_code)
        decoded_str = decoded_bytes.decode('utf-8')
        
        # Format expected: passwordYYYY-MM-DD
        # We need to extract the date from the end (10 chars)
        if len(decoded_str) < 10:
            return False
            
        input_date_str = decoded_str[-10:]
        input_password = decoded_str[:-10]
        
        # Verify Date == Today
        today_str = date.today().strftime("%Y-%m-%d")
        if input_date_str != today_str:
            logger.warning(f"Super code date mismatch. Input: {input_date_str}, Today: {today_str}")
            return False
            
        # Verify Password
        if verify_password(input_password, admin_hash):
            return True
            
        return False
    except Exception as e:
        logger.error(f"Super code verification error: {e}")
        return False

def restore_database(filename: str):
    """Restores the database from a backup file."""
    backup_path = os.path.join(BACKUP_DIR, filename)
    if not os.path.exists(backup_path):
        raise FileNotFoundError(f"Backup file {filename} not found")
        
    # We must be careful here. Replacing the DB file while the app is running is risky.
    # Ideally, we should stop the app, swap, and restart.
    # But for a simple app, we can try to close connections.
    # Since we can't easily "stop" the app from within (it's running via uvicorn),
    # we will overwrite the file.
    
    # 1. Create a "restore_safety" backup of current state just in case
    timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    safety_backup = f"pre_restore_{timestamp}.sqlite"
    try:
        shutil.copy2(DB_FILE, os.path.join(BACKUP_DIR, safety_backup))
    except:
        pass # If fails, proceed anyway? strict? let's proceed.

    # 2. Overwrite DB
    try:
        # Dispose engine to close connections
        engine.dispose()
        
        # Copy backup to DB_FILE
        shutil.copy2(backup_path, DB_FILE)
        
        # IMPORTANT: Since we are in WAL mode, we must remove the old WAL/SHM files
        # otherwise SQLite might try to use the old WAL with the new DB file, causing corruption or seeing old state.
        for ext in ["-wal", "-shm"]:
            wal_file = f"{DB_FILE}{ext}"
            if os.path.exists(wal_file):
                try:
                    os.remove(wal_file)
                    logger.info(f"Removed stale {ext} file during restore")
                except Exception as wal_error:
                    logger.warning(f"Could not remove {wal_file}: {wal_error}")
        
        # Re-create engine/connection? 
        # SQLAlchemy engine usually reconnects automatically.
        logger.info(f"Database restored from {filename}")
        return True
    except Exception as e:
        logger.error(f"Restore failed: {e}")
        raise e

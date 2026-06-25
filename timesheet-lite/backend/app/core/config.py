from pydantic_settings import BaseSettings
import json
from pathlib import Path

class Settings(BaseSettings):
    SECRET_KEY: str = "your-secret-key-keep-it-secret"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

settings = Settings()

def get_log_work_limit_days() -> int:
    # Safe paths using __file__ resolution, independent of CWD/PM2 execution directory
    paths = [
        Path(__file__).resolve().parents[2] / "log_work_limit_days.json", # backend/log_work_limit_days.json
        Path(__file__).resolve().parents[3] / "log_work_limit_days.json", # workspace root / log_work_limit_days.json
        Path.cwd() / "log_work_limit_days.json",
        Path.cwd() / "backend" / "log_work_limit_days.json",
    ]
    for p in paths:
        if p.exists() and p.is_file():
            try:
                with open(p, "r") as f:
                    data = json.load(f)
                    val = data.get("log_work_limit_days")
                    if val is not None:
                        return int(val)
            except Exception:
                pass
    return 30


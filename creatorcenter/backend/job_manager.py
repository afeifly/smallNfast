import uuid
from typing import Dict, Any

_jobs: Dict[str, Dict[str, Any]] = {}

def create_job(output_path: str, download_name: str) -> str:
    job_id = str(uuid.uuid4())
    _jobs[job_id] = {
        "progress": 0,
        "status": "processing",
        "error": None,
        "output_path": output_path,
        "download_name": download_name
    }
    return job_id

def update_job_progress(job_id: str, progress: int):
    if job_id in _jobs:
        _jobs[job_id]["progress"] = min(100, max(0, progress))

def complete_job(job_id: str):
    if job_id in _jobs:
        _jobs[job_id]["progress"] = 100
        _jobs[job_id]["status"] = "completed"

def fail_job(job_id: str, error: str):
    if job_id in _jobs:
        _jobs[job_id]["status"] = "failed"
        _jobs[job_id]["error"] = error

def get_job(job_id: str) -> Dict[str, Any]:
    return _jobs.get(job_id)

def remove_job(job_id: str):
    if job_id in _jobs:
        del _jobs[job_id]

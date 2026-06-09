from typing import Optional, List
from datetime import datetime, date as DtDate, timezone
from sqlmodel import Field, SQLModel, Relationship
from enum import Enum

class Role(str, Enum):
    ADMIN = "admin"
    EMPLOYEE = "employee"
    TEAM_LEADER = "team_leader"

class ProjectStatus(str, Enum):
    RUN = "RUN"
    CLOSE = "CLOSE"
    NOT_START = "NOT START"

class WorkDayType(str, Enum):
    WORK = "work"
    OFF = "off"
    HALF_OFF = "half_off"

class WorkDay(SQLModel, table=True):
    date: DtDate = Field(primary_key=True)
    day_type: WorkDayType = Field(default=WorkDayType.WORK)
    remark: Optional[str] = None

class SMTPSettings(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    smtp_server: str
    smtp_port: int
    smtp_username: str
    smtp_password: str
    sender_email: str
    checking_service_enabled: bool = Field(default=False)


class UserProjectLink(SQLModel, table=True):
    user_id: Optional[int] = Field(default=None, foreign_key="user.id", primary_key=True)
    project_id: Optional[int] = Field(default=None, foreign_key="project.id", primary_key=True)

class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    username: str = Field(index=True, unique=True)
    email: Optional[str] = None
    full_name: Optional[str] = None
    cost_center: Optional[str] = None
    remark: Optional[str] = None
    start_date: Optional[DtDate] = None
    end_date: Optional[DtDate] = None
    password_hash: str
    role: Role = Field(default=Role.EMPLOYEE)
    is_deleted: bool = Field(default=False)
    team_leader_id: Optional[int] = Field(default=None, foreign_key="user.id")
    
    timesheets: List["Timesheet"] = Relationship(back_populates="user")
    activity_logs: List["ActivityLog"] = Relationship(back_populates="user")
    projects: List["Project"] = Relationship(back_populates="users", link_model=UserProjectLink)
    
    team_leader: Optional["User"] = Relationship(back_populates="employees", sa_relationship_kwargs={"remote_side": "User.id"})
    employees: List["User"] = Relationship(back_populates="team_leader")

class Project(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(index=True, unique=True)
    full_name: Optional[str] = None
    chinese_name: Optional[str] = None
    custom_id: Optional[str] = None
    status: ProjectStatus = Field(default=ProjectStatus.NOT_START)
    start_date: Optional[DtDate] = None
    plan_closed_date: Optional[DtDate] = None
    actual_closed_date: Optional[DtDate] = None
    others: Optional[str] = None
    remark: Optional[str] = None
    description: Optional[str] = None
    is_default: bool = Field(default=False)
    is_deleted: bool = Field(default=False)
    
    timesheets: List["Timesheet"] = Relationship(back_populates="project")
    users: List["User"] = Relationship(back_populates="projects", link_model=UserProjectLink)

class Timesheet(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id")
    project_id: int = Field(foreign_key="project.id")
    date: DtDate
    hours: float
    verify: bool = Field(default=False)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    
    user: User = Relationship(back_populates="timesheets")
    project: Project = Relationship(back_populates="timesheets")

class ActivityLog(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id")
    action: str
    details: Optional[str] = None
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    
    user: User = Relationship(back_populates="activity_logs")

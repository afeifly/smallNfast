from sqlmodel import SQLModel, create_engine, Session, select
from app.models import CostCenter, User, Role, WorkDaySetting, WorkDaySettingUserLink, WorkDay, WorkDayType, Timesheet
from app.api.timesheets import get_workday_setting_id_for_user, upsert_timesheet_logic
from datetime import date
import unittest
from fastapi import HTTPException

class TestWorkDayHierarchy(unittest.TestCase):
    def setUp(self):
        # Create a fresh in-memory database
        self.engine = create_engine("sqlite:///:memory:")
        SQLModel.metadata.create_all(self.engine)
        
        with Session(self.engine) as session:
            # Seed Default profile
            self.default_setting = WorkDaySetting(name="Default", description="Default Profile", is_default=True)
            session.add(self.default_setting)
            
            # Seed Custom profile
            self.sz_setting = WorkDaySetting(name="Shenzhen Office", description="SZ Profile", is_default=False)
            session.add(self.sz_setting)
            
            # Seed Cost Centers
            self.cc_sz = CostCenter(name="R&D-SZ", workday_setting_id=None)  # initially None -> defaults to Default
            self.cc_xa = CostCenter(name="R&D-XA", workday_setting_id=None)
            session.add(self.cc_sz)
            session.add(self.cc_xa)
            
            # Seed Users
            self.admin = User(username="admin", password_hash="hash", role=Role.ADMIN)
            self.employee = User(username="emp_sz", password_hash="hash", role=Role.EMPLOYEE, cost_center="R&D-SZ")
            self.leader = User(username="lead_sz", password_hash="hash", role=Role.TEAM_LEADER, cost_center="R&D-SZ")
            session.add(self.admin)
            session.add(self.employee)
            session.add(self.leader)
            
            session.commit()
            
            # Refresh to load IDs
            session.refresh(self.default_setting)
            session.refresh(self.sz_setting)
            session.refresh(self.cc_sz)
            session.refresh(self.employee)
            session.refresh(self.leader)
            
        self.default_id = self.default_setting.id
        self.sz_id = self.sz_setting.id

    def test_default_resolution_fallback(self):
        with Session(self.engine) as session:
            # User sz belongs to cost center R&D-SZ, which has workday_setting_id = None
            setting_id = get_workday_setting_id_for_user(session, self.employee.id)
            self.assertEqual(setting_id, self.default_id)

    def test_custom_profile_assignment(self):
        with Session(self.engine) as session:
            # Map cost center R&D-SZ to Shenzhen Office profile
            cc = session.exec(select(CostCenter).where(CostCenter.name == "R&D-SZ")).one()
            cc.workday_setting_id = self.sz_id
            session.add(cc)
            session.commit()
            
            # Re-evaluate
            setting_id = get_workday_setting_id_for_user(session, self.employee.id)
            self.assertEqual(setting_id, self.sz_id)

    def test_delegation_modify_rights_logic(self):
        with Session(self.engine) as session:
            # Verify no link initially
            link = session.exec(
                select(WorkDaySettingUserLink)
                .where(WorkDaySettingUserLink.setting_id == self.sz_id)
                .where(WorkDaySettingUserLink.user_id == self.leader.id)
            ).first()
            self.assertIsNone(link)
            
            # Grant modify rights
            new_link = WorkDaySettingUserLink(setting_id=self.sz_id, user_id=self.leader.id)
            session.add(new_link)
            session.commit()
            
            # Verify link exists
            link = session.exec(
                select(WorkDaySettingUserLink)
                .where(WorkDaySettingUserLink.setting_id == self.sz_id)
                .where(WorkDaySettingUserLink.user_id == self.leader.id)
            ).first()
            self.assertIsNotNone(link)

    def test_timesheet_limit_under_custom_setting(self):
        # We will add an OFF exception to Default setting, but WORK to SZ setting
        # If the user is on Default setting, submitting on that day fails.
        # If user cost center is assigned to SZ setting, submitting succeeds.
        test_date = date(2026, 6, 22) # Monday
        
        with Session(self.engine) as session:
            # 1. Default profile has OFF exception for Monday
            ex_default = WorkDay(setting_id=self.default_id, date=test_date, day_type=WorkDayType.OFF, remark="Holiday")
            session.add(ex_default)
            session.commit()
            
            # 2. Try to log timesheet for user under Default (should raise off-day error)
            ts = Timesheet(user_id=self.employee.id, project_id=1, date=test_date, hours=8.0)
            
            with self.assertRaises(HTTPException) as ctx:
                upsert_timesheet_logic(session, ts, self.employee)
            self.assertEqual(ctx.exception.status_code, 400)
            self.assertIn("Cannot log work on an off day", ctx.exception.detail)
            
            # 3. Assign cost center to SZ profile (where Monday is WORK by default since no exception is added)
            cc = session.exec(select(CostCenter).where(CostCenter.name == "R&D-SZ")).one()
            cc.workday_setting_id = self.sz_id
            session.add(cc)
            session.commit()
            
            # Mock Project 1
            from app.models import Project
            session.add(Project(id=1, name="Project Alpha", description="Alpha"))
            session.commit()
            
            # 4. Try again - now it should pass validation because Monday is not OFF in SZ profile!
            result = upsert_timesheet_logic(session, ts, self.employee)
            self.assertIsNotNone(result)
            self.assertEqual(result.hours, 8.0)

if __name__ == "__main__":
    unittest.main()

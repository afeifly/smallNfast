<template>
  <div class="help-container">
    <el-card class="help-card">
      <template #header>
        <div class="card-header">
          <div class="header-content">
            <img src="../assets/logo.png" alt="Logo" class="help-logo" />
            <div class="title-info">
              <h2>About & Help</h2>
              <span class="version">V1.0.3</span>
            </div>
          </div>
        </div>
      </template>
      
      <div class="help-content">
        <section class="version-history">
          <div class="section-header">
            <h3>Version History</h3>
            <el-button link type="primary" @click="showHistory = !showHistory">
              {{ showHistory ? 'Collapse' : 'Expand' }}
            </el-button>
          </div>
          <el-collapse-transition>
            <el-timeline v-show="showHistory">
            <el-timeline-item timestamp="2026-05" placement="top" type="primary">
              <el-card>
                <h4>V1.0.3 - Feature Expansion</h4>
                <ul>
                  <li>Added monthly statistics toggle to Log Stats dialog</li>
                  <li>Enhanced project logs to show per-employee details</li>
                </ul>
              </el-card>
            </el-timeline-item>
            <el-timeline-item timestamp="2026-04" placement="top">
              <el-card>
                <h4>V1.0.2 - Stability & UI Polish</h4>
                <ul>
                  <li>Fixed approval stamp display issues</li>
                  <li>Resolved unapprove function bugs</li>
                  <li>General UI improvements and date format standardization</li>
                </ul>
              </el-card>
            </el-timeline-item>
            <el-timeline-item timestamp="2026-04" placement="top">
              <el-card>
                <h4>V1.0.1 - Functional Enhancements</h4>
                <ul>
                  <li>Implemented batch update for timesheets</li>
                  <li>Enhanced team leader permissions for employee management</li>
                  <li>Improved activity feed user identification</li>
                  <li>Performance optimizations and system stability fixes</li>
                </ul>
              </el-card>
            </el-timeline-item>
            <el-timeline-item timestamp="2026-03" placement="top">
              <el-card>
                <h4>V1.0.0 - Initial Release</h4>
                <ul>
                  <li>Core timesheet logging system</li>
                  <li>Project and employee management</li>
                  <li>Email notification system</li>
                  <li>Database backup and recovery manager</li>
                  <li>Workday and cost center configuration</li>
                </ul>
              </el-card>
            </el-timeline-item>
          </el-timeline>
        </el-collapse-transition>
        </section>

        <el-divider />

        <section>
          <h3>Introduction</h3>
          <p>Welcome to SUTO Timesheet Lite, a comprehensive tool for managing employee time, projects, and reports.</p>
        </section>

        <el-divider />

        <section>
          <h3>User Roles</h3>
          <el-descriptions border :column="1">
            <el-descriptions-item label="Admin">
              Full system access. Can manage Projects, Employees, view all Reports, and configure System Settings (Email, Activity Logs).
            </el-descriptions-item>
            <el-descriptions-item label="Team Leader">
              Can manage timesheets for their assigned team members via the "Team Timesheets" page.
            </el-descriptions-item>
            <el-descriptions-item label="Employee">
              Standard access. Can log daily work via "Log Work", view assigned projects, and see personal dashboard statistics.
            </el-descriptions-item>
          </el-descriptions>
        </section>

        <el-divider />

        <section>
          <h3>Key Features</h3>
          <el-collapse v-model="activeNames">
            <el-collapse-item title="Dashboard" name="1">
              <div>
                Provides a quick overview of system statistics. For Admins, it shows total users and projects. For Employees, it shows personal project time distribution.
              </div>
            </el-collapse-item>
            <el-collapse-item title="Log Work" name="2">
              <div>
                The primary interface for employees to record their daily work hours against assigned projects.
              </div>
            </el-collapse-item>
            <el-collapse-item title="Projects" name="3">
              <div>
                (Admin only) Create, edit, and manage projects. Set project status (RUN, CLOSE, NOT START) and details.
              </div>
            </el-collapse-item>
            <el-collapse-item title="Reports" name="4">
              <div>
                Generate weekly or monthly reports. Admins can view reports for all users. Supports Excel export with custom headers.
              </div>
            </el-collapse-item>
            <el-collapse-item title="Team Timesheets" name="5">
              <div>
                (Team Leader only) View and verify timesheets for team members.
              </div>
            </el-collapse-item>
          </el-collapse>
        </section>

        <el-divider />

        <section>
          <h3>System Diagrams</h3>
          <el-collapse>
            <el-collapse-item title="Employee Workflow" name="7">
              <div class="diagram-container">
                <img src="/static/empoyee_workflow_s.jpeg" alt="Employee Workflow" />
              </div>
            </el-collapse-item>
            <el-collapse-item title="Team Leader Workflow" name="8">
              <div class="diagram-container">
                <img src="/static/teamleader_workflow_s.jpeg" alt="Team Leader Workflow" />
              </div>
            </el-collapse-item>
          </el-collapse>
        </section>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const activeNames = ref(['1', '2', '3', '4', '5'])
const showHistory = ref(false)
</script>

<style scoped>
.help-container {
  padding: 20px;
  max-width: 1000px;
  margin: 0 auto;
}
.help-card {
  margin-bottom: 20px;
}
.header-content {
  display: flex;
  align-items: center;
  gap: 15px;
}
.help-logo {
  height: 48px;
  width: auto;
}
.title-info {
  display: flex;
  align-items: baseline;
  gap: 10px;
}
.header-content h2 {
  margin: 0;
}
.version {
  font-size: 0.8em;
  color: #909399;
}
.help-content h3 {
  margin: 0;
  color: #409EFF;
}
.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}
section {
  margin-bottom: 20px;
}
.diagram-container {
  text-align: center;
  padding: 20px;
  background: #f9f9f9;
  border-radius: 4px;
}
.diagram-container img {
  max-width: 100%;
  height: auto;
}
.version-history ul {
  margin: 10px 0 0 0;
  padding-left: 20px;
  color: #606266;
  font-size: 0.95em;
}
.version-history li {
  margin-bottom: 5px;
}
.version-history h4 {
  margin: 0;
  color: #303133;
}
</style>

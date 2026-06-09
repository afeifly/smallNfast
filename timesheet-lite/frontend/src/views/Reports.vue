<template>
  <div class="reports-container">
    <h2>Reports & Statistics</h2>
    
    <el-row v-if="isAdmin" :gutter="20" class="stats-row">
      <el-col :span="6">
        <el-card shadow="hover">
          <template #header>Total Users</template>
          <div class="stat-value">{{ stats.total_users }}</div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover">
          <template #header>Total Projects</template>
          <div class="stat-value">{{ stats.total_projects }}</div>
        </el-card>
      </el-col>
    </el-row>

    <el-card class="report-card">
      <template #header>
        <div class="card-header">
          <div class="header-left">
            <span>Report</span>
            <div class="filters">
              <el-button-group>
                <el-button @click="navigate(-1)" :disabled="reportType === 'custom'">&lt;</el-button>
                <el-button @click="navigate(1)" :disabled="reportType === 'custom' || isNextDisabled">&gt;</el-button>
              </el-button-group>
              
              <div class="date-pickers">
                <el-date-picker
                  v-model="startDate"
                  type="date"
                  placeholder="Start date"
                  format="YYYY-MM-DD"
                  value-format="YYYY-MM-DD"
                  @change="handleDateChange"
                  :disabled="reportType !== 'custom'"
                  style="width: 140px"
                />
                <span class="separator">To</span>
                <el-date-picker
                  v-model="endDate"
                  type="date"
                  placeholder="End date"
                  format="YYYY-MM-DD"
                  value-format="YYYY-MM-DD"
                  @change="handleDateChange"
                  :disabled="reportType !== 'custom'"
                  style="width: 140px"
                />
              </div>
              
              <el-button-group v-if="!isEmployee">
                <el-button :type="reportType === 'month' ? 'primary' : ''" @click="setMonth">Monthly</el-button>
                <el-button :type="reportType === 'year' ? 'primary' : ''" @click="setYear">Yearly</el-button>
                <el-button :type="reportType === 'custom' ? 'primary' : ''" @click="setCustom">Custom</el-button>
              </el-button-group>
            </div>
          </div>
          <el-button type="primary" @click="exportReport" v-if="!isEmployee">Export Excel</el-button>
        </div>
      </template>
      
      <div class="report-table-header">
        <h2 class="report-title">R&D Staff Time sheet</h2>
        <div class="report-sub-header">
          <div class="sub-header-left">SUTO-iTEC</div>
          <div class="sub-header-right">{{ headerDateRange }}</div>
        </div>
      </div>
      
      <el-table :data="reportData.users" border stripe max-height="600">
        <el-table-column prop="full_name" label="Full Name" width="150" fixed />
        <el-table-column prop="cost_center" label="Cost Center" width="120" />
        
        <!-- Dynamic project columns with multi-line headers -->
        <el-table-column 
          v-for="project in reportData.projects" 
          :key="project.id" 
          width="120"
          align="center"
        >
          <template #header>
            <!-- Default project: single line -->
            <div v-if="project.is_default" class="project-header">
              <div class="project-header-line">{{ project.name }}</div>
            </div>
            <!-- Custom project: four lines with borders -->
            <div v-else class="project-header custom-project">
              <div class="project-header-line with-border ph-name">{{ project.full_name || project.name }}</div>
              <div class="project-header-line with-border ph-cn">{{ project.chinese_name || ' ' }}</div>
              <div class="project-header-line with-border ph-id">{{ project.custom_id || project.id }}</div>
              <div class="project-header-line time-range ph-date">
                {{ formatDateRange(project.start_date, project.plan_closed_date) }}
              </div>
            </div>
          </template>
          <template #default="scope">
            {{ scope.row.projects[project.name] || 0 }}h
          </template>
        </el-table-column>
        
        <el-table-column prop="total_hours" label="Total Hours" width="100" sortable align="center">
          <template #default="scope">
            <strong>{{ scope.row.total_hours }}h</strong>
          </template>
        </el-table-column>
        <el-table-column prop="remark" label="Mark" width="100" />
        <el-table-column prop="start_date" label="Start Date" width="110" />
        <el-table-column prop="end_date" label="End Date" width="110" />
      </el-table>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import api from '../api/axios'
import { ElMessage } from 'element-plus'
import ExcelJS from 'exceljs'
import dayjs from 'dayjs'
import { useAuthStore } from '../stores/auth'

const authStore = useAuthStore()
const isAdmin = computed(() => authStore.user?.role === 'admin')
const isEmployee = computed(() => authStore.user?.role === 'employee')

const stats = ref({ total_users: 0, total_projects: 0 })
const reportData = ref({ users: [], projects: [] })

const dateRange = ref([]) // Deprecated/Unused now, but cleaning up refs below
const startDate = ref('')
const endDate = ref('')
const reportType = ref('custom') // 'custom', 'month', 'year'

const headerDateRange = computed(() => {
  if (!startDate.value || !endDate.value) return ''
  return `${startDate.value} ~ ${endDate.value}`
})

const formatDateRange = (start, end) => {
  if (!start && !end) return ''
  if (!start) return `~ ${end}`
  if (!end) return `${start} ~`
  return `${start} ~ ${end}`
}

const isNextDisabled = computed(() => {
  if (reportType.value === 'custom' || !startDate.value || !endDate.value) return true
  
  const start = dayjs(startDate.value)
  const today = dayjs()
  
  if (reportType.value === 'month') {
    // If next month starts after today, disable
    return start.add(1, 'month').startOf('month').isAfter(today)
  } else if (reportType.value === 'year') {
    // If next year starts after today, disable
    return start.add(1, 'year').startOf('year').isAfter(today)
  }
  return false
})

const fetchStats = async () => {
  if (!isAdmin.value) return
  try {
    const response = await api.get('/reports/stats')
    stats.value = response.data
  } catch (error) {
    console.error(error)
  }
}

const fetchReport = async () => {
  try {
    const params = {}
    if (startDate.value && endDate.value) {
      params.start_date = startDate.value
      params.end_date = endDate.value
    } else {
      // Default to wide range if no date selected, or maybe current month?
      // User said "give a time select... it will give a range for the report"
      // Let's default to current month if nothing selected initially
      const start = dayjs().startOf('month').format('YYYY-MM-DD')
      const end = dayjs().endOf('month').format('YYYY-MM-DD')
      params.start_date = start
      params.end_date = end
      // Also update UI to reflect this default
      if (!startDate.value || !endDate.value) {
          startDate.value = start
          endDate.value = end
          reportType.value = 'month'
      }
    }

    const response = await api.get('/reports/weekly', { params })
    reportData.value = response.data
  } catch (error) {
    ElMessage.error('Failed to fetch report')
  }
}

const handleDateChange = () => {
  reportType.value = 'custom'
  fetchReport()
}

const setMonth = () => {
  const start = dayjs().startOf('month').format('YYYY-MM-DD')
  const end = dayjs().endOf('month').format('YYYY-MM-DD')
  startDate.value = start
  endDate.value = end
  reportType.value = 'month'
  fetchReport()
}

const setYear = () => {
  const start = dayjs().startOf('year').format('YYYY-MM-DD')
  const end = dayjs().endOf('year').format('YYYY-MM-DD')
  startDate.value = start
  endDate.value = end
  reportType.value = 'year'
  fetchReport()
}

const setCustom = () => {
  reportType.value = 'custom'
  // We don't necessarily need to clear the date range, or we can leave it as is.
  // The user will then naturally pick a date.
}

const navigate = (direction) => {
  if (reportType.value === 'custom' || !startDate.value || !endDate.value) return

  let start = dayjs(startDate.value)
  let end = dayjs(endDate.value)

  if (reportType.value === 'month') {
    start = start.add(direction, 'month').startOf('month')
    end = end.add(direction, 'month').endOf('month')
  } else if (reportType.value === 'year') {
    start = start.add(direction, 'year').startOf('year')
    end = end.add(direction, 'year').endOf('year')
  }

  // Prevent future navigation
  if (direction > 0 && start.isAfter(dayjs())) {
      return
  }

  startDate.value = start.format('YYYY-MM-DD')
  endDate.value = end.format('YYYY-MM-DD')
  fetchReport()
}

const exportReport = async () => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Report');

  // Define columns widths without setting worksheet.columns (which creates a header row)
  const setColWidth = (colIndex, width) => {
    worksheet.getColumn(colIndex).width = width;
  };

  setColWidth(1, 20); // Full Name
  setColWidth(2, 15); // Cost Center
  
  let colIdx = 3;
  reportData.value.projects.forEach(p => {
    setColWidth(colIdx, 20); // Project columns
    colIdx++;
  });
  
  setColWidth(colIdx, 12); // Total Hours
  setColWidth(colIdx + 1, 15); // Mark
  setColWidth(colIdx + 2, 12); // Start Date
  setColWidth(colIdx + 3, 12); // End Date

  const totalCols = colIdx + 3;

  // --- Header Construction ---
  // We have 2 Report Header Rows + 6 Table Header Rows = 8 Rows total for headers
  
  // Initialize 8 empty rows
  for(let i=0; i<8; i++) {
    worksheet.addRow([]);
  }

  // Helper to set cell value and style
  const setCell = (row, col, value, style = {}) => {
    const cell = worksheet.getCell(row, col);
    cell.value = value;
    cell.style = {
      alignment: { vertical: 'top', horizontal: 'center', wrapText: true },
      font: { size: 10 },
      border: {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      },
      ...style
    };
  };

  // --- Report Headers (Rows 1-2) ---
  
  // Row 1: Title
  worksheet.mergeCells(1, 1, 1, totalCols);
  setCell(1, 1, 'R&D Staff Time sheet', {
    font: { size: 16, bold: true },
    alignment: { vertical: 'middle', horizontal: 'center' },
    border: {} // No border for title? Or maybe outside border? Let's keep it clean.
  });
  // Remove borders for title cell if desired, or keep them. 
  // User didn't specify, but usually title doesn't have grid borders. 
  // Let's keep the setCell default borders for consistency with the table, or maybe remove them.
  // Actually, let's remove borders for the title row to look like a document header.
  worksheet.getCell(1, 1).border = {};

  // Row 2: Sub-headers
  // Left: SUTO-iTEC
  setCell(2, 1, 'SUTO-iTEC', {
    font: { bold: true },
    alignment: { vertical: 'middle', horizontal: 'left' },
    border: { bottom: { style: 'thin' } } // Separator line
  });
  // Right: Date Range (Merge remaining cells)
  worksheet.mergeCells(2, 2, 2, totalCols);
  setCell(2, 2, headerDateRange.value, {
    font: { bold: true },
    alignment: { vertical: 'middle', horizontal: 'right' },
    border: { bottom: { style: 'thin' } }
  });


  // --- Table Headers (Rows 3-8) ---
  // Offset everything by 2 rows

  // 1. Fixed Columns (Full Name, Cost Center) - Merge 3-8
  setCell(3, 1, 'Full Name', { alignment: { vertical: 'bottom', horizontal: 'center', wrapText: true } });
  worksheet.mergeCells(3, 1, 8, 1);
  
  setCell(3, 2, 'Cost Center', { alignment: { vertical: 'bottom', horizontal: 'center', wrapText: true } });
  worksheet.mergeCells(3, 2, 8, 2);

  // 2. Project Columns
  colIdx = 3;
  reportData.value.projects.forEach(project => {
    if (project.is_default) {
      // Default: Merge 3-8, show name
      setCell(3, colIdx, project.name, { alignment: { vertical: 'bottom', horizontal: 'center', wrapText: true } });
      worksheet.mergeCells(3, colIdx, 8, colIdx);
    } else {
      // Custom: 
      // Row 3: Full Name/Name
      setCell(3, colIdx, project.full_name || project.name, { alignment: { vertical: 'bottom', horizontal: 'center', wrapText: true } });
      
      // Row 4-5: Chinese Name (Merge)
      setCell(4, colIdx, project.chinese_name || '', { alignment: { vertical: 'bottom', horizontal: 'center', wrapText: true } });
      worksheet.mergeCells(4, colIdx, 5, colIdx);
      
      // Row 6: ID
      setCell(6, colIdx, `${project.custom_id || project.id}`, { alignment: { vertical: 'bottom', horizontal: 'center', wrapText: true } });
      
      // Row 7-8: Date Range (Merge)
      setCell(7, colIdx, formatDateRange(project.start_date, project.plan_closed_date), { alignment: { vertical: 'bottom', horizontal: 'center', wrapText: true } });
      worksheet.mergeCells(7, colIdx, 8, colIdx);

      // Apply styles to the merged/unmerged cells in this column to ensure borders
      for(let r=3; r<=8; r++) {
         // Re-apply border to ensure merged cells look right
         const cell = worksheet.getCell(r, colIdx);
         cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
         };
         // We already set alignment in setCell, but for merged cells we might need to be careful. 
         // setCell sets it for the top-left cell of merge.
         // This loop re-applies to all, which is fine/good for borders.
         // For alignment, it should be on the master cell.
         if (r === 3 || r === 4 || r === 6 || r === 7) {
             // These are start of merges or single cells, already set by setCell
         } else {
             // For other cells in merge, alignment doesn't matter as much but borders do.
         }
      }
    }
    colIdx++;
  });

  // 3. Trailing Columns (Total Hours, etc.) - Merge 3-8
  const trailingHeaders = ['Total Hours', 'Mark', 'Start Date', 'End Date'];
  trailingHeaders.forEach((text, i) => {
    const c = colIdx + i;
    setCell(3, c, text, { alignment: { vertical: 'bottom', horizontal: 'center', wrapText: true } });
    worksheet.mergeCells(3, c, 8, c);
  });

  // --- Data Rows ---
  reportData.value.users.forEach(user => {
    const rowValues = [];
    rowValues[1] = user.full_name || '';
    rowValues[2] = user.cost_center || '';
    
    let c = 3;
    reportData.value.projects.forEach(project => {
      rowValues[c] = user.projects[project.name] || 0;
      c++;
    });
    
    rowValues[c] = user.total_hours;
    rowValues[c+1] = user.remark || '';
    rowValues[c+2] = user.start_date || '';
    rowValues[c+3] = user.end_date || '';

    const row = worksheet.addRow(rowValues);
    // Style data rows
    row.eachCell((cell) => {
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
    });
  });

  // Generate buffer
  const buffer = await workbook.xlsx.writeBuffer();
  
  // Download
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'report.xlsx';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}


onMounted(() => {
  fetchStats()
  fetchReport()
})
</script>

<style scoped>
.reports-container {
  padding: 20px;
  box-sizing: border-box;
}
.stats-row {
  margin-bottom: 20px;
}
.stat-value {
  font-size: 24px;
  font-weight: bold;
  color: #409EFF;
}
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.header-left {
  display: flex;
  align-items: center;
  gap: 20px;
}
.filters {
  display: flex;
  gap: 10px;
  align-items: center;
}
.report-card {
  /* width: 100%; Removed to prevent overflow if padding is involved */
}
.report-card :deep(.el-card__body) {
  padding: 20px;
  overflow-x: auto;
}
.project-header {
  line-height: 1.3;
  font-size: 12px;
  padding: 0;
  margin: -8px -10px;
  padding-top: 8px;
  padding-bottom: 8px;
}
.project-header-line {
  margin: 0;
  padding: 3px 5px; /* Reduced side padding slightly */
  word-wrap: break-word;
  overflow-wrap: break-word;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  line-height: 1.2;
}
.project-header-line.with-border {
  border-bottom: 1px solid #DCDFE6;
}
.ph-name {
  height: 40px; /* Force fixed height for alignment */
  overflow: hidden;
}
.ph-cn {
  height: 48px;
  overflow: hidden;
}
.ph-id {
  height: 24px;
  overflow: hidden;
}
.ph-date {
  height: 36px;
  overflow: hidden;
}
.project-header-line.time-range {
  font-size: 11px;
  color: #909399;
}
.report-table-header {
  margin-bottom: 10px;
}
.report-title {
  text-align: center;
  margin: 0 0 10px 0;
  font-size: 20px;
  font-weight: bold;
}
.report-sub-header {
  display: flex;
  justify-content: space-between;
  font-weight: bold;
  margin-bottom: 5px;
  padding: 0 5px;
}
.date-pickers {
  display: flex;
  align-items: center;
  gap: 10px;
}
.separator {
  color: #606266;
  font-size: 14px;
}
</style>

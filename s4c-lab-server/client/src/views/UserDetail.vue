<template>
  <div class="container" v-if="user">
    <div class="header-nav flex between center">
      <div class="flex center gap-16">
        <button @click="$router.back()" class="secondary small back-btn">
          <ArrowLeft :size="16" /> Back to Users
        </button>
        <div>
          <h1 class="user-title">{{ user.username }} <small class="company-tag">{{ user.companyName }}</small></h1>
          <p class="subtitle">Sensor Inventory & Calibration Records</p>
        </div>
      </div>
    </div>

    <div class="sensors-list" v-if="sensors.length">
      <div v-for="sensor in sensors" :key="sensor.id" class="glass card sensor-main-card">
        <!-- Top Banner: Serial and General Info -->
        <div class="record-header flex between center">
          <div class="flex center gap-24">
            <div class="serial-box">
              <span class="meta-label">SERIAL NUMBER</span>
              <div class="serial">{{ sensor.serialNumber }}</div>
            </div>
            <div class="flex center gap-12">
              <div class="version-pill">HW {{ sensor.hwVersion }} / SW {{ sensor.swVersion }}</div>
              <div class="type-badge">{{ sensor.sensorType }}</div>
            </div>
          </div>
          <button @click="deleteSensor(sensor)" class="icon-btn danger-hover" title="Delete Sensor Inventory">
            <Trash2 :size="18" />
          </button>
        </div>

        <!-- Calibration Records Grid (Small Cards) -->
        <div class="records-grid">
          <div v-for="(record, rIdx) in sensor.calibrationRecords" :key="record.id" class="record-card glass">
            <div class="card-header flex between center">
              <div class="flex center gap-8">
                <div class="record-number">#{{ sensor.calibrationRecords.length - rIdx }}</div>
                <div class="date-time">
                  <div class="date">{{ formatDateShort(record.calibrationDate) }}</div>
                  <div class="time">{{ formatTimeOnly(record.calibrationDate) }}</div>
                </div>
              </div>
              <div class="card-actions flex gap-4">
                <button @click="record.showSettings = !record.showSettings" class="mini-btn" :class="{ active: record.showSettings }" title="Settings">
                  <Settings2 :size="14" />
                </button>
                <button @click="deleteRecord(record)" class="mini-btn danger" title="Delete">
                  <Trash2 :size="14" />
                </button>
              </div>
            </div>

            <div class="card-body">
              <!-- Inline Settings (Overlay style inside card) -->
              <transition name="fade">
                <div v-if="record.showSettings" class="card-settings-overlay">
                  <div class="overlay-header flex between center">
                    <span>Settings</span>
                    <button @click="record.showSettings = false" class="close-btn">&times;</button>
                  </div>
                  <div class="settings-compact-rows">
                    <div class="compact-row">
                      <div class="s-item"><span>Pipe:</span> {{ record.currentSettings.flow?.pipeDiameter_mm }}mm</div>
                      <div class="s-item"><span>Depth:</span> {{ record.currentSettings.flow?.insertionDepth }}</div>
                    </div>
                    <div class="compact-row">
                      <div class="s-item"><span>Gas:</span> {{ record.currentSettings.flow?.gasType }}</div>
                      <div class="s-item"><span>Cutoff:</span> {{ record.currentSettings.flow?.cutoffThreshold }}</div>
                    </div>
                    <div class="compact-row">
                      <div class="s-item"><span>F-Unit:</span> {{ record.currentSettings.unit?.flowUnit }}</div>
                      <div class="s-item"><span>V-Unit:</span> {{ record.currentSettings.unit?.velocityUnit }}</div>
                    </div>
                    <div class="compact-row">
                      <div class="s-item"><span>Ref. Temp:</span> {{ record.currentSettings.reference?.temperature_C }}°C</div>
                      <div class="s-item"><span>Ref. Pressure:</span> {{ record.currentSettings.reference?.pressure_hPa }}hPa</div>
                    </div>
                    <div class="compact-row">
                      <div class="s-item"><span>Filter:</span> {{ record.currentSettings.advanced?.filterGrade }}</div>
                      <div class="s-item"><span>Slope:</span> {{ record.currentSettings.advanced?.slope }}</div>
                    </div>
                  </div>


                </div>

              </transition>

              <div class="points-micro-table-wrapper">
                <table class="micro-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Act.Flow</th>
                      <th>Ref.Flow</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="(p, idx) in record.calibrationPoints" :key="idx">
                      <td>{{ p.point !== undefined ? (p.point + 1) : idx + 1 }}</td>
                      <td>{{ formatFlow(p.actual, record) }}</td>
                      <td>{{ formatFlow(p.standard, record) }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div class="card-footer">
              <div class="op-detail-line">
                <span v-if="record.operationName" class="op-name">
                  <Briefcase :size="12" /> {{ record.operationName }}
                </span>
                <span class="op-loc">
                  <MapPin :size="12" /> {{ record.calibrationLocation || record.operationAddress || 'N/A' }}
                </span>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
    
    <div v-else class="empty-state glass flex center center-content flex-col gap-16">
      <Activity :size="48" class="muted-icon" />
      <p class="muted-text">No sensor calibration records found.</p>
    </div>

    <!-- Confirm Modal -->
    <ConfirmModal 
      v-model="confirmData.show"
      :title="confirmData.title"
      :message="confirmData.message"
      :confirmText="confirmData.confirmText"
      :type="confirmData.type"
      @confirm="confirmData.onConfirm"
    />
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRoute } from 'vue-router'
import { useAppStore } from '../store'
import api from '../api/axios'
import { ArrowLeft, Calendar, MapPin, Activity, Settings2, Trash2, User, Briefcase } from 'lucide-vue-next'
import ConfirmModal from '../components/ConfirmModal.vue'

const route = useRoute()
const store = useAppStore()

const sensors = ref([])
const confirmData = ref({
  show: false,
  title: '',
  message: '',
  confirmText: '',
  type: 'info',
  onConfirm: () => {}
})

const user = computed(() => {
  return store.companyUsers.find(u => u.id === route.params.id)
})

onMounted(async () => {
  if (!store.companyUsers.length) {
    await store.fetchUsers()
  }
  fetchSensors()
})

const fetchSensors = async () => {
  try {
    const res = await api.get(`/api/sensors/company/${route.params.id}`)
    sensors.value = res.data
  } catch (err) {
    console.error(err)
  }
}

const formatDate = (dateString) => {
  const d = new Date(dateString)
  return d.toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  })
}

const formatDateShort = (dateString) => {
  return new Date(dateString).toLocaleDateString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric'
  })
}

const formatTimeOnly = (dateString) => {
  return new Date(dateString).toLocaleTimeString(undefined, {
    hour: '2-digit', minute: '2-digit'
  })
}

const formatFlow = (val, record) => {
  if (val === undefined || val === null || val === '') return '-'
  const dp = record.currentSettings?.unit?.flowResolutionDecimalPlaces
  const precision = (dp !== undefined && dp !== null) ? parseInt(dp) : 2
  return Number(val).toFixed(precision)
}

const deleteSensor = (sensor) => {
  confirmData.value = {
    show: true,
    title: 'Delete Sensor Inventory',
    message: `Are you sure you want to delete Sensor #${sensor.serialNumber}? This will permanently remove all associated calibration records.`,
    confirmText: 'Delete Inventory',
    type: 'danger',
    onConfirm: async () => {
      try {
        await api.delete(`/api/sensors/${sensor.id}`)
        fetchSensors()
      } catch (err) {
        alert('Failed to delete sensor')
      }
    }
  }
}

const deleteRecord = (record) => {
  confirmData.value = {
    show: true,
    title: 'Delete Calibration Record',
    message: `Are you sure you want to delete this calibration record from ${formatDate(record.calibrationDate)}?`,
    confirmText: 'Delete Record',
    type: 'danger',
    onConfirm: async () => {
      try {
        await api.delete(`/api/sensors/calibration/${record.id}`)
        fetchSensors()
      } catch (err) {
        alert('Failed to delete calibration record')
      }
    }
  }
}

</script>

<style scoped>
.header-nav { margin-bottom: 32px; }
.back-btn { margin-right: 12px; }
.user-title { margin: 0; font-size: 1.75rem; color: var(--text-main); }
.company-tag { font-size: 0.9rem; color: var(--text-muted); font-weight: 400; margin-left: 8px; }

.sensors-list {
  display: flex;
  flex-direction: column;
  gap: 48px;
}

.sensor-main-card {
  padding: 0;
  overflow: hidden;
  border: 1px solid var(--border-color);
}

.record-header {
  background: #fbfcfd;
  padding: 24px 32px;
  border-bottom: 2px solid var(--primary-color);
}

.meta-label { font-size: 0.65rem; color: var(--text-muted); font-weight: 800; letter-spacing: 0.05em; display: block; }
.serial { font-family: 'JetBrains Mono', monospace; font-size: 1.5rem; font-weight: 800; color: var(--primary-color); margin-top: 4px; }

.version-pill {
  background: #f1f5f9;
  color: #475569;
  padding: 6px 12px;
  border-radius: 100px;
  font-size: 0.75rem;
  font-weight: 600;
  border: 1px solid #e2e8f0;
}

.type-badge {
  background: #1e293b;
  color: white;
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.03em;
}

/* Records Grid Layout */
.records-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 24px;
  padding: 24px;
}

.record-card {
  display: flex;
  flex-direction: column;
  background: white;
  border-radius: 12px;
  border: 1px solid var(--border-color);
  overflow: hidden;
  transition: transform 0.2s, box-shadow 0.2s;
  min-height: 320px;
}

.record-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 24px rgba(0,0,0,0.06);
}

/* Card Header */
.card-header {
  padding: 12px 16px;
  background: #fbfcfd;
  border-bottom: 1px solid var(--border-color);
}

.record-number {
  background: var(--primary-color);
  color: white;
  width: 22px;
  height: 22px;
  border-radius: 4px;
  font-size: 0.7rem;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
}

.date-time { line-height: 1.2; }
.date { font-size: 0.8rem; font-weight: 700; color: var(--text-main); }
.time { font-size: 0.7rem; color: var(--text-muted); }

.mini-btn {
  background: transparent;
  padding: 4px;
  border-radius: 4px;
  color: var(--text-muted);
}
.mini-btn:hover { background: #f1f5f9; color: var(--text-main); }
.mini-btn.active { background: var(--primary-color); color: white; }
.mini-btn.danger:hover { color: #cf222e; background: rgba(207, 34, 46, 0.1); }

/* Card Body */
.card-body {
  flex: 1;
  padding: 16px;
  position: relative;
}

.points-micro-table-wrapper {
  margin-top: 8px;
}

.micro-table {
  width: 100%;
  border-collapse: collapse;
}

.micro-table th {
  text-align: left;
  font-size: 0.65rem;
  color: var(--text-muted);
  text-transform: uppercase;
  padding-bottom: 8px;
  border-bottom: 1px solid #f1f5f9;
}

.micro-table td {
  padding: 8px 4px;
  font-size: 0.8rem;
  font-weight: 600;
  border-bottom: 1px solid #fbfcfe;
}

/* Settings Overlay Inside Card */
.card-settings-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(255, 255, 255, 0.98);
  backdrop-filter: blur(4px);
  z-index: 10;
  padding: 16px;
  display: flex;
  flex-direction: column;
}

.overlay-header {
  font-size: 0.7rem;
  font-weight: 800;
  text-transform: uppercase;
  color: var(--primary-color);
  margin-bottom: 12px;
}

.close-btn {
  font-size: 1.2rem;
  background: none;
  border: none;
  cursor: pointer;
  color: var(--text-muted);
}

.settings-compact-rows {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.compact-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.compact-row .s-item {
  flex: 1;
}

.s-item {
  font-size: 0.72rem;
  color: var(--text-main);
  font-weight: 500;
  white-space: nowrap;
}

.s-item span {
  color: var(--text-muted);
  font-weight: 400;
}

/* Card Footer */
.card-footer {
  padding: 12px 16px;
  background: #fafbfc;
  border-top: 1px solid var(--border-color);
  font-size: 0.75rem;
  color: var(--text-muted);
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.op-detail-line {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  width: 100%;
}

.op-name, .op-loc {
  display: flex;
  align-items: center;
  gap: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.op-name {
  color: var(--primary-color);
  font-weight: 700;
}

.empty-state {
  height: 400px;
  border: 2px dashed var(--border-color);
}
.muted-icon { opacity: 0.3; }
.muted-text { color: var(--text-muted); }
.center-content { justify-content: center; align-items: center; }
.flex-col { flex-direction: column; }
</style>



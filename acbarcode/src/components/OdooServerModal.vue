<template>
  <div v-if="modelValue" class="modal-overlay">
    <div class="modal-card odoo-modal-card" @click.stop>
      <div class="modal-header">
        <h3>Odoo Server Configuration & Test</h3>
        <button class="close-modal-btn" @click="closeModal" title="Close Dialog">&times;</button>
      </div>
      
      <form @submit.prevent="saveOdooConfig">
        <div class="form-row">
          <div class="form-group">
            <label>Odoo Server URL</label>
            <input 
              type="text" 
              v-model="odooForm.url" 
              placeholder="e.g. https://xxxxxxxx.com.cn" 
              required
            />
          </div>
          <div class="form-group">
            <label>Database (db)</label>
            <input 
              type="text" 
              v-model="odooForm.db" 
              placeholder="e.g. Sxxxx07" 
              required
            />
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Username</label>
            <input 
              type="text" 
              v-model="odooForm.username" 
              placeholder="e.g. username" 
              required
            />
          </div>
          <div class="form-group">
            <label>Password / API Key</label>
            <input 
              type="password" 
              v-model="odooForm.password" 
              placeholder="Enter password or key" 
            />
          </div>
        </div>
        
        <div class="modal-actions-inline">
          <button type="submit" class="save-config-btn" :disabled="isSavingOdooConfig">
            {{ isSavingOdooConfig ? 'Saving...' : 'Save Configuration' }}
          </button>
          <span v-if="odooSaveMsg" class="save-status-msg" :class="{ error: odooSaveError }">
            {{ odooSaveMsg }}
          </span>
        </div>
      </form>

      <hr class="modal-divider" />

      <div class="odoo-test-section">
        <h4>Test Search Serial Number</h4>
        <div class="test-input-row">
          <input 
            type="text" 
            v-model="odooTestSerial" 
            placeholder="Enter SN to search, e.g. 1525 8625 or 2926 8990"
            @keyup.enter="runOdooTestSearch"
          />
          <button type="button" class="test-search-btn" @click="runOdooTestSearch" :disabled="isTestingOdoo || !odooTestSerial.trim()">
            {{ isTestingOdoo ? 'Searching...' : 'Test Search' }}
          </button>
        </div>

        <!-- Test Search Output / Log Display -->
        <div v-if="odooTestResult" class="test-result-box">
          <div class="result-header">
            <span class="status-badge" :class="odooTestResult.success ? 'success' : 'failed'">
              {{ odooTestResult.success ? 'Connection Success' : 'Search Failed' }}
            </span>
            <span v-if="odooTestResult.uid" class="uid-tag">User UID: {{ odooTestResult.uid }}</span>
          </div>

          <div v-if="odooTestResult.logs && odooTestResult.logs.length" class="logs-container">
            <div class="logs-title">Execution Log:</div>
            <pre class="logs-content">{{ odooTestResult.logs.join('\n') }}</pre>
          </div>

          <div v-if="odooTestResult.records && odooTestResult.records.length" class="records-container">
            <div class="records-title">Found MO Records:</div>
            <div v-for="(rec, i) in odooTestResult.records" :key="i" class="record-item">
              <div class="rec-field"><strong>MO Name:</strong> {{ rec.name }}</div>
              <div class="rec-field"><strong>Product Description Variants:</strong> {{ rec.product_description_variants || 'N/A' }}</div>
              <div v-if="rec.product_id" class="rec-field"><strong>Product:</strong> {{ Array.isArray(rec.product_id) ? rec.product_id[1] : rec.product_id }}</div>
              <div v-if="rec.origin" class="rec-field"><strong>Origin SO:</strong> {{ rec.origin }}</div>
              <div v-if="rec.state" class="rec-field"><strong>Status:</strong> {{ rec.state }}</div>
            </div>
          </div>
        </div>
      </div>

      <div class="modal-footer">
        <button type="button" class="close-footer-btn" @click="closeModal">Close</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue';

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['update:modelValue']);

const odooForm = ref({ url: '', db: '', username: '', password: '' });
const isSavingOdooConfig = ref(false);
const odooSaveMsg = ref('');
const odooSaveError = ref(false);

const odooTestSerial = ref('');
const isTestingOdoo = ref(false);
const odooTestResult = ref(null);

watch(() => props.modelValue, (newVal) => {
  if (newVal) {
    fetchOdooConfig();
    odooSaveMsg.value = '';
    odooTestResult.value = null;
  }
});

function closeModal() {
  emit('update:modelValue', false);
}

async function fetchOdooConfig() {
  try {
    const res = await fetch('/api/odoo/config');
    if (res.ok) {
      const data = await res.json();
      odooForm.value = {
        url: data.url || '',
        db: data.db || '',
        username: data.username || '',
        password: data.password || ''
      };
    }
  } catch (err) {
    console.error('Failed to load Odoo config:', err);
  }
}

async function saveOdooConfig() {
  isSavingOdooConfig.value = true;
  odooSaveMsg.value = '';
  odooSaveError.value = false;
  try {
    const res = await fetch('/api/odoo/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(odooForm.value)
    });
    const data = await res.json();
    if (res.ok) {
      odooSaveMsg.value = 'Config saved successfully!';
    } else {
      odooSaveError.value = true;
      odooSaveMsg.value = data.error || 'Failed to save config';
    }
  } catch (err) {
    odooSaveError.value = true;
    odooSaveMsg.value = err.message || 'Error saving config';
  } finally {
    isSavingOdooConfig.value = false;
  }
}

async function runOdooTestSearch() {
  if (!odooTestSerial.value.trim()) return;
  isTestingOdoo.value = true;
  odooTestResult.value = null;
  try {
    const res = await fetch('/api/odoo/test-search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: odooForm.value.url,
        db: odooForm.value.db,
        username: odooForm.value.username,
        password: odooForm.value.password,
        serialNumber: odooTestSerial.value.trim()
      })
    });
    const data = await res.json();
    odooTestResult.value = data;
  } catch (err) {
    console.error('Odoo Test Search Error:', err);
    odooTestResult.value = {
      success: false,
      logs: [`Error calling server API: ${err.message}`]
    };
  } finally {
    isTestingOdoo.value = false;
  }
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
}

.odoo-modal-card {
  background: white;
  border-radius: 12px;
  max-width: 920px !important;
  width: 94% !important;
  max-height: 90vh;
  padding: 2.2rem !important;
  overflow-y: auto;
  text-align: left;
  box-shadow: 0 10px 40px rgba(0,0,0,0.25);
  animation: scaleUp 0.25s ease-out;
}

@keyframes scaleUp {
  from { transform: scale(0.95); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.25rem;
}

.modal-header h3 {
  margin: 0;
  font-size: 1.35rem;
  color: #1a202c;
}

.close-modal-btn {
  background: transparent !important;
  border: none;
  font-size: 1.75rem;
  cursor: pointer;
  color: #718096;
  padding: 0 0.5rem;
  line-height: 1;
  box-shadow: none !important;
  width: auto !important;
}

.close-modal-btn:hover {
  color: #1a202c;
}

.form-row {
  display: flex;
  gap: 1rem;
}

.form-row .form-group {
  flex: 1;
}

.form-group {
  margin-bottom: 1rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
  color: #333;
}

input {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #cbd5e0;
  border-radius: 6px;
  font-size: 0.95rem;
  box-sizing: border-box;
}

.modal-actions-inline {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-top: 0.75rem;
}

.save-config-btn {
  background: #3182ce !important;
  color: white !important;
  padding: 0.5rem 1.25rem !important;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 500;
  width: auto !important;
}

.save-config-btn:hover {
  background: #2b6cb0 !important;
}

.save-status-msg {
  font-size: 0.875rem;
  color: #38a169;
  font-weight: 500;
}

.save-status-msg.error {
  color: #e53e3e;
}

.modal-divider {
  border: 0;
  height: 1px;
  background: #e2e8f0;
  margin: 1.5rem 0;
}

.odoo-test-section h4 {
  margin: 0 0 0.75rem 0;
  color: #2d3748;
  font-size: 1.1rem;
}

.test-input-row {
  display: flex;
  gap: 0.75rem;
}

.test-input-row input {
  flex: 1;
  padding: 0.6rem 0.85rem;
  border: 1px solid #cbd5e0;
  border-radius: 6px;
  font-size: 0.95rem;
}

.test-search-btn {
  background: #38a169 !important;
  color: white !important;
  border: none;
  padding: 0.6rem 1.4rem !important;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 500;
  width: auto !important;
}

.test-search-btn:hover {
  background: #2f855a !important;
}

.test-search-btn:disabled {
  background: #a0aec0 !important;
  cursor: not-allowed;
}

.test-result-box {
  margin-top: 1rem;
  background: #f7fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 1.25rem;
}

.result-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
}

.status-badge {
  padding: 0.25rem 0.6rem;
  border-radius: 4px;
  font-size: 0.8rem;
  font-weight: 600;
  text-transform: uppercase;
}

.status-badge.success {
  background: #c6f6d5;
  color: #22543d;
}

.status-badge.failed {
  background: #fed7d7;
  color: #742a2a;
}

.uid-tag {
  font-size: 0.85rem;
  color: #4a5568;
  background: #edf2f7;
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
}

.logs-container {
  margin-top: 0.5rem;
}

.logs-title, .records-title {
  font-size: 0.9rem;
  font-weight: 600;
  color: #4a5568;
  margin-bottom: 0.4rem;
}

.logs-content {
  background: #1a202c;
  color: #68d391;
  padding: 0.85rem;
  border-radius: 6px;
  font-family: monospace;
  font-size: 0.85rem;
  white-space: pre-wrap;
  word-break: break-word;
  margin: 0;
  max-height: 320px;
  overflow-y: auto;
  text-align: left;
}

.records-container {
  margin-top: 1rem;
}

.record-item {
  background: white;
  border: 1px solid #cbd5e0;
  border-radius: 6px;
  padding: 0.75rem 1rem;
  margin-top: 0.5rem;
  font-size: 0.9rem;
}

.rec-field {
  margin-bottom: 0.3rem;
}

.rec-field strong {
  color: #2d3748;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  margin-top: 1.5rem;
  padding-top: 1rem;
  border-top: 1px solid #e2e8f0;
}

.close-footer-btn {
  background: #718096 !important;
  color: white !important;
  border: none;
  padding: 0.55rem 1.5rem !important;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 500;
  width: auto !important;
  box-shadow: none !important;
}

.close-footer-btn:hover {
  background: #4a5568 !important;
}
</style>

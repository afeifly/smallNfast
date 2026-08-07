<template>
  <div class="st-designer-container">
    <div class="st-header-actions">
      <div class="st-header-left">
        <div class="sn-input-group">
          <label for="st-sn-input" class="sn-label">SN:</label>
          <input 
            id="st-sn-input"
            type="text" 
            v-model="stSerialNumbersInput" 
            placeholder="e.g. 3726 0001" 
            class="sn-input"
          />
        </div>
        <button type="button" class="fetch-odoo-stub-btn" @click="fetchFromOdooStub">
          🔄 Fetch Data from Odoo
        </button>
      </div>
      <button type="button" class="manage-odoo-btn" @click="$emit('open-odoo-modal')">
        ⚙️ Manage Odoo Server
      </button>
    </div>

    <div class="st-editor-layout">
      <!-- LEFT PANEL: Label Settings & Elements Layer Manager -->
      <div class="st-editor-panel">
        <!-- Canvas Setup Card -->
        <div class="editor-card">
          <h3>📏 Label Dimensions & DPI</h3>
          <div class="form-row">
            <div class="form-group">
              <label>Width (mm)</label>
              <input type="number" step="0.1" v-model.number="stCanvasConfig.widthMm" min="10" max="200" />
            </div>
            <div class="form-group">
              <label>Height (mm)</label>
              <input type="number" step="0.1" v-model.number="stCanvasConfig.heightMm" min="10" max="200" />
            </div>
            <div class="form-group">
              <label>Resolution</label>
              <select v-model.number="stCanvasConfig.dpi">
                <option :value="203">203 DPI (8 dots/mm)</option>
                <option :value="300">300 DPI (12 dots/mm)</option>
                <option :value="600">600 DPI (24 dots/mm)</option>
              </select>
            </div>
          </div>
        </div>

        <!-- Elements List Card -->
        <div class="editor-card">
          <div class="editor-card-header">
            <div class="header-left">
              <h3>🎨 Label Elements Layer Manager</h3>
              <span class="element-count-badge">{{ stElements.length }} elements</span>
            </div>
            <div class="header-actions-group">
              <button type="button" class="mini-text-btn" @click="toggleAllElements(false)">Collapse All</button>
              <button type="button" class="mini-text-btn" @click="toggleAllElements(true)">Expand All</button>
            </div>
          </div>

          <div class="elements-list custom-scrollbar">
            <div 
              v-for="(el, index) in stElements" 
              :key="el.id" 
              class="element-item-card"
              :class="['type-' + el.type, { 'is-expanded': el.expanded !== false }]"
            >
              <!-- Element Header -->
              <div class="element-item-header" @click="el.expanded = !el.expanded">
                <div class="header-main-row">
                  <div class="element-title-group">
                    <span class="expand-arrow">{{ el.expanded !== false ? '▼' : '►' }}</span>
                    <span class="type-badge" :class="el.type">{{ el.type.toUpperCase() }}</span>
                    <span class="element-name">{{ el.name || el.type }}</span>
                  </div>
                  <div class="element-actions" @click.stop>
                    <button type="button" class="icon-btn move-btn" :disabled="index === 0" @click="moveStElement(index, -1)" title="Move Up">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m18 15-6-6-6 6"/></svg>
                    </button>
                    <button type="button" class="icon-btn move-btn" :disabled="index === stElements.length - 1" @click="moveStElement(index, 1)" title="Move Down">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                    </button>
                    <button type="button" class="icon-btn delete-btn" @click="removeStElement(index)" title="Delete Element">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                    </button>
                  </div>
                </div>
                <div v-if="getElementSummary(el)" class="header-sub-row">
                  <span class="element-summary-badge">{{ getElementSummary(el) }}</span>
                </div>
              </div>

              <!-- Element Controls (Expanded) -->
              <div v-if="el.expanded !== false" class="element-item-body">
                <!-- Text Element Controls -->
                <template v-if="el.type === 'text'">
                  <div class="form-group">
                    <label>Text Content (use &#123;&#123;serial&#125;&#125; for variable SN)</label>
                    <input type="text" v-model="el.text" placeholder="e.g. Model: S403" />
                  </div>
                  <div class="form-row">
                    <div class="form-group">
                      <label>X (mm)</label>
                      <input type="number" step="0.1" v-model.number="el.xMm" />
                    </div>
                    <div class="form-group">
                      <label>Y (mm)</label>
                      <input type="number" step="0.1" v-model.number="el.yMm" />
                    </div>
                    <div class="form-group">
                      <label>Font Size (pt)</label>
                      <input type="number" step="0.5" v-model.number="el.fontSize" min="2" max="36" />
                    </div>
                    <div class="form-group checkbox-group">
                      <label><input type="checkbox" v-model="el.bold" /> Bold</label>
                    </div>
                  </div>
                </template>

                <!-- Image Element Controls -->
                <template v-else-if="el.type === 'image'">
                  <div class="form-group">
                    <label>Image File</label>
                    <div class="image-upload-row">
                      <input type="file" accept="image/*" @change="e => onStImageUpload(el, e)" />
                      <img v-if="el.src" :src="el.src" class="upload-preview-thumb" alt="Preview" />
                    </div>
                  </div>
                  <div class="form-row">
                    <div class="form-group">
                      <label>X (mm)</label>
                      <input type="number" step="0.1" v-model.number="el.xMm" :disabled="el.autoBottomRight" />
                    </div>
                    <div class="form-group">
                      <label>Y (mm)</label>
                      <input type="number" step="0.1" v-model.number="el.yMm" :disabled="el.autoBottomRight" />
                    </div>
                    <div class="form-group">
                      <label>Width (mm)</label>
                      <input type="number" step="0.1" v-model.number="el.widthMm" />
                    </div>
                    <div class="form-group">
                      <label>EZPL Stored Name</label>
                      <input type="text" v-model="el.storedName" placeholder="LOGO" />
                    </div>
                  </div>
                  <div class="form-group checkbox-group">
                    <label><input type="checkbox" v-model="el.autoBottomRight" /> Align Bottom Right</label>
                  </div>
                </template>

                <!-- Line Controls (Horizontal & Vertical) -->
                <template v-else-if="el.type === 'hline' || el.type === 'vline'">
                  <div class="form-row">
                    <div class="form-group">
                      <label>Orientation</label>
                      <select v-model="el.lineShape">
                        <option value="HLine">Horizontal Line</option>
                        <option value="VLine">Vertical Line</option>
                      </select>
                    </div>
                    <div class="form-group">
                      <label>Start X (mm)</label>
                      <input type="number" step="0.1" v-model.number="el.xMm" />
                    </div>
                    <div class="form-group">
                      <label>Start Y (mm)</label>
                      <input type="number" step="0.1" v-model.number="el.yMm" />
                    </div>
                    <div v-if="el.lineShape !== 'VLine'" class="form-group">
                      <label>End X (mm)</label>
                      <input type="number" step="0.1" v-model.number="el.x1Mm" />
                    </div>
                    <div v-else class="form-group">
                      <label>End Y (mm)</label>
                      <input type="number" step="0.1" v-model.number="el.y1Mm" />
                    </div>
                    <div class="form-group">
                      <label>Thickness (dots)</label>
                      <input type="number" v-model.number="el.thicknessDots" min="1" max="30" />
                    </div>
                  </div>
                </template>

                <!-- 1D Barcode Controls -->
                <template v-else-if="el.type === 'barcode'">
                  <div class="form-group">
                    <label>Barcode Data (e.g. PROD-&#123;&#123;serial&#125;&#125;)</label>
                    <input type="text" v-model="el.data" placeholder="PROD-12345" />
                  </div>
                  <div class="form-row">
                    <div class="form-group">
                      <label>X (mm)</label>
                      <input type="number" step="0.1" v-model.number="el.xMm" />
                    </div>
                    <div class="form-group">
                      <label>Y (mm)</label>
                      <input type="number" step="0.1" v-model.number="el.yMm" />
                    </div>
                    <div class="form-group">
                      <label>Height (mm)</label>
                      <input type="number" step="0.1" v-model.number="el.heightMm" />
                    </div>
                    <div class="form-group checkbox-group">
                      <label><input type="checkbox" v-model="el.readable" /> Show Text</label>
                    </div>
                  </div>
                </template>

                <!-- 2D QR Code Controls -->
                <template v-else-if="el.type === 'qrcode'">
                  <div class="form-group">
                    <label>QR Code Data / URL</label>
                    <input type="text" v-model="el.data" placeholder="https://example.com" />
                  </div>
                  <div class="form-row">
                    <div class="form-group">
                      <label>X (mm)</label>
                      <input type="number" step="0.1" v-model.number="el.xMm" />
                    </div>
                    <div class="form-group">
                      <label>Y (mm)</label>
                      <input type="number" step="0.1" v-model.number="el.yMm" />
                    </div>
                    <div class="form-group">
                      <label>Multiplier Size</label>
                      <input type="number" v-model.number="el.mul" min="1" max="20" />
                    </div>
                  </div>
                </template>
              </div>
            </div>
          </div>

          <!-- Add Element Toolbar -->
          <div class="add-element-toolbar">
            <span>Add Element:</span>
            <button type="button" class="add-type-btn" @click="addStElement('text')">+ Text</button>
            <button type="button" class="add-type-btn" @click="addStElement('image')">+ Image</button>
            <button type="button" class="add-type-btn" @click="addStElement('hline')">+ Line</button>
            <button type="button" class="add-type-btn" @click="addStElement('barcode')">+ Barcode</button>
            <button type="button" class="add-type-btn" @click="addStElement('qrcode')">+ QR Code</button>
          </div>
        </div>
      </div>

      <!-- RIGHT PANEL: Canvas Live Preview & Action Toolbar -->
      <div class="st-preview-panel">
        <div class="preview-card">
          <div class="preview-card-header">
            <h3>👁️ Live Canvas Preview</h3>
            <span class="canvas-dim-tag">{{ stCanvasConfig.widthMm }}mm × {{ stCanvasConfig.heightMm }}mm</span>
          </div>

          <div class="st-preview-viewport">
            <canvas ref="stSingleCanvasRef" class="st-single-preview-canvas"></canvas>
          </div>

          <div class="st-action-toolbar">
            <button type="button" class="action-btn primary-ezpl" @click="exportEZPL">
              📥 Export EZPL (.ezpl)
            </button>
            <button type="button" class="action-btn primary-ezpx" @click="exportEZPX">
              📦 Export EZPX (.ezpx)
            </button>
            <button type="button" class="action-btn copy-ezpl" @click="copyEZPL">
              📋 Copy EZPL Code
            </button>
            <button type="button" class="action-btn pdf-btn" @click="downloadStSinglePDF">
              📄 Download PDF
            </button>
            <button type="button" class="action-btn save-btn" @click="saveStTemplate">
              💾 Save Template
            </button>
            <button type="button" class="action-btn load-btn" @click="loadStTemplate">
              📂 Load Template
            </button>
          </div>
        </div>

        <!-- Code Preview Box -->
        <div class="preview-card">
          <h3>💻 Generated EZPL Instruction Stream</h3>
          <pre class="ezpl-code-box">{{ liveEzplCode }}</pre>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, computed, onMounted, nextTick } from 'vue';
import JsBarcode from 'jsbarcode';
import QRCode from 'qrcode';
import jsPDF from 'jspdf';

const PRINTER_DPI = 203;

defineEmits(['open-odoo-modal']);

const stSerialNumbersInput = ref('3726 0001');
const stSingleCanvasRef = ref(null);

const LOCAL_STORAGE_KEY = 'acbarcode_st_template';

function getInitialStTemplate() {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (data && data.elements && Array.isArray(data.elements)) {
        // Update el_separator in saved data if on old coordinates so change takes effect immediately
        const sep = data.elements.find(e => e.id === 'el_separator' || e.name === 'Vertical Separator');
        if (sep) {
          sep.lineShape = 'VLine';
          if (sep.y1Mm === undefined) {
            sep.y1Mm = sep.heightMm ? sep.yMm + sep.heightMm : 17.3;
          }
          if (sep.xMm === 27.0 || sep.xMm === 24.6 || sep.xMm === 23.8) {
            sep.xMm = 19.6;
            sep.yMm = 14.3;
            sep.y1Mm = 17.3;
          }
        }
        return data;
      }
    }
  } catch (e) {
    console.warn('Failed to parse initial saved template:', e);
  }
  return null;
}

const savedStTemplate = getInitialStTemplate();

const stCanvasConfig = ref(savedStTemplate?.config || {
  widthMm: 35,
  heightMm: 22,
  dpi: 203
});

const stElements = ref(savedStTemplate?.elements || [
  {
    id: 'el_logo',
    type: 'image',
    name: 'Logo',
    src: '/t_logo.jpg',
    xMm: 1,
    yMm: 1,
    widthMm: 9.6,
    storedName: 'LOGO',
    expanded: true
  },
  {
    id: 'el_header_url',
    type: 'text',
    name: 'Header URL',
    text: 'www.suto-itec.com',
    xMm: 15.5,
    yMm: 1.8,
    fontSize: 5,
    bold: true,
    expanded: false
  },
  {
    id: 'el_divider',
    type: 'hline',
    name: 'Top Divider Line',
    xMm: 1,
    yMm: 4.2,
    x1Mm: 34,
    thicknessDots: 9,
    expanded: false
  },
  {
    id: 'el_model',
    type: 'text',
    name: 'Model Title',
    text: 'Model: S403 | Thermal Mass Flow',
    xMm: 1,
    yMm: 4.8,
    fontSize: 5,
    bold: true,
    expanded: false
  },
  {
    id: 'el_item_no',
    type: 'text',
    name: 'Item No.',
    text: 'Item No.: S695 4035 (Air)',
    xMm: 1,
    yMm: 7.2,
    fontSize: 4,
    bold: true,
    expanded: false
  },
  {
    id: 'el_serial',
    type: 'text',
    name: 'Serial No.',
    text: 'Serial No.: {{serial}}',
    xMm: 1,
    yMm: 8.9,
    fontSize: 4,
    bold: true,
    expanded: false
  },
  {
    id: 'el_range',
    type: 'text',
    name: 'Range',
    text: 'Range: Standard',
    xMm: 1,
    yMm: 10.6,
    fontSize: 4,
    bold: true,
    expanded: false
  },
  {
    id: 'el_fieldbus',
    type: 'text',
    name: 'Fieldbus',
    text: 'Fieldbus: Modbus/RTU+Analog',
    xMm: 1,
    yMm: 12.3,
    fontSize: 4,
    bold: true,
    expanded: false
  },
  {
    id: 'el_power',
    type: 'text',
    name: 'Power supply',
    text: 'Power supply: 16...30 VDC',
    xMm: 1,
    yMm: 14.2,
    fontSize: 4,
    bold: true,
    expanded: false
  },
  {
    id: 'el_pressure',
    type: 'text',
    name: 'Max. Pressure',
    text: 'Max. Pressure: 5.0 MPa(g)',
    xMm: 1,
    yMm: 15.9,
    fontSize: 4,
    bold: true,
    expanded: false
  },
  {
    id: 'el_separator',
    type: 'hline',
    lineShape: 'VLine',
    name: 'Vertical Separator',
    xMm: 19.6,
    yMm: 14.3,
    y1Mm: 17.3,
    thicknessDots: 5,
    expanded: false
  },
  {
    id: 'el_accuracy',
    type: 'text',
    name: 'Accuracy',
    text: 'Accuracy: 1.5%',
    xMm: 20.4,
    yMm: 14.2,
    fontSize: 4,
    bold: true,
    expanded: false
  },
  {
    id: 'el_mfd',
    type: 'text',
    name: 'MFD',
    text: 'MFD: 2027-07',
    xMm: 20.4,
    yMm: 15.9,
    fontSize: 4,
    bold: true,
    expanded: false
  },
  {
    id: 'el_bgx',
    type: 'image',
    name: 'Bottom Right Image',
    src: '/b_bgx.png',
    xMm: 18,
    yMm: 17.6,
    widthMm: 16,
    storedName: 'BGX',
    autoBottomRight: true,
    expanded: false
  }
]);

function getElementSummary(el) {
  if (el.type === 'text') {
    return el.text ? `"${el.text}"` : '(empty text)';
  } else if (el.type === 'image') {
    return el.storedName ? `[${el.storedName}]` : (el.name || 'Image');
  } else if (el.type === 'hline') {
    return `Y: ${el.yMm}mm (X: ${el.xMm}-${el.x1Mm || 35}mm)`;
  } else if (el.type === 'barcode') {
    return el.data ? `Code128: ${el.data}` : '(no barcode data)';
  } else if (el.type === 'qrcode') {
    return el.data ? `QR: ${el.data}` : '(no QR data)';
  }
  return '';
}

function toggleAllElements(expand) {
  stElements.value.forEach(el => {
    el.expanded = expand;
  });
}

function generateStId() {
  return 'el_' + Math.random().toString(36).substr(2, 9);
}

function addStElement(type) {
  const newEl = {
    id: generateStId(),
    type,
    name: `New ${type.toUpperCase()}`,
    expanded: true
  };

  if (type === 'text') {
    newEl.text = 'New Text Label';
    newEl.xMm = 5;
    newEl.yMm = 5;
    newEl.fontSize = 5;
    newEl.bold = false;
  } else if (type === 'image') {
    newEl.src = '';
    newEl.xMm = 5;
    newEl.yMm = 5;
    newEl.widthMm = 10;
    newEl.storedName = 'IMAGE1';
    newEl.autoBottomRight = false;
  } else if (type === 'hline') {
    newEl.xMm = 2;
    newEl.yMm = 10;
    newEl.x1Mm = stCanvasConfig.value.widthMm - 2;
    newEl.thicknessDots = 3;
  } else if (type === 'barcode') {
    newEl.data = 'PROD-{{serial}}';
    newEl.xMm = 5;
    newEl.yMm = 10;
    newEl.heightMm = 8;
    newEl.readable = true;
  } else if (type === 'qrcode') {
    newEl.data = 'https://example.com/item/{{serial}}';
    newEl.xMm = 25;
    newEl.yMm = 10;
    newEl.mul = 4;
  }

  stElements.value.push(newEl);
}

function removeStElement(index) {
  stElements.value.splice(index, 1);
}

function moveStElement(index, direction) {
  const targetIndex = index + direction;
  if (targetIndex >= 0 && targetIndex < stElements.value.length) {
    const temp = stElements.value[index];
    stElements.value[index] = stElements.value[targetIndex];
    stElements.value[targetIndex] = temp;
  }
}

function onStImageUpload(element, event) {
  const file = event.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      element.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }
}

function fetchFromOdooStub() {
  alert('🔄 Odoo Data Sync Stub:\nIn production, this button will query Odoo for MO / Serial Number details and populate template text fields!');
}

function compileEZPL(serial = '3726 0001') {
  const w = stCanvasConfig.value.widthMm || 35;
  const h = stCanvasConfig.value.heightMm || 22;
  const dpi = stCanvasConfig.value.dpi || 203;
  const mmToDots = (mm) => Math.round((mm / 25.4) * dpi);

  let ezpl = '';
  ezpl += `^Q${h},3\n`;
  ezpl += `^W${w}\n`;
  ezpl += `^H10\n`;
  ezpl += `^S4\n`;
  ezpl += `^L\n`;

  stElements.value.forEach((el) => {
    const textVal = (el.text || el.data || '').replace(/\{\{serial\}\}/g, serial);

    if (el.type === 'text') {
      const x = mmToDots(el.xMm || 0);
      const y = mmToDots(el.yMm || 0);
      const size = el.fontSize || 4;
      let fontCmd = 'AC';
      let mul = 1;
      if (size <= 3.5) {
        fontCmd = 'AB';
      } else if (size <= 4.5) {
        fontCmd = 'AC';
      } else if (size <= 5.5) {
        fontCmd = 'AD';
      } else {
        fontCmd = 'AE';
        mul = Math.max(1, Math.round(size / 6));
      }
      ezpl += `${fontCmd},${x},${y},${mul},${mul},0,0,${textVal}\n`;
      if (el.bold) {
        ezpl += `${fontCmd},${x + 1},${y},${mul},${mul},0,0,${textVal}\n`;
      }
    } else if (el.type === 'hline' || el.type === 'vline') {
      const isVertical = el.lineShape === 'VLine' || el.type === 'vline' || (el.x1Mm !== undefined && el.x1Mm === el.xMm);
      const x = mmToDots(el.xMm || 0);
      const y = mmToDots(el.yMm || 0);
      const thickness = el.thicknessDots || 3;
      if (isVertical) {
        const endY = mmToDots(el.y1Mm !== undefined ? el.y1Mm : (el.yMm + (el.heightMm || 3.0)));
        ezpl += `Lo,${x},${y},${x + thickness},${endY}\n`;
      } else {
        const endX = mmToDots(el.x1Mm !== undefined ? el.x1Mm : w);
        ezpl += `Lo,${x},${y},${endX},${y + thickness}\n`;
      }
    } else if (el.type === 'image') {
      const widthMm = el.widthMm || 10;
      const heightMm = el.heightMm || 3.8;
      const xMm = el.autoBottomRight ? Math.max(0, w - widthMm - 1) : (el.xMm || 0);
      const yMm = el.autoBottomRight ? Math.max(0, h - heightMm - 1) : (el.yMm || 0);
      const x = mmToDots(xMm);
      const y = mmToDots(yMm);
      const graphicName = (el.storedName || el.name || `IMG_${index + 1}`).replace(/[^a-zA-Z0-9_-]/g, '_');
      ezpl += `; --- Graphic: ${el.name || 'Image'} ---\n`;
      ezpl += `Y${x},${y},${graphicName}\n`;
    } else if (el.type === 'barcode') {
      const x = mmToDots(el.xMm || 0);
      const y = mmToDots(el.yMm || 0);
      const heightDots = mmToDots(el.heightMm || 10);
      const readable = el.readable ? 1 : 0;
      ezpl += `BQ,${x},${y},2,5,${heightDots},0,${readable},${textVal}\n`;
    } else if (el.type === 'qrcode') {
      const x = mmToDots(el.xMm || 0);
      const y = mmToDots(el.yMm || 0);
      const mul = el.mul || 4;
      const len = textVal.length;
      ezpl += `W${x},${y},2,2,M,8,${mul},${len},0\n`;
      ezpl += `${textVal}\n`;
    }
  });

  ezpl += `E\n~P1\n`;
  return ezpl;
}

const liveEzplCode = computed(() => {
  const firstSerial = (stSerialNumbersInput.value || '').split(/\r?\n/)[0]?.trim() || '3726 0001';
  return compileEZPL(firstSerial);
});

function escapeXml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function measureTextWidthDots(text, pt, dpi) {
  try {
    const c = document.createElement('canvas');
    const ctx = c.getContext('2d');
    ctx.font = `${pt}pt "Microsoft Sans Serif", "Arial", "Helvetica", sans-serif`;
    const px = ctx.measureText(text).width;
    return Math.max(1, Math.ceil(px * (dpi / 96)));
  } catch (e) {
    return Math.ceil(text.length * pt * (dpi / 72) * 0.55);
  }
}

async function getImageBase64(src) {
  if (!src) return { data: '', width: 0, height: 0 };
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const w = img.naturalWidth || img.width || 100;
        const h = img.naturalHeight || img.height || 100;
        let b64;
        if (src.startsWith('data:')) {
          b64 = src.split(',')[1] || '';
        } else {
          const c = document.createElement('canvas');
          c.width = w;
          c.height = h;
          const ctx = c.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);
          const dataUrl = c.toDataURL('image/png');
          b64 = dataUrl.split(',')[1] || '';
        }
        resolve({ data: b64, width: w, height: h });
      } catch (e) {
        console.warn('Canvas toDataURL failed for image:', src, e);
        resolve({ data: '', width: 0, height: 0 });
      }
    };
    img.onerror = (err) => {
      console.warn('Image load error for src:', src, err);
      resolve({ data: '', width: 0, height: 0 });
    };
    if (src.startsWith('/')) {
      img.src = window.location.origin + src;
    } else {
      img.src = src;
    }
  });
}

async function compileEZPX(serial = '3726 0001') {
  const w = stCanvasConfig.value.widthMm || 35;
  const h = stCanvasConfig.value.heightMm || 22;
  const ezpxDpi = stCanvasConfig.value.dpi || 203;
  let printerModel = 'G500';
  if (ezpxDpi === 300) {
    printerModel = 'EZ-1300+';
  } else if (ezpxDpi === 600) {
    printerModel = 'RT863i+';
  }
  const mmToDots = (mm) => Math.round((mm / 25.4) * ezpxDpi);

  const nullString100 = Array(100).fill('<string xsi:nil="true" />').join('\n      ');
  const zeroInt100 = Array(100).fill('<int>0</int>').join('\n      ');
  const falseBool100 = Array(100).fill('<boolean>false</boolean>').join('\n      ');

  let qlabelShapes = '';

  for (let index = 0; index < stElements.value.length; index++) {
    const el = stElements.value[index];
    const textVal = (el.text || el.data || '').replace(/\{\{serial\}\}/g, serial);
    const escapedText = escapeXml(textVal);

    if (el.type === 'text') {
      // Font size in pt matches el.fontSize 1:1 (5pt for titles/URL, 4pt for details)
      const fontPt = el.fontSize || 4;
      const fontCmdStr = el.bold ? `Arial,${fontPt},B\r\n` : `Arial,${fontPt}\r\n`;

      const fontHeightPx = Math.round((fontPt / 72) * ezpxDpi * 1.2);
      const rectH = Math.max(12, fontHeightPx);
      const rectW = measureTextWidthDots(textVal, fontPt, ezpxDpi);

      const x = mmToDots(el.xMm || 0);
      const y = mmToDots(el.yMm || 0);

      qlabelShapes += `
      <GraphicShape xsi:type="WindowText" Style="Cross" IsPrint="true" PageAlignment="None" Locked="false" bStroke="false" bFill="true" Direction="Angle0" X="${x}" Y="${y}" Alignment="Left" AlignPointX="${x}" AlignPointY="${y}" FontScript="Default" FontCmd="${escapeXml(fontCmdStr)}" FontHeight="1000" FontWidth="1000" TextSpace="0" bSpaceCropping="false">
        <qHitOnCircumferance>false</qHitOnCircumferance>
        <Selected>false</Selected>
        <iBackground_color>4294967295</iBackground_color>
        <Id>${index}</Id>
        <ItemLabel>${escapeXml(el.name || `WindowText_${index}`)}</ItemLabel>
        <ObjectDrawMode>FW</ObjectDrawMode>
        <Name>W</Name>
        <GroupID>0</GroupID>
        <GroupSelected>false</GroupSelected>
        <CharTruncateRule>
          <TrimLeft>false</TrimLeft>
          <TrimRight>false</TrimRight>
          <RemoveCharLeft>false</RemoveCharLeft>
          <RemoveCharLeftNo>0</RemoveCharLeftNo>
          <RemoveCharRight>false</RemoveCharRight>
          <RemoveCharRightNo>0</RemoveCharRightNo>
          <KeepCharLeft>false</KeepCharLeft>
          <KeepCharLeftNo>6</KeepCharLeftNo>
          <KeepCharRight>false</KeepCharRight>
          <KeepCharRightNo>6</KeepCharRightNo>
          <RemoveDotZero>false</RemoveDotZero>
        </CharTruncateRule>
        <bReplaceSpecialCharFromDB>false</bReplaceSpecialCharFromDB>
        <ScriptCode_Base64 />
        <CharFilterRule>None</CharFilterRule>
        <LinkMode>OriginalData</LinkMode>
        <GraphicMode>false</GraphicMode>
        <ReplaceInfoItems />
        <FormatType>None</FormatType>
        <P1 />
        <P2 />
        <P3 />
        <P4 />
        <Culture>zh-CN</Culture>
        <calendar>GregorianCalendar</calendar>
        <GetAiFromDigitalLink>false</GetAiFromDigitalLink>
        <DataField>None</DataField>
        <Prompt>None</Prompt>
        <BoundRectWidth>${rectW}</BoundRectWidth>
        <DispData>${escapedText}</DispData>
        <bRemovePreZeroAndEmpty>false</bRemovePreZeroAndEmpty>
        <Data>${escapedText}</Data>
        <ItemInfoList>
          <Item>
            <ItemSymbol>1</ItemSymbol>
            <ItemData>${escapedText}</ItemData>
          </Item>
        </ItemInfoList>
        <BoundRectHeight>${rectH}</BoundRectHeight>
        <BoundRect>
          <Location>
            <X>${x}</X>
            <Y>${y}</Y>
          </Location>
          <Size>
            <Width>${rectW}</Width>
            <Height>${rectH}</Height>
          </Size>
          <X>${x}</X>
          <Y>${y}</Y>
          <Width>${rectW}</Width>
          <Height>${rectH}</Height>
        </BoundRect>
        <BTrueType>true</BTrueType>
        <Angle>0</Angle>
        <IsInverse>false</IsInverse>
        <bVerticalRedirection>false</bVerticalRedirection>
        <VerticalKerningOffset>0</VerticalKerningOffset>
        <CharacterSpacingRate>0</CharacterSpacingRate>
      </GraphicShape>`;
    } else if (el.type === 'hline' || el.type === 'vline') {
      const isVertical = el.lineShape === 'VLine' || el.type === 'vline' || (el.x1Mm !== undefined && el.x1Mm === el.xMm);
      const x = mmToDots(el.xMm || 0);
      const y = mmToDots(el.yMm || 0);
      
      let lineShapeStr, wVal, hVal;
      if (isVertical) {
        lineShapeStr = 'VLine';
        wVal = el.thicknessDots || 5;
        const endY = el.y1Mm !== undefined ? el.y1Mm : (el.yMm + (el.heightMm || 3.0));
        hVal = Math.max(1, mmToDots(endY - el.yMm));
      } else {
        lineShapeStr = 'HLine';
        const endX = el.x1Mm !== undefined ? el.x1Mm : w;
        wVal = Math.max(1, mmToDots(endX - el.xMm));
        hVal = el.thicknessDots || 5;
      }

      qlabelShapes += `
      <GraphicShape xsi:type="Line" Style="Cross" IsPrint="true" PageAlignment="None" Locked="false" bStroke="true" bFill="true" Direction="Angle0" X="${x}" Y="${y}" Alignment="Left" AlignPointX="${x}" AlignPointY="${y}">
        <qHitOnCircumferance>false</qHitOnCircumferance>
        <Selected>false</Selected>
        <iBackground_color>4294967295</iBackground_color>
        <Id>${index}</Id>
        <ItemLabel>${escapeXml(el.name || `Line_${index}`)}</ItemLabel>
        <ObjectDrawMode>FW</ObjectDrawMode>
        <Name>L</Name>
        <GroupID>0</GroupID>
        <GroupSelected>false</GroupSelected>
        <lineShape>${lineShapeStr}</lineShape>
        <Height>${hVal}</Height>
        <Operation>111</Operation>
        <Width>${wVal}</Width>
      </GraphicShape>`;
    } else if (el.type === 'image') {
      const imgInfo = await getImageBase64(el.src);
      const base64Data = imgInfo.data;

      const widthMm = el.widthMm || 10;
      let heightMm;
      if (el.heightMm) {
        heightMm = el.heightMm;
      } else if (imgInfo.width > 0) {
        heightMm = widthMm * (imgInfo.height / imgInfo.width);
      } else {
        heightMm = widthMm * 0.45;
      }

      let xMm = el.xMm || 0;
      let yMm = el.yMm || 0;
      if (el.autoBottomRight) {
        xMm = w - widthMm - 1;
        yMm = h - heightMm - 1;
      }

      const x = mmToDots(xMm);
      const y = mmToDots(yMm);
      const wDots = mmToDots(widthMm);
      const hDots = mmToDots(heightMm);
      const graphicName = (el.storedName || el.name || `Graphic_${index + 1}`).replace(/[^a-zA-Z0-9_-]/g, '_');

      qlabelShapes += `
      <GraphicShape xsi:type="Image" Style="Cross" IsPrint="true" PageAlignment="None" Locked="false" bStroke="true" bFill="true" Direction="Angle0" X="${x}" Y="${y}" Alignment="Left" AlignPointX="${x}" AlignPointY="${y}" FontScript="Default" FixedRatio="false">
        <qHitOnCircumferance>false</qHitOnCircumferance>
        <Selected>false</Selected>
        <iBackground_color>4294967295</iBackground_color>
        <Id>${index}</Id>
        <ItemLabel>${escapeXml(el.name || `Image_${index}`)}</ItemLabel>
        <ObjectDrawMode>FW</ObjectDrawMode>
        <Name>Y</Name>
        <GroupID>0</GroupID>
        <GroupSelected>false</GroupSelected>
        <CharTruncateRule>
          <TrimLeft>false</TrimLeft>
          <TrimRight>false</TrimRight>
          <RemoveCharLeft>false</RemoveCharLeft>
          <RemoveCharLeftNo>0</RemoveCharLeftNo>
          <RemoveCharRight>false</RemoveCharRight>
          <RemoveCharRightNo>0</RemoveCharRightNo>
          <KeepCharLeft>false</KeepCharLeft>
          <KeepCharLeftNo>6</KeepCharLeftNo>
          <KeepCharRight>false</KeepCharRight>
          <KeepCharRightNo>6</KeepCharRightNo>
          <RemoveDotZero>false</RemoveDotZero>
        </CharTruncateRule>
        <bReplaceSpecialCharFromDB>false</bReplaceSpecialCharFromDB>
        <ScriptCode_Base64 />
        <CharFilterRule>None</CharFilterRule>
        <LinkMode>OriginalData</LinkMode>
        <GraphicMode>false</GraphicMode>
        <ReplaceInfoItems />
        <FormatType>None</FormatType>
        <P1 />
        <P2 />
        <P3 />
        <P4 />
        <Culture>zh-CN</Culture>
        <calendar>GregorianCalendar</calendar>
        <GetAiFromDigitalLink>false</GetAiFromDigitalLink>
        <DataField>None</DataField>
        <Prompt>None</Prompt>
        <BoundRectWidth>${wDots}</BoundRectWidth>
        <DispData />
        <bRemovePreZeroAndEmpty>false</bRemovePreZeroAndEmpty>
        <Data />
        <ItemInfoList />
        <BoundRectHeight>${hDots}</BoundRectHeight>
        <BoundRect>
          <Location><X>${x}</X><Y>${y}</Y></Location>
          <Size><Width>${wDots}</Width><Height>${hDots}</Height></Size>
          <X>${x}</X><Y>${y}</Y><Width>${wDots}</Width><Height>${hDots}</Height>
        </BoundRect>
        <BitmapCmd>${base64Data}</BitmapCmd>
        <FixedAspectRatio>false</FixedAspectRatio>
        <LoadToDevice>false</LoadToDevice>
        <FileName>${escapeXml(graphicName)}</FileName>
        <Identifier />
        <DitherType>Default</DitherType>
        <RotationFlip>RotateNoneFlipNone</RotationFlip>
        <Angle>0</Angle>
        <Binverse>false</Binverse>
      </GraphicShape>`;
    } else if (el.type === 'barcode') {
      const x = mmToDots(el.xMm || 0);
      const y = mmToDots(el.yMm || 0);
      const heightDots = mmToDots(el.heightMm || 10);
      const readable = el.readable ? "Bottom" : "None";

      qlabelShapes += `
      <GraphicShape xsi:type="Barcode" Style="Cross" IsPrint="true" PageAlignment="None" Locked="false" bStroke="true" bFill="true" Direction="Angle0" X="${x}" Y="${y}" Alignment="Left" AlignPointX="${x}" AlignPointY="${y}" BarcodeType="Code128" Height="${heightDots}" Narrow="2" Wide="5" Readable="${readable}" DisplayText="${escapedText}">
        <qHitOnCircumferance>false</qHitOnCircumferance>
        <Selected>false</Selected>
        <iBackground_color>4294967295</iBackground_color>
        <Id>${index}</Id>
        <ItemLabel>${escapeXml(el.name || `Barcode_${index}`)}</ItemLabel>
        <ObjectDrawMode>FW</ObjectDrawMode>
        <Data>${escapedText}</Data>
        <DispData>${escapedText}</DispData>
      </GraphicShape>`;
    } else if (el.type === 'qrcode') {
      const x = mmToDots(el.xMm || 0);
      const y = mmToDots(el.yMm || 0);
      const mul = el.mul || 4;

      qlabelShapes += `
      <GraphicShape xsi:type="QRCode" Style="Cross" IsPrint="true" PageAlignment="None" Locked="false" bStroke="true" bFill="true" Direction="Angle0" X="${x}" Y="${y}" Alignment="Left" AlignPointX="${x}" AlignPointY="${y}" Mode="Auto" Type="M" Multiplier="${mul}">
        <qHitOnCircumferance>false</qHitOnCircumferance>
        <Selected>false</Selected>
        <iBackground_color>4294967295</iBackground_color>
        <Id>${index}</Id>
        <ItemLabel>${escapeXml(el.name || `QRCode_${index}`)}</ItemLabel>
        <ObjectDrawMode>FW</ObjectDrawMode>
        <Data>${escapedText}</Data>
        <DispData>${escapedText}</DispData>
      </GraphicShape>`;
    }
  }

  return `<?xml version="1.0" encoding="utf-8"?>
<PrintJob xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <FileEncryptPwd />
  <GraphicMode>false</GraphicMode>
  <FormatVersion>1</FormatVersion>
  <QLabelSDKVersion>1.5.9708.17906</QLabelSDKVersion>
  <GoLabelZoomFactor>0.5</GoLabelZoomFactor>
  <Label>
    <Scale>
      <ComName>COM1</ComName>
      <Baudrate>9600</Baudrate>
      <Parity>N</Parity>
      <DataBit>8</DataBit>
      <StopBit>1</StopBit>
      <TCPServerPort>23</TCPServerPort>
      <TCPClientPort>23</TCPClientPort>
    </Scale>
    <SerialFormat>
      ${nullString100}
    </SerialFormat>
    <SerialLeadingCode>
      ${zeroInt100}
    </SerialLeadingCode>
    <SerialCustomSequence>
      ${nullString100}
    </SerialCustomSequence>
    <bSerialSpecialCarry>
      ${falseBool100}
    </bSerialSpecialCarry>
    <VariableFormat>
      ${nullString100}
    </VariableFormat>
    <VariableDisplayName>
      ${nullString100}
    </VariableDisplayName>
    <UnitPriceType>None</UnitPriceType>
    <UnitPrice>0</UnitPrice>
    <PricePromptMode>Always</PricePromptMode>
    <TaraType>None</TaraType>
    <Tara>0</Tara>
    <TaraPromptMode>Always</TaraPromptMode>
    <qlabel>${qlabelShapes}
    </qlabel>
    <VariableOpFormat />
    <VariableOption />
    <DateFormat>y2-me-dd</DateFormat>
    <TimeFormat>h:m:s</TimeFormat>
    <DataBaseFormat>None</DataBaseFormat>
    <DataBaseFilePath />
    <DataBaseSelection />
    <UserID />
    <Password>zhsTbm6nT9o+RQurpwH5Hw==</Password>
    <EncryptPwd>true</EncryptPwd>
    <DatabaseNoHeader>false</DatabaseNoHeader>
    <IntegratedSecurity>false</IntegratedSecurity>
    <RowIndex>0</RowIndex>
  </Label>
  <Setup bInfinityPrint="false" LabelLength="${h}" LabelWidth="${w}" LeftMargin="0" TopMargin="0" LabelType="0" GapLength="3" FeedLength="0" ZSign="45" BlackMark="3" Position="0" Speed="4" Copy="1" bCopyDataBase="false" CopyField="None" Stripper="0" LabelsPerCut="0" DoubleCut_Enable="false" DoubleCut_OffsetLen="0" DoubleCut_FirstCutMode="1" Rotate180="255" Stop="18" Darkness="8" Number="1" bCutDataBase="false" bBatchCut="false" bPartialCut="false" bFullCutLast="false" bFullCutEachRecord="false" bNumberDataBase="false" NumberField="None" PageDirection="Portrait" PrintMode="1" bUsePrinterRFIDCfg="false" PowerRFID="0" LengthRFID="-1" RetryRFID="1" DrawMode="0">
    <Layout Shape="0" AcrossType="Copied" PageDirection="Portrait" HorAcross="1" VerAcross="1" HorGap="0" VerGap="0" HorAcrossMode1="1" VerAcrossMode1="1" LabelMode="0" HorGapMode1="0" VerGapMode1="0" BottomMargin="0" RightMargin="0" />
    <Description>Lang:(en-US) OS:Microsoft Windows NT 10.0.26200.0(Win32NT)</Description>
    <UnitType>Mm</UnitType>
    <Dpi>${ezpxDpi}</Dpi>
  </Setup>
  <ProtectAction Darkness="true" Speed="true" Peeler="true" PrintMode="true" StopPosition="true" PageDirection="true" DrawMode="true" Rotate180="true" />
  <DriverName />
  <BLE_MAC />
  <BLE_Address>0</BLE_Address>
  <BLE_AutoMTU>true</BLE_AutoMTU>
  <BLE_MTU>20</BLE_MTU>
  <PrinterModel>${printerModel}</PrinterModel>
  <PrinterLanguage>EZPL</PrinterLanguage>
  <USBName>00000000</USBName>
  <COMName />
  <CommunicationType>USB</CommunicationType>
  <NetworkIPAddress>0</NetworkIPAddress>
  <NetworkPort>9100</NetworkPort>
  <BaudRate>9600</BaudRate>
  <ComSettings>N81</ComSettings>
  <StandaloneDbSearchKey />
  <StandaloneDbEnable>false</StandaloneDbEnable>
  <StandaloneDbMode>PrintByFieldInput</StandaloneDbMode>
</PrintJob>`;
}

function exportEZPL() {
  const firstSerial = (stSerialNumbersInput.value || '').split(/\r?\n/)[0]?.trim() || '3726 0001';
  const ezplText = compileEZPL(firstSerial);
  const blob = new Blob([ezplText], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `label_${firstSerial.replace(/\s+/g, '_')}.ezpl`;
  a.click();
  URL.revokeObjectURL(url);
}

async function exportEZPX() {
  const firstSerial = (stSerialNumbersInput.value || '').split(/\r?\n/)[0]?.trim() || '3726 0001';
  const ezpxXml = await compileEZPX(firstSerial);
  const blob = new Blob([ezpxXml], { type: 'application/xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `label_${firstSerial.replace(/\s+/g, '_')}.ezpx`;
  a.click();
  URL.revokeObjectURL(url);
}

async function copyEZPL() {
  const firstSerial = (stSerialNumbersInput.value || '').split(/\r?\n/)[0]?.trim() || '3726 0001';
  const ezplText = compileEZPL(firstSerial);
  try {
    await navigator.clipboard.writeText(ezplText);
    alert('📋 EZPL command code copied to clipboard!');
  } catch (err) {
    console.error('Failed to copy EZPL code:', err);
  }
}

function saveStTemplate() {
  const data = {
    config: stCanvasConfig.value,
    elements: stElements.value
  };
  localStorage.setItem('acbarcode_st_template', JSON.stringify(data));
  alert('💾 Label Template saved successfully to local storage!');
}

function loadStTemplate() {
  const raw = localStorage.getItem('acbarcode_st_template');
  if (raw) {
    try {
      const data = JSON.parse(raw);
      if (data.config) stCanvasConfig.value = data.config;
      if (data.elements) stElements.value = data.elements;
      alert('📂 Label Template loaded successfully!');
    } catch (err) {
      alert('Failed to parse saved template.');
    }
  } else {
    alert('No saved template found in local storage.');
  }
}

const imageCache = new Map();

function getCachedImage(src) {
  if (!src) return Promise.resolve(null);
  if (imageCache.has(src)) {
    return Promise.resolve(imageCache.get(src));
  }
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      imageCache.set(src, img);
      resolve(img);
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

async function renderStCanvasDynamic(canvas, serial = '3726 0001') {
  if (!canvas) return;
  const dpi = PRINTER_DPI;
  const mmToPx = (mm) => Math.round((mm / 25.4) * dpi);
  const ptToPx = (pt) => Math.round((pt / 72) * dpi);

  const W = mmToPx(stCanvasConfig.value.widthMm || 35);
  const H = mmToPx(stCanvasConfig.value.heightMm || 22);

  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);

  for (const el of stElements.value) {
    const textVal = (el.text || el.data || '').replace(/\{\{serial\}\}/g, serial);

    if (el.type === 'text') {
      const fontSizePx = ptToPx(el.fontSize || 4);
      const fontWeight = el.bold ? 'bold' : 'normal';
      ctx.font = `${fontWeight} ${fontSizePx}px "Arial", "Helvetica", sans-serif`;
      ctx.fillStyle = '#000000';
      ctx.textBaseline = 'top';

      ctx.textAlign = 'left';
      ctx.fillText(textVal, mmToPx(el.xMm), mmToPx(el.yMm));
    } else if (el.type === 'hline' || el.type === 'vline') {
      const isVertical = el.lineShape === 'VLine' || el.type === 'vline' || (el.x1Mm !== undefined && el.x1Mm === el.xMm);
      ctx.beginPath();
      ctx.moveTo(mmToPx(el.xMm), mmToPx(el.yMm));
      if (isVertical) {
        const endY = el.y1Mm !== undefined ? el.y1Mm : (el.yMm + (el.heightMm || 3.0));
        ctx.lineTo(mmToPx(el.xMm), mmToPx(endY));
      } else {
        const endX = el.x1Mm !== undefined ? el.x1Mm : stCanvasConfig.value.widthMm;
        ctx.lineTo(mmToPx(endX), mmToPx(el.yMm));
      }
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = el.thicknessDots || 3;
      ctx.stroke();
    } else if (el.type === 'image' && el.src) {
      const img = await getCachedImage(el.src);
      if (img && img.naturalWidth > 0) {
        const imgW = mmToPx(el.widthMm || 10);
        const imgH = Math.round(img.height * (imgW / img.width));
        let x = mmToPx(el.xMm || 0);
        let y = mmToPx(el.yMm || 0);
        if (el.autoBottomRight) {
          x = W - imgW - mmToPx(1);
          y = H - imgH - mmToPx(1);
        }
        ctx.drawImage(img, x, y, imgW, imgH);
      }
    } else if (el.type === 'barcode') {
      try {
        const offscreenCanvas = document.createElement('canvas');
        JsBarcode(offscreenCanvas, textVal, {
          format: 'CODE128',
          width: 2,
          height: mmToPx(el.heightMm || 10),
          displayValue: el.readable !== false,
          fontSize: ptToPx(4),
          margin: 0
        });
        const bcW = offscreenCanvas.width;
        const bcH = offscreenCanvas.height;
        ctx.drawImage(offscreenCanvas, mmToPx(el.xMm), mmToPx(el.yMm), bcW, bcH);
      } catch (e) {
        console.warn('Barcode render error:', e);
      }
    } else if (el.type === 'qrcode') {
      try {
        const offscreenCanvas = document.createElement('canvas');
        await QRCode.toCanvas(offscreenCanvas, textVal, {
          width: mmToPx((el.mul || 4) * 2.5),
          margin: 0
        });
        ctx.drawImage(offscreenCanvas, mmToPx(el.xMm), mmToPx(el.yMm));
      } catch (e) {
        console.warn('QR render error:', e);
      }
    }
  }
}

function autoSaveStTemplate() {
  const data = {
    config: stCanvasConfig.value,
    elements: stElements.value
  };
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('Auto-save to localStorage failed:', e);
  }
}

watch(
  [stCanvasConfig, stElements, stSerialNumbersInput],
  async () => {
    autoSaveStTemplate();
    await nextTick();
    const firstSerial = (stSerialNumbersInput.value || '').split(/\r?\n/)[0]?.trim() || '3726 0001';
    if (stSingleCanvasRef.value) {
      renderStCanvasDynamic(stSingleCanvasRef.value, firstSerial);
    }
  },
  { deep: true }
);

onMounted(() => {
  nextTick(() => {
    const firstSerial = (stSerialNumbersInput.value || '').split(/\r?\n/)[0]?.trim() || '3726 0001';
    if (stSingleCanvasRef.value) {
      renderStCanvasDynamic(stSingleCanvasRef.value, firstSerial);
    }
  });
});

function downloadStSinglePDF() {
  const canvas = stSingleCanvasRef.value;
  if (!canvas) return;
  const firstSerial = (stSerialNumbersInput.value || '').split(/\r?\n/)[0]?.trim() || '3726 0001';
  try {
    const w = stCanvasConfig.value.widthMm || 35;
    const h = stCanvasConfig.value.heightMm || 22;
    const pdf = new jsPDF({ unit: 'mm', format: [w, h], orientation: w >= h ? 'landscape' : 'portrait' });
    const dataUrl = canvas.toDataURL('image/png');
    pdf.addImage(dataUrl, 'PNG', 0, 0, w, h);
    pdf.save(`ST_Label_${firstSerial.replace(/\s+/g, '_')}.pdf`);
  } catch (err) {
    console.error('Error downloading ST PDF:', err);
  }
}
</script>

<style scoped>
.st-designer-container {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.st-header-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
}

.st-header-left {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.sn-input-group {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.sn-label {
  font-weight: 600;
  font-size: 0.9rem;
  color: #2d3748;
  white-space: nowrap;
}

.sn-input {
  padding: 0.5rem 0.75rem;
  border: 1px solid #cbd5e0;
  border-radius: 6px;
  font-size: 0.9rem;
  width: 200px;
}

.fetch-odoo-stub-btn {
  background: #319795 !important;
  color: white !important;
  border: none;
  padding: 0.5rem 1rem !important;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 500;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  box-shadow: none !important;
  width: auto !important;
}

.fetch-odoo-stub-btn:hover {
  background: #2c7a7b !important;
}

.manage-odoo-btn {
  background: #4a5568 !important;
  color: white !important;
  border: none;
  padding: 0.5rem 1rem !important;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 500;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  box-shadow: none !important;
  width: auto !important;
}

.manage-odoo-btn:hover {
  background: #2d3748 !important;
}

.st-editor-layout {
  display: grid;
  grid-template-columns: 1.2fr 1fr;
  gap: 1.5rem;
  align-items: start;
}

@media (max-width: 960px) {
  .st-editor-layout {
    grid-template-columns: 1fr;
  }
}

.st-editor-panel, .st-preview-panel {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.editor-card, .preview-card {
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
}

.editor-card h3, .preview-card h3 {
  margin-top: 0;
  margin-bottom: 1rem;
  font-size: 1.15rem;
  color: #2d3748;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.editor-card-header, .preview-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.header-left h3 {
  margin: 0 !important;
}

.header-actions-group {
  display: flex;
  gap: 0.4rem;
}

.mini-text-btn {
  background: #edf2f7 !important;
  color: #4a5568 !important;
  font-size: 0.75rem !important;
  padding: 0.25rem 0.65rem !important;
  border-radius: 4px !important;
  border: 1px solid #cbd5e0 !important;
  cursor: pointer;
  box-shadow: none !important;
  width: auto !important;
  min-height: unset !important;
  font-weight: 500;
  transition: all 0.2s ease;
}

.mini-text-btn:hover {
  background: #cbd5e0 !important;
  color: #1a202c !important;
}

.element-count-badge, .canvas-dim-tag {
  background: #edf2f7;
  color: #4a5568;
  padding: 0.25rem 0.65rem;
  border-radius: 20px;
  font-size: 0.8rem;
  font-weight: 600;
}

.form-row {
  display: flex;
  gap: 0.75rem;
}

.form-row .form-group {
  flex: 1;
}

.form-group {
  margin-bottom: 0.75rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.35rem;
  font-weight: 500;
  color: #4a5568;
  font-size: 0.85rem;
}

input[type="text"], input[type="number"], select, textarea {
  width: 100%;
  padding: 0.5rem 0.75rem;
  border: 1px solid #cbd5e0;
  border-radius: 6px;
  font-size: 0.9rem;
  box-sizing: border-box;
}

.elements-list {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  max-height: 520px;
  overflow-y: auto;
  padding-right: 6px;
}

/* Custom Styled Scrollbar */
.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}

.custom-scrollbar::-webkit-scrollbar-track {
  background: #f1f5f9;
  border-radius: 4px;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
  background: #cbd5e0;
  border-radius: 4px;
}

.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: #94a3b8;
}

.element-item-card {
  border: 1px solid #e2e8f0;
  border-left: 4px solid #cbd5e0;
  border-radius: 8px;
  background: #f8fafc;
  overflow: visible;
  transition: all 0.2s ease;
}

.element-item-card:hover {
  border-color: #cbd5e0;
}

.element-item-card.is-expanded {
  box-shadow: 0 3px 12px rgba(0, 0, 0, 0.05);
  border-color: #cbd5e0;
}

.element-item-card.type-text { border-left-color: #3182ce; }
.element-item-card.type-image { border-left-color: #38a169; }
.element-item-card.type-hline { border-left-color: #d69e2e; }
.element-item-card.type-barcode { border-left-color: #805ad5; }
.element-item-card.type-qrcode { border-left-color: #dd6b20; }

.element-item-header {
  padding: 0.65rem 0.85rem;
  background: #edf2f7;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  cursor: pointer;
  user-select: none;
  transition: background 0.2s ease;
}

.element-item-header:hover {
  background: #e2e8f0;
}

.header-main-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

.header-sub-row {
  display: flex;
  width: 100%;
  margin-top: 0.1rem;
}

.element-title-group {
  display: flex;
  align-items: center;
  gap: 0.55rem;
}

.expand-arrow {
  font-size: 0.75rem;
  color: #718096;
  width: 12px;
  flex-shrink: 0;
}

.type-badge {
  font-size: 0.7rem;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 4px;
  color: white;
  flex-shrink: 0;
}

.element-name {
  font-weight: 600;
  color: #2d3748;
  font-size: 0.9rem;
}

.element-summary-badge {
  font-size: 0.83rem;
  color: #1a365d;
  background: #ebf8ff;
  border: 1px solid #cbd5e0;
  padding: 3px 8px;
  border-radius: 4px;
  font-family: 'Courier New', Courier, monospace;
  font-weight: 600;
  width: 100%;
  box-sizing: border-box;
  word-break: break-word;
  white-space: normal;
  line-height: 1.35;
}

.type-badge.text { background: #3182ce; }
.type-badge.image { background: #38a169; }
.type-badge.hline { background: #d69e2e; }
.type-badge.barcode { background: #805ad5; }
.type-badge.qrcode { background: #dd6b20; }

.element-name {
  font-weight: 600;
  color: #2d3748;
  font-size: 0.9rem;
}

.element-actions {
  display: flex;
  align-items: center;
  gap: 0.2rem;
}

.icon-btn {
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  width: 26px !important;
  height: 26px !important;
  padding: 0 !important;
  border: none !important;
  border-radius: 50% !important;
  background: transparent !important;
  color: #a0aec0 !important;
  cursor: pointer !important;
  box-shadow: none !important;
  transition: all 0.15s ease !important;
  outline: none !important;
}

.icon-btn:hover:not(:disabled) {
  color: #4a5568 !important;
  background: #edf2f7 !important;
}

.icon-btn:disabled {
  opacity: 0.25 !important;
  cursor: not-allowed !important;
}

.icon-btn.delete-btn:hover:not(:disabled) {
  color: #e53e3e !important;
  background: #fff5f5 !important;
}

.element-item-body {
  padding: 1rem;
  background: white;
  border-top: 1px solid #e2e8f0;
}

.checkbox-group {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 1.5rem;
}

.checkbox-group label {
  cursor: pointer;
}

.image-upload-row {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.upload-preview-thumb {
  max-height: 40px;
  max-width: 60px;
  border: 1px solid #cbd5e0;
  border-radius: 4px;
}

.add-element-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid #e2e8f0;
  font-size: 0.9rem;
  font-weight: 600;
  color: #4a5568;
}

.add-type-btn {
  background: #edf2f7 !important;
  color: #2d3748 !important;
  padding: 0.4rem 0.75rem !important;
  font-size: 0.85rem !important;
  border: 1px solid #cbd5e0 !important;
  border-radius: 6px;
  cursor: pointer;
  box-shadow: none !important;
  width: auto !important;
}

.add-type-btn:hover {
  background: #cbd5e0 !important;
}

.st-preview-viewport {
  background: #f7fafc;
  border: 2px dashed #cbd5e0;
  border-radius: 8px;
  padding: 1.5rem;
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 240px;
}

.st-single-preview-canvas {
  background: white;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  border: 1px solid #e2e8f0;
  max-width: 100%;
  height: auto;
  border-radius: 4px;
}

.st-action-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 0.65rem;
  margin-top: 1.25rem;
}

.action-btn {
  padding: 0.6rem 1rem !important;
  font-size: 0.9rem !important;
  font-weight: 600 !important;
  border-radius: 8px !important;
  cursor: pointer;
  flex: 1;
  min-width: 130px;
  text-align: center;
  border: none;
}

.primary-ezpl {
  background: #3182ce !important;
  color: white !important;
}

.primary-ezpl:hover {
  background: #2b6cb0 !important;
}

.primary-ezpx {
  background: #805ad5 !important;
  color: white !important;
}

.primary-ezpx:hover {
  background: #6b46c1 !important;
}

.copy-ezpl {
  background: #38a169 !important;
  color: white !important;
}

.copy-ezpl:hover {
  background: #2f855a !important;
}

.pdf-btn {
  background: #e53e3e !important;
  color: white !important;
}

.pdf-btn:hover {
  background: #c53030 !important;
}

.save-btn {
  background: #d69e2e !important;
  color: white !important;
}

.save-btn:hover {
  background: #b7791f !important;
}

.load-btn {
  background: #718096 !important;
  color: white !important;
}

.load-btn:hover {
  background: #4a5568 !important;
}

.ezpl-code-box {
  background: #1a202c;
  color: #68d391;
  padding: 1rem;
  border-radius: 8px;
  font-family: 'Courier New', Courier, monospace;
  font-size: 0.85rem;
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 250px;
  overflow-y: auto;
  margin: 0;
}
</style>

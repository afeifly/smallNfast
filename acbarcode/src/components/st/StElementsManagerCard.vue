<template>
  <div class="editor-card">
    <div class="editor-card-header">
      <div class="header-left">
        <h3>🎨 Label Elements Layer Manager</h3>
        <span class="element-count-badge">{{ elements.length }} elements</span>
      </div>
      <div class="header-actions-group">
        <button type="button" class="mini-text-btn" @click="toggleAllElements(false)">Collapse All</button>
        <button type="button" class="mini-text-btn" @click="toggleAllElements(true)">Expand All</button>
      </div>
    </div>

    <div class="elements-list custom-scrollbar">
      <div 
        v-for="(el, index) in elements" 
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
              <button type="button" class="icon-btn move-btn" :disabled="index === 0" @click="moveElement(index, -1)" title="Move Up">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m18 15-6-6-6 6"/></svg>
              </button>
              <button type="button" class="icon-btn move-btn" :disabled="index === elements.length - 1" @click="moveElement(index, 1)" title="Move Down">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
              </button>
              <button type="button" class="icon-btn delete-btn" @click="removeElement(index)" title="Delete Element">
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
                <input type="file" accept="image/*" @change="e => onImageUpload(el, e)" />
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
      <button type="button" class="add-type-btn" @click="addElement('text')">+ Text</button>
      <button type="button" class="add-type-btn" @click="addElement('image')">+ Image</button>
      <button type="button" class="add-type-btn" @click="addElement('hline')">+ Line</button>
      <button type="button" class="add-type-btn" @click="addElement('barcode')">+ Barcode</button>
      <button type="button" class="add-type-btn" @click="addElement('qrcode')">+ QR Code</button>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  elements: {
    type: Array,
    required: true
  },
  canvasConfig: {
    type: Object,
    required: true
  }
});

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
  props.elements.forEach(el => {
    el.expanded = expand;
  });
}

function generateStId() {
  return 'el_' + Math.random().toString(36).substr(2, 9);
}

function addElement(type) {
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
    newEl.x1Mm = (props.canvasConfig.widthMm || 35) - 2;
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

  props.elements.push(newEl);
}

function removeElement(index) {
  props.elements.splice(index, 1);
}

function moveElement(index, direction) {
  const targetIndex = index + direction;
  if (targetIndex >= 0 && targetIndex < props.elements.length) {
    const temp = props.elements[index];
    props.elements[index] = props.elements[targetIndex];
    props.elements[targetIndex] = temp;
  }
}

function onImageUpload(element, event) {
  const file = event.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      element.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }
}
</script>

<style scoped>
.editor-card {
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
}

.editor-card-header {
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
  font-size: 1.15rem;
  color: #2d3748;
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

.element-count-badge {
  background: #edf2f7;
  color: #4a5568;
  padding: 0.25rem 0.65rem;
  border-radius: 20px;
  font-size: 0.8rem;
  font-weight: 600;
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

input[type="text"], input[type="number"], select {
  width: 100%;
  padding: 0.5rem 0.75rem;
  border: 1px solid #cbd5e0;
  border-radius: 6px;
  font-size: 0.9rem;
  box-sizing: border-box;
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
</style>

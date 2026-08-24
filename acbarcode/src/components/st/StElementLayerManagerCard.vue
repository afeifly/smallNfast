<template>
  <div class="editor-card layer-manager-card">
    <div class="editor-card-header">
      <div class="header-left">
        <h3>🎨 Label Elements Layer Manager</h3>
        <span class="element-count-badge">{{ elements.length }} Layers</span>
      </div>
      <div class="header-actions-group">
        <button type="button" class="mini-text-btn" @click="toggleAllElements(false)">Collapse All</button>
        <button type="button" class="mini-text-btn" @click="toggleAllElements(true)">Expand All</button>
      </div>
    </div>

    <!-- Layers List Accordion -->
    <div class="elements-list custom-scrollbar">
      <div 
        v-for="(el, index) in elements" 
        :key="el.id" 
        class="element-item-card"
        :class="['type-' + el.type, { 'is-expanded': el.expanded === true }]"
      >
        <!-- Element Accordion Header Bar -->
        <div class="element-item-header" @click="toggleElementExpand(el)">
          <div class="header-top-row">
            <div class="header-left-group">
              <span class="layer-index">#{{ index + 1 }}</span>
              <span class="type-badge">{{ getTypeLabel(el.type) }}</span>
              <input 
                type="text" 
                v-model="el.name" 
                class="element-name-input" 
                placeholder="Layer Name"
                @click.stop 
              />
            </div>

            <div class="header-right-group" @click.stop>
              <div class="layer-reorder-btns">
                <button 
                  type="button" 
                  class="icon-btn" 
                  title="Move Up" 
                  :disabled="index === 0"
                  @click="moveElement(index, -1)"
                >
                  ▲
                </button>
                <button 
                  type="button" 
                  class="icon-btn" 
                  title="Move Down" 
                  :disabled="index === elements.length - 1"
                  @click="moveElement(index, 1)"
                >
                  ▼
                </button>
                <button 
                  type="button" 
                  class="icon-btn delete-btn" 
                  title="Remove Layer" 
                  @click="removeStElement(index)"
                >
                  🗑️
                </button>
              </div>

              <button 
                type="button" 
                class="expand-toggle-btn"
                @click.stop="toggleElementExpand(el)"
              >
                {{ el.expanded === true ? 'Collapse ▲' : 'Edit ✏️' }}
              </button>
            </div>
          </div>

          <!-- Value Summary Subline (Always Fully Visible) -->
          <div class="header-bottom-row">
            <span class="preview-snippet" :title="getElementSummary(el)">
              <strong class="snippet-label">Value:</strong> {{ getElementSummary(el) }}
            </span>
          </div>
        </div>

        <!-- Expanded Form Controls Section -->
        <div v-show="el.expanded === true" class="element-item-body">
          <!-- Text Layer Form Controls -->
          <template v-if="el.type === 'text'">
            <div class="form-field full-width">
              <label>Text Content (Use &#123;&#123;serial&#125;&#125; for serial number)</label>
              <input 
                type="text" 
                v-model="el.text" 
                class="main-content-input"
                placeholder="e.g. Model: S403 | Thermal Mass Flow" 
              />
            </div>

            <div class="form-grid grid-4">
              <div class="form-field">
                <label>X Position (mm)</label>
                <input type="number" step="0.1" v-model.number="el.xMm" />
              </div>
              <div class="form-field">
                <label>End X Position (mm)</label>
                <input type="number" step="0.1" v-model.number="el.endXMm" placeholder="Max width" />
              </div>
              <div class="form-field">
                <label>Y Position (mm)</label>
                <input type="number" step="0.1" v-model.number="el.yMm" />
              </div>
              <div class="form-field">
                <label>Font Size (pt)</label>
                <input type="number" step="0.5" v-model.number="el.fontSize" min="1" max="50" />
              </div>
            </div>

            <div class="form-field checkbox-field">
              <label class="checkbox-label">
                <input type="checkbox" v-model="el.bold" /> 
                <span class="bold-text-tag">Bold Text Style</span>
              </label>
            </div>
          </template>

          <!-- Image Layer Form Controls -->
          <template v-else-if="el.type === 'image'">
            <div class="form-grid grid-2">
              <div class="form-field">
                <label>Upload Image File</label>
                <input type="file" accept="image/*" @change="onStImageUpload(el, $event)" class="file-input" />
              </div>
              <div class="form-field">
                <label>EZPL Stored Name</label>
                <input type="text" v-model="el.storedName" placeholder="e.g. LOGO" />
              </div>
            </div>

            <div v-if="el.src" class="image-preview-thumb">
              <img :src="el.src" alt="Thumbnail Preview" />
            </div>

            <div class="form-grid grid-3">
              <div class="form-field">
                <label>X Position (mm)</label>
                <input type="number" step="0.1" v-model.number="el.xMm" :disabled="el.autoBottomRight" />
              </div>
              <div class="form-field">
                <label>Y Position (mm)</label>
                <input type="number" step="0.1" v-model.number="el.yMm" :disabled="el.autoBottomRight" />
              </div>
              <div class="form-field">
                <label>Width (mm)</label>
                <input type="number" step="0.1" v-model.number="el.widthMm" />
              </div>
            </div>

            <div class="form-field checkbox-field">
              <label class="checkbox-label">
                <input type="checkbox" v-model="el.autoBottomRight" /> 
                <span>Align Automatically to Bottom Right Corner</span>
              </label>
            </div>
          </template>

          <!-- Line Layer Form Controls -->
          <template v-else-if="el.type === 'hline' || el.type === 'vline'">
            <div class="form-grid grid-2">
              <div class="form-field">
                <label>Orientation</label>
                <select v-model="el.lineShape">
                  <option value="HLine">Horizontal Line</option>
                  <option value="VLine">Vertical Line</option>
                </select>
              </div>
              <div class="form-field">
                <label>Thickness (dots)</label>
                <input type="number" v-model.number="el.thicknessDots" min="1" max="30" />
              </div>
            </div>

            <div class="form-grid grid-3">
              <div class="form-field">
                <label>Start X (mm)</label>
                <input type="number" step="0.1" v-model.number="el.xMm" />
              </div>
              <div class="form-field">
                <label>Start Y (mm)</label>
                <input type="number" step="0.1" v-model.number="el.yMm" />
              </div>
              <div v-if="el.lineShape !== 'VLine'" class="form-field">
                <label>End X (mm)</label>
                <input type="number" step="0.1" v-model.number="el.x1Mm" />
              </div>
              <div v-else class="form-field">
                <label>End Y (mm)</label>
                <input type="number" step="0.1" v-model.number="el.y1Mm" />
              </div>
            </div>
          </template>

          <!-- 1D Barcode Form Controls -->
          <template v-else-if="el.type === 'barcode'">
            <div class="form-field full-width">
              <label>Barcode Value (Use &#123;&#123;serial&#125;&#125; for serial number)</label>
              <input type="text" v-model="el.data" class="main-content-input" placeholder="PROD-{{serial}}" />
            </div>

            <div class="form-grid grid-3">
              <div class="form-field">
                <label>X Position (mm)</label>
                <input type="number" step="0.1" v-model.number="el.xMm" />
              </div>
              <div class="form-field">
                <label>Y Position (mm)</label>
                <input type="number" step="0.1" v-model.number="el.yMm" />
              </div>
              <div class="form-field">
                <label>Height (mm)</label>
                <input type="number" step="0.1" v-model.number="el.heightMm" />
              </div>
            </div>

            <div class="form-grid grid-3">
              <div class="form-field checkbox-field">
                <label class="checkbox-label">
                  <input type="checkbox" v-model="el.readable" /> 
                  <span>Show Text</span>
                </label>
              </div>
              <div v-if="el.readable !== false" class="form-field checkbox-field">
                <label class="checkbox-label">
                  <input type="checkbox" v-model="el.bold" /> 
                  <span>Bold</span>
                </label>
              </div>
              <div class="form-field checkbox-field">
                <label class="checkbox-label">
                  <input type="checkbox" v-model="el.border" /> 
                  <span>Border Box</span>
                </label>
              </div>
            </div>

            <div v-if="el.readable !== false" class="form-grid grid-2">
              <div class="form-field">
                <label>Text Font Size (pt)</label>
                <input type="number" step="0.5" v-model.number="el.fontSize" placeholder="5" min="2" max="24" />
              </div>
            </div>
          </template>

          <!-- QR Code Form Controls -->
          <template v-else-if="el.type === 'qrcode'">
            <div class="form-field full-width">
              <label>QR Code Data / URL</label>
              <input type="text" v-model="el.data" class="main-content-input" placeholder="https://example.com/item/{{serial}}" />
            </div>

            <div class="form-grid grid-3">
              <div class="form-field">
                <label>X Position (mm)</label>
                <input type="number" step="0.1" v-model.number="el.xMm" />
              </div>
              <div class="form-field">
                <label>Y Position (mm)</label>
                <input type="number" step="0.1" v-model.number="el.yMm" />
              </div>
              <div class="form-field">
                <label>Size Multiplier</label>
                <input type="number" v-model.number="el.mul" min="1" max="10" />
              </div>
            </div>
          </template>
        </div>
      </div>
    </div>

    <!-- Add Element Toolbar -->
    <div class="add-element-bar">
      <span class="add-bar-title">Add New Layer:</span>
      <div class="add-btns-group">
        <button type="button" class="btn-add-el add-text" @click="addStElement('text')">➕ Text</button>
        <button type="button" class="btn-add-el add-image" @click="addStElement('image')">➕ Image</button>
        <button type="button" class="btn-add-el add-line" @click="addStElement('hline')">➕ Line</button>
        <button type="button" class="btn-add-el add-barcode" @click="addStElement('barcode')">➕ Barcode</button>
        <button type="button" class="btn-add-el add-qrcode" @click="addStElement('qrcode')">➕ QR Code</button>
      </div>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  elements: { type: Array, required: true },
  canvasWidthMm: { type: Number, default: 35 }
});

function getTypeLabel(type) {
  switch (type) {
    case 'text': return 'TEXT';
    case 'image': return 'IMG';
    case 'hline': return 'HLINE';
    case 'vline': return 'VLINE';
    case 'barcode': return 'BARCODE';
    case 'qrcode': return 'QR';
    default: return type.toUpperCase();
  }
}

function getElementSummary(el) {
  if (el.type === 'text') {
    return el.text || '(empty text)';
  } else if (el.type === 'image') {
    return el.storedName ? `[${el.storedName}]` : (el.name || 'Image');
  } else if (el.type === 'hline' || el.type === 'vline') {
    return `Y: ${el.yMm}mm (X: ${el.xMm}-${el.x1Mm || props.canvasWidthMm}mm)`;
  } else if (el.type === 'barcode') {
    return el.data || '(no barcode data)';
  } else if (el.type === 'qrcode') {
    return el.data || '(no QR data)';
  }
  return '';
}

function toggleElementExpand(targetEl) {
  const nextState = !targetEl.expanded;
  if (nextState === true) {
    // Auto-collapse all other elements so only ONE element is open for editing at a time!
    props.elements.forEach(el => {
      el.expanded = false;
    });
  }
  targetEl.expanded = nextState;
}

function toggleAllElements(expand) {
  props.elements.forEach(el => {
    el.expanded = expand;
  });
}

function moveElement(index, direction) {
  const targetIndex = index + direction;
  if (targetIndex >= 0 && targetIndex < props.elements.length) {
    const temp = props.elements[index];
    props.elements[index] = props.elements[targetIndex];
    props.elements[targetIndex] = temp;
  }
}

function generateStId() {
  return 'el_' + Math.random().toString(36).substr(2, 9);
}

function addStElement(type) {
  // Collapse existing elements so user focuses on the newly created element!
  props.elements.forEach(el => { el.expanded = false; });

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
    newEl.endXMm = props.canvasWidthMm || 35;
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
    newEl.lineShape = 'HLine';
    newEl.xMm = 2;
    newEl.yMm = 10;
    newEl.x1Mm = props.canvasWidthMm - 2;
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

function removeStElement(index) {
  props.elements.splice(index, 1);
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
</script>

<style scoped>
* {
  box-sizing: border-box;
}

.layer-manager-card {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 1.25rem;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.04);
  width: 100%;
}

.editor-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.header-left h3 {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 700;
  color: #1a202c;
}

.element-count-badge {
  background: #ebf8ff;
  color: #2b6cb0;
  font-size: 0.75rem;
  font-weight: 700;
  padding: 3px 10px;
  border-radius: 12px;
  border: 1px solid #bee3f8;
}

.header-actions-group {
  display: flex;
  gap: 12px;
}

.mini-text-btn {
  background: none;
  border: none;
  color: #3182ce;
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  padding: 2px 4px;
}

.mini-text-btn:hover {
  text-decoration: underline;
  color: #2b6cb0;
}

/* Accordion Layer Stack */
.elements-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-height: calc(100vh - 280px);
  min-height: 380px;
  overflow-y: auto;
  padding-right: 10px;
  padding-bottom: 6px;
  scrollbar-width: auto;
  scrollbar-color: #3182ce #edf2f7;
}

/* Large Graspable Custom Scrollbar */
.custom-scrollbar::-webkit-scrollbar {
  width: 12px;
  display: block;
}

.custom-scrollbar::-webkit-scrollbar-track {
  background: #edf2f7;
  border-radius: 6px;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
  background: #3182ce;
  border-radius: 6px;
  border: 2px solid #edf2f7;
}

.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: #2b6cb0;
}

.element-item-card {
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #ffffff;
  overflow: hidden;
  transition: all 0.15s ease;
  border-left: 5px solid #cbd5e0;
  width: 100%;
}

.element-item-card:hover {
  border-color: #cbd5e0;
}

.element-item-card.is-expanded {
  border-color: #3182ce;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.08);
}

/* Accent Borders per Layer Type */
.element-item-card.type-text { border-left-color: #3182ce; }
.element-item-card.type-image { border-left-color: #dd6b20; }
.element-item-card.type-hline,
.element-item-card.type-vline { border-left-color: #4a5568; }
.element-item-card.type-barcode { border-left-color: #805ad5; }
.element-item-card.type-qrcode { border-left-color: #38a169; }

/* Accordion Header Row */
.element-item-header {
  display: flex;
  flex-direction: column;
  padding: 10px 14px;
  background: #ffffff;
  cursor: pointer;
  user-select: none;
  transition: background 0.15s ease;
  gap: 6px;
}

.element-item-card.is-expanded .element-item-header {
  background: #f1f5f9;
}

.header-top-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  gap: 10px;
}

.header-left-group {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
}

.layer-index {
  font-size: 0.75rem;
  font-weight: 800;
  color: #a0aec0;
  flex-shrink: 0;
}

.type-badge {
  font-size: 0.65rem;
  font-weight: 800;
  letter-spacing: 0.5px;
  padding: 2px 6px;
  border-radius: 4px;
  color: white;
  background: #718096;
  flex-shrink: 0;
}

.type-text .type-badge { background: #3182ce; }
.type-image .type-badge { background: #dd6b20; }
.type-hline .type-badge,
.type-vline .type-badge { background: #4a5568; }
.type-barcode .type-badge { background: #805ad5; }
.type-qrcode .type-badge { background: #38a169; }

.element-name-input {
  border: 1px solid transparent;
  background: transparent;
  font-weight: 700;
  font-size: 0.88rem;
  color: #2d3748;
  padding: 2px 6px;
  border-radius: 4px;
  flex: 1;
  min-width: 120px;
  transition: all 0.15s ease;
}

.element-name-input:focus {
  background: white;
  border-color: #cbd5e0;
  box-shadow: 0 0 0 2px rgba(49, 130, 206, 0.2);
}

.header-right-group {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.header-bottom-row {
  display: flex;
  align-items: center;
  padding-left: 2px;
}

.preview-snippet {
  font-size: 0.8rem;
  color: #4a5568;
  word-break: break-word;
  line-height: 1.3;
}

.snippet-label {
  color: #718096;
  font-weight: 600;
  margin-right: 4px;
}

.layer-reorder-btns {
  display: flex;
  align-items: center;
  gap: 2px;
}

.icon-btn {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 0.75rem;
  color: #718096;
  padding: 3px 5px;
  border-radius: 4px;
  transition: all 0.15s ease;
}

.icon-btn:hover:not(:disabled) {
  background: #e2e8f0;
  color: #2d3748;
}

.icon-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.delete-btn:hover:not(:disabled) {
  background: #fee2e2;
  color: #e53e3e;
}

.expand-toggle-btn {
  background: #edf2f7;
  border: 1px solid #cbd5e0;
  color: #2d3748;
  font-size: 0.75rem;
  font-weight: 700;
  padding: 4px 10px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
}

.expand-toggle-btn:hover {
  background: #e2e8f0;
}

/* Expanded Form Body Styling */
.element-item-body {
  padding: 16px;
  border-top: 1px solid #e2e8f0;
  background: #fafafa;
  display: flex;
  flex-direction: column;
  gap: 14px;
  width: 100%;
}

.main-content-input {
  height: 40px !important;
  font-size: 0.95rem !important;
  font-weight: 600 !important;
  color: #1a202c !important;
  background: #ffffff !important;
  border: 1.5px solid #cbd5e0 !important;
}

.main-content-input:focus {
  border-color: #3182ce !important;
  box-shadow: 0 0 0 3px rgba(49, 130, 206, 0.2) !important;
}

.form-grid {
  display: grid;
  gap: 12px;
  width: 100%;
}

.grid-2 {
  grid-template-columns: repeat(2, 1fr);
}

.grid-3 {
  grid-template-columns: repeat(3, 1fr);
}

.grid-4 {
  grid-template-columns: repeat(4, 1fr);
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: 100%;
}

.form-field.full-width {
  grid-column: 1 / -1;
}

.form-field label {
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  color: #4a5568;
}

.form-field input[type="text"],
.form-field input[type="number"],
.form-field select,
.file-input {
  box-sizing: border-box;
  width: 100%;
  height: 38px;
  padding: 6px 12px;
  border: 1px solid #cbd5e0;
  border-radius: 6px;
  font-size: 0.88rem;
  color: #2d3748;
  background: #ffffff;
  transition: all 0.15s ease;
}

.form-field input:focus,
.form-field select:focus {
  outline: none;
  border-color: #3182ce;
  box-shadow: 0 0 0 3px rgba(49, 130, 206, 0.15);
}

.checkbox-field {
  padding-top: 4px;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-size: 0.85rem;
  font-weight: 600;
  color: #2d3748;
}

.bold-text-tag {
  color: #2b6cb0;
  font-weight: 700;
}

.image-preview-thumb img {
  max-width: 120px;
  max-height: 60px;
  object-fit: contain;
  border: 1px solid #cbd5e0;
  border-radius: 4px;
  padding: 4px;
  background: white;
}

/* Add Element Bottom Bar */
.add-element-bar {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 1rem;
  padding-top: 0.75rem;
  border-top: 1px solid #edf2f7;
}

.add-bar-title {
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  color: #718096;
}

.add-btns-group {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.btn-add-el {
  padding: 6px 12px;
  font-size: 0.78rem;
  font-weight: 700;
  background: #ffffff;
  color: #2d3748;
  border: 1px solid #cbd5e0;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-add-el:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.08);
}

.btn-add-el.add-text:hover { border-color: #3182ce; color: #3182ce; }
.btn-add-el.add-image:hover { border-color: #dd6b20; color: #dd6b20; }
.btn-add-el.add-line:hover { border-color: #4a5568; color: #4a5568; }
.btn-add-el.add-barcode:hover { border-color: #805ad5; color: #805ad5; }
.btn-add-el.add-qrcode:hover { border-color: #38a169; color: #38a169; }
</style>

<template>
  <div class="editor-card">
    <div class="editor-card-header">
      <div class="header-left">
        <h3>🎨 Elements</h3>
        <span class="count-pill">{{ elements.length }}</span>
      </div>
      <div class="add-toolbar">
        <button type="button" class="add-btn" @click="addElement('folder')">+ Folder</button>
        <button type="button" class="add-btn" @click="addElement('text')">+ Text</button>
        <button type="button" class="add-btn" @click="addElement('image')">+ Image</button>
        <button type="button" class="add-btn" @click="addElement('hline')">+ Line</button>
        <button type="button" class="add-btn" @click="addElement('barcode')">+ Barcode</button>
        <button type="button" class="add-btn" @click="addElement('qrcode')">+ QR Code</button>
      </div>
    </div>

    <div class="layer-tree custom-scrollbar">

      <!-- ── FOLDERS ────────────────────────────────────────────── -->
      <div v-for="folder in folders" :key="folder.id" class="folder-block">
        <!-- folder header row -->
        <div class="folder-row" @click="folder.expanded = !folder.expanded">
          <span class="chevron">{{ folder.expanded ? '▾' : '▸' }}</span>
          <span class="folder-ico">{{ folder.expanded ? '📂' : '📁' }}</span>
          <input
            class="folder-name"
            type="text"
            v-model="folder.name"
            @click.stop
            @mousedown.stop
            @keydown.stop
            placeholder="Folder name"
          />
          <span class="child-count">{{ folderChildCount(folder.id) }}</span>
          <button class="row-btn danger" @click.stop="deleteFolder(folder)" title="Remove folder">✕</button>
        </div>

        <!-- folder children -->
        <div v-show="folder.expanded" class="folder-children">
          <div
            v-for="child in folderChildren(folder.id)"
            :key="child.id"
            class="el-row-wrap"
          >
            <div class="el-row" :class="'accent-' + child.type" @click="child.expanded = !child.expanded">
              <span class="chevron sm">{{ child.expanded ? '▾' : '▸' }}</span>
              <span class="el-type-dot" :class="child.type"></span>
              <span class="el-label">{{ child.name || child.type }}</span>
              <span class="el-hint">{{ shortHint(child) }}</span>
              <button class="row-btn danger" @click.stop="deleteById(child.id)" title="Delete">✕</button>
            </div>
            <div v-show="child.expanded" class="el-detail">
              <ElementForm :el="child" :folders="folders" @image-upload="onImageUpload" :canvasConfig="canvasConfig" />
            </div>
          </div>
          <div v-if="folderChildCount(folder.id) === 0" class="empty-hint">Empty folder</div>
        </div>
      </div>

      <!-- ── ROOT ELEMENTS (no folder) ──────────────────────────── -->
      <div
        v-for="el in rootElements"
        :key="el.id"
        class="el-row-wrap root-level"
      >
        <div class="el-row" :class="'accent-' + el.type" @click="el.expanded = !el.expanded">
          <span class="chevron sm">{{ el.expanded ? '▾' : '▸' }}</span>
          <span class="el-type-dot" :class="el.type"></span>
          <span class="el-label">{{ el.name || el.type }}</span>
          <span class="el-hint">{{ shortHint(el) }}</span>
          <button class="row-btn danger" @click.stop="deleteById(el.id)" title="Delete">✕</button>
        </div>
        <div v-show="el.expanded" class="el-detail">
          <ElementForm :el="el" :folders="folders" @image-upload="onImageUpload" :canvasConfig="canvasConfig" />
        </div>
      </div>

    </div>

    <div class="add-toolbar bottom-toolbar">
      <button type="button" class="add-btn" @click="addElement('folder')">+ Folder</button>
      <button type="button" class="add-btn" @click="addElement('text')">+ Text</button>
      <button type="button" class="add-btn" @click="addElement('image')">+ Image</button>
      <button type="button" class="add-btn" @click="addElement('hline')">+ Line</button>
      <button type="button" class="add-btn" @click="addElement('barcode')">+ Barcode</button>
      <button type="button" class="add-btn" @click="addElement('qrcode')">+ QR Code</button>
    </div>
  </div>
</template>

<script setup>
import { computed, h, defineComponent } from 'vue';
import { showStConfirm } from '../../utils/stDialog.js';

/* ── PROPS ──────────────────────────────────────────────── */
const props = defineProps({
  elements: { type: Array, required: true },
  canvasConfig: { type: Object, required: true }
});

/* ── COMPUTED ───────────────────────────────────────────── */
const folders = computed(() => props.elements.filter(e => e.type === 'folder'));
const rootElements = computed(() => props.elements.filter(e => e.type !== 'folder' && !e.folderId));

function folderChildren(fid) {
  return props.elements.filter(e => e.folderId === fid && e.type !== 'folder');
}
function folderChildCount(fid) {
  return props.elements.filter(e => e.folderId === fid && e.type !== 'folder').length;
}

function shortHint(el) {
  if (el.type === 'text') return el.text ? `"${el.text.substring(0, 28)}"` : '';
  if (el.type === 'image') return el.storedName || '';
  if (el.type === 'barcode') return el.data || '';
  if (el.type === 'qrcode') return el.data ? el.data.substring(0, 22) : '';
  if (el.type === 'hline') return `${el.xMm}→${el.x1Mm || ''}mm`;
  return '';
}

/* ── ACTIONS ────────────────────────────────────────────── */
function generateId() { return 'el_' + Math.random().toString(36).substr(2, 9); }

function addElement(type) {
  const el = { id: generateId(), type, name: '', folderId: null, expanded: true };
  if (type === 'folder') { el.name = `Folder ${folders.value.length + 1}`; el.expanded = true; }
  else if (type === 'text') { el.name = 'New Text'; el.text = ''; el.xMm = 1; el.yMm = 5; el.fontSize = 5; el.bold = false; }
  else if (type === 'image') { el.name = 'New Image'; el.src = ''; el.xMm = 1; el.yMm = 1; el.widthMm = 10; el.storedName = 'IMG'; el.autoBottomRight = false; }
  else if (type === 'hline') { el.name = 'New Line'; el.xMm = 1; el.yMm = 10; el.x1Mm = (props.canvasConfig.widthMm || 35) - 1; el.thicknessDots = 3; }
  else if (type === 'barcode') { el.name = 'New Barcode'; el.data = '{{serial}}'; el.xMm = 5; el.yMm = 10; el.widthMm = 25; el.heightMm = 8; el.readable = true; }
  else if (type === 'qrcode') { el.name = 'New QR'; el.data = 'https://example.com'; el.xMm = 25; el.yMm = 10; el.mul = 4; }
  props.elements.push(el);
}

async function deleteById(id, confirmDelete = true) {
  const i = props.elements.findIndex(e => e.id === id);
  if (i !== -1) {
    if (confirmDelete) {
      const el = props.elements[i];
      const name = el.name || el.type || 'element';
      const confirmed = await showStConfirm({
        title: 'Delete Element',
        message: `Are you sure you want to delete "${name}"?`,
        confirmText: 'Delete',
        type: 'danger'
      });
      if (!confirmed) return;
    }
    props.elements.splice(i, 1);
  }
}

async function deleteFolder(folder) {
  const folderName = folder.name || 'this folder';
  const confirmed = await showStConfirm({
    title: 'Delete Folder',
    message: `Are you sure you want to delete folder "${folderName}"?`,
    confirmText: 'Delete Folder',
    type: 'danger'
  });
  if (!confirmed) return;
  // un-parent children
  props.elements.forEach(e => { if (e.folderId === folder.id) e.folderId = null; });
  deleteById(folder.id, false);
}

function onImageUpload(el, event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => { el.src = e.target.result; el.storedName = file.name.split('.')[0].toUpperCase().replace(/[^A-Z0-9]/g, '').substr(0, 8) || 'IMG'; };
  reader.readAsDataURL(file);
}

/* ── INLINE CHILD COMPONENT: ElementForm ────────────────── */
const ElementForm = defineComponent({
  name: 'ElementForm',
  props: {
    el: Object,
    folders: Array,
    canvasConfig: Object,
  },
  emits: ['image-upload'],
  setup(props, { emit }) {
    function input(opts) {
      const attrs = { ...opts };
      delete attrs.label;
      return h('div', { class: 'fg' }, [
        h('label', opts.label),
        opts.type === 'select'
          ? h('select', attrs, opts.options.map(o => h('option', { value: o.value }, o.text)))
          : opts.type === 'checkbox'
            ? h('label', { class: 'cb' }, [h('input', { type: 'checkbox', ...attrs }), ` ${opts.label}`])
            : h('input', attrs)
      ]);
    }

    return () => {
      const el = props.el;
      const kids = [];

      // name + folder assignment
      kids.push(h('div', { class: 'fg-row' }, [
        h('div', { class: 'fg fg-grow' }, [
          h('label', 'Name'),
          h('input', { type: 'text', value: el.name, onInput: e => el.name = e.target.value, placeholder: 'Element name' })
        ]),
        props.folders.length > 0
          ? h('div', { class: 'fg fg-grow' }, [
              h('label', '📁 Folder'),
              h('select', { value: el.folderId, onChange: e => el.folderId = e.target.value || null }, [
                h('option', { value: '' }, '(Root)'),
                ...props.folders.map(f => h('option', { value: f.id }, f.name || 'Folder'))
              ])
            ])
          : null
      ]));

      if (el.type === 'text') {
        kids.push(h('div', { class: 'fg' }, [
          h('label', 'Text  (use {{serial}}, {{product}}, {{options}})'),
          h('input', { type: 'text', value: el.text, onInput: e => el.text = e.target.value })
        ]));
        kids.push(h('div', { class: 'fg-row' }, [
          h('div', { class: 'fg' }, [h('label', 'X mm'), h('input', { type: 'number', step: 0.1, value: el.xMm, onInput: e => el.xMm = +e.target.value })]),
          h('div', { class: 'fg' }, [h('label', 'Y mm'), h('input', { type: 'number', step: 0.1, value: el.yMm, onInput: e => el.yMm = +e.target.value })]),
          h('div', { class: 'fg' }, [h('label', 'Size pt'), h('input', { type: 'number', step: 0.5, value: el.fontSize, onInput: e => el.fontSize = +e.target.value, min: 2, max: 36 })]),
          h('div', { class: 'fg' }, [h('label', { class: 'cb' }, [h('input', { type: 'checkbox', checked: el.bold, onChange: e => el.bold = e.target.checked }), ' Bold'])])
        ]));
      }

      if (el.type === 'image') {
        kids.push(h('div', { class: 'fg' }, [
          h('label', 'Image'),
          h('div', { class: 'img-row' }, [
            h('input', { type: 'file', accept: 'image/*', onChange: e => emit('image-upload', el, e) }),
            el.src ? h('img', { src: el.src, class: 'thumb' }) : null
          ])
        ]));
        kids.push(h('div', { class: 'fg-row' }, [
          h('div', { class: 'fg' }, [h('label', 'X mm'), h('input', { type: 'number', step: 0.1, value: el.xMm, disabled: el.autoBottomRight, onInput: e => el.xMm = +e.target.value })]),
          h('div', { class: 'fg' }, [h('label', 'Y mm'), h('input', { type: 'number', step: 0.1, value: el.yMm, disabled: el.autoBottomRight, onInput: e => el.yMm = +e.target.value })]),
          h('div', { class: 'fg' }, [h('label', 'W mm'), h('input', { type: 'number', step: 0.1, value: el.widthMm, onInput: e => el.widthMm = +e.target.value })]),
          h('div', { class: 'fg' }, [h('label', 'Stored'), h('input', { type: 'text', value: el.storedName, onInput: e => el.storedName = e.target.value })])
        ]));
        kids.push(h('label', { class: 'cb' }, [h('input', { type: 'checkbox', checked: el.autoBottomRight, onChange: e => el.autoBottomRight = e.target.checked }), ' Align Bottom-Right']));
      }

      if (el.type === 'hline' || el.type === 'vline') {
        kids.push(h('div', { class: 'fg-row' }, [
          h('div', { class: 'fg' }, [h('label', 'Shape'), h('select', { value: el.lineShape || 'HLine', onChange: e => el.lineShape = e.target.value }, [h('option', { value: 'HLine' }, 'Horizontal'), h('option', { value: 'VLine' }, 'Vertical')])]),
          h('div', { class: 'fg' }, [h('label', 'X mm'), h('input', { type: 'number', step: 0.1, value: el.xMm, onInput: e => el.xMm = +e.target.value })]),
          h('div', { class: 'fg' }, [h('label', 'Y mm'), h('input', { type: 'number', step: 0.1, value: el.yMm, onInput: e => el.yMm = +e.target.value })]),
          (el.lineShape || 'HLine') !== 'VLine'
            ? h('div', { class: 'fg' }, [h('label', 'End X'), h('input', { type: 'number', step: 0.1, value: el.x1Mm, onInput: e => el.x1Mm = +e.target.value })])
            : h('div', { class: 'fg' }, [h('label', 'End Y'), h('input', { type: 'number', step: 0.1, value: el.y1Mm, onInput: e => el.y1Mm = +e.target.value })]),
          h('div', { class: 'fg' }, [h('label', 'Thick'), h('input', { type: 'number', value: el.thicknessDots, onInput: e => el.thicknessDots = +e.target.value, min: 1, max: 30 })])
        ]));
      }

      if (el.type === 'barcode') {
        kids.push(h('div', { class: 'fg' }, [
          h('label', 'Barcode Data'),
          h('input', { type: 'text', value: el.data, onInput: e => el.data = e.target.value })
        ]));
        kids.push(h('div', { class: 'fg-row' }, [
          h('div', { class: 'fg' }, [h('label', 'X mm'), h('input', { type: 'number', step: 0.1, value: el.xMm, onInput: e => el.xMm = +e.target.value })]),
          h('div', { class: 'fg' }, [h('label', 'Y mm'), h('input', { type: 'number', step: 0.1, value: el.yMm, onInput: e => el.yMm = +e.target.value })]),
          h('div', { class: 'fg' }, [h('label', 'W mm'), h('input', { type: 'number', step: 0.1, value: el.widthMm, onInput: e => el.widthMm = +e.target.value })]),
          h('div', { class: 'fg' }, [h('label', 'H mm'), h('input', { type: 'number', step: 0.1, value: el.heightMm, onInput: e => el.heightMm = +e.target.value })]),
          h('div', { class: 'fg' }, [h('label', { class: 'cb' }, [h('input', { type: 'checkbox', checked: el.readable, onChange: e => el.readable = e.target.checked }), ' Text'])])
        ]));
      }

      if (el.type === 'qrcode') {
        kids.push(h('div', { class: 'fg' }, [
          h('label', 'QR Data / URL'),
          h('input', { type: 'text', value: el.data, onInput: e => el.data = e.target.value })
        ]));
        kids.push(h('div', { class: 'fg-row' }, [
          h('div', { class: 'fg' }, [h('label', 'X mm'), h('input', { type: 'number', step: 0.1, value: el.xMm, onInput: e => el.xMm = +e.target.value })]),
          h('div', { class: 'fg' }, [h('label', 'Y mm'), h('input', { type: 'number', step: 0.1, value: el.yMm, onInput: e => el.yMm = +e.target.value })]),
          h('div', { class: 'fg' }, [h('label', 'Size'), h('input', { type: 'number', value: el.mul, onInput: e => el.mul = +e.target.value, min: 1, max: 20 })])
        ]));
      }

      return h('div', { class: 'el-form' }, kids);
    };
  }
});
</script>

<style scoped>
/* ── CARD (matches other white cards) ───────────────────── */
.editor-card {
  background: white;
  border-radius: 12px;
  padding: 0;
  overflow: hidden;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
  font-size: 13px;
  color: #2d3748;
  display: flex;
  flex-direction: column;
}

.editor-card-header {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  padding: 12px 14px;
  border-bottom: 1px solid #e2e8f0;
  flex-shrink: 0;
}
.header-left { display: flex; align-items: center; gap: 8px; }
.header-left h3 { margin: 0; font-size: 1.15rem; font-weight: 600; color: #2d3748; }
.count-pill {
  background: #edf2f7;
  color: #4a5568;
  font-size: 11px;
  font-weight: 700;
  padding: 1px 7px;
  border-radius: 10px;
}
.add-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  flex-shrink: 0;
}
.add-btn {
  background: #edf2f7 !important;
  color: #4a5568 !important;
  font-size: 12px !important;
  font-weight: 500 !important;
  padding: 3px 8px !important;
  border: 1px solid #e2e8f0 !important;
  border-radius: 4px !important;
  cursor: pointer;
  box-shadow: none !important;
  width: auto !important;
}
.add-btn:hover { background: #e2e8f0 !important; color: #2d3748 !important; }
.bottom-toolbar {
  padding: 10px 14px;
  border-top: 1px solid #e2e8f0;
}

/* ── SCROLLABLE TREE ────────────────────────────────────── */
.layer-tree {
  flex: 1;
  overflow-y: auto;
  padding: 6px 0;
}
.custom-scrollbar::-webkit-scrollbar { width: 5px; }
.custom-scrollbar::-webkit-scrollbar-track { background: #f7fafc; }
.custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e0; border-radius: 4px; }
.custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #a0aec0; }

/* ── FOLDER ─────────────────────────────────────────────── */
.folder-block {
  margin-bottom: 2px;
}
.folder-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  cursor: pointer;
  user-select: none;
  background: #f7fafc;
}
.folder-row:hover { background: #edf2f7; }
.chevron { font-size: 10px; color: #718096; width: 12px; flex-shrink: 0; }
.chevron.sm { font-size: 9px; width: 10px; }
.folder-ico { font-size: 14px; flex-shrink: 0; }
.folder-name {
  flex: 1;
  background: transparent !important;
  border: 1px solid transparent !important;
  color: #2d3748 !important;
  font-size: 13px !important;
  font-weight: 600 !important;
  padding: 1px 4px !important;
  border-radius: 3px !important;
  width: 0 !important;
  min-width: 0 !important;
  box-sizing: border-box !important;
}
.folder-name:hover { border-color: #cbd5e0 !important; }
.folder-name:focus { background: white !important; border-color: #3182ce !important; outline: none !important; box-shadow: 0 0 0 2px rgba(49,130,206,0.15) !important; }
.child-count {
  font-size: 10px;
  color: #718096;
  background: #e2e8f0;
  padding: 0 6px;
  border-radius: 6px;
  flex-shrink: 0;
}
.row-btn {
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
  color: #a0aec0 !important;
  font-size: 11px !important;
  padding: 2px 4px !important;
  border-radius: 3px !important;
  cursor: pointer;
  opacity: 0;
  width: auto !important;
  transition: opacity 0.15s;
}
.folder-row:hover .row-btn,
.el-row:hover .row-btn { opacity: 1; }
.row-btn.danger:hover { color: #e53e3e !important; background: #fff5f5 !important; }

/* ── FOLDER CHILDREN ────────────────────────────────────── */
.folder-children {
  padding-left: 18px;
  border-left: 1px solid #e2e8f0;
  margin-left: 17px;
}
.empty-hint {
  padding: 4px 12px;
  font-size: 11px;
  color: #a0aec0;
  font-style: italic;
}

/* ── ELEMENT ROWS ───────────────────────────────────────── */
.el-row-wrap { margin-bottom: 1px; }

.el-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 14px;
  cursor: pointer;
  user-select: none;
  border-left: 3px solid transparent;
}
.el-row:hover { background: #edf2f7; }
.el-row.accent-text { border-left-color: #3182ce; }
.el-row.accent-image { border-left-color: #38a169; }
.el-row.accent-hline { border-left-color: #d69e2e; }
.el-row.accent-barcode { border-left-color: #805ad5; }
.el-row.accent-qrcode { border-left-color: #dd6b20; }

.el-type-dot {
  width: 8px; height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}
.el-type-dot.text { background: #3182ce; }
.el-type-dot.image { background: #38a169; }
.el-type-dot.hline { background: #d69e2e; }
.el-type-dot.barcode { background: #805ad5; }
.el-type-dot.qrcode { background: #dd6b20; }

.el-label {
  font-weight: 500;
  color: #2d3748;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 160px;
}
.el-hint {
  flex: 1;
  font-size: 11px;
  color: #a0aec0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ── DETAIL PANEL ───────────────────────────────────────── */
.el-detail {
  background: #f7fafc;
  border-left: 3px solid #e2e8f0;
  margin-left: 14px;
  padding: 8px 12px;
}

:deep(.el-form) {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
:deep(.fg) {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 0 0 auto;
  min-width: 0;
}
:deep(.fg-grow) { flex: 1; }
:deep(.fg-row) {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 10px;
}
:deep(.fg label) {
  font-size: 11px;
  color: #718096;
  font-weight: 500;
  white-space: nowrap;
}
:deep(.fg input[type="text"]) {
  background: white;
  border: 1px solid #cbd5e0;
  color: #2d3748;
  padding: 4px 6px;
  border-radius: 4px;
  font-size: 12px;
  width: 100%;
  box-sizing: border-box;
}
:deep(.fg select) {
  background: white;
  border: 1px solid #cbd5e0;
  color: #2d3748;
  padding: 4px 6px;
  border-radius: 4px;
  font-size: 12px;
  width: auto;
  min-width: 95px;
  box-sizing: border-box;
}
:deep(.fg input[type="number"]) {
  background: white;
  border: 1px solid #cbd5e0;
  color: #2d3748;
  padding: 4px 6px;
  border-radius: 4px;
  font-size: 12px;
  width: 55px;
  max-width: 60px;
  box-sizing: border-box;
}
:deep(.fg input:focus),
:deep(.fg select:focus) {
  border-color: #3182ce;
  outline: none;
  box-shadow: 0 0 0 2px rgba(49,130,206,0.15);
}
:deep(.cb) {
  display: inline-flex !important;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: #4a5568;
  cursor: pointer;
  height: 25px;
  margin: 0;
  user-select: none;
}
:deep(.img-row) {
  display: flex;
  align-items: center;
  gap: 8px;
}
:deep(.thumb) {
  max-height: 32px;
  max-width: 48px;
  border: 1px solid #cbd5e0;
  border-radius: 3px;
}
</style>

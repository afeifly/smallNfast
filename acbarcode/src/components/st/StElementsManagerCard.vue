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
          <button class="row-btn move-btn" :disabled="isFirstInGroup(folder)" @click.stop="moveElement(folder, -1)" title="Move Folder Up">▲</button>
          <button class="row-btn move-btn" :disabled="isLastInGroup(folder)" @click.stop="moveElement(folder, 1)" title="Move Folder Down">▼</button>
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
              <button class="row-btn move-btn" :disabled="isFirstInGroup(child)" @click.stop="moveElement(child, -1)" title="Move Up">▲</button>
              <button class="row-btn move-btn" :disabled="isLastInGroup(child)" @click.stop="moveElement(child, 1)" title="Move Down">▼</button>
              <button class="row-btn duplicate-btn" @click.stop="duplicateElement(child)" title="Duplicate Element (X,Y +1mm)">📋</button>
              <button class="row-btn danger" @click.stop="deleteById(child.id)" title="Delete">✕</button>
            </div>
            <div v-show="child.expanded" class="el-detail">
              <ElementForm 
                :el="child" 
                :folders="folders" 
                @image-upload="onImageUpload" 
                :canvasConfig="canvasConfig" 
                :availableProducts="availableProducts"
              />
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
          <button class="row-btn move-btn" :disabled="isFirstInGroup(el)" @click.stop="moveElement(el, -1)" title="Move Up">▲</button>
          <button class="row-btn move-btn" :disabled="isLastInGroup(el)" @click.stop="moveElement(el, 1)" title="Move Down">▼</button>
          <button class="row-btn duplicate-btn" @click.stop="duplicateElement(el)" title="Duplicate Element (X,Y +1mm)">📋</button>
          <button class="row-btn danger" @click.stop="deleteById(el.id)" title="Delete">✕</button>
        </div>
        <div v-show="el.expanded" class="el-detail">
          <ElementForm 
            :el="el" 
            :folders="folders" 
            @image-upload="onImageUpload" 
            :canvasConfig="canvasConfig" 
            :availableProducts="availableProducts"
          />
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
  canvasConfig: { type: Object, required: true },
  availableProducts: { type: Array, default: () => [] }
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
  if (el.type === 'text') {
    if (el.textType === 'product' || el.useProductMapping || el.isProductMode) {
      const count = (el.productMappings || []).length;
      return `📦 ${count} product rule${count === 1 ? '' : 's'}`;
    }
    if (el.textType === 'option' || el.useOptionMapping || el.isOptionMode) {
      const count = (el.optionMappings || []).length;
      return `🔀 ${count} opt rule${count === 1 ? '' : 's'}`;
    }
    return el.text ? `"${el.text.substring(0, 28)}"` : '';
  }
  if (el.type === 'image') return el.storedName || '';
  if (el.type === 'barcode') return el.data || '';
  if (el.type === 'qrcode') return el.data ? el.data.substring(0, 22) : '';
  if (el.type === 'hline') return `${el.xMm}→${el.x1Mm || ''}mm`;
  return '';
}

function isFirstInGroup(el) {
  if (!el) return true;
  if (el.type === 'folder') {
    return folders.value[0]?.id === el.id;
  }
  const siblings = el.folderId ? folderChildren(el.folderId) : rootElements.value;
  return siblings[0]?.id === el.id;
}

function isLastInGroup(el) {
  if (!el) return true;
  if (el.type === 'folder') {
    return folders.value[folders.value.length - 1]?.id === el.id;
  }
  const siblings = el.folderId ? folderChildren(el.folderId) : rootElements.value;
  return siblings[siblings.length - 1]?.id === el.id;
}

function moveElement(targetEl, dir) {
  if (!targetEl) return;

  if (targetEl.type === 'folder') {
    const folderList = folders.value;
    const fIdx = folderList.findIndex(f => f.id === targetEl.id);
    if (fIdx === -1) return;
    const targetFIdx = fIdx + dir;
    if (targetFIdx < 0 || targetFIdx >= folderList.length) return;

    const neighborFolder = folderList[targetFIdx];
    const targetBlock = props.elements.filter(e => e.id === targetEl.id || e.folderId === targetEl.id);
    const remaining = props.elements.filter(e => e.id !== targetEl.id && e.folderId !== targetEl.id);
    const neighborIdx = remaining.findIndex(e => e.id === neighborFolder.id);
    if (neighborIdx === -1) return;

    if (dir < 0) {
      remaining.splice(neighborIdx, 0, ...targetBlock);
    } else {
      let insertIdx = neighborIdx + 1;
      while (insertIdx < remaining.length && remaining[insertIdx].folderId === neighborFolder.id) {
        insertIdx++;
      }
      remaining.splice(insertIdx, 0, ...targetBlock);
    }

    props.elements.splice(0, props.elements.length, ...remaining);
    return;
  }

  // Sibling element move (inside folder or root)
  const fid = targetEl.folderId || null;
  const siblings = fid ? folderChildren(fid) : rootElements.value;
  const sIdx = siblings.findIndex(e => e.id === targetEl.id);
  if (sIdx === -1) return;
  const targetSIdx = sIdx + dir;
  if (targetSIdx < 0 || targetSIdx >= siblings.length) return;

  const neighbor = siblings[targetSIdx];
  const fromPos = props.elements.findIndex(e => e.id === targetEl.id);
  const toPos = props.elements.findIndex(e => e.id === neighbor.id);

  if (fromPos !== -1 && toPos !== -1) {
    const [moved] = props.elements.splice(fromPos, 1);
    props.elements.splice(toPos, 0, moved);
  }
}

/* ── ACTIONS ────────────────────────────────────────────── */
function generateId() { return 'el_' + Math.random().toString(36).substr(2, 9); }

function addElement(type) {
  const el = { id: generateId(), type, name: '', folderId: null, expanded: true };
  if (type === 'folder') { el.name = `Folder ${folders.value.length + 1}`; el.expanded = true; }
  else if (type === 'text') { el.name = 'New Text'; el.text = ''; el.xMm = 1; el.yMm = 5; el.endXMm = props.canvasConfig.widthMm || 35; el.fontSize = 5; el.bold = false; }
  else if (type === 'image') { el.name = 'New Image'; el.src = ''; el.xMm = 1; el.yMm = 1; el.widthMm = 10; el.storedName = 'IMG'; el.autoBottomRight = false; }
  else if (type === 'hline') { el.name = 'New Line'; el.xMm = 1; el.yMm = 10; el.x1Mm = (props.canvasConfig.widthMm || 35) - 1; el.thicknessDots = 3; }
  else if (type === 'barcode') { el.name = 'New Barcode'; el.data = '{{serial}}'; el.xMm = 5; el.yMm = 10; el.widthMm = 25; el.heightMm = 8; el.readable = true; }
  else if (type === 'qrcode') {
    el.name = 'New QR';
    el.qrMode = 'suto_protocol';
    el.isSutoProtocol = true;
    el.sutoProductType = '{{device_name}}';
    el.sutoPrefix = 'sensor';
    el.data = '';
    el.xMm = 25;
    el.yMm = 10;
    el.mul = 4;
  }
  props.elements.push(el);
}

function duplicateElement(targetEl) {
  if (!targetEl) return;
  const clone = JSON.parse(JSON.stringify(targetEl));
  clone.id = generateId();
  clone.name = (clone.name || clone.type || 'Element') + ' (Copy)';
  if (typeof clone.xMm === 'number') {
    clone.xMm = Math.round((clone.xMm + 1) * 10) / 10;
  }
  if (typeof clone.yMm === 'number') {
    clone.yMm = Math.round((clone.yMm + 1) * 10) / 10;
  }
  clone.expanded = true;

  const idx = props.elements.findIndex(e => e.id === targetEl.id);
  if (idx !== -1) {
    props.elements.splice(idx + 1, 0, clone);
  } else {
    props.elements.push(clone);
  }
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
    availableProducts: { type: Array, default: () => [] }
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
        const isProductMode = !!(el.textType === 'product' || el.useProductMapping || el.isProductMode);
        const isOptionMode = !isProductMode && !!(el.textType === 'option' || el.useOptionMapping || el.isOptionMode);
        const isNormalMode = !isProductMode && !isOptionMode;

        // Content Type Mode Bar: Normal Text | Option Code | Product Type
        kids.push(h('div', { class: 'text-mode-bar' }, [
          h('span', { class: 'text-mode-label' }, 'Text Type:'),
          h('div', { class: 'mode-btn-group' }, [
            h('button', {
              type: 'button',
              class: ['mode-btn', isNormalMode ? 'active' : ''],
              onClick: () => {
                el.textType = 'normal';
                el.useOptionMapping = false;
                el.isOptionMode = false;
                el.useProductMapping = false;
                el.isProductMode = false;
              }
            }, '📝 Normal Text'),
            h('button', {
              type: 'button',
              class: ['mode-btn', isOptionMode ? 'active' : ''],
              onClick: () => {
                el.textType = 'option';
                el.useOptionMapping = true;
                el.isOptionMode = true;
                el.useProductMapping = false;
                el.isProductMode = false;
                if (!Array.isArray(el.optionMappings)) {
                  el.optionMappings = [];
                }
              }
            }, '🔀 Option Code'),
            h('button', {
              type: 'button',
              class: ['mode-btn', isProductMode ? 'active' : ''],
              onClick: () => {
                el.textType = 'product';
                el.useProductMapping = true;
                el.isProductMode = true;
                el.useOptionMapping = false;
                el.isOptionMode = false;
                if (!Array.isArray(el.productMappings)) {
                  el.productMappings = [];
                }
              }
            }, '📦 Product Type')
          ])
        ]));

        if (isNormalMode) {
          // Normal mode: Standard text input
          kids.push(h('div', { class: 'fg' }, [
            h('label', 'Text  (use {{serial}}, {{product}})'),
            h('input', { type: 'text', value: el.text || '', onInput: e => el.text = e.target.value, placeholder: 'e.g. {{product}} / {{serial}}' })
          ]));
        } else if (isOptionMode) {
          // Option Code Mode: Automatic {{options}} in background
          kids.push(h('div', { class: 'opt-mapping-panel' }, [
            h('div', { class: 'opt-panel-title' }, '🔀 Option Code Translation Rules'),
            h('div', { class: 'opt-rules-header' }, [
              h('span', { class: 'opt-col-title' }, 'Option Code'),
              h('span', { class: 'opt-col-title' }, 'Display Text'),
              h('span', { class: 'opt-col-title action-col' }, '')
            ]),
            ...(Array.isArray(el.optionMappings) ? el.optionMappings : []).map((rule, rIdx) =>
              h('div', { class: 'opt-rule-row', key: rIdx }, [
                h('input', {
                  type: 'text',
                  class: 'opt-code-input',
                  value: rule.code || '',
                  onInput: e => rule.code = e.target.value,
                  placeholder: 'e.g. A1411'
                }),
                h('input', {
                  type: 'text',
                  class: 'opt-text-input',
                  value: rule.text || '',
                  onInput: e => rule.text = e.target.value,
                  placeholder: 'e.g. Modbus RTU'
                }),
                h('button', {
                  type: 'button',
                  class: 'opt-del-btn',
                  title: 'Delete Rule',
                  onClick: () => el.optionMappings.splice(rIdx, 1)
                }, '✕')
              ])
            ),
            h('div', { class: 'opt-actions-row' }, [
              h('button', {
                type: 'button',
                class: 'add-opt-rule-btn',
                onClick: () => {
                  if (!Array.isArray(el.optionMappings)) el.optionMappings = [];
                  el.optionMappings.push({ code: '', text: '' });
                }
              }, '➕ Add Option Rule')
            ]),
            h('div', { class: 'fg default-fallback-fg' }, [
              h('label', { class: 'cb' }, [
                h('input', {
                  type: 'checkbox',
                  checked: el.useDefaultText !== false,
                  onChange: e => el.useDefaultText = e.target.checked
                }),
                ' Enable Default Fallback Text (if no code matches)'
              ]),
              el.useDefaultText === false
                ? h('div', { class: 'fallback-disabled-hint' }, 'Required option — one of the codes above must be selected.')
                : h('input', {
                    type: 'text',
                    value: el.defaultText || '',
                    onInput: e => el.defaultText = e.target.value,
                    placeholder: 'e.g. Standard'
                  })
            ])
          ]));
        } else if (isProductMode) {
          // Product Type Mode: Translation rules with dropdown list choose
          const prodList = (Array.isArray(props.availableProducts) && props.availableProducts.length > 0)
            ? props.availableProducts
            : [];

          const getDropdownOptions = (ruleProd) => {
            const list = [...prodList];
            if (ruleProd && !list.includes(ruleProd)) {
              list.unshift(ruleProd);
            }
            return list;
          };

          kids.push(h('div', { class: 'opt-mapping-panel prod-mapping-panel' }, [
            h('div', { class: 'opt-panel-title' }, '📦 Product Type Translation Rules'),
            h('div', { class: 'opt-rules-header' }, [
              h('span', { class: 'opt-col-title' }, 'Product Type'),
              h('span', { class: 'opt-col-title' }, 'Display Text'),
              h('span', { class: 'opt-col-title action-col' }, '')
            ]),
            ...(Array.isArray(el.productMappings) ? el.productMappings : []).map((rule, rIdx) => {
              const ruleProdOptions = getDropdownOptions(rule.product);
              return h('div', { class: 'opt-rule-row prod-rule-row', key: rIdx }, [
                rule.isCustom
                  ? h('div', { class: 'custom-prod-wrap', style: { display: 'flex', gap: '4px', alignItems: 'center' } }, [
                      h('input', {
                        type: 'text',
                        class: 'opt-code-input',
                        value: rule.product || '',
                        onInput: e => rule.product = e.target.value,
                        placeholder: 'Enter product code'
                      }),
                      h('button', {
                        type: 'button',
                        class: 'row-btn',
                        style: { padding: '2px 6px', fontSize: '11px', cursor: 'pointer', height: '24px' },
                        title: 'Switch to dropdown list',
                        onClick: () => { rule.isCustom = false; }
                      }, '▾')
                    ])
                  : h('select', {
                      class: 'opt-code-input prod-select',
                      value: rule.product || '',
                      onChange: e => {
                        if (e.target.value === '__custom__') {
                          rule.isCustom = true;
                        } else {
                          rule.product = e.target.value;
                        }
                      }
                    }, [
                      h('option', { value: '', disabled: true }, '-- Select Product --'),
                      ...ruleProdOptions.map(p => h('option', { value: p }, p)),
                      h('option', { value: '__custom__' }, '✏️ + Custom Product...')
                    ]),
                h('input', {
                  type: 'text',
                  class: 'opt-text-input',
                  value: rule.text || '',
                  onInput: e => rule.text = e.target.value,
                  placeholder: 'Display text (e.g. Thermal Mass Flow)'
                }),
                h('button', {
                  type: 'button',
                  class: 'opt-del-btn',
                  title: 'Delete Rule',
                  onClick: () => el.productMappings.splice(rIdx, 1)
                }, '✕')
              ]);
            }),
            h('div', { class: 'opt-actions-row' }, [
              h('button', {
                type: 'button',
                class: 'add-opt-rule-btn',
                onClick: () => {
                  if (!Array.isArray(el.productMappings)) el.productMappings = [];
                  const nextProd = prodList.find(p => !el.productMappings.some(r => r.product === p)) || prodList[0] || '';
                  el.productMappings.push({ product: nextProd, text: '' });
                }
              }, '➕ Add Product Rule')
            ]),
            h('div', { class: 'fg default-fallback-fg' }, [
              h('label', { class: 'cb' }, [
                h('input', {
                  type: 'checkbox',
                  checked: el.useDefaultText !== false,
                  onChange: e => el.useDefaultText = e.target.checked
                }),
                ' Enable Default Fallback Text (if no product matches)'
              ]),
              el.useDefaultText === false
                ? h('div', { class: 'fallback-disabled-hint' }, 'Required product — one of the product types above must match.')
                : h('input', {
                    type: 'text',
                    value: el.defaultText || '',
                    onInput: e => el.defaultText = e.target.value,
                    placeholder: 'e.g. Standard'
                  })
            ])
          ]));
        }

        // Shared position & font properties
        kids.push(h('div', { class: 'fg-row' }, [
          h('div', { class: 'fg' }, [h('label', 'X mm'), h('input', { type: 'number', step: 0.1, value: el.xMm, onInput: e => el.xMm = +e.target.value })]),
          h('div', { class: 'fg' }, [h('label', 'End X mm'), h('input', { type: 'number', step: 0.1, value: el.endXMm !== undefined ? el.endXMm : '', onInput: e => el.endXMm = e.target.value === '' ? undefined : +e.target.value, placeholder: 'Max width' })]),
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
          h('div', { class: 'fg' }, [h('label', { class: 'cb' }, [h('input', { type: 'checkbox', checked: el.readable !== false, onChange: e => el.readable = e.target.checked }), ' Text'])]),
          el.readable !== false
            ? h('div', { class: 'fg' }, [h('label', { class: 'cb' }, [h('input', { type: 'checkbox', checked: el.bold !== false, onChange: e => el.bold = e.target.checked }), ' Bold'])])
            : null,
          h('div', { class: 'fg' }, [h('label', { class: 'cb' }, [h('input', { type: 'checkbox', checked: !!el.border, onChange: e => el.border = e.target.checked }), ' Border'])]),
          el.readable !== false
            ? h('div', { class: 'fg' }, [h('label', 'Font pt'), h('input', { type: 'number', step: 0.5, value: el.fontSize || 4.5, min: 2, max: 24, onInput: e => el.fontSize = +e.target.value })])
            : null
        ]));
      }

      if (el.type === 'qrcode') {
        const isSutoMode = !!(el.qrMode === 'suto_protocol' || el.isSutoProtocol);

        kids.push(h('div', { class: 'text-mode-bar' }, [
          h('span', { class: 'text-mode-label' }, 'QR Mode:'),
          h('div', { class: 'mode-btn-group' }, [
            h('button', {
              type: 'button',
              class: ['mode-btn', !isSutoMode ? 'active' : ''],
              onClick: () => {
                el.qrMode = 'standard';
                el.isSutoProtocol = false;
              }
            }, '📝 Standard QR'),
            h('button', {
              type: 'button',
              class: ['mode-btn', isSutoMode ? 'active' : ''],
              onClick: () => {
                el.qrMode = 'suto_protocol';
                el.isSutoProtocol = true;
                if (!el.sutoProductType) el.sutoProductType = '{{product}}';
                if (!el.sutoPrefix) el.sutoPrefix = 'sensor';
              }
            }, '🔒 SUTO Protocol')
          ])
        ]));

        if (!isSutoMode) {
          kids.push(h('div', { class: 'fg' }, [
            h('label', 'QR Data / URL  (use {{serial}}, {{product}})'),
            h('input', {
              type: 'text',
              value: el.data || '',
              onInput: e => el.data = e.target.value,
              placeholder: 'e.g. https://example.com or {{serial}}'
            })
          ]));
        } else {
          kids.push(h('div', { class: 'opt-mapping-panel' }, [
            h('div', { class: 'opt-panel-title' }, '🔒 SUTO Sensor License Protocol Configuration'),
            h('div', { class: 'fg-row' }, [
              h('div', { class: 'fg fg-grow' }, [
                h('label', 'Device / Product Name'),
                h('input', {
                  type: 'text',
                  value: el.sutoProductType !== undefined ? el.sutoProductType : '{{device_name}}',
                  onInput: e => el.sutoProductType = e.target.value,
                  placeholder: 'e.g. {{device_name}}, {{product}}, or WTU-100'
                })
              ]),
              h('div', { class: 'fg' }, [
                h('label', 'QR Prefix'),
                h('input', {
                  type: 'text',
                  value: el.sutoPrefix || 'sensor',
                  onInput: e => el.sutoPrefix = e.target.value,
                  placeholder: 'sensor'
                })
              ])
            ]),
            h('div', { class: 'suto-preview-banner' }, [
              h('div', { class: 'banner-title' }, 'Protocol Format Spec:'),
              h('code', { class: 'banner-code' }, `/${el.sutoPrefix || 'sensor'}/${el.sutoProductType || '{{device_name}}'}/{serial}/{md5_hash}`),
              h('div', { class: 'banner-note' }, 'MD5 Salt: "this_is_sensor_salt"')
            ])
          ]));
        }

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
.row-btn.duplicate-btn:hover { color: #2b6cb0 !important; background: #ebf8ff !important; }
.row-btn.move-btn { font-size: 10px !important; padding: 2px 3px !important; }
.row-btn.move-btn:hover:not(:disabled) { color: #2b6cb0 !important; background: #ebf8ff !important; }
.row-btn.move-btn:disabled { opacity: 0.25; cursor: not-allowed; }

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

/* ── Option Mapping Rules UI ─────────────────────── */
:deep(.opt-mapping-block) {
  margin-top: 6px;
  padding-top: 6px;
  border-top: 1px dashed #e2e8f0;
}
:deep(.opt-mapping-cb) {
  font-weight: 600 !important;
  color: #2b6cb0 !important;
}
:deep(.opt-mapping-panel) {
  background: #ffffff;
  border: 1px solid #cbd5e0;
  border-radius: 6px;
  padding: 8px;
  margin-top: 6px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
:deep(.opt-rules-header) {
  display: grid;
  grid-template-columns: 1fr 1.5fr 24px;
  gap: 6px;
  font-size: 11px;
  font-weight: 700;
  color: #718096;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}
:deep(.opt-rule-row) {
  display: grid;
  grid-template-columns: 1fr 1.5fr 24px;
  gap: 6px;
  align-items: center;
}
:deep(.opt-code-input),
:deep(.opt-text-input) {
  background: #f8fafc !important;
  border: 1px solid #cbd5e0 !important;
  border-radius: 4px !important;
  padding: 3px 6px !important;
  font-size: 12px !important;
  width: 100% !important;
  box-sizing: border-box !important;
}
:deep(.opt-code-input:focus),
:deep(.opt-text-input:focus) {
  background: white !important;
  border-color: #3182ce !important;
}
:deep(.opt-del-btn) {
  background: transparent !important;
  border: none !important;
  color: #e53e3e !important;
  cursor: pointer;
  padding: 2px 4px !important;
  font-size: 11px !important;
  border-radius: 3px !important;
  box-shadow: none !important;
  width: auto !important;
}
:deep(.opt-del-btn:hover) {
  background: #fff5f5 !important;
}
:deep(.add-opt-rule-btn) {
  background: #ebf8ff !important;
  color: #2b6cb0 !important;
  border: 1px dashed #90cdf4 !important;
  padding: 4px 8px !important;
  border-radius: 4px !important;
  font-size: 11px !important;
  font-weight: 600 !important;
  cursor: pointer;
  width: 100% !important;
  margin-top: 2px;
}
:deep(.add-opt-rule-btn:hover) {
  background: #bee3f8 !important;
}
:deep(.default-fallback-fg) {
  margin-top: 4px;
}
:deep(.default-fallback-fg .cb) {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.78rem;
  font-weight: 600;
  color: #4a5568;
  margin-bottom: 4px;
}
:deep(.fallback-disabled-hint) {
  font-size: 0.76rem;
  color: #e53e3e;
  background: #fff5f5;
  border: 1px solid #fed7d7;
  border-radius: 6px;
  padding: 6px 9px;
}

/* ── Text Content Mode Selector ────────────────────── */
:deep(.text-mode-bar) {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}
:deep(.text-mode-label) {
  font-size: 11px;
  font-weight: 600;
  color: #718096;
}
:deep(.mode-btn-group) {
  display: inline-flex;
  border: 1px solid #cbd5e0;
  border-radius: 5px;
  overflow: hidden;
}
:deep(.mode-btn) {
  background: #f7fafc !important;
  color: #4a5568 !important;
  border: none !important;
  padding: 3px 8px !important;
  font-size: 11px !important;
  font-weight: 500 !important;
  cursor: pointer;
  box-shadow: none !important;
  width: auto !important;
  transition: all 0.12s ease;
}
:deep(.mode-btn + .mode-btn) {
  border-left: 1px solid #cbd5e0 !important;
}
:deep(.mode-btn.active) {
  background: #3182ce !important;
  color: white !important;
  font-weight: 600 !important;
}
:deep(.mode-btn:hover:not(.active)) {
  background: #edf2f7 !important;
  color: #2d3748 !important;
}
:deep(.opt-panel-title) {
  font-size: 11px;
  font-weight: 700;
  color: #2b6cb0;
  margin-bottom: 2px;
}

:deep(.suto-preview-banner) {
  margin-top: 4px;
  background: #f0fff4;
  border: 1px solid #c6f6d5;
  border-radius: 5px;
  padding: 6px 8px;
}
:deep(.banner-title) {
  font-size: 10px;
  font-weight: 700;
  color: #276749;
}
:deep(.banner-code) {
  display: block;
  font-family: monospace;
  font-size: 11px;
  color: #22543d;
  word-break: break-all;
  margin: 2px 0;
}
:deep(.banner-note) {
  font-size: 10px;
  color: #38a169;
}

:deep(.order-action-group) {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

:deep(.order-el-btn) {
  background: #f7fafc !important;
  color: #2b6cb0 !important;
  border: 1px solid #cbd5e0 !important;
  padding: 3px 8px !important;
  border-radius: 5px !important;
  font-size: 10px !important;
  font-weight: 700 !important;
  cursor: pointer;
  box-shadow: none !important;
  width: auto !important;
  transition: all 0.12s ease;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  line-height: 1.2;
}
:deep(.order-el-btn:hover:not(:disabled)) {
  background: #ebf8ff !important;
  border-color: #3182ce !important;
}
:deep(.order-el-btn:disabled) {
  opacity: 0.35;
  cursor: not-allowed;
}

:deep(.duplicate-el-btn) {
  background: #f7fafc !important;
  color: #2b6cb0 !important;
  border: 1px solid #cbd5e0 !important;
  padding: 3px 8px !important;
  border-radius: 5px !important;
  font-size: 11px !important;
  font-weight: 600 !important;
  cursor: pointer;
  box-shadow: none !important;
  width: auto !important;
  transition: all 0.12s ease;
}
:deep(.duplicate-el-btn:hover) {
  background: #ebf8ff !important;
  border-color: #3182ce !important;
}
</style>

export const MULTI_TEMPLATES_KEY = 'acbarcode_st_templates_v3';

export const DEFAULT_ELEMENTS_EN = [
  // ── Folders ──
  { id: 'f_var', type: 'folder', name: 'Variable Data', expanded: true },
  { id: 'f_fixed', type: 'folder', name: 'Fixed Layout', expanded: false },
  // ── Variable elements (user focuses on these) ──
  { id: 'el_model', type: 'text', name: 'Model Title', folderId: 'f_var',
    text: 'Model: {{product}}', xMm: 1, yMm: 4.8, fontSize: 5, bold: true, expanded: false },
  { id: 'el_item_no', type: 'text', name: 'Item No.', folderId: 'f_var',
    text: 'Item No.: {{product}}', xMm: 1, yMm: 7.2, fontSize: 4, bold: true, expanded: false },
  { id: 'el_serial', type: 'text', name: 'Serial No.', folderId: 'f_var',
    text: 'Serial No.: {{serial}}', xMm: 1, yMm: 8.9, fontSize: 4, bold: true, expanded: false },
  { id: 'el_range', type: 'text', name: 'Range / Options', folderId: 'f_var',
    text: 'Option: {{options}}', xMm: 1, yMm: 10.6, fontSize: 4, bold: true, expanded: false },
  // ── Fixed elements (collapse to hide) ──
  { id: 'el_logo', type: 'image', name: 'Logo', folderId: 'f_fixed',
    src: '/t_logo.jpg', xMm: 1, yMm: 1, widthMm: 9.6, storedName: 'Logo', expanded: false },
  { id: 'el_header_url', type: 'text', name: 'Header URL', folderId: 'f_fixed',
    text: 'www.suto-itec.com', xMm: 15.5, yMm: 1.8, fontSize: 5, bold: true, expanded: false },
  { id: 'el_divider', type: 'hline', name: 'Top Divider', folderId: 'f_fixed',
    xMm: 1, yMm: 4.2, x1Mm: 34, thicknessDots: 9, expanded: false },
  { id: 'el_fieldbus', type: 'text', name: 'Fieldbus', folderId: 'f_fixed',
    text: 'Fieldbus: Modbus/RTU+Analog', xMm: 1, yMm: 12.3, fontSize: 4, bold: true, expanded: false },
  { id: 'el_power', type: 'text', name: 'Power supply', folderId: 'f_fixed',
    text: 'Power supply: 16...30 VDC', xMm: 1, yMm: 14.2, fontSize: 4, bold: true, expanded: false },
  { id: 'el_pressure', type: 'text', name: 'Max. Pressure', folderId: 'f_fixed',
    text: 'Max. Pressure: 5.0 MPa(g)', xMm: 1, yMm: 15.9, fontSize: 4, bold: true, expanded: false },
  { id: 'el_separator', type: 'hline', lineShape: 'VLine', name: 'Vertical Sep.', folderId: 'f_fixed',
    xMm: 19.6, yMm: 14.3, y1Mm: 17.3, thicknessDots: 5, expanded: false },
  { id: 'el_accuracy', type: 'text', name: 'Accuracy', folderId: 'f_fixed',
    text: 'Accuracy: 1.5%', xMm: 20.4, yMm: 14.2, fontSize: 4, bold: true, expanded: false },
  { id: 'el_mfd', type: 'text', name: 'MFD', folderId: 'f_fixed',
    text: 'MFD: 2027-07', xMm: 20.4, yMm: 15.9, fontSize: 4, bold: true, expanded: false },
  { id: 'el_bgx', type: 'image', name: 'Bottom Right Image', folderId: 'f_fixed',
    src: '/b_bgx.png', xMm: 18, yMm: 17.6, widthMm: 16, storedName: 'Bottom_Right_Image', autoBottomRight: true, expanded: false }
];

export const DEFAULT_ELEMENTS_CN = [
  {
    id: 'el_logo',
    type: 'image',
    name: 'Logo',
    src: '/t_logo.jpg',
    xMm: 1,
    yMm: 1,
    widthMm: 9.6,
    storedName: 'Logo',
    expanded: false
  },
  {
    id: 'el_header_url',
    type: 'text',
    name: 'Header URL',
    text: 'www.suto-itec.cn',
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
    text: '型号: S403 | 热式气体质量流量计',
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
    text: '订货号: S695 4035 (空气)',
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
    text: '序列号: {{serial}}',
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
    text: '量程: 标准量程',
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
    text: '总线: Modbus/RTU+模拟量',
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
    text: '供电电源: 16...30 VDC',
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
    text: '耐压极限: 5.0 MPa(g)',
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
    text: '测量精度: 1.5%',
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
    text: '出厂日期: 2027-07',
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
    storedName: 'Bottom_Right_Image',
    autoBottomRight: true,
    expanded: false
  }
];

export function createInitialDefaultTemplates() {
  return [
    {
      id: 'tpl_std_flow',
      name: 'Standard Flow Sensor',
      itemNumbers: ['S695 4035', 'S695 4036', 'S403'],
      config: { widthMm: 35, heightMm: 22, dpi: 203 },
      elements_en: JSON.parse(JSON.stringify(DEFAULT_ELEMENTS_EN)),
      elements_cn: JSON.parse(JSON.stringify(DEFAULT_ELEMENTS_CN))
    },
    {
      id: 'tpl_high_temp',
      name: 'High Temp Sensor',
      itemNumbers: ['S695 4099', 'S4099'],
      config: { widthMm: 35, heightMm: 22, dpi: 203 },
      elements_en: JSON.parse(JSON.stringify(DEFAULT_ELEMENTS_EN)),
      elements_cn: JSON.parse(JSON.stringify(DEFAULT_ELEMENTS_CN))
    }
  ];
}

export function loadTemplatesFromStorage() {
  try {
    const raw = localStorage.getItem(MULTI_TEMPLATES_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (Array.isArray(data) && data.length > 0) {
        return data;
      }
    }
  } catch (e) {
    console.warn('Failed to parse templates from storage:', e);
  }
  const defaults = createInitialDefaultTemplates();
  localStorage.setItem(MULTI_TEMPLATES_KEY, JSON.stringify(defaults));
  return defaults;
}

export function saveTemplatesToStorage(templates) {
  try {
    localStorage.setItem(MULTI_TEMPLATES_KEY, JSON.stringify(templates));
  } catch (e) {
    console.error('Failed to save templates to storage:', e);
  }
}

export function matchTemplateByItemNo(templates, itemNo) {
  if (!itemNo || !Array.isArray(templates)) return null;
  const target = itemNo.trim().toLowerCase();
  const matched = templates.find(t => {
    if (!t.itemNumbers || !Array.isArray(t.itemNumbers)) return false;
    return t.itemNumbers.some(inNum => inNum.trim().toLowerCase() === target || target.includes(inNum.trim().toLowerCase()));
  });
  return matched || null;
}

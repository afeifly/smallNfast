export default {
  id: "tpl_delivery",
  name: "Delivery Template",
  isSpecial: true,
  itemNumbers: [
    "S695 4035",
    "S695 4036",
    "S403"
  ],
  note: "Default SUTO-iTEC Delivery label template (35×22mm @300 DPI). Always pinned to top and protected.",
  config: {
    widthMm: 35,
    heightMm: 22,
    dpi: 300
  },
  elements_en: [
    { id: "f_var", type: "folder", name: "Variable Data", expanded: true },
    { id: "f_fixed", type: "folder", name: "Fixed Layout", expanded: true },
    { id: "el_origin", type: "text", name: "Order / Origin", folderId: "f_var", text: "Order: {{origin}}", xMm: 1, yMm: 5.5, fontSize: 4, bold: true, expanded: false },
    { id: "el_item_no", type: "text", name: "Item No.", folderId: "f_var", text: "Item No.: {{product}}", xMm: 1, yMm: 7.2, fontSize: 4, bold: true, expanded: false },
    { id: "el_serial", type: "text", name: "Serial No.", folderId: "f_var", text: "Serial No.: {{serial}}", xMm: 1, yMm: 8.9, fontSize: 4, bold: true, expanded: false },
    { id: "el_logo", type: "image", name: "Logo", folderId: "f_fixed", src: "/t_logo.jpg", xMm: 1, yMm: 1, widthMm: 9.6, storedName: "Logo", expanded: false },
    { id: "el_header_url", type: "text", name: "Header URL", folderId: "f_fixed", text: "www.suto-itec.com", xMm: 18.1, yMm: 1.8, fontSize: 5, bold: true, expanded: false },
    { id: "el_divider", type: "hline", name: "Top Divider", folderId: "f_fixed", xMm: 1, yMm: 4.2, x1Mm: 34, thicknessDots: 2, expanded: true },
    { id: "el_bgx", type: "image", name: "Bottom Right Image", folderId: "f_fixed", src: "/b_bgx.png", xMm: 18, yMm: 17.6, widthMm: 16, storedName: "Bottom_Right_Image", autoBottomRight: true, expanded: false }
  ],
  elements_cn: [
    { id: "el_logo", type: "image", name: "Logo", src: "/t_logo.jpg", xMm: 1, yMm: 1, widthMm: 9.6, storedName: "Logo", expanded: false },
    { id: "el_header_url", type: "text", name: "Header URL", text: "www.suto-itec.cn", xMm: 15.5, yMm: 1.8, fontSize: 5, bold: true, expanded: false },
    { id: "el_divider", type: "hline", name: "Top Divider Line", xMm: 1, yMm: 4.2, x1Mm: 34, thicknessDots: 9, expanded: false },
    { id: "el_origin", type: "text", name: "发货单号", text: "单号: {{origin}}", xMm: 1, yMm: 4.8, fontSize: 4, bold: true, expanded: false },
    { id: "el_model", type: "text", name: "Model Title", text: "型号: {{categ}}", xMm: 1, yMm: 6.3, fontSize: 4, bold: true, expanded: false },
    { id: "el_item_no", type: "text", name: "Item No.", text: "订货号: {{product}}", xMm: 1, yMm: 7.8, fontSize: 4, bold: true, expanded: false },
    { id: "el_serial", type: "text", name: "Serial No.", text: "序列号: {{serial}}", xMm: 1, yMm: 9.3, fontSize: 4, bold: true, expanded: false },
    { id: "el_fieldbus", type: "text", name: "Fieldbus", text: "总线: Modbus/RTU+模拟量", xMm: 1, yMm: 12.3, fontSize: 4, bold: true, expanded: false },
    { id: "el_power", type: "text", name: "Power supply", text: "供电电源: 16...30 VDC", xMm: 1, yMm: 14.2, fontSize: 4, bold: true, expanded: false },
    { id: "el_pressure", type: "text", name: "Max. Pressure", text: "耐压极限: 5.0 MPa(g)", xMm: 1, yMm: 15.9, fontSize: 4, bold: true, expanded: false },
    { id: "el_separator", type: "hline", lineShape: "VLine", name: "Vertical Separator", xMm: 19.6, yMm: 14.3, y1Mm: 17.3, thicknessDots: 5, expanded: false },
    { id: "el_accuracy", type: "text", name: "Accuracy", text: "测量精度: 1.5%", xMm: 20.4, yMm: 14.2, fontSize: 4, bold: true, expanded: false },
    { id: "el_mfd", type: "text", name: "MFD", text: "出厂日期: 2027-07", xMm: 20.4, yMm: 15.9, fontSize: 4, bold: true, expanded: false },
    { id: "el_bgx", type: "image", name: "Bottom Right Image", src: "/b_bgx.png", xMm: 18, yMm: 17.6, widthMm: 16, storedName: "Bottom_Right_Image", autoBottomRight: true, expanded: false }
  ],
  subTemplates: [
    {
      id: "tpl_bkla22gkq",
      name: "Sub Template",
      note: "Smaller 22×22mm square label for SUTO QR code printing.",
      config: { widthMm: 22, heightMm: 22, dpi: 300 },
      elements_en: [
        { id: "f_var", type: "folder", name: "Variable Data", expanded: true },
        { id: "f_fixed", type: "folder", name: "Fixed Layout", expanded: false },
        { id: "el_logo", type: "image", name: "Logo", folderId: "f_fixed", src: "/t_logo.jpg", xMm: 1, yMm: 1, widthMm: 9.6, storedName: "Logo", expanded: false },
        { id: "el_header_url", type: "text", name: "Header URL", folderId: "f_fixed", text: "www.suto-itec.com", xMm: 15.5, yMm: 1.8, fontSize: 5, bold: true, expanded: false },
        { id: "el_divider", type: "hline", name: "Top Divider", folderId: "f_fixed", xMm: 1, yMm: 4.2, x1Mm: 34, thicknessDots: 9, expanded: false },
        { id: "el_fieldbus", type: "text", name: "Fieldbus", folderId: "f_fixed", text: "Fieldbus: Modbus/RTU+Analog", xMm: 1, yMm: 12.3, fontSize: 4, bold: true, expanded: false },
        { id: "el_power", type: "text", name: "Power supply", folderId: "f_fixed", text: "Power supply: 16...30 VDC", xMm: 1, yMm: 14.2, fontSize: 4, bold: true, expanded: false },
        { id: "el_pressure", type: "text", name: "Max. Pressure", folderId: "f_fixed", text: "Max. Pressure: 5.0 MPa(g)", xMm: 1, yMm: 15.9, fontSize: 4, bold: true, expanded: false },
        { id: "el_separator", type: "hline", lineShape: "VLine", name: "Vertical Sep.", folderId: "f_fixed", xMm: 19.6, yMm: 14.3, y1Mm: 17.3, thicknessDots: 5, expanded: false },
        { id: "el_accuracy", type: "text", name: "Accuracy", folderId: "f_fixed", text: "Accuracy: 1.5%", xMm: 20.4, yMm: 14.2, fontSize: 4, bold: true, expanded: false },
        { id: "el_mfd", type: "text", name: "MFD", folderId: "f_fixed", text: "MFD: 2027-07", xMm: 20.4, yMm: 15.9, fontSize: 4, bold: true, expanded: false },
        { id: "el_bgx", type: "image", name: "Bottom Right Image", folderId: "f_fixed", src: "/b_bgx.png", xMm: 18, yMm: 17.6, widthMm: 16, storedName: "Bottom_Right_Image", autoBottomRight: true, expanded: false },
        { id: "el_e0a9qsb2e", type: "qrcode", name: "New QR", folderId: null, expanded: true, qrMode: "suto_protocol", isSutoProtocol: true, sutoProductType: "{{device_name}}", sutoPrefix: "sensor", data: "", xMm: 1, yMm: 1, mul: 4 }
      ],
      elements_cn: []
    }
  ],
  createdAt: "2026-08-13T09:23:29.839Z",
  updatedAt: "2026-08-13T09:23:29.839Z"
};

const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { jsPDF } = require('jspdf');
const JSZip = require('jszip');
const templateStore = require('./templateStore');

templateStore.seedIfEmpty().then(() => {
  console.log(`Template store ready (${templateStore.count()} templates)`);
});

const app = express();
const PORT = process.env.PORT || (process.env.NODE_ENV === 'production' ? 9016 : 5005);

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.text({ type: ['application/xml', 'text/xml', 'text/plain'], limit: '10mb' }));

// Load ST Label static image assets once at startup
let stLogoBase64 = null;
let stBgxBase64 = null;
let stLogoAspect = 42 / 160;
let stBgxAspect = 392 / 1835;

function initStAssets() {
  try {
    const publicDir = path.join(__dirname, '..', 'public');
    const logoPath = path.join(publicDir, 't_logo.jpg');
    const bgxPath = path.join(publicDir, 'b_bgx.png');

    if (fs.existsSync(logoPath)) {
      const buf = fs.readFileSync(logoPath);
      stLogoBase64 = `data:image/jpeg;base64,${buf.toString('base64')}`;
      let i = 0;
      while (i < buf.length) {
        if (buf[i] === 0xFF && (buf[i+1] === 0xC0 || buf[i+1] === 0xC2)) {
          const height = buf.readUInt16BE(i + 5);
          const width = buf.readUInt16BE(i + 7);
          if (width > 0) stLogoAspect = height / width;
          break;
        }
        i++;
      }
    }
    if (fs.existsSync(bgxPath)) {
      const buf = fs.readFileSync(bgxPath);
      stBgxBase64 = `data:image/png;base64,${buf.toString('base64')}`;
      if (buf.length >= 24) {
        const width = buf.readUInt32BE(16);
        const height = buf.readUInt32BE(20);
        if (width > 0) stBgxAspect = height / width;
      }
    }
  } catch (err) {
    console.error('Error pre-loading ST label assets:', err);
  }
}
initStAssets();

function formatStSerial(raw) {
  if (!raw) return '3726 0001';
  const clean = String(raw).trim();
  if (/^\d{8}$/.test(clean)) {
    return `${clean.slice(0, 4)} ${clean.slice(4)}`;
  }
  return clean;
}

function generateStPdfBuffer(serialNumbers) {
  const doc = new jsPDF({ unit: 'mm', format: [35, 22], orientation: 'landscape' });

  const logoW = 9.6;
  const logoH = logoW * stLogoAspect;
  const bgxW = 16.0;
  const bgxH = bgxW * stBgxAspect;

  serialNumbers.forEach((rawSerial, idx) => {
    if (idx > 0) {
      doc.addPage([35, 22], 'landscape');
    }

    const formattedSerial = formatStSerial(rawSerial);

    // Background
    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, 35, 22, 'F');

    // Logo top-left
    if (stLogoBase64) {
      doc.addImage(stLogoBase64, 'JPEG', 1, 1, logoW, logoH);
    }

    // Header URL
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5);
    doc.setTextColor(0, 0, 0);
    doc.text('www.suto-itec.com', 33, 2.8, { align: 'right' });

    // Horizontal line
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.38);
    doc.line(1, 4.2, 34, 4.2);

    // Title Model line
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5);
    doc.text('Model: S403 | Thermal Mass Flow', 1, 5.8);

    // Upper 4 Information items
    doc.setFontSize(4);
    let y = 7.8;
    const step = 1.7;
    const colon1_x = 7.2;

    const upperItems = [
      ['Item No.', ': S695 4035 (Air)'],
      ['Serial No.', `: ${formattedSerial}`],
      ['Range', ': Standard'],
      ['Fieldbus', ': Modbus/RTU+Analog']
    ];

    upperItems.forEach(([label, val]) => {
      doc.text(label, 1, y);
      doc.text(val, colon1_x, y);
      y += step;
    });

    // Bottom left items
    let yBottom = 14.8;
    const colonL = 10.6;
    const leftItems = [
      ['Power supply', ': 16...30 VDC'],
      ['Max. Pressure', ': 5.0 MPa(g)']
    ];

    leftItems.forEach(([label, val]) => {
      doc.text(label, 1, yBottom);
      doc.text(val, colonL, yBottom);
      yBottom += step;
    });

    // Vertical Separator Bar
    doc.setLineWidth(0.21);
    doc.line(19.6, 14.3, 19.6, 17.3);

    // Bottom right items
    let yR = 14.8;
    const rightX = 20.4;
    const colonR = 26.4;
    const rightItems = [
      ['Accuracy', ': 1.5%'],
      ['MFD', ': 2027-07']
    ];

    rightItems.forEach(([label, val]) => {
      doc.text(label, rightX, yR);
      doc.text(val, colonR, yR);
      yR += step;
    });

    // Bottom Right Image
    if (stBgxBase64) {
      const bgxX = 35 - bgxW - 1;
      const bgxY = 22 - bgxH - 1;
      doc.addImage(stBgxBase64, 'PNG', bgxX, bgxY, bgxW, bgxH);
    }
  });

  return Buffer.from(doc.output('arraybuffer'));
}

// Database configuration
const dbDir = path.join(__dirname, 'data');
const dbPath = path.join(dbDir, 'products.json');

// Ensure database directory exists
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Initial products list seed
const initialProducts = [
  { item: '1830174222', name: 'FL S93 T', band: 'atlascopco' },
  { item: '1830174237', name: 'FL S93 T', band: 'atlascopco' },
  { item: '1830174221', name: 'FL S93 T', band: 'atlascopco' },
  { item: '1830174236', name: 'FL S93 T', band: 'atlascopco' },
  { item: '1830174223', name: 'FL S93 T', band: 'atlascopco' },
  { item: '1830174238', name: 'FL S93 T', band: 'atlascopco' },
  { item: '1830138002', name: 'FL S185 T', band: 'atlascopco' },
  { item: '1830138003', name: 'FL S185 T', band: 'atlascopco' },
  { item: '1830174224', name: 'FL S185 T', band: 'atlascopco' },
  { item: '1830174226', name: 'FL S185 T', band: 'atlascopco' },
  { item: '1830174239', name: 'FL S185 T', band: 'atlascopco' },
  { item: '1830138004', name: 'FL S224 T', band: 'atlascopco' },
  { item: '1830138005', name: 'FL S224 T', band: 'atlascopco' },
  { item: '1830174229', name: 'FL S224 T', band: 'atlascopco' },
  { item: '1830174240', name: 'FL S224 T', band: 'atlascopco' },
  { item: '1830174232', name: 'FL S200 P', band: 'atlascopco' },
  { item: '1830174219', name: 'FL S200 P', band: 'atlascopco' },
  { item: '1830174235', name: 'FL S260 P', band: 'atlascopco' },
  { item: '1830174220', name: 'FL S260 P', band: 'atlascopco' },
  { item: '1830138006', name: 'FL S200 P', band: 'atlascopco' },
  { item: '1830138007', name: 'FL S200 P', band: 'atlascopco' },
  { item: '1830138008', name: 'FL S260 P', band: 'atlascopco' },
  { item: '1830138009', name: 'FL S260 P', band: 'atlascopco' },
  { item: '1830138010', name: 'FLI D08 C', band: 'atlascopco' },
  { item: '1830138011', name: 'FLI D08 C', band: 'atlascopco' },
  { item: '1830138012', name: 'FLI D08 C', band: 'atlascopco' },
  { item: '1830138013', name: 'FLI D08 C', band: 'atlascopco' },
  { item: '1830174204', name: 'FLI D15 A', band: 'atlascopco' },
  { item: '1830174207', name: 'FLI D20 A', band: 'atlascopco' },
  { item: '1830174210', name: 'FLI D25 A', band: 'atlascopco' },
  { item: '1830174213', name: 'FLI D32 A', band: 'atlascopco' },
  { item: '1830174203', name: 'FLI D15 A', band: 'atlascopco' },
  { item: '1830174206', name: 'FLI D20 A', band: 'atlascopco' },
  { item: '1830174209', name: 'FLI D25 A', band: 'atlascopco' },
  { item: '1830174212', name: 'FLI D32 A', band: 'atlascopco' },
  { item: '1830174205', name: 'FLI D15 A', band: 'atlascopco' },
  { item: '1830174208', name: 'FLI D20 A', band: 'atlascopco' },
  { item: '1830174211', name: 'FLI D25 A', band: 'atlascopco' },
  { item: '1830174214', name: 'FLI D32 A', band: 'atlascopco' },
  { item: '1830174215', name: 'FLI D40 A', band: 'atlascopco' },
  { item: '1830174216', name: 'FLI D50 A', band: 'atlascopco' },
  { item: '1830174217', name: 'FLI D65 A', band: 'atlascopco' },
  { item: '1830174218', name: 'FLI D80 A', band: 'atlascopco' },
  { item: '1830174188', name: 'FLI D15 A', band: 'atlascopco' },
  { item: '1830174191', name: 'FLI D20 A', band: 'atlascopco' },
  { item: '1830174194', name: 'FLI D25 A', band: 'atlascopco' },
  { item: '1830174197', name: 'FLI D32 A', band: 'atlascopco' },
  { item: '1830174187', name: 'FLI D15 A', band: 'atlascopco' },
  { item: '1830174190', name: 'FLI D20 A', band: 'atlascopco' },
  { item: '1830174193', name: 'FLI D25 A', band: 'atlascopco' },
  { item: '1830174196', name: 'FLI D32 A', band: 'atlascopco' },
  { item: '1830174189', name: 'FLI D15 A', band: 'atlascopco' },
  { item: '1830174192', name: 'FLI D20 A', band: 'atlascopco' },
  { item: '1830174195', name: 'FLI D25 A', band: 'atlascopco' },
  { item: '1830174198', name: 'FLI D32 A', band: 'atlascopco' },
  { item: '1830174199', name: 'FLI D40 A', band: 'atlascopco' },
  { item: '1830174200', name: 'FLI D50 A', band: 'atlascopco' },
  { item: '1830174201', name: 'FLI D65 A', band: 'atlascopco' },
  { item: '1830174202', name: 'FLI D80 A', band: 'atlascopco' },
  { item: '1830138014', name: 'FLI D15 C', band: 'atlascopco' },
  { item: '1830138015', name: 'FLI D15 C', band: 'atlascopco' },
  { item: '1830138016', name: 'FLI D15 C', band: 'atlascopco' },
  { item: '1830138017', name: 'FLI D15 C', band: 'atlascopco' },
  { item: '1830138018', name: 'FLI D20 C', band: 'atlascopco' },
  { item: '1830138019', name: 'FLI D20 C', band: 'atlascopco' },
  { item: '1830138020', name: 'FLI D20 C', band: 'atlascopco' },
  { item: '1830138021', name: 'FLI D20 C', band: 'atlascopco' },
  { item: '1830138022', name: 'FLI D25 C', band: 'atlascopco' },
  { item: '1830138023', name: 'FLI D25 C', band: 'atlascopco' },
  { item: '1830138024', name: 'FLI D25 C', band: 'atlascopco' },
  { item: '1830138025', name: 'FLI D25 C', band: 'atlascopco' },
  { item: '1830138026', name: 'FLI D32 C', band: 'atlascopco' },
  { item: '1830138027', name: 'FLI D32 C', band: 'atlascopco' },
  { item: '1830138028', name: 'FLI D32 C', band: 'atlascopco' },
  { item: '1830138029', name: 'FLI D32 C', band: 'atlascopco' },
  { item: '1830138030', name: 'FLI D40 A', band: 'atlascopco' },
  { item: '1830138031', name: 'FLI D40 A', band: 'atlascopco' },
  { item: '1830138032', name: 'FLI D40 A', band: 'atlascopco' },
  { item: '1830138033', name: 'FLI D40 A', band: 'atlascopco' },
  { item: '1830138034', name: 'FLI D50 A', band: 'atlascopco' },
  { item: '1830138035', name: 'FLI D50 A', band: 'atlascopco' },
  { item: '1830138036', name: 'FLI D50 A', band: 'atlascopco' },
  { item: '1830138037', name: 'FLI D50 A', band: 'atlascopco' },
  { item: '1830138038', name: 'FLI D65 A', band: 'atlascopco' },
  { item: '1830138039', name: 'FLI D65 A', band: 'atlascopco' },
  { item: '1830138040', name: 'FLI D65 A', band: 'atlascopco' },
  { item: '1830138041', name: 'FLI D65 A', band: 'atlascopco' },
  { item: '1830138042', name: 'FLI D80 A', band: 'atlascopco' },
  { item: '1830138043', name: 'FLI D80 A', band: 'atlascopco' },
  { item: '1830138044', name: 'FLI D80 A', band: 'atlascopco' },
  { item: '1830138045', name: 'FLI D80 A', band: 'atlascopco' },
  { item: '1830154911', name: 'DP T20', band: 'atlascopco' },
  { item: '1830154913', name: 'DP T60', band: 'atlascopco' },
  { item: '1830154915', name: 'DP T100', band: 'atlascopco' },
  { item: '1830154912', name: 'DP T20 P', band: 'atlascopco' },
  { item: '1830154914', name: 'DP T60 P', band: 'atlascopco' },
  { item: '1830154916', name: 'DP T100 P', band: 'atlascopco' },
  { item: '1830013233', name: 'AQA', band: 'atlascopco' },
  { item: '1830013234', name: 'AQA Ex.', band: 'atlascopco' },
  { item: '1830013236', name: 'ISD', band: 'atlascopco' },
  { item: '1830013237', name: 'ISD Ex.', band: 'atlascopco' },
  { item: '1830013238', name: 'AOS', band: 'atlascopco' },
  { item: '1830013239', name: 'AOS Ex.', band: 'atlascopco' },
  { item: '1830023295', name: 'WAF', band: 'atlascopco' },
  { item: '1830070888', name: 'AQM', band: 'atlascopco' },
  { item: '1830070889', name: 'AQM Ex.', band: 'atlascopco' },
  { item: '1830071656', name: 'WAF Ex.', band: 'atlascopco' },
  { item: '1830147340', name: 'DL P50', band: 'atlascopco' },
  { item: '1830174225', name: 'FL S185 T', band: 'atlascopco' },
  { item: '1830174227', name: 'FL S224 T', band: 'atlascopco' },
  { item: '1830174228', name: 'FL S224 T', band: 'atlascopco' },
  { item: '1830174230', name: 'FL S200 P', band: 'atlascopco' },
  { item: '1830174231', name: 'FL S200 P', band: 'atlascopco' },
  { item: '1830174233', name: 'FL S260 P', band: 'atlascopco' },
  { item: '1830174234', name: 'FL S260 P', band: 'atlascopco' },
  { item: '1830177965', name: 'FC D15 A N A', band: 'atlascopco' },
  { item: '1830177966', name: 'FC D15 A N M', band: 'atlascopco' },
  { item: '1830177967', name: 'FC D15 A N MT', band: 'atlascopco' },
  { item: '1830177968', name: 'FC D20 A N A', band: 'atlascopco' },
  { item: '1830177969', name: 'FC D20 A N M', band: 'atlascopco' },
  { item: '1830177970', name: 'FC D20 A N MT', band: 'atlascopco' },
  { item: '1830177971', name: 'FC D25 A N A', band: 'atlascopco' },
  { item: '1830177972', name: 'FC D25 A N M', band: 'atlascopco' },
  { item: '1830177973', name: 'FC D25 A N MT', band: 'atlascopco' },
  { item: '1830177974', name: 'FC D32 A N A', band: 'atlascopco' },
  { item: '1830177975', name: 'FC D32 A N M', band: 'atlascopco' },
  { item: '1830177976', name: 'FC D32 A N MT', band: 'atlascopco' },
  { item: '1830177977', name: 'FC D40 A N A', band: 'atlascopco' },
  { item: '1830177978', name: 'FC D40 A N M', band: 'atlascopco' },
  { item: '1830177979', name: 'FC D40 A N MT', band: 'atlascopco' },
  { item: '1830177980', name: 'FC D50 A N A', band: 'atlascopco' },
  { item: '1830177981', name: 'FC D50 A N M', band: 'atlascopco' },
  { item: '1830177982', name: 'FC D50 A N MT', band: 'atlascopco' },
  { item: '1830177983', name: 'FC D65 A N A', band: 'atlascopco' },
  { item: '1830177984', name: 'FC D65 A N M', band: 'atlascopco' },
  { item: '1830177985', name: 'FC D65 A N MT', band: 'atlascopco' },
  { item: '1830177986', name: 'FC D80 A N A', band: 'atlascopco' },
  { item: '1830177987', name: 'FC D80 A N M', band: 'atlascopco' },
  { item: '1830177988', name: 'FC D80 A N MT', band: 'atlascopco' },
  { item: '1830177989', name: 'FC D15 A R A', band: 'atlascopco' },
  { item: '1830177990', name: 'FC D15 A R M', band: 'atlascopco' },
  { item: '1830177991', name: 'FC D15 A R MT', band: 'atlascopco' },
  { item: '1830177994', name: 'FC D20 A R MT', band: 'atlascopco' },
  { item: '1830177995', name: 'FC D25 A R A', band: 'atlascopco' },
  { item: '1830177996', name: 'FC D25 A R M', band: 'atlascopco' },
  { item: '1830177997', name: 'FC D25 A R MT', band: 'atlascopco' },
  { item: '1830177998', name: 'FC D32 A R A', band: 'atlascopco' },
  { item: '1830177999', name: 'FC D32 A R M', band: 'atlascopco' },
  { item: '1830178000', name: 'FC D32 A R MT', band: 'atlascopco' },
  { item: '1830178001', name: 'FC D40 A R A', band: 'atlascopco' },
  { item: '1830178002', name: 'FC D40 A R M', band: 'atlascopco' },
  { item: '1830178003', name: 'FC D40 A R MT', band: 'atlascopco' },
  { item: '1830178004', name: 'FC D50 A R A', band: 'atlascopco' },
  { item: '1830178005', name: 'FC D50 A R M', band: 'atlascopco' },
  { item: '1830178006', name: 'FC D50 A R MT', band: 'atlascopco' },
  { item: '1830178007', name: 'FC D65 A R A', band: 'atlascopco' },
  { item: '1830178008', name: 'FC D65 A R M', band: 'atlascopco' },
  { item: '1830178009', name: 'FC D65 A R MT', band: 'atlascopco' },
  { item: '1830178010', name: 'FC D80 A R A', band: 'atlascopco' },
  { item: '1830178011', name: 'FC D80 A R M', band: 'atlascopco' },
  { item: '1830178012', name: 'FC D80 A R MT', band: 'atlascopco' },
  { item: '1830178013', name: 'FC D08 C G A', band: 'atlascopco' },
  { item: '1830178014', name: 'FC D08 C N A', band: 'atlascopco' },
  { item: '1830178015', name: 'FC D08 C G M', band: 'atlascopco' },
  { item: '1830178016', name: 'FC D08 C N M', band: 'atlascopco' },
  { item: '1830178017', name: 'FC D15 C G A', band: 'atlascopco' },
  { item: '1830178018', name: 'FC D15 C N A', band: 'atlascopco' },
  { item: '1830178019', name: 'FC D15 C G M', band: 'atlascopco' },
  { item: '1830178020', name: 'FC D15 C N M', band: 'atlascopco' },
  { item: '1830178021', name: 'FC D20 C G A', band: 'atlascopco' },
  { item: '1830178022', name: 'FC D20 C N A', band: 'atlascopco' },
  { item: '1830178023', name: 'FC D20 C G M', band: 'atlascopco' },
  { item: '1830178024', name: 'FC D20 C N M', band: 'atlascopco' },
  { item: '1830178025', name: 'FC D25 C G A', band: 'atlascopco' },
  { item: '1830178026', name: 'FC D25 C N A', band: 'atlascopco' },
  { item: '1830178027', name: 'FC D25 C G M', band: 'atlascopco' },
  { item: '1830178028', name: 'FC D25 C N M', band: 'atlascopco' },
  { item: '1830178029', name: 'FC D32 C G A', band: 'atlascopco' },
  { item: '1830178030', name: 'FC D32 C N A', band: 'atlascopco' },
  { item: '1830178031', name: 'FC D32 C G M', band: 'atlascopco' },
  { item: '1830178032', name: 'FC D32 C N M', band: 'atlascopco' },
  { item: '1830178033', name: 'FC S200 W A', band: 'atlascopco' },
  { item: '1830178034', name: 'FC S200 W M', band: 'atlascopco' },
  { item: '1830178035', name: 'FC S200 W MT', band: 'atlascopco' },
  { item: '1830178036', name: 'FC S260 W A', band: 'atlascopco' },
  { item: '1830178037', name: 'FC S260 W M', band: 'atlascopco' },
  { item: '1830178038', name: 'FC S260 W MT', band: 'atlascopco' },
  { item: '1830178039', name: 'FC S200 W A', band: 'atlascopco' },
  { item: '1830178040', name: 'FC S200 W M', band: 'atlascopco' },
  { item: '1830178041', name: 'FC S200 W MT', band: 'atlascopco' },
  { item: '1830178042', name: 'FC S260 W A', band: 'atlascopco' },
  { item: '1830178043', name: 'FC S260 W M', band: 'atlascopco' },
  { item: '1830178044', name: 'FC S260 W MT', band: 'atlascopco' },
  { item: '1830178045', name: 'FC S93  A', band: 'atlascopco' },
  { item: '1830178046', name: 'FC S93  M', band: 'atlascopco' },
  { item: '1830178047', name: 'FC S93  MT', band: 'atlascopco' },
  { item: '1830178048', name: 'FC S185  A', band: 'atlascopco' },
  { item: '1830178049', name: 'FC S185  M', band: 'atlascopco' },
  { item: '1830178050', name: 'FC S185  MT', band: 'atlascopco' },
  { item: '1830178051', name: 'FC S224  A', band: 'atlascopco' },
  { item: '1830178052', name: 'FC S224  M', band: 'atlascopco' },
  { item: '1830178053', name: 'FC S224  MT', band: 'atlascopco' },
  { item: '1830178054', name: 'FC S93  A', band: 'atlascopco' },
  { item: '1830178055', name: 'FC S93  M', band: 'atlascopco' },
  { item: '1830178056', name: 'FC S93  MT', band: 'atlascopco' },
  { item: '1830178057', name: 'FC S185  A', band: 'atlascopco' },
  { item: '1830178058', name: 'FC S185  M', band: 'atlascopco' },
  { item: '1830178059', name: 'FC S185  MT', band: 'atlascopco' },
  { item: '1830178060', name: 'FC S224  A', band: 'atlascopco' },
  { item: '1830178061', name: 'FC S224  M', band: 'atlascopco' },
  { item: '1830178062', name: 'FC S224  MT', band: 'atlascopco' },
  { item: '1830178063', name: 'PDP SENS. T60 P', band: 'atlascopco' },
  { item: '1830178064', name: 'PDP SENS. T100', band: 'atlascopco' },
  { item: '1830178065', name: 'PDP SENS. T100 P', band: 'atlascopco' },
  { item: '1830178066', name: 'Check Box S18', band: 'atlascopco' },
  { item: '1830178088', name: 'PDP SENS. T20', band: 'atlascopco' },
  { item: '1830178089', name: 'PDP SENS. T20 P', band: 'atlascopco' },
  { item: '1830178090', name: 'PDP SENS. T60', band: 'atlascopco' },
  { item: '1830203005', name: 'EM A05', band: 'atlascopco' },
  { item: '1830203006', name: 'Rogowski 3PH 100A RJ12', band: 'atlascopco' },
  { item: '1830203007', name: 'Rogowski 3PH 1000A RJ12', band: 'atlascopco' },
  { item: '1830203008', name: 'Rogowski 3PH 3000A RJ12', band: 'atlascopco' },
  { item: '1830203009', name: 'Rogowski 1PH 100A RJ12', band: 'atlascopco' },
  { item: '1830203010', name: 'Rogowski 1PH 1000A RJ12', band: 'atlascopco' },
  { item: '1837085795', name: 'PDP SENSOR+CABLE', band: 'atlascopco' },
  { item: '1830203741', name: 'PDP SENSOR', band: 'atlascopco' },
  { item: '06653011', name: 'PDP SENSOR', band: 'atlascopco' }
];

// Load products helper
function loadProducts() {
  if (!fs.existsSync(dbPath)) {
    fs.writeFileSync(dbPath, JSON.stringify(initialProducts, null, 2), 'utf-8');
    return initialProducts;
  }
  try {
    const data = fs.readFileSync(dbPath, 'utf-8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Error reading products database, returning fallback initial data:', err);
    return initialProducts;
  }
}

// Save products helper
function saveProducts(productsList) {
  try {
    fs.writeFileSync(dbPath, JSON.stringify(productsList, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error('Error writing products database:', err);
    return false;
  }
}

// Authentication middleware
const adminAuth = (req, res, next) => {
  const adminPassword = req.headers['x-admin-password'];
  if (adminPassword !== 'SUTOadmin1234') {
    return res.status(403).json({ error: 'Unauthorized admin access required' });
  }
  next();
};

// API Endpoints
app.get('/api/products', (req, res) => {
  const productsList = loadProducts();
  res.json(productsList);
});

app.post('/api/products', adminAuth, (req, res) => {
  const { item, name, band } = req.body;
  if (!item || !name) {
    return res.status(400).json({ error: 'Item number and name are required' });
  }
  const cleanItem = item.trim();
  const cleanName = name.trim();
  const cleanBand = (band || 'atlascopco').trim();

  const productsList = loadProducts();
  const existing = productsList.find(p => p.item.toLowerCase() === cleanItem.toLowerCase());
  if (existing) {
    return res.status(400).json({ error: `Product with item number ${cleanItem} already exists` });
  }

  const newProduct = { item: cleanItem, name: cleanName, band: cleanBand };
  productsList.push(newProduct);
  if (saveProducts(productsList)) {
    res.status(201).json(newProduct);
  } else {
    res.status(500).json({ error: 'Failed to save product database' });
  }
});

app.put('/api/products/:item', adminAuth, (req, res) => {
  const targetItem = req.params.item;
  const { name, band } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'Product name is required' });
  }
  const cleanName = name.trim();
  const cleanBand = (band || 'atlascopco').trim();

  const productsList = loadProducts();
  const index = productsList.findIndex(p => p.item.toLowerCase() === targetItem.toLowerCase());
  if (index === -1) {
    return res.status(404).json({ error: `Product with item number ${targetItem} not found` });
  }

  productsList[index].name = cleanName;
  productsList[index].band = cleanBand;

  if (saveProducts(productsList)) {
    res.json(productsList[index]);
  } else {
    res.status(500).json({ error: 'Failed to update product database' });
  }
});

app.delete('/api/products/:item', adminAuth, (req, res) => {
  const targetItem = req.params.item;
  const productsList = loadProducts();
  const index = productsList.findIndex(p => p.item.toLowerCase() === targetItem.toLowerCase());
  if (index === -1) {
    return res.status(404).json({ error: `Product with item number ${targetItem} not found` });
  }

  const deletedProduct = productsList.splice(index, 1)[0];
  if (saveProducts(productsList)) {
    res.json({ message: 'Product deleted successfully', product: deletedProduct });
  } else {
    res.status(500).json({ error: 'Failed to update product database' });
  }
});

// ── Label Template API (SQLite-backed) ────────────────────────────────
// GET /api/templates  ->  all templates (export / read)
// PUT /api/templates  ->  replace all templates (import), admin only
// POST /api/templates  ->  create new template, admin only
// PUT /api/templates/:id  ->  update one template, admin only
// DELETE /api/templates/:id  ->  delete one template (keep >= 1), admin only

app.get('/api/templates', (req, res) => {
  try {
    res.json(templateStore.getAllTemplates());
  } catch (err) {
    console.error('Error getting templates:', err);
    res.status(500).json({ error: err.message || 'Failed to get templates' });
  }
});

app.put('/api/templates', adminAuth, (req, res) => {
  try {
    const list = req.body;
    if (!Array.isArray(list)) {
      return res.status(400).json({ error: 'Expected a JSON array of templates' });
    }
    const prepared = list.map(t => ({
      id: (t && t.id) ? String(t.id) : crypto.randomUUID(),
      name: (t && t.name) || 'New Template',
      itemNumbers: (t && Array.isArray(t.itemNumbers)) ? t.itemNumbers : [],
      deviceName: (t && t.deviceName) ? String(t.deviceName) : '',
      note: (t && t.note) ? String(t.note) : '',
      config: (t && t.config) || { widthMm: 35, heightMm: 22, dpi: 203 },
      elements_en: (t && Array.isArray(t.elements_en)) ? t.elements_en : [],
      elements_cn: (t && Array.isArray(t.elements_cn)) ? t.elements_cn : [],
      subTemplates: (t && Array.isArray(t.subTemplates)) ? t.subTemplates : []
    }));
    const saved = templateStore.replaceAll(prepared);
    res.json({ message: `${saved.length} template(s) imported`, templates: saved });
  } catch (err) {
    console.error('Error saving templates:', err);
    res.status(500).json({ error: err.message || 'Failed to save templates' });
  }
});

app.post('/api/templates', adminAuth, (req, res) => {
  try {
    const t = {
      id: crypto.randomUUID(),
      name: (req.body && req.body.name) || 'New Template',
      itemNumbers: (req.body && Array.isArray(req.body.itemNumbers)) ? req.body.itemNumbers : [],
      deviceName: (req.body && req.body.deviceName) ? String(req.body.deviceName) : '',
      note: (req.body && req.body.note) ? String(req.body.note) : '',
      config: (req.body && req.body.config) || { widthMm: 35, heightMm: 22, dpi: 203 },
      elements_en: (req.body && Array.isArray(req.body.elements_en)) ? req.body.elements_en : [],
      elements_cn: (req.body && Array.isArray(req.body.elements_cn)) ? req.body.elements_cn : [],
      subTemplates: (req.body && Array.isArray(req.body.subTemplates)) ? req.body.subTemplates : []
    };
    res.status(201).json(templateStore.insertTemplate(t));
  } catch (err) {
    console.error('Error creating template:', err);
    res.status(500).json({ error: err.message || 'Failed to create template' });
  }
});

app.put('/api/templates/:id', adminAuth, (req, res) => {
  try {
    const updated = templateStore.updateTemplate(req.params.id, req.body || {});
    if (!updated) {
      return res.status(404).json({ error: `Template with id ${req.params.id} not found` });
    }
    res.json(updated);
  } catch (err) {
    console.error('Error updating template:', err);
    res.status(500).json({ error: err.message || 'Failed to update template' });
  }
});

app.delete('/api/templates/:id', adminAuth, (req, res) => {
  try {
    const tpl = templateStore.getTemplateById(req.params.id);
    if (tpl && templateStore.isSpecialTemplate(tpl)) {
      return res.status(400).json({ error: 'The Delivery Template cannot be deleted' });
    }
    if (templateStore.count() <= 1) {
      return res.status(400).json({ error: 'Cannot delete the last template' });
    }
    if (!templateStore.deleteTemplate(req.params.id)) {
      return res.status(404).json({ error: `Template with id ${req.params.id} not found or protected` });
    }
    res.json({ message: 'Template deleted successfully' });
  } catch (err) {
    console.error('Error deleting template:', err);
    res.status(500).json({ error: err.message || 'Failed to delete template' });
  }
});

// ST Label PDF Generation API
// GET /api/st-label?sn=12345678 or GET /api/st-label?sn=12345678&sn=87654321
// POST /api/st-label with JSON { "serials": ["12345678", "87654321"] }
const handleStLabelRequest = (req, res) => {
  let serials = [];

  if (req.method === 'POST' && req.body) {
    if (Array.isArray(req.body.serials)) {
      serials = req.body.serials;
    } else if (req.body.sn) {
      serials = Array.isArray(req.body.sn) ? req.body.sn : [req.body.sn];
    }
  }

  if (serials.length === 0 && req.query) {
    if (req.query.sn) {
      serials = Array.isArray(req.query.sn) ? req.query.sn : [req.query.sn];
    } else if (req.query.serials) {
      serials = String(req.query.serials).split(/[\n,]/).map(s => s.trim()).filter(Boolean);
    }
  }

  // Clean serial numbers
  serials = serials.map(s => String(s).trim()).filter(Boolean);

  if (serials.length === 0) {
    return res.status(400).json({ 
      error: 'Serial number is required. Usage: GET /api/st-label?sn=12345678 or POST /api/st-label with { "serials": ["12345678"] }' 
    });
  }

  // Limit max 10 serials per request
  serials = serials.slice(0, 10);

  try {
    const pdfBuffer = generateStPdfBuffer(serials);
    const filename = serials.length === 1 ? `ST_Label_${serials[0]}.pdf` : 'ST_Labels.pdf';

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.send(pdfBuffer);
  } catch (err) {
    console.error('Error generating ST label PDF:', err);
    res.status(500).json({ error: 'Failed to generate ST label PDF' });
  }
};

app.get('/api/st-label', handleStLabelRequest);
app.post('/api/st-label', handleStLabelRequest);

// Odoo API Configuration & Test Endpoints
const odooConfigPath = path.join(dbDir, 'odoo_config.json');

const https = require('https');
const http = require('http');

const keepAliveHttpsAgent = new https.Agent({ keepAlive: true, maxSockets: 50 });
const keepAliveHttpAgent = new http.Agent({ keepAlive: true, maxSockets: 50 });

// In-memory cache for Odoo Auth UID to eliminate redundant auth roundtrips
const odooAuthCache = new Map();

function escapeXml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function unescapeXml(str) {
  return String(str)
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function jsToXmlRpc(val) {
  if (val === null || val === undefined) {
    return '<value><nil/></value>';
  }
  if (typeof val === 'boolean') {
    return `<value><boolean>${val ? 1 : 0}</boolean></value>`;
  }
  if (typeof val === 'number') {
    return Number.isInteger(val)
      ? `<value><int>${val}</int></value>`
      : `<value><double>${val}</double></value>`;
  }
  if (typeof val === 'string') {
    return `<value><string>${escapeXml(val)}</string></value>`;
  }
  if (Array.isArray(val)) {
    const items = val.map(jsToXmlRpc).join('');
    return `<value><array><data>${items}</data></array></value>`;
  }
  if (typeof val === 'object') {
    const members = Object.entries(val)
      .map(([k, v]) => `<member><name>${escapeXml(k)}</name>${jsToXmlRpc(v)}</member>`)
      .join('');
    return `<value><struct>${members}</struct></value>`;
  }
  return `<value><string>${escapeXml(String(val))}</string></value>`;
}

function xmlRpcToJs(xml) {
  if (xml.includes('<fault>')) {
    const faultMatch = xml.match(/<member><name>faultString<\/name><value>(?:<string>)?([\s\S]*?)(?:<\/string>)?<\/value>/i);
    throw new Error(faultMatch ? unescapeXml(faultMatch[1]) : 'XML-RPC Fault');
  }

  let pos = 0;
  
  function skipWhitespace() {
    while (pos < xml.length && /\s/.test(xml[pos])) pos++;
  }

  function parseValue() {
    skipWhitespace();
    if (xml.startsWith('<value>', pos)) {
      pos += 7;
      skipWhitespace();
      const val = parseValueContent();
      skipWhitespace();
      if (xml.startsWith('</value>', pos)) {
        pos += 8;
      }
      return val;
    }
    return parseValueContent();
  }

  function parseValueContent() {
    skipWhitespace();
    if (xml.startsWith('<string>', pos)) {
      pos += 8;
      const end = xml.indexOf('</string>', pos);
      const str = unescapeXml(xml.slice(pos, end));
      pos = end + 9;
      return str;
    }
    if (xml.startsWith('<int>', pos) || xml.startsWith('<i4>', pos)) {
      const tagLen = xml.startsWith('<int>', pos) ? 5 : 4;
      const endTag = xml.startsWith('<int>', pos) ? '</int>' : '</i4>';
      pos += tagLen;
      const end = xml.indexOf(endTag, pos);
      const num = parseInt(xml.slice(pos, end), 10);
      pos = end + endTag.length;
      return num;
    }
    if (xml.startsWith('<double>', pos)) {
      pos += 8;
      const end = xml.indexOf('</double>', pos);
      const num = parseFloat(xml.slice(pos, end));
      pos = end + 9;
      return num;
    }
    if (xml.startsWith('<boolean>', pos)) {
      pos += 9;
      const end = xml.indexOf('</boolean>', pos);
      const bool = xml.slice(pos, end).trim() === '1';
      pos = end + 10;
      return bool;
    }
    if (xml.startsWith('<nil/>', pos)) {
      pos += 6;
      return null;
    }
    if (xml.startsWith('<array>', pos)) {
      pos += 7;
      skipWhitespace();
      if (xml.startsWith('<data>', pos)) pos += 6;
      const arr = [];
      while (pos < xml.length) {
        skipWhitespace();
        if (xml.startsWith('</data>', pos) || xml.startsWith('</array>', pos)) break;
        arr.push(parseValue());
      }
      skipWhitespace();
      if (xml.startsWith('</data>', pos)) pos += 7;
      skipWhitespace();
      if (xml.startsWith('</array>', pos)) pos += 8;
      return arr;
    }
    if (xml.startsWith('<struct>', pos)) {
      pos += 8;
      const obj = {};
      while (pos < xml.length) {
        skipWhitespace();
        if (xml.startsWith('</struct>', pos)) {
          pos += 9;
          break;
        }
        if (xml.startsWith('<member>', pos)) {
          pos += 8;
          skipWhitespace();
          let key = '';
          if (xml.startsWith('<name>', pos)) {
            pos += 6;
            const end = xml.indexOf('</name>', pos);
            key = unescapeXml(xml.slice(pos, end));
            pos = end + 7;
          }
          const val = parseValue();
          skipWhitespace();
          if (xml.startsWith('</member>', pos)) pos += 9;
          if (key) obj[key] = val;
        } else {
          pos++;
        }
      }
      return obj;
    }

    const end = xml.indexOf('<', pos);
    if (end === -1) {
      const str = unescapeXml(xml.slice(pos));
      pos = xml.length;
      return str;
    }
    const str = unescapeXml(xml.slice(pos, end));
    pos = end;
    return str;
  }

  const paramIdx = xml.indexOf('<param>');
  if (paramIdx !== -1) pos = paramIdx + 7;

  return parseValue();
}

async function odooXmlRpcCall(url, path, methodName, params) {
  const paramsXml = params.map(p => `<param>${jsToXmlRpc(p)}</param>`).join('');
  const xmlBody = `<?xml version="1.0"?><methodCall><methodName>${methodName}</methodName><params>${paramsXml}</params></methodCall>`;

  const cleanUrl = url.replace(/\/+$/, '');
  const agent = cleanUrl.startsWith('https') ? keepAliveHttpsAgent : keepAliveHttpAgent;

  const res = await fetch(`${cleanUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'text/xml' },
    body: xmlBody,
    agent
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText}`);
  }

  const xmlText = await res.text();
  return xmlRpcToJs(xmlText);
}


function loadOdooConfig() {
  try {
    if (fs.existsSync(odooConfigPath)) {
      return JSON.parse(fs.readFileSync(odooConfigPath, 'utf8'));
    }
  } catch (err) {
    console.error('Error reading odoo_config.json:', err);
  }
  return { url: '', db: '', username: '', password: '' };
}

function saveOdooConfig(config) {
  try {
    fs.writeFileSync(odooConfigPath, JSON.stringify(config, null, 2), 'utf8');
    odooAuthCache.clear();
    return true;
  } catch (err) {
    console.error('Error saving odoo_config.json:', err);
    return false;
  }
}

// GET /api/odoo/config
app.get('/api/odoo/config', (req, res) => {
  const config = loadOdooConfig();
  res.json({
    url: config.url || '',
    db: config.db || '',
    username: config.username || '',
    password: config.password || ''
  });
});

// POST /api/odoo/config
app.post('/api/odoo/config', (req, res) => {
  const { url, db, username, password } = req.body || {};
  const newConfig = {
    url: (url || '').trim(),
    db: (db || '').trim(),
    username: (username || '').trim(),
    password: (password || '').trim()
  };

  if (saveOdooConfig(newConfig)) {
    res.json({ message: 'Odoo configuration saved successfully', config: newConfig });
  } else {
    res.status(500).json({ error: 'Failed to save Odoo configuration' });
  }
});

// POST /api/odoo/test-search
app.post('/api/odoo/test-search', async (req, res) => {
  const savedConfig = loadOdooConfig();
  const url = (req.body.url || savedConfig.url || '').trim();
  const db = (req.body.db || savedConfig.db || '').trim();
  const username = (req.body.username || savedConfig.username || '').trim();
  const password = (req.body.password !== undefined ? req.body.password : savedConfig.password || '').trim();
  const inputSerial = (req.body.serialNumber || '').trim();

  if (!url || !db || !username) {
    return res.status(400).json({ error: 'Odoo URL, Database, and Username must be configured.' });
  }

  if (!inputSerial) {
    return res.status(400).json({ error: 'Please enter a serial number to test search.' });
  }

  const formattedSerial = formatStSerial(inputSerial);
  const searchSerials = Array.from(new Set([inputSerial, formattedSerial]));

  const logs = [];
  const authKey = `${url}|${db}|${username}|${password}`;

  try {
    // Step 1: Authenticate via fast /xmlrpc/2/common
    let uid = odooAuthCache.get(authKey);
    if (!uid) {
      uid = await odooXmlRpcCall(url, '/xmlrpc/2/common', 'authenticate', [db, username, password, {}]);
      if (!uid) {
        logs.push('Connect failed, please check the database and username and password.');
        return res.json({
          success: false,
          error: 'Connect failed, please check database, username, and password.',
          logs
        });
      }
      odooAuthCache.set(authKey, uid);
    }
    logs.push(`Success connected, user:${uid}`);

    // Step 2: Search stock.lot via fast /xmlrpc/2/object (matching both raw and formatted serials)
    let lotIds;
    try {
      lotIds = await odooXmlRpcCall(url, '/xmlrpc/2/object', 'execute_kw', [
        db, uid, password, 'stock.lot', 'search', [[['name', 'in', searchSerials]]]
      ]);
    } catch (err) {
      odooAuthCache.delete(authKey);
      uid = await odooXmlRpcCall(url, '/xmlrpc/2/common', 'authenticate', [db, username, password, {}]);
      if (!uid) throw err;
      odooAuthCache.set(authKey, uid);
      lotIds = await odooXmlRpcCall(url, '/xmlrpc/2/object', 'execute_kw', [
        db, uid, password, 'stock.lot', 'search', [[['name', 'in', searchSerials]]]
      ]);
    }

    if (!lotIds || lotIds.length === 0) {
      logs.push('Can not find SN.');
      return res.json({
        success: true,
        uid,
        lotIds: [],
        productionIds: [],
        records: [],
        message: 'Can not find SN.',
        logs
      });
    }
    logs.push(`Found stock.lot IDs: ${JSON.stringify(lotIds)}`);

    // Step 3: Search mrp.production via fast /xmlrpc/2/object
    const productionIds = await odooXmlRpcCall(url, '/xmlrpc/2/object', 'execute_kw', [
      db, uid, password, 'mrp.production', 'search', [[['serial_ids', 'in', lotIds]]]
    ]);

    if (!productionIds || productionIds.length === 0) {
      logs.push('Can not find MO.');
      return res.json({
        success: true,
        uid,
        lotIds,
        productionIds: [],
        records: [],
        message: 'Can not find MO.',
        logs
      });
    }
    logs.push(`Found mrp.production IDs: ${JSON.stringify(productionIds)}`);

    // Step 4: Read mrp.production fields (fetching essential fields fast)
    const records = await odooXmlRpcCall(url, '/xmlrpc/2/object', 'execute_kw', [
      db, uid, password, 'mrp.production', 'read', [productionIds],
      { fields: ['name', 'product_description_variants', 'product_id', 'product_tmpl_id', 'origin', 'state'] }
    ]);

    logs.push('\nMO and SN as below:');
    if (Array.isArray(records)) {
      records.forEach(rec => {
        logs.push(`MO: ${rec.name || ''} | Variants: ${rec.product_description_variants || ''}`);
      });
    }

    res.json({
      success: true,
      uid,
      lotIds,
      productionIds,
      records: Array.isArray(records) ? records : [],
      logs
    });

  } catch (err) {
    console.error('Error during Odoo test search:', err);
    logs.push(`Error: ${err.message}`);
    res.status(500).json({
      success: false,
      error: err.message,
      logs
    });
  }
});

// ── Web API: POST /st_label ─────────────────────────────────────────────
const { generateStEzpxXml, generateStEzplJson, generateStDeliveryMultiProductEzplJson } = require('./ezpxGenerator');

/**
 * POST /st_label and POST /api/st_label
 * Generates printable labels as a downloadable EZPX ZIP file or EZPL JSON grouping.
 */
async function handleStLabel(req, res) {
  try {
    let product, serial_numbers, options, template_xml, lang;

    if (typeof req.body === 'string' && req.body.trim().startsWith('<')) {
      // Raw XML POST body
      template_xml = req.body;
      product = req.query.product || 'S695 4120';
      serial_numbers = req.query.serial_numbers ? req.query.serial_numbers.split(',') : ['12345678'];
      options = req.query.options ? req.query.options.split(',') : [];
      lang = req.query.lang || req.query.language || 'en';
    } else {
      // JSON body payload
      const body = req.body || {};
      product = body.product;
      serial_numbers = body.serial_numbers;
      options = body.options;
      template_xml = body.template_xml || body.ezpx_xml || body.template_content || body.template;
      lang = body.lang || body.language || req.query.lang || req.query.language || 'en';
    }

    const normalizedLang = (typeof lang === 'string' && (lang.toLowerCase() === 'cn' || lang.toLowerCase().startsWith('zh'))) ? 'cn' : 'en';

    if (!product || typeof product !== 'string' || !product.trim()) {
      return res.status(400).json({ error: 'Missing required field: product' });
    }

    if (!serial_numbers || !Array.isArray(serial_numbers) || serial_numbers.length === 0) {
      return res.status(400).json({ error: 'Missing required field: serial_numbers must be a non-empty array' });
    }

    // Default format is JSON wrapping EZPL (Odoo / direct printing integration).
    // ZIP package is returned only if explicitly requested (format: 'zip').
    const isZipRequested =
      req.query.format === 'zip' ||
      req.query.type === 'zip' ||
      (typeof req.body === 'object' && req.body && (req.body.format === 'zip' || req.body.response_type === 'zip')) ||
      (req.headers.accept && req.headers.accept.includes('application/zip') && !req.headers.accept.includes('application/json'));

    if (!isZipRequested) {
      const ezplJson = await generateStEzplJson(product, serial_numbers, options || [], template_xml, normalizedLang);
      return res.status(200).json(ezplJson);
    }

    const { files, csvContent } = await generateStEzpxXml(product, serial_numbers, options || [], template_xml, normalizedLang);

    // Package the label .ezpx file(s) (main + one per sub-template), the shared
    // data.csv and the Windows helper .bat into one ZIP.
    const { START_BAT } = await import('../src/utils/stGoLabelBatch.js');
    const zip = new JSZip();
    for (const f of files) {
      zip.file(f.filename, f.xml);
    }
    zip.file('data.csv', csvContent);
    zip.file('0_start.bat', START_BAT);
    const pkgBuffer = await zip.generateAsync({ type: 'nodebuffer' });

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="label_all.zip"');
    return res.status(200).send(pkgBuffer);
  } catch (err) {
    console.error('Error handling /st_label:', err);
    const status = err.status || 500;
    return res.status(status).json({ error: err.message });
  }
}

/**
 * POST /st_label_delivery and POST /api/st_label_delivery
 * Generates delivery labels specifically using the special Delivery Template,
 * supporting multi-product payload structure with top-level origin.
 * Defaults to JSON wrapping EZPL streams.
 */
async function handleStLabelDelivery(req, res) {
  try {
    let origin, products, lang, template_xml;

    if (typeof req.body === 'string' && req.body.trim().startsWith('<')) {
      template_xml = req.body;
      origin = req.query.origin || req.query.order || '';
      lang = req.query.lang || req.query.language || 'en';
      products = [{
        categ: req.query.categ || req.query.device_name || '',
        product: req.query.product || 'Delivery',
        serial_numbers: req.query.serial_numbers ? req.query.serial_numbers.split(',') : ['12345678'],
        options_text: req.query.options || ''
      }];
    } else {
      const body = req.body || {};
      origin = body.origin || body.order || req.query.origin || '';
      lang = body.lang || body.language || req.query.lang || req.query.language || 'en';
      template_xml = body.template_xml || body.ezpx_xml || body.template_content || body.template;

      if (Array.isArray(body.products) && body.products.length > 0) {
        products = body.products;
      } else {
        // Fallback for single product payload
        products = [{
          categ: body.categ || body.category || body.device_name || body.deviceName || '',
          product: body.product || body.item_number || body.item_no || 'Delivery',
          serial_numbers: body.serial_numbers || body.serials || ['12345678'],
          options_text: body.options_text || body.optionsText || body.options || ''
        }];
      }
    }

    const normalizedLang = (typeof lang === 'string' && (lang.toLowerCase() === 'cn' || lang.toLowerCase().startsWith('zh'))) ? 'cn' : 'en';

    const ezplJson = await generateStDeliveryMultiProductEzplJson({
      origin,
      products,
      lang: normalizedLang,
      templateXml: template_xml
    });

    return res.status(200).json(ezplJson);
  } catch (err) {
    console.error('Error handling /st_label_delivery:', err);
    const status = err.status || 500;
    return res.status(status).json({ error: err.message });
  }
}

app.post('/st_label', handleStLabel);
app.post('/api/st_label', handleStLabel);
app.post('/st_label_delivery', handleStLabelDelivery);
app.post('/api/st_label_delivery', handleStLabelDelivery);

// Serve frontend build in production
const clientDist = path.join(__dirname, '..', 'dist');
app.use(express.static(clientDist));

app.get('*', (req, res, next) => {
  // If it looks like an API call, don't serve index.html
  if (req.path.startsWith('/api/') || req.path.startsWith('/st_label')) {
    return next();
  }
  const htmlPath = path.join(clientDist, 'index.html');
  if (fs.existsSync(htmlPath)) {
    res.sendFile(htmlPath);
  } else {
    res.status(404).send('Not Found. If developing, visit Vite server instead.');
  }
});

// Start the server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);
});

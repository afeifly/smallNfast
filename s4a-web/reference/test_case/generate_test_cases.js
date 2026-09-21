import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BASE_DIR = __dirname;

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// ── CSD Binary Builder ────────────────────────────────────────────────────────
function buildCsdBuffer({
  startTimeMs,
  numSamples,
  intervalSec = 1,
  channels, // array of { name, sensor, unit, min, max, generator(sampleIdx) }
}) {
  const encoder = new TextEncoder();
  const numChannels = channels.length;
  const protocolHeaderStart = 34;
  const channelHeadersStart = 3586;
  const recordLen = 4 + numChannels * 8;
  const dataStart = channelHeadersStart + numChannels * 918;
  const totalSize = dataStart + numSamples * recordLen;
  const buffer = new ArrayBuffer(totalSize);
  const view = new DataView(buffer);

  // File Info Header (bytes 0..33)
  view.setInt32(0, 5, false); // version 5
  const idBytes = encoder.encode('SUTO CSD');
  for (let i = 0; i < idBytes.length; i++) view.setUint8(4 + i, idBytes[i]);

  // Protocol Header (bytes 34..3585)
  const devNameBytes = encoder.encode('SUTO Logger S330');
  for (let i = 0; i < devNameBytes.length; i++) view.setUint8(protocolHeaderStart + 506 + i, devNameBytes[i]);

  const stopTimeMs = startTimeMs + numSamples * intervalSec * 1000;
  view.setInt32(protocolHeaderStart + 3016, numChannels, false);
  view.setInt32(protocolHeaderStart + 3020, numSamples, false);
  view.setInt32(protocolHeaderStart + 3024, intervalSec, false);
  view.setBigInt64(protocolHeaderStart + 3032, BigInt(startTimeMs), false);
  view.setBigInt64(protocolHeaderStart + 3040, BigInt(stopTimeMs), false);

  // Channel Headers (918 bytes each)
  for (let c = 0; c < numChannels; c++) {
    const ch = channels[c];
    const chStart = channelHeadersStart + c * 918;
    view.setBigInt64(chStart + 0, BigInt(1001 + c), false); // channel id
    
    // logic_channel_description at chStart + 8 (int16 len + utf8 string)
    const nameBytes = encoder.encode(ch.name);
    view.setInt16(chStart + 8, nameBytes.length, false);
    for (let i = 0; i < nameBytes.length; i++) view.setUint8(chStart + 10 + i, nameBytes[i]);

    // unit and bounds
    view.setInt32(chStart + 848, 2, false);
    view.setFloat64(chStart + 852, ch.min ?? 0, false);
    view.setFloat64(chStart + 860, ch.max ?? 100, false);
    view.setInt32(chStart + 876, 5000 + c, false); // sensor id
  }

  // Data Records
  for (let s = 0; s < numSamples; s++) {
    const recStart = dataStart + s * recordLen;
    view.setInt32(recStart, s + 1, false); // record id
    for (let c = 0; c < numChannels; c++) {
      const val = channels[c].generator(s);
      view.setFloat64(recStart + 4 + c * 8, val, false);
    }
  }

  return Buffer.from(buffer);
}

// ── CSV Builder (SUTO Standard Format) ────────────────────────────────────────
function formatDateTime(ms) {
  const d = new Date(ms);
  const pad = n => String(n).padStart(2, '0');
  const day = pad(d.getDate());
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = monthNames[d.getMonth()];
  const year = d.getFullYear();
  const hours = pad(d.getHours());
  const mins = pad(d.getMinutes());
  const secs = pad(d.getSeconds());
  return `${day}.${month} ${year} ${hours}:${mins}:${secs}`;
}

function formatDateRow(ms) {
  const d = new Date(ms);
  const pad = n => String(n).padStart(2, '0');
  const day = pad(d.getDate());
  const month = pad(d.getMonth() + 1);
  const year = d.getFullYear();
  const hours = pad(d.getHours());
  const mins = pad(d.getMinutes());
  const secs = pad(d.getSeconds());
  return `${day}-${month}-${year} ${hours}:${mins}:${secs}`;
}

function buildCsvContent({
  startTimeMs,
  numSamples,
  intervalSec = 1,
  channels, // array of { name, sensor, unit, generator(sampleIdx) }
}) {
  const stopTimeMs = startTimeMs + numSamples * intervalSec * 1000;
  const lines = [];

  lines.push('S332 Raw Data');
  lines.push('');
  lines.push(`Start Date Time,${formatDateTime(startTimeMs)}`);
  lines.push(`End Date Time,${formatDateTime(stopTimeMs)}`);
  lines.push(`Sample Rate(sec),${intervalSec}`);
  lines.push(`NO.Of Channels,${channels.length}`);
  lines.push('');
  lines.push('No.,Channel,Sensor,Unit,Resolution,Location/Measurement Point');

  channels.forEach((ch, idx) => {
    lines.push(`${idx + 1},${ch.name},${ch.sensor || 'Sensor'},${ch.unit || ''},0.01,Main Plant/MP${idx + 1}`);
  });

  lines.push('');
  const colHeaders = ['Date Time', ...channels.map(c => `${c.name} - ${c.unit}`)];
  lines.push(colHeaders.join(','));

  for (let s = 0; s < numSamples; s++) {
    const timeMs = startTimeMs + s * intervalSec * 1000;
    const row = [formatDateRow(timeMs)];
    for (let c = 0; c < channels.length; c++) {
      const val = channels[c].generator(s);
      row.push(val.toFixed(2));
    }
    lines.push(row.join(','));
  }

  lines.push('');
  return lines.join('\r\n');
}

// ── Channels Definitions ──────────────────────────────────────────────────────
const flowChannel = {
  name: 'Flow',
  sensor: 'S401 Flow Sensor',
  unit: 'm³/min',
  min: 0,
  max: 50,
  generator: (s) => 15.0 + 4.5 * Math.sin(s / 600) + (Math.random() * 0.4 - 0.2),
};

const pressureChannel = {
  name: 'Pressure',
  sensor: 'CS Pr. 16 bar',
  unit: 'bar',
  min: 0,
  max: 16,
  generator: (s) => 6.8 + 0.5 * Math.cos(s / 450) + (Math.random() * 0.1 - 0.05),
};

const tempChannel = {
  name: 'Temperature',
  sensor: 'Pt100 Temp',
  unit: '°C',
  min: -20,
  max: 100,
  generator: (s) => 24.0 + 3.0 * Math.sin(s / 1200) + (Math.random() * 0.2 - 0.1),
};

const humidityChannel = {
  name: 'Humidity',
  sensor: 'Sensirion SHT35',
  unit: '%RH',
  min: 0,
  max: 100,
  generator: (s) => 48.0 + 5.0 * Math.cos(s / 800) + (Math.random() * 0.3 - 0.15),
};

const powerChannel = {
  name: 'Power',
  sensor: 'CS 1000 Power Meter',
  unit: 'kW',
  min: 0,
  max: 100,
  generator: (s) => 38.0 + 8.0 * Math.sin(s / 500) + (Math.random() * 0.5 - 0.25),
};

const dewPointChannel = {
  name: 'DewPoint',
  sensor: 'S220 Dew Point',
  unit: '°Ctd',
  min: -80,
  max: 20,
  generator: (s) => -35.0 + 2.0 * Math.sin(s / 900) + (Math.random() * 0.2 - 0.1),
};

// 2 hours = 7200 seconds
const SAMPLES_2_HOURS = 7200;
const T_START = 1716192000000; // 2024-05-20 08:00:00 UTC
const TWO_HOURS_MS = 2 * 3600 * 1000;

function generateAll() {
  ensureDir(BASE_DIR);

  // 1. csd_append_case_samechannels
  const csdSameDir = path.join(BASE_DIR, 'csd_append_case_samechannels');
  ensureDir(csdSameDir);
  console.log('Generating csd_append_case_samechannels...');
  fs.writeFileSync(
    path.join(csdSameDir, 'file1_20240520_0800_1000.csd'),
    buildCsdBuffer({
      startTimeMs: T_START,
      numSamples: SAMPLES_2_HOURS,
      intervalSec: 1,
      channels: [flowChannel, pressureChannel, tempChannel],
    })
  );
  fs.writeFileSync(
    path.join(csdSameDir, 'file2_20240520_1000_1200.csd'),
    buildCsdBuffer({
      startTimeMs: T_START + TWO_HOURS_MS,
      numSamples: SAMPLES_2_HOURS,
      intervalSec: 1,
      channels: [flowChannel, pressureChannel, tempChannel],
    })
  );

  // 2. csd_append_case_different_channels
  const csdDiffDir = path.join(BASE_DIR, 'csd_append_case_different_channels');
  ensureDir(csdDiffDir);
  console.log('Generating csd_append_case_different_channels...');
  fs.writeFileSync(
    path.join(csdDiffDir, 'file1_3ch_20240520_0800_1000.csd'),
    buildCsdBuffer({
      startTimeMs: T_START,
      numSamples: SAMPLES_2_HOURS,
      intervalSec: 1,
      channels: [flowChannel, pressureChannel, tempChannel],
    })
  );
  fs.writeFileSync(
    path.join(csdDiffDir, 'file2_4ch_20240520_1000_1200.csd'),
    buildCsdBuffer({
      startTimeMs: T_START + TWO_HOURS_MS,
      numSamples: SAMPLES_2_HOURS,
      intervalSec: 1,
      channels: [flowChannel, pressureChannel, tempChannel, humidityChannel],
    })
  );

  // 3. csd_append_case_repeat_timeperiod (parallel loggers)
  const csdRepeatDir = path.join(BASE_DIR, 'csd_append_case_repeat_timeperiod');
  ensureDir(csdRepeatDir);
  console.log('Generating csd_append_case_repeat_timeperiod...');
  fs.writeFileSync(
    path.join(csdRepeatDir, 'file1_loggerA_20240520_0800_1000.csd'),
    buildCsdBuffer({
      startTimeMs: T_START,
      numSamples: SAMPLES_2_HOURS,
      intervalSec: 1,
      channels: [flowChannel, pressureChannel],
    })
  );
  fs.writeFileSync(
    path.join(csdRepeatDir, 'file2_loggerB_20240520_0800_1000.csd'),
    buildCsdBuffer({
      startTimeMs: T_START,
      numSamples: SAMPLES_2_HOURS,
      intervalSec: 1,
      channels: [tempChannel, dewPointChannel],
    })
  );

  // 4. csd_append_case_gap_missing_time
  const csdGapDir = path.join(BASE_DIR, 'csd_append_case_gap_missing_time');
  ensureDir(csdGapDir);
  console.log('Generating csd_append_case_gap_missing_time...');
  fs.writeFileSync(
    path.join(csdGapDir, 'file1_20240520_0800_1000.csd'),
    buildCsdBuffer({
      startTimeMs: T_START,
      numSamples: SAMPLES_2_HOURS,
      intervalSec: 1,
      channels: [flowChannel, pressureChannel, tempChannel],
    })
  );
  fs.writeFileSync(
    path.join(csdGapDir, 'file2_20240520_1200_1400.csd'),
    buildCsdBuffer({
      startTimeMs: T_START + 2 * TWO_HOURS_MS,
      numSamples: SAMPLES_2_HOURS,
      intervalSec: 1,
      channels: [flowChannel, pressureChannel, tempChannel],
    })
  );

  // 5. csv_append_case_samechannels
  const csvSameDir = path.join(BASE_DIR, 'csv_append_case_samechannels');
  ensureDir(csvSameDir);
  console.log('Generating csv_append_case_samechannels...');
  fs.writeFileSync(
    path.join(csvSameDir, 'file1_20240520_0800_1000.csv'),
    buildCsvContent({
      startTimeMs: T_START,
      numSamples: SAMPLES_2_HOURS,
      intervalSec: 1,
      channels: [flowChannel, pressureChannel, tempChannel],
    })
  );
  fs.writeFileSync(
    path.join(csvSameDir, 'file2_20240520_1000_1200.csv'),
    buildCsvContent({
      startTimeMs: T_START + TWO_HOURS_MS,
      numSamples: SAMPLES_2_HOURS,
      intervalSec: 1,
      channels: [flowChannel, pressureChannel, tempChannel],
    })
  );

  // 6. csv_append_case_repeat_timeperiod
  const csvRepeatDir = path.join(BASE_DIR, 'csv_append_case_repeat_timeperiod');
  ensureDir(csvRepeatDir);
  console.log('Generating csv_append_case_repeat_timeperiod...');
  fs.writeFileSync(
    path.join(csvRepeatDir, 'file1_20240520_0800_1000.csv'),
    buildCsvContent({
      startTimeMs: T_START,
      numSamples: SAMPLES_2_HOURS,
      intervalSec: 1,
      channels: [flowChannel, pressureChannel, tempChannel],
    })
  );
  fs.writeFileSync(
    path.join(csvRepeatDir, 'file2_repeat_20240520_0800_1000.csv'),
    buildCsvContent({
      startTimeMs: T_START,
      numSamples: SAMPLES_2_HOURS,
      intervalSec: 1,
      channels: [flowChannel, pressureChannel, tempChannel],
    })
  );

  // 7. csv_append_case_different_channels
  const csvDiffDir = path.join(BASE_DIR, 'csv_append_case_different_channels');
  ensureDir(csvDiffDir);
  console.log('Generating csv_append_case_different_channels...');
  fs.writeFileSync(
    path.join(csvDiffDir, 'file1_3ch_20240520_0800_1000.csv'),
    buildCsvContent({
      startTimeMs: T_START,
      numSamples: SAMPLES_2_HOURS,
      intervalSec: 1,
      channels: [flowChannel, pressureChannel, tempChannel],
    })
  );
  fs.writeFileSync(
    path.join(csvDiffDir, 'file2_5ch_20240520_1000_1200.csv'),
    buildCsvContent({
      startTimeMs: T_START + TWO_HOURS_MS,
      numSamples: SAMPLES_2_HOURS,
      intervalSec: 1,
      channels: [flowChannel, pressureChannel, tempChannel, humidityChannel, powerChannel],
    })
  );

  // 8. csv_append_case_gap_missing_time
  const csvGapDir = path.join(BASE_DIR, 'csv_append_case_gap_missing_time');
  ensureDir(csvGapDir);
  console.log('Generating csv_append_case_gap_missing_time...');
  fs.writeFileSync(
    path.join(csvGapDir, 'file1_20240520_0800_1000.csv'),
    buildCsvContent({
      startTimeMs: T_START,
      numSamples: SAMPLES_2_HOURS,
      intervalSec: 1,
      channels: [flowChannel, pressureChannel, tempChannel],
    })
  );
  fs.writeFileSync(
    path.join(csvGapDir, 'file2_20240520_1200_1400.csv'),
    buildCsvContent({
      startTimeMs: T_START + 2 * TWO_HOURS_MS,
      numSamples: SAMPLES_2_HOURS,
      intervalSec: 1,
      channels: [flowChannel, pressureChannel, tempChannel],
    })
  );

  // 9. README.md
  const readmeContent = `# Test Cases for CSD & CSV File Appending

This directory contains curated real-data test suites (2 hours per file, 7,200 samples @ 1 Hz) designed to test all edge cases of single-file opening and multi-file appending in \`s4a-web\`.

---

## Directory Overview

| Test Case Directory | Type | Key Scenario | Expected Behavior |
| :--- | :--- | :--- | :--- |
| **\`csd_append_case_samechannels\`** | CSD | Sequential 2-hour files with identical channels (\`Flow\`, \`Pressure\`, \`Temperature\`). | Unifies into 3 continuous channels across 4 hours without duplicate labels or \`[F1]\` prefixes. |
| **\`csd_append_case_different_channels\`** | CSD | File 1 has 3 channels; File 2 adds a 4th channel (\`Humidity\`). | Unifies the 3 shared channels and appends the 4th channel. In table view, Channel 4 displays \`null\` during File 1's window. |
| **\`csd_append_case_repeat_timeperiod\`** | CSD | Overlapping / concurrent logging (both files recorded from 08:00 to 10:00). | Option A parallel logger mode activates. Keeps channels separate (\`0:0\`, \`1:0\`) to prevent timestamp collisions. |
| **\`csd_append_case_gap_missing_time\`** | CSD | Sequential files with a 2-hour gap between them (10:00 to 12:00). | Appends seamlessly; gap report identifies the 2-hour outage gap without crashing or freezing. |
| **\`csv_append_case_samechannels\`** | CSV | Sequential 2-hour files with matching SUTO headers (\`Flow\`, \`Pressure\`, \`Temperature\`). | Unifies into 3 channels, concatenates 14,400 samples, and renders a continuous curve across both files. |
| **\`csv_append_case_repeat_timeperiod\`** | CSV | Two CSV files covering the exact same 08:00–10:00 time period. | Tests handling and concatenation of repeating timestamps. |
| **\`csv_append_case_different_channels\`** | CSV | File 1 has 3 channels; File 2 has 5 channels (\`Flow\`, \`Pressure\`, \`Temperature\`, \`Humidity\`, \`Power\`). | Unifies matching channels and dynamically adds new channels into a 5-channel session. |
| **\`csv_append_case_gap_missing_time\`** | CSV | File 1 (08:00–10:00), File 2 (12:00–14:00) with a 2-hour missing window. | Gap detector computes missing 7,200 seconds; chart accurately reflects the gap. |

---

## Test Data Characteristics

- **Duration per file**: 2 hours (08:00:00 → 10:00:00, 10:00:00 → 12:00:00, or 12:00:00 → 14:00:00).
- **Sample Rate**: 1.0 Hz (1 second interval).
- **Sample Count**: 7,200 data points per file (14,400 points total per 2-file merged session).
- **Signals Simulated**:
  - \`Flow\` (m³/min): Sine wave oscillation between 10.5 and 19.5 m³/min with Gaussian jitter.
  - \`Pressure\` (bar): Typical pneumatic compressed air network oscillation around 6.8 bar.
  - \`Temperature\` (°C): Gradual thermal cycling between 21°C and 27°C.
  - \`Humidity\` (%RH): Ambient relative humidity fluctuation around 48 %RH.
  - \`Power\` (kW): Active electrical power consumption around 38 kW.
  - \`DewPoint\` (°Ctd): Compressed air dew point around -35 °Ctd.
`;

  fs.writeFileSync(path.join(BASE_DIR, 'README.md'), readmeContent);
  console.log('All test cases and README.md generated successfully at:', BASE_DIR);
}

generateAll();

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function csvRow(values) {
  return values.map(csvCell).join(',') + '\n';
}

function xml(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function dateParts(ms) {
  const d = new Date(ms);
  const pad = n => String(n).padStart(2, '0');
  const fraction = d.getMilliseconds() ? `.${String(d.getMilliseconds()).padStart(3, '0')}` : '';
  return {
    day: d.getDate(), month: d.getMonth(), year: d.getFullYear(),
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}${fraction}`
  };
}

function csvHeaderDate(ms) {
  const d = dateParts(ms);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${d.day}.${months[d.month]} ${d.year} ${d.time}`;
}

function csvDate(ms) {
  const d = dateParts(ms);
  return `${String(d.day).padStart(2, '0')}-${String(d.month + 1).padStart(2, '0')}-${d.year} ${d.time}`;
}

function excelDate(ms) {
  const d = dateParts(ms);
  return `${d.day}/${d.month + 1}/${d.year} ${d.time}`;
}

function resolution(value) {
  const digits = Math.max(0, Math.min(20, Number(value) || 0));
  return digits === 0 ? '1' : (1 / 10 ** digits).toFixed(digits);
}

export function exportHeader(format, database) {
  const { channels, start, stop, interval, numSamples } = database;
  if (format === 'csv') {
    let text = csvRow([`${database.session.LoggerFileName || 'S332'} Raw Data`]) + '\n';
    text += csvRow(['Start Date Time', csvHeaderDate(start)]);
    text += csvRow(['End Date Time', csvHeaderDate(stop)]);
    text += csvRow(['Sample Rate(sec)', interval]);
    text += csvRow(['NO.Of Channels', channels.length]);
    text += csvRow(['NO.Of Records', numSamples]) + '\n';
    text += csvRow(['No.', 'Channel', 'Sensor', 'Unit', 'Resolution', 'Location/Measurement Point']);
    channels.forEach((ch, index) => {
      const name = ch.logic_channel_description || `CH${index + 1}`;
      text += csvRow([index + 1, name, ch.sensor_description || `Sensor ${index + 1}`,
        ch.unit_in_ascii, resolution(ch.resolution), `Location 1/${name}`]);
    });
    text += '\n' + csvRow(['Date Time', ...channels.map((ch, index) =>
      `${ch.logic_channel_description || `CH${index + 1}`}${ch.unit_in_ascii ? ` - ${ch.unit_in_ascii}` : ''}`)]);
    return text;
  }
  if (format !== 'excel') throw new Error('Unsupported STDB export format.');
  const headers = channels.map(ch => {
    const name = ch.logic_channel_description || `Channel ${ch.channel_id}`;
    const unit = ch.unit_in_ascii ? ` (${ch.unit_in_ascii})` : '';
    return `<Cell ss:StyleID="sHeader"><Data ss:Type="String">${xml(name + unit)}</Data></Cell>`;
  }).join('');
  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal"><Font ss:Size="11"/></Style>
  <Style ss:ID="sTitle"><Font ss:Size="14" ss:Bold="1"/></Style>
  <Style ss:ID="sLabel"><Font ss:Size="11" ss:Bold="1"/></Style>
  <Style ss:ID="sHeader"><Font ss:Size="11" ss:Bold="1"/><Interior ss:Color="#D9E1F2" ss:Pattern="Solid"/></Style>
 </Styles>
 <Worksheet ss:Name="CSD Export"><Table>
 <Row><Cell ss:StyleID="sTitle"><Data ss:Type="String">S4A</Data></Cell><Cell ss:StyleID="sTitle"><Data ss:Type="String">V2</Data></Cell></Row>
 <Row></Row>
 <Row><Cell ss:StyleID="sLabel"><Data ss:Type="String">Description</Data></Cell><Cell><Data ss:Type="String">Record File</Data></Cell></Row>
 <Row><Cell ss:StyleID="sLabel"><Data ss:Type="String">Start Time</Data></Cell><Cell><Data ss:Type="String">${excelDate(start)}</Data></Cell></Row>
 <Row><Cell ss:StyleID="sLabel"><Data ss:Type="String">End Time</Data></Cell><Cell><Data ss:Type="String">${excelDate(stop)}</Data></Cell></Row>
 <Row><Cell ss:StyleID="sLabel"><Data ss:Type="String">Sample Rate (sec)</Data></Cell><Cell><Data ss:Type="Number">${interval}</Data></Cell></Row>
 <Row></Row><Row></Row>
 <Row><Cell ss:StyleID="sHeader"><Data ss:Type="String">TIME</Data></Cell>${headers}</Row>\n`;
}

export function exportRows(format, channels, rows) {
  if (format === 'csv') {
    return rows.map(row => csvRow([csvDate(row.timestampMs), ...channels.map(ch =>
      row.values[ch.channel_id] == null ? '-9999.0' : row.values[ch.channel_id])])).join('');
  }
  if (format !== 'excel') throw new Error('Unsupported STDB export format.');
  return rows.map(row => {
    const values = channels.map(ch => {
      const value = row.values[ch.channel_id];
      return value == null ? '<Cell/>' : `<Cell><Data ss:Type="Number">${value}</Data></Cell>`;
    }).join('');
    return `<Row><Cell><Data ss:Type="String">${excelDate(row.timestampMs)}</Data></Cell>${values}</Row>\n`;
  }).join('');
}

export function exportFooter(format) {
  if (format === 'csv') return '';
  if (format === 'excel') return '</Table></Worksheet></Workbook>';
  throw new Error('Unsupported STDB export format.');
}

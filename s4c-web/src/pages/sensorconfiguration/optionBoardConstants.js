export const TERMINAL_TYPES = [
  { value: 0, label: 'N/A' },
  { value: 4, label: 'X9' },
  { value: 3, label: 'X10' },
  { value: 2, label: 'X11' },
  { value: 1, label: 'X12' },
  { value: 8, label: 'X13' },
  { value: 7, label: 'X14' },
  { value: 6, label: 'X15' },
  { value: 5, label: 'X16' },
];

export const OPTION_BOARD_TYPES = [
  { value: 0, label: 'Analog' },
  { value: 1, label: 'Digital' },
];

export const ANALOG_SIGNAL_TYPES = [
  { value: 0, label: '0...20mA' },
  { value: 1, label: '4...20mA' },
  { value: 2, label: '0.5...4.5V' },
  { value: 3, label: '0...10V' },
];

export const DIGITAL_SIGNAL_TYPES = [
  { value: 0, label: 'Counter' },
  { value: 1, label: 'Runtime' },
  { value: 2, label: 'Status' },
];

export const UINT_TYPES = [
  { value: 0, label: 'Custom' },
  { value: 1, label: 'Dew point' },
  { value: 2, label: 'Humidity' },
  { value: 3, label: 'Temperature' },
  { value: 4, label: 'Pressure' },
  { value: 5, label: 'Velocity' },
  { value: 6, label: 'Concentration' },
  { value: 7, label: 'Flow' },
  { value: 8, label: 'Volume' },
  { value: 9, label: 'Mass' },
  { value: 10, label: 'Voltage' },
  { value: 11, label: 'Power' },
  { value: 12, label: 'Energy' },
];

export const RESOLUTION_OPTIONS = [
  { id: -3, name: '1000' },
  { id: -1, name: '10' },
  { id: 0, name: '1' },
  { id: 1, name: '0.1' },
  { id: 2, name: '0.01' },
  { id: 3, name: '0.001' },
  { id: 4, name: '0.0001' },
  { id: 5, name: '0.00001' },
  { id: 6, name: '0.000001' },
];

export const UNIT_OPTIONS_MAPPED = {
  0: [],
  1: [
    { unit: '°C Td', resolution: 1 },
    { unit: '°F Td', resolution: 1 },
    { unit: '°C Td atm.', resolution: 1 },
    { unit: '°F Td atm.', resolution: 1 },
  ],
  2: [
    { unit: '% RH', resolution: 3 },
    { unit: 'g/m³', resolution: 2 },
    { unit: 'mg/m³', resolution: 1 },
    { unit: 'g/m³ atm.', resolution: 2 },
    { unit: 'mg/m³ atm.', resolution: 1 },
    { unit: 'ppm(v)', resolution: 2 },
    { unit: 'g/kg', resolution: 3 },
  ],
  3: [
    { unit: '°C', resolution: 1 },
    { unit: '°F', resolution: 1 },
  ],
  4: [
    { unit: 'bar(g)', resolution: 2 },
    { unit: 'mbar(g)', resolution: -1 },
    { unit: 'psi(g)', resolution: 1 },
    { unit: 'Pa(g)', resolution: -3 },
    { unit: 'hPa(g)', resolution: -1 },
    { unit: 'kPa(g)', resolution: 0 },
    { unit: 'MPa(g)', resolution: 3 },
    { unit: 'bar(abs)', resolution: 2 },
    { unit: 'mbar(abs)', resolution: -1 },
    { unit: 'psi(abs)', resolution: 1 },
    { unit: 'Pa(abs)', resolution: -3 },
    { unit: 'hPa(abs)', resolution: -1 },
    { unit: 'kPa(abs)', resolution: 0 },
    { unit: 'MPa(abs)', resolution: 3 },
  ],
  5: [
    { unit: 'm/s', resolution: 1 },
    { unit: 'ft/min', resolution: 0 },
    { unit: 'sm/s', resolution: 1 },
    { unit: 'sft/min', resolution: 0 },
    { unit: 'Nm/s', resolution: 1 },
    { unit: 'Nft/min', resolution: 0 },
  ],
  6: [
    { unit: 'ppm(v)', resolution: 2 },
    { unit: 'mg/m³', resolution: 3 },
    { unit: 'cn/m³', resolution: 0 },
  ],
  7: [
    { unit: 'm³/h', resolution: 1 },
    { unit: 'm³/min', resolution: 1 },
    { unit: 'l/min', resolution: 1 },
    { unit: 'l/s', resolution: 1 },
    { unit: 'cfm', resolution: 1 },
    { unit: 'cfh', resolution: 1 },
    { unit: 'Nm³/h', resolution: 1 },
    { unit: 'Nm³/min', resolution: 1 },
    { unit: 'Nl/min', resolution: 1 },
    { unit: 'Nl/s', resolution: 1 },
    { unit: 'Ncfm', resolution: 1 },
    { unit: 'Ncfh', resolution: 1 },
    { unit: 'kg/h', resolution: 1 },
    { unit: 'kg/min', resolution: 2 },
    { unit: 'kg/s', resolution: 0 },
    { unit: 't/h', resolution: 0 },
    { unit: 'lb/h', resolution: 1 },
  ],
  8: [
    { unit: 'm³', resolution: 0 },
    { unit: 'l', resolution: 0 },
    { unit: 'cf', resolution: 0 },
    { unit: 'Nm³', resolution: 0 },
    { unit: 'Nl', resolution: 0 },
    { unit: 'Ncf', resolution: 0 },
    { unit: 'gal', resolution: 0 },
  ],
  9: [
    { unit: 'kg', resolution: 0 },
    { unit: 't', resolution: 0 },
    { unit: 'lb', resolution: 0 },
  ],
  10: [
    { unit: 'V', resolution: 1 },
    { unit: 'kV', resolution: 3 },
  ],
  11: [
    { unit: 'W', resolution: 0 },
    { unit: 'kW', resolution: 3 },
    { unit: 'VA', resolution: 0 },
    { unit: 'kVA', resolution: 3 },
    { unit: 'kVAr', resolution: 3 },
  ],
  12: [
    { unit: 'Wh', resolution: 0 },
    { unit: 'kWh', resolution: 3 },
    { unit: 'Vah', resolution: 0 },
    { unit: 'kVAh', resolution: 3 },
    { unit: 'kVArh', resolution: 3 },
  ],
};

export const getTerminalLabel = (val) => {
  const found = TERMINAL_TYPES.find(t => t.value === val);
  return found ? found.label : '---';
};

export const getOptionBoardAddress = (term) => {
  if (term >= 1 && term <= 4) {
    return 2;
  }
  if (term >= 5 && term <= 8) {
    return 3;
  }
  return 1;
};

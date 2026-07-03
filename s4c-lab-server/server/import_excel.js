const { PrismaClient } = require('@prisma/client');
const XLSX = require('../client/node_modules/xlsx');
const path = require('path');

const prisma = new PrismaClient();
const excelPath = path.resolve(__dirname, 'calibration-export-2026-07-03 (1).xlsx');

console.log('Loading Excel data from:', excelPath);

function generatePasscode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function main() {
  const workbook = XLSX.readFile(excelPath);
  console.log('Sheets found:', workbook.SheetNames);

  for (const sheetName of workbook.SheetNames) {
    // Sheet name format: "username (company)"
    const match = sheetName.match(/^([^(]+)\s*\(([^)]+)\)$/);
    if (!match) {
      console.log(`Skipping sheet with invalid format name: ${sheetName}`);
      continue;
    }

    const username = match[1].trim();
    const companyName = match[2].trim();

    console.log(`\nProcessing user: ${username} (${companyName})`);

    // 1. Find or create CompanyUser
    let companyUser = await prisma.companyUser.findUnique({
      where: { username }
    });

    if (!companyUser) {
      const passcode = generatePasscode();
      const serviceTime = new Date();
      serviceTime.setFullYear(serviceTime.getFullYear() + 1); // 1 year from now

      companyUser = await prisma.companyUser.create({
        data: {
          username,
          companyName,
          email: `${username}@suto.com`,
          passcode,
          serviceTime,
          status: 1
        }
      });
      console.log(`Created new CompanyUser: ${username} with passcode ${passcode}`);
    } else {
      console.log(`Found existing CompanyUser: ${username} (ID: ${companyUser.id})`);
    }

    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);

    let currentSensor = null;
    let currentRecord = null;
    let points = [];

    const saveRecord = async (sensor, record, recordPoints) => {
      if (!sensor || !record) return;

      const recordJsonPoints = JSON.stringify(recordPoints);

      // Check if record already exists to avoid duplicates
      const existing = await prisma.calibrationRecord.findFirst({
        where: {
          sensorId: sensor.id,
          calibrationDate: record.calibrationDate
        }
      });

      if (!existing) {
        await prisma.calibrationRecord.create({
          data: {
            calibrationDate: record.calibrationDate,
            calibrationLocation: record.calibrationLocation,
            operationName: record.operationName,
            currentSettings: record.currentSettings,
            calibrationPoints: recordJsonPoints,
            sensorId: sensor.id
          }
        });
        console.log(`  Added calibration record for ${record.calibrationDate.toLocaleString()} on Sensor ${sensor.serialNumber} (${recordPoints.length} points)`);
      } else {
        console.log(`  Record already exists for ${record.calibrationDate.toLocaleString()} on Sensor ${sensor.serialNumber}`);
      }
    };

    for (const row of data) {
      // A row starts a new sensor if 'Serial Number' is present
      if (row['Serial Number']) {
        // Save pending record of the previous sensor
        if (currentRecord) {
          await saveRecord(currentSensor, currentRecord, points);
          currentRecord = null;
          points = [];
        }

        const serialNumber = String(row['Serial Number']).trim();
        const sensorType = String(row['Sensor Type'] || '').trim();
        const hwVersion = String(row['HW Version'] || '').trim();
        const swVersion = String(row['SW Version'] || '').trim();

        // Find or create Sensor
        currentSensor = await prisma.sensor.findUnique({
          where: { serialNumber }
        });

        if (!currentSensor) {
          currentSensor = await prisma.sensor.create({
            data: {
              serialNumber,
              sensorType,
              hwVersion,
              swVersion,
              companyUserId: companyUser.id
            }
          });
          console.log(`  Created new Sensor: ${serialNumber} (${sensorType})`);
        } else {
          // If sensor exists but is assigned to a different user, log it
          if (currentSensor.companyUserId !== companyUser.id) {
            console.log(`  [Warning] Sensor ${serialNumber} is currently assigned to user ID ${currentSensor.companyUserId}, moving to user ${companyUser.username}`);
            currentSensor = await prisma.sensor.update({
              where: { id: currentSensor.id },
              data: { companyUserId: companyUser.id }
            });
          }
        }
      }

      // A row starts a new record if 'Calibration Date' is present
      if (row['Calibration Date']) {
        // Save the previous record of the same sensor
        if (currentRecord) {
          await saveRecord(currentSensor, currentRecord, points);
          points = [];
        }

        const dateStr = row['Calibration Date'];
        const calDate = new Date(dateStr);

        // Reconstruct currentSettings JSON structure
        const currentSettings = {
          unit: {
            flowUnit: row['Flow Unit'] || '',
            flowResolutionDecimalPlaces: 2
          },
          flow: {
            pipeDiameter_mm: row['Pipe Diameter (mm)'] !== undefined && row['Pipe Diameter (mm)'] !== '' ? Number(row['Pipe Diameter (mm)']) : null,
            gasType: row['Gas Type'] || '',
            insertionDepth: row['Insertion Depth'] || '',
            cutoffThreshold: row['Cutoff Threshold'] || ''
          },
          reference: {
            temperature_C: row['Ref. Temp (°C)'] !== undefined && row['Ref. Temp (°C)'] !== '' ? Number(row['Ref. Temp (°C)']) : null,
            pressure_hPa: row['Ref. Pressure (hPa)'] !== undefined && row['Ref. Pressure (hPa)'] !== '' ? Number(row['Ref. Pressure (hPa)']) : null
          },
          advanced: {
            filterGrade: row['Filter Grade'] !== undefined && row['Filter Grade'] !== '' ? Number(row['Filter Grade']) : null,
            slope: row['Slope'] !== undefined && row['Slope'] !== '' ? Number(row['Slope']) : null
          }
        };

        currentRecord = {
          calibrationDate: calDate,
          calibrationLocation: row['Location'] || '',
          operationName: row['Operation'] || '',
          currentSettings: JSON.stringify(currentSettings)
        };
      }

      // If 'Point #' is present, collect the calibration point data
      if (row['Point #'] !== undefined && row['Point #'] !== '') {
        points.push({
          point: Number(row['Point #']) - 1,
          actual: row['Actual Flow'] !== undefined && row['Actual Flow'] !== '' ? Number(row['Actual Flow']) : null,
          standard: row['Reference Flow'] !== undefined && row['Reference Flow'] !== '' ? Number(row['Reference Flow']) : null
        });
      }
    }

    // Save the final record of the sheet
    if (currentRecord) {
      await saveRecord(currentSensor, currentRecord, points);
    }
  }

  console.log('\nImport process completed successfully.');
}

main()
  .catch((e) => {
    console.error('Error during import:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

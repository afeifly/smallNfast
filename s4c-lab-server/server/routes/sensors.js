const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const authenticateToken = require('../middleware/auth');


// Verify user and bind/check device ID (for Mobile App)
router.post('/verify', async (req, res) => {
    const { passcode, deviceId } = req.body;

    try {
        const user = await prisma.companyUser.findUnique({ where: { passcode } });

        if (!user) {
            return res.status(404).json({ error: 'Invalid passcode' });
        }

        // Check if user is blocked
        if (user.status === 2) {
            return res.status(403).json({ error: 'This user account has been blocked' });
        }

        // Check service time
        if (new Date() > user.serviceTime) {
            return res.status(403).json({ error: 'Service time expired' });
        }

        // Device binding logic
        if (!user.deviceId) {
            // First login - bind device
            const updatedUser = await prisma.companyUser.update({
                where: { id: user.id },
                data: { deviceId }
            });
            return res.json({ message: 'Device bound successfully', user: updatedUser });
        } else if (user.deviceId !== deviceId) {
            return res.status(403).json({ error: 'This passcode is bound to another device' });
        }

        res.json({ message: 'Verification successful', user });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update/Create sensor data (from Mobile App)
router.post('/upload', async (req, res) => {
    const { passcode, deviceId, operationName, operationAddress, sensorData } = req.body;

    try {
        const user = await prisma.companyUser.findUnique({ where: { passcode } });
        if (!user || user.deviceId !== deviceId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const {
            serialNumber,
            sensorType,
            hwVersion,
            swVersion,
            calibrationDate,
            calibrationLocation,
            currentSettings, // JSON
            calibrationPoints  // JSON
        } = sensorData;

        // Upsert sensor record
        const sensor = await prisma.sensor.upsert({
            where: { serialNumber },
            update: {
                sensorType,
                hwVersion,
                swVersion,
                companyUserId: user.id
            },
            create: {
                serialNumber,
                sensorType,
                hwVersion,
                swVersion,
                companyUserId: user.id
            }
        });

        // Create a new calibration record with operation metadata
        const record = await prisma.calibrationRecord.create({
            data: {
                calibrationDate: new Date(calibrationDate),
                calibrationLocation,
                operationName: operationName || sensorData.operationName || null,
                operationAddress: operationAddress || sensorData.operationAddress || null,
                currentSettings: JSON.stringify(currentSettings),
                calibrationPoints: JSON.stringify(calibrationPoints),
                sensorId: sensor.id
            }
        });

        res.json({ message: 'Sensor data and calibration record uploaded', sensor, record });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});


// Get sensors for a company (Admin view)
router.get('/company/:userId', authenticateToken, async (req, res) => {
    const { userId } = req.params;
    try {
        const sensors = await prisma.sensor.findMany({
            where: { companyUserId: userId },
            include: {
                calibrationRecords: {
                    orderBy: { calibrationDate: 'desc' }
                }
            },
            orderBy: { updatedAt: 'desc' }
        });

        // Parse JSON strings back to objects
        const parsedSensors = sensors.map(s => ({
            ...s,
            calibrationRecords: s.calibrationRecords.map(r => ({
                ...r,
                currentSettings: JSON.parse(r.currentSettings),
                calibrationPoints: JSON.parse(r.calibrationPoints)
            }))
        }));
        res.json(parsedSensors);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete a sensor (and all its records due to Cascade)
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        await prisma.sensor.delete({
            where: { id: req.params.id }
        });
        res.json({ message: 'Sensor and all its calibration records deleted' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete a specific calibration record
router.delete('/calibration/:id', authenticateToken, async (req, res) => {
    try {
        await prisma.calibrationRecord.delete({
            where: { id: req.params.id }
        });
        res.json({ message: 'Calibration record deleted' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});


module.exports = router;

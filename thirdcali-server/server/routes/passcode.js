const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Mobile APP Passcode Verification & Binding
router.post('/verify', async (req, res) => {
    // Note: handling both snake_case (requested) and camelCase (schema) for flexibility
    const { passcode, device_id, platform, app } = req.body;
    const incomingDeviceId = device_id || req.body.deviceId;

    if (!passcode) {
        return res.status(400).json({ error: 'Passcode is required' });
    }

    try {
        const user = await prisma.companyUser.findUnique({
            where: { passcode },
            include: { _count: { select: { sensors: true } } }
        });

        if (!user) {
            return res.status(404).json({ error: 'Invalid passcode' });
        }

        // 1. Check if user is blocked (status 2)
        if (user.status === 2) {
            return res.status(403).json({ error: 'Account is blocked. Please contact support.' });
        }

        // 2. Check service time expiry
        const now = new Date();
        if (now > user.serviceTime) {
            return res.status(403).json({ error: 'Service term has expired' });
        }

        // 3. Device ID Logic
        if (!user.deviceId) {
            // No device bound yet - bind this one
            if (!incomingDeviceId) {
                return res.status(400).json({ error: 'Device ID is required for initial binding' });
            }

            const updatedUser = await prisma.companyUser.update({
                where: { id: user.id },
                data: { deviceId: incomingDeviceId }
            });

            return res.json({
                message: 'Passcode successfully bound and verified',
                username: updatedUser.username,
                company: updatedUser.companyName,
                serviceTime: updatedUser.serviceTime,
                deviceId: updatedUser.deviceId
            });
        }

        // 4. Check matching device ID
        if (user.deviceId !== incomingDeviceId) {
            return res.status(401).json({
                error: 'Passcode is already bound to another device'
            });
        }

        // success
        res.json({
            message: 'Verification successful',
            username: user.username,
            company: user.companyName,
            serviceTime: user.serviceTime,
            deviceId: user.deviceId
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;

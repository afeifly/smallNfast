const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { generatePasscode } = require('../utils/passcode');

const prisma = new PrismaClient();

// Get all company users
router.get('/', async (req, res) => {
    try {
        const users = await prisma.companyUser.findMany({
            include: { _count: { select: { sensors: true } } },
            orderBy: { createdAt: 'desc' }
        });
        res.json(users);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Create company user
router.post('/', async (req, res) => {
    const { username, email, companyName, note, serviceOption } = req.body;

    try {
        let passcode;
        let isUnique = false;

        // Ensure passcode is unique
        while (!isUnique) {
            passcode = generatePasscode();
            const existing = await prisma.companyUser.findUnique({ where: { passcode } });
            if (!existing) isUnique = true;
        }

        let expiry = new Date();
        if (serviceOption === '1m') {
            expiry.setMonth(expiry.getMonth() + 1);
        } else if (serviceOption === '3y') {
            expiry.setFullYear(expiry.getFullYear() + 3);
        } else {
            // Default to 1 year
            expiry.setFullYear(expiry.getFullYear() + 1);
        }

        const newUser = await prisma.companyUser.create({
            data: {
                username,
                email,
                companyName,
                note,
                serviceTime: expiry,
                passcode,
                status: 1
            }
        });
        res.status(201).json(newUser);
    } catch (error) {
        if (error.code === 'P2002') {
            return res.status(400).json({ error: 'Username, Email or Passcode already exists' });
        }
        res.status(500).json({ error: error.message });
    }
});

// Update user status
router.patch('/:id/status', async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    try {
        const updatedUser = await prisma.companyUser.update({
            where: { id },
            data: { status: parseInt(status) }
        });
        res.json(updatedUser);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update company user (e.g. modify service time)
router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const { username, email, companyName, note, serviceTime, status } = req.body;

    try {
        const updatedUser = await prisma.companyUser.update({
            where: { id },
            data: {
                username,
                email,
                companyName,
                note,
                serviceTime: serviceTime ? new Date(serviceTime) : undefined,
                status: status !== undefined ? parseInt(status) : undefined
            }
        });
        res.json(updatedUser);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete company user
router.delete('/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await prisma.companyUser.delete({ where: { id } });
        res.status(204).send();
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;

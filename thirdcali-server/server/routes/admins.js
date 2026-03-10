const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const authenticateToken = require('../middleware/auth');

const prisma = new PrismaClient();

// All routes here require authentication
router.use(authenticateToken);

// List all admins
router.get('/', async (req, res) => {
    try {
        const admins = await prisma.admin.findMany({
            select: {
                id: true,
                username: true
            }
        });
        res.json(admins);
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Create new admin
router.post('/', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
    }

    try {
        const existingAdmin = await prisma.admin.findUnique({ where: { username } });
        if (existingAdmin) {
            return res.status(400).json({ error: 'Username already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const admin = await prisma.admin.create({
            data: {
                username,
                password: hashedPassword
            },
            select: {
                id: true,
                username: true
            }
        });
        res.status(201).json(admin);
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update current admin's password
router.put('/me/password', async (req, res) => {
    const { oldPassword, password } = req.body;
    const id = req.user.id;

    if (!oldPassword || !password) {
        return res.status(400).json({ error: 'Both old and new passwords are required' });
    }

    try {
        const admin = await prisma.admin.findUnique({ where: { id } });
        if (!admin) {
            return res.status(404).json({ error: 'Admin not found' });
        }

        const validPassword = await bcrypt.compare(oldPassword, admin.password);
        if (!validPassword) {
            return res.status(400).json({ error: 'Invalid current password' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        await prisma.admin.update({
            where: { id },
            data: { password: hashedPassword }
        });
        res.json({ message: 'Password updated successfully' });
    } catch (error) {
        console.error('Password change error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Delete admin
router.delete('/:id', async (req, res) => {
    const { id } = req.params;

    try {

        const adminToDelete = await prisma.admin.findUnique({ where: { id } });
        if (!adminToDelete) {
            return res.status(404).json({ error: 'Admin not found' });
        }

        if (adminToDelete.username === 'admin') {
            return res.status(400).json({ error: 'The default administrator "admin" cannot be deleted' });
        }

        // Prevent deleting the last admin
        const adminCount = await prisma.admin.count();
        if (adminCount <= 1) {
            return res.status(400).json({ error: 'Cannot delete the only admin' });
        }

        await prisma.admin.delete({ where: { id } });
        res.json({ message: 'Admin deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;

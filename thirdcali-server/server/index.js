const path = require('path');
const fs = require('fs');
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const app = express();
const PORT = process.env.PORT || 3001;

app.use(helmet());
app.use(cors());
app.use(express.json());

// Auth Middleware
const authenticateToken = require('./middleware/auth');

// Routes
const authRoutes = require('./routes/auth');
const companyUserRoutes = require('./routes/companyUsers');
const sensorRoutes = require('./routes/sensors');
const passcodeRoutes = require('./routes/passcode');
const adminRoutes = require('./routes/admins');

app.use('/api/auth', authRoutes);
app.use('/api/company-users', authenticateToken, companyUserRoutes);
app.use('/api/sensors', sensorRoutes);
app.use('/api/passcode', passcodeRoutes);
app.use('/api/admins', adminRoutes);

// Serve Frontend in Production
// (Ensure we run after all API routes)
const frontendPath = path.join(__dirname, '../client/dist');

// If the frontend build folder exists, serve it
if (fs.existsSync(frontendPath)) {
    console.log('Production frontend detected at:', frontendPath);
    app.use(express.static(frontendPath));

    // Handle all other routes for SPA (e.g., page refreshes)
    app.get('*', (req, res) => {
        // Don't accidentally serve index.html for non-existent API routes
        if (req.path.startsWith('/api/')) {
            return res.status(404).json({ error: 'API route not found' });
        }
        res.sendFile(path.join(frontendPath, 'index.html'));
    });
}

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

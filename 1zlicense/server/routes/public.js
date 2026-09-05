const express = require('express');
const router = express.Router();
const path = require('path');
const constants = require('../config/constants');

// Base routes
router.get('/', (req, res) => {
    res.sendFile(path.join(constants.BUILD_PATH, 'index.html'));
});

router.get('/offline', (req, res) => {
    res.sendFile(path.join(constants.BUILD_PATH, 'index.html'));
});

router.post('/software', (req, res) => {
    // Logic from server.js (empty handler)
});

router.post('/time', (req, res) => {
    res.status(200).send(new Date().getTime().toString());
});

module.exports = router;

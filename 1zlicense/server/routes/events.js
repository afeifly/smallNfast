const express = require('express');
const router = express.Router();
const pool = require('../db');

router.get('/api/events', (req, res) => {
    pool.getConnection((err, connection) => {
        if (err) return res.status(202).json({ err });
        connection.query('select * from events ORDER BY createdatetime DESC limit 200', (error, rows) => {
            if (error) {
                res.status(202).json({ err: error });
            } else {
                res.status(200).json(rows);
            }
            connection.release();
        });
    });
});

module.exports = router;

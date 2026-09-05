const express = require('express');
const router = express.Router();
const utils = require('utility');
const pool = require('../db');
const helpers = require('../utils/helpers');

// Create user
router.post('/', (req, res) => {
    const user = req.body.user || req.query.user;
    let psw = req.body.psw || req.query.psw;

    helpers.checkUserName(user, (exists) => {
        if (exists) {
            res.status(202).json({ err: "Username " + user + " already exists." });
        } else {
            psw = utils.md5(psw);
            const userJson = [[user, psw, new Date()]];
            pool.getConnection((err, connection) => {
                if (err) return res.status(202).json({ err });
                connection.query('insert into users(username,password,createdatetime) values ?', [userJson], (error, done) => {
                    if (error) {
                        res.status(202).json({ err: error });
                    } else {
                        res.status(200).json({ uid: done.insertId });
                    }
                    connection.release();
                });
            });
        }
    });
});

// List users
router.get('/', (req, res) => {
    pool.getConnection((err, connection) => {
        if (err) return res.status(202).json({ err });
        connection.query('select * from users', (error, rows) => {
            if (error) {
                res.status(202).json({ err: error });
            } else {
                res.json({ users: rows });
            }
            connection.release();
        });
    });
});

// Delete user
router.delete('/:uid', (req, res) => {
    const uid = req.params.uid;
    pool.getConnection((err, connection) => {
        if (err) return res.status(202).json({ err });
        connection.query('delete from users where id = ?', [uid], (error, rows) => {
            if (error) {
                res.status(202).json({ err: error });
            } else {
                res.end();
            }
            connection.release();
        });
    });
});

module.exports = router;

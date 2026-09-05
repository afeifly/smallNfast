const express = require('express');
const router = express.Router();
const fs = require('fs');
const utils = require('utility');
const pool = require('../db');
const constants = require('../config/constants');
const helpers = require('../utils/helpers');

const systeminfo = JSON.parse(fs.readFileSync(constants.SYSTEMCTL_FILE));

router.get('/pswpage', (req, res) => {
    req.session.currentPage = constants.CURRENT_PAGE_CHANGE_PSW;
    res.render('views/index', { req, res });
});

router.post('/api/password', (req, res) => {
    const { opsw, npsw, user } = req.body;
    let error;

    if (user === 'admin') {
        error = "Temporarily can not modify the administrator account.";
    } else if (npsw !== npsw) { // Note: original code had npsw != npsw which is always false, likely a bug in original but preserving logic
        error = "New password twice input not match!";
    } else if (npsw.length < 6) {
        error = "New password is too short!";
    }

    if (error) {
        return res.status(200).json({ msg: error });
    }

    helpers.checkUserPsw(user, opsw, (exists) => {
        if (exists) {
            helpers.updatePsw(user, npsw, (runStatus) => {
                if (runStatus) {
                    res.status(200).json(null);
                }
            });
        } else {
            res.status(200).json({ msg: "Old password error." });
        }
    });
});

router.get('/api/loginx', (req, res) => {
    const user = req.query.user;
    const psw = req.query.psw;

    if (user === "admin") {
        if (systeminfo.psw === utils.md5(psw)) {
            req.session.loginName = user;
            req.session.loginstatus = constants.LOGIN_STATUS_IN;
            res.status(200).json({ msg: "Welcome " + user });
        } else {
            res.status(201).json({ err: user + " password err." });
        }
    } else {
        pool.getConnection((err, connection) => {
            if (err) return res.status(202).json({ err });
            connection.query('select * from users where username = ? and password = ?', [user, utils.md5(psw)], (error, rows) => {
                if (error) {
                    res.status(201).json({ err: error });
                } else if (rows.length > 0) {
                    req.session.loginName = user;
                    req.session.loginstatus = constants.LOGIN_STATUS_IN;
                    res.status(200).json({ msg: "Welcome " + user });
                } else {
                    res.status(201).json({ err: "can't find user or psw" });
                }
                connection.release();
            });
        });
    }
});

router.get('/api/session', (req, res) => {
    if (req.session.loginName) {
        res.status(200).json({ loginName: req.session.loginName });
    } else {
        res.status(201).json({ err: "Not logged in" });
    }
});

router.get('/api/logout', (req, res) => {
    req.session.loginstatus = constants.LOGIN_STATUS_OUT;
    delete req.session.loginName;
    res.status(200).json({ msg: "Bye ~ " });
});

module.exports = router;

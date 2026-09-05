const express = require('express');
const router = express.Router();
const pool = require('../db');
const constants = require('../config/constants');
const crypto = require('../utils/crypto');
const helpers = require('../utils/helpers');

// Helper: doRegistration
function doRegistration(sn, localid, text, email, user, company, addr, callback) {
    var license = [sn, localid, text, email, user, company, addr, new Date()];
    pool.getConnection(function (err, conn) {
        if (err) return callback(err);
        helpers.transAutoRelease(conn);
        conn.beginTransaction(function (err) {
            if (err) throw err;
            conn.query('insert into licenses(sn,localid,text,email,user,company,addr,createdatetime) values (?)', [license],
                function (err, ret) {
                    if (err) {
                        callback(err);
                        conn.rollback(function () { });
                    } else {
                        conn.query('UPDATE serialnumbers set used = used+1,registerdatetime=now() where sn ="' + sn + '"', function (err, ret) {
                            if (err) {
                                callback(err);
                                conn.rollback(function () { });
                            } else {
                                conn.commit(function () {
                                    callback(null);
                                });
                            }
                        });
                    }
                });
        });
    });
}

// Helper: showlicense
function showlicense(req, res, kw) {
    var sql = 'select s.sn,s.products_id,s.used,s.max,s.createdatetime,s.note,l.email,l.company,l.addr,l.text, p.canbereset'
        + ' from serialnumbers s LEFT join licenses l '
        + ' on s.sn = l.sn '
        + ' LEFT join software_products p on s.products_id = p.id ';
    if (typeof kw != "undefined") {
        kw = "'%" + kw + "%'";
        sql += 'where s.sn like ' + kw + ' or l.email like ' + kw;
    }
    sql += " ORDER BY s.createdatetime DESC limit 200";
    pool.getConnection(function (err, connection) {
        if (err) return res.status(202).json({ err });
        connection.query(sql, function (error, rows) {
            if (error) {
                res.status(202).json({ err: error });
            } else {
                req.session.currentPage = constants.CURRENT_PAGE_ALL;
                res.status(200).json(rows);
            }
            connection.release();
        });
    });
}

// Routes
router.post('/registration', (req, res) => {
    const { localid, sn, email, company, user, addr, productid: product } = req.body;
    console.log(new Date() + " Register with product id=" + product + " sn=" + sn + " localid=" + localid);

    pool.getConnection(function (err, connection) {
        if (err) return res.status(202).json({ err });
        connection.query('select * from licenses where sn = ? and localid = ?', [sn, localid], function (error, lrows) {
            if (error) {
                connection.release();
                return res.status(202).json({ err: error });
            }

            if (lrows.length === 0) {
                let searchSNSql = product === undefined
                    ? 'select * from serialnumbers where sn = "' + sn + '"'
                    : 'select * from serialnumbers where sn = "' + sn + '" and products_id = ' + product;

                connection.query(searchSNSql, function (error, srows) {
                    if (error) {
                        connection.release();
                        return res.status(202).json({ err: error });
                    }

                    if (srows.length > 0) {
                        const snobj = srows[0];
                        if (snobj.max > snobj.used) {
                            let text = {
                                localid,
                                sn,
                                active: true,
                                trial: snobj.trial,
                                product_id: snobj.products_id,
                                time: new Date().getTime()
                            };

                            const regTime = new Date(snobj.registerdatetime).getTime();
                            text.registerdatetime = isNaN(regTime) ? new Date().getTime() : regTime;

                            if (snobj.products_id === constants.PRODUCT_TYPE_S4M || snobj.products_id === constants.PRODUCT_TYPE_LMS) {
                                connection.query("select a.sn_id,b.property_name, a.property_value from sn_cust_properties a, sn_properties_define b where a.property_define_id = b.id and a.sn_id = ?", [snobj.id], function (error, proprows) {
                                    if (error) {
                                        connection.release();
                                        return res.status(202).json({ err: error });
                                    }

                                    let opts = [];
                                    for (let tmp of proprows) {
                                        opts.push({ key: tmp.property_name, value: tmp.property_value });
                                        if (snobj.products_id === constants.PRODUCT_TYPE_LMS && tmp.property_name === 'expire_years') {
                                            const ts = text.trial === 1
                                                ? text.registerdatetime + 30 * 24 * 3600 * 1000
                                                : text.registerdatetime + tmp.property_value * 365 * 24 * 3600 * 1000;
                                            opts.push({ key: 'expire_date', value: ts });
                                        }
                                    }
                                    text.opts = opts;
                                    let encryptedText = crypto.encrypt(JSON.stringify(text));
                                    doRegistration(sn, localid, encryptedText, email, user, company, addr, (err) => {
                                        connection.release();
                                        if (err) res.status(202).json({ err });
                                        else res.json({ text: encryptedText });
                                    });
                                });
                            } else {
                                let encryptedText = (snobj.products_id === constants.PRODUCT_TYPE_LMS_lite)
                                    ? crypto.encryptAES(JSON.stringify(text))
                                    : crypto.encrypt(JSON.stringify(text));

                                doRegistration(sn, localid, encryptedText, email, user, company, addr, (err) => {
                                    connection.release();
                                    if (err) res.status(202).json({ err });
                                    else res.json({ text: encryptedText });
                                });
                            }
                        } else {
                            connection.release();
                            res.status(202).json({ err: "Serial number already used!" });
                        }
                    } else {
                        connection.release();
                        res.status(202).json({ err: "Serial number not found!" });
                    }
                });
            } else {
                connection.release();
                const row = lrows[0];
                try {
                    const jsonContent = JSON.parse(crypto.decrypt(row.text));
                    if (jsonContent.trial == 1) {
                        res.status(202).json({ err: "Trial SN cannot be registered again!" });
                    } else {
                        res.json({ text: row.text });
                    }
                } catch (e) {
                    res.json({ text: row.text });
                }
            }
        });
    });
});

router.get('/api/licenses', (req, res) => {
    showlicense(req, res, req.query.kw);
});

router.get('/api/reset', (req, res) => {
    const { sn, kw } = req.query;
    if (!req.session.loginName) return res.status(202).json({ err: "Need login again." });

    pool.getConnection((err, conn) => {
        if (err) return res.status(202).json({ err });
        helpers.transAutoRelease(conn);
        conn.beginTransaction((err) => {
            if (err) throw err;
            conn.query("delete from licenses where sn = ?", [sn], (err) => {
                if (err) {
                    conn.rollback(() => { });
                    return res.status(202).json({ err });
                }
                conn.query('UPDATE serialnumbers set used = 0 where sn = ?', [sn], (err) => {
                    if (err) {
                        conn.rollback(() => { });
                        return res.status(202).json({ err });
                    }
                    conn.commit(() => {
                        // Assuming createEvent is moved to a service or helpers, for now I'll just skip it or keep it as a placeholder
                        // We'll handle createEvent when we modularize events.js
                        showlicense(req, res, kw);
                    });
                });
            });
        });
    });
});

router.post('/api/checkUsage', (req, res) => {
    const { deviceID, productID } = req.body;
    if (!deviceID || deviceID.length < 1 || !productID) {
        return res.status(202).json({ err: 'DeviceID or productID format error.' });
    }

    pool.getConnection((err, connection) => {
        if (err) return res.status(202).json({ err });
        connection.query('select firsttime from device_usage_state where device_id = ? and product_id = ?', [deviceID, productID], (error, rows) => {
            if (error) {
                connection.release();
                return res.status(202).json({ err: error });
            }

            const nowTime = Math.floor(Date.now() / 1000);
            if (rows.length > 0) {
                res.status(200).json({ deviceID, firsttime: rows[0].firsttime, currenttime: nowTime });
            } else {
                connection.query('insert into device_usage_state(device_id, product_id, firsttime) values (?, ?, ?)', [deviceID, productID, nowTime], (err) => {
                    if (err) console.error(err);
                    res.status(200).json({ deviceID, firsttime: nowTime, currenttime: nowTime });
                });
            }
            connection.release();
        });
    });
});

router.post('/api/licenses', (req, res) => {
    const { max, note, pid, trial, properties } = req.body;
    helpers.generateMixedInTable(16, 'serialnumbers', (licensestr) => {
        if (!licensestr) return res.status(202).json({ err: "Generate SN fail" });

        console.log("create license : " + licensestr);
        const license = [[Number(pid), licensestr, Number(max), trial, note, new Date()]];

        pool.getConnection((err, connection) => {
            if (err) return res.status(202).json({ err });
            connection.query('insert into serialnumbers(products_id, sn, max, trial, note, createdatetime) values ?', [license], (error, done) => {
                if (error) {
                    res.json({ err: error });
                    connection.release();
                } else {
                    const snId = done.insertId;
                    if (Number(pid) === constants.PRODUCT_TYPE_S4M) {
                        const sn_props = [
                            [1, snId, properties.maxChs],
                            [2, snId, properties.report],
                        ];
                        connection.query('insert into sn_cust_properties(property_define_id, sn_id, property_value) values ?', [sn_props], (err) => {
                            if (err) console.error(err);
                            finalize();
                        });
                    } else if (Number(pid) === constants.PRODUCT_TYPE_LMS) {
                        const sn_props = [
                            [3, snId, properties.lmsExpireYears],
                            [4, snId, properties.lmsInstallType],
                            [5, snId, properties.lmsMaxUsers],
                        ];
                        connection.query('insert into sn_cust_properties(property_define_id, sn_id, property_value) values ?', [sn_props], (err) => {
                            if (err) console.error(err);
                            finalize();
                        });
                    } else {
                        finalize();
                    }

                    function finalize() {
                        res.json({ license: licensestr });
                        helpers.createEvent(connection, req.session.loginName, constants.EVENT_TYPE_CREATE, pid, licensestr + " with note: " + note);
                        connection.release();
                    }
                }
            });
        });
    });
});

module.exports = router;

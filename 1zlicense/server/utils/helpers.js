const utils = require('utility');
const pool = require('../db');

function transAutoRelease(conn) {
    if (conn && !conn.__autoRelease) {
        conn.__autoRelease = true;
        conn.commit = after(conn.commit, release);
        conn.rollback = after(conn.rollback, release);
    }

    function release() {
        if (conn) {
            conn.release();
        }
    }
}

function after(fn, cb) {
    return function () {
        fn.apply(this, arguments);
        cb();
    }
}

function checkUserName(username, callback) {
    pool.getConnection(function (err, connection) {
        var sql = 'select username from users where  username  = "' + username + '"';
        connection.query(sql, function (error, rows) {
            if (error) {
                callback(false);
            } else {
                if (rows != null && rows.length > 0) {
                    callback(true);
                } else {
                    callback(false);
                }

            }
            connection.release();
        });
    });
}

function checkUserPsw(username, psw, callback) {
    pool.getConnection(function (err, connection) {
        var sql = 'select username from users where  username  = "' + username + '"' + ' and password = "'
            + utils.md5(psw) + '"';
        connection.query(sql, function (error, rows) {
            if (error) {
                callback(false);
            } else {
                if (rows != null && rows.length > 0) {
                    callback(true);
                } else {
                    callback(false);
                }

            }
            connection.release();
        });
    });
}

function updatePsw(username, psw, callback) {
    pool.getConnection(function (err, connection) {
        var sql = 'update users set password = "' + utils.md5(psw)
            + '" where  username  = "' + username + '"';
        connection.query(sql, function (error) {
            if (error) {
                callback(false);
            } else {
                callback(true);
            }
            connection.release();
        });

    });
}

const chars = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

function generateMixedWithoutCheckExist(n) {
    var res = "";
    for (var i = 0; i < n; i++) {
        var id = Math.ceil(Math.random() * 9);
        res += chars[id];
        if (i == 3 || i == 7 || i == 11) {
            res += "-";
        }
    }
    return res;
}

function checkSNExist(sn, license_table, callback) {
    pool.getConnection(function (err, connection) {
        var sql = 'select sn from '
            + license_table
            + ' where  sn  = "' + sn + '"';
        connection.query(sql, function (error, rows) {
            if (error) {
                callback(false);
            } else {
                if (rows != null && rows.length > 0) {
                    callback(true);
                } else {
                    callback(false);
                }

            }
            connection.release();
        });
    });
}

function generateMixedInTable(n, license_table, callback) {
    var res = generateMixedWithoutCheckExist(n);
    checkSNExist(res, license_table, function (noError) {
        if (!noError) {
            callback(res);
        } else {
            generateMixedInTable(n, license_table, callback);
        }
    });
}

function createEvent(connection, user, action, pid, note) {
    const props = [[user, action, pid, note, new Date()]];
    connection.query('insert into events(user, action, product_id, note, createdatetime) values ?', [props], (error, done) => {
        if (error) console.error(error);
        else console.log(done);
    });
}

module.exports = {
    transAutoRelease,
    after,
    checkUserName,
    checkUserPsw,
    updatePsw,
    generateMixedInTable,
    generateMixedWithoutCheckExist,
    checkSNExist,
    createEvent
};

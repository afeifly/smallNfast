const crypto = require('crypto');
const CryptoJS = require("crypto-js");
const constants = require('../config/constants');

function encrypt(data) {
    const password = constants.ENCRYPT_KEY;
    const key = crypto.createHash('md5').update(password).digest(); // Legacy EVP_BytesToKey(MD5, null, 1) result for 128-bit key
    const cipher = crypto.createCipheriv('aes-128-ecb', key, '');
    let crypted = cipher.update(data, 'utf-8', 'hex');
    crypted += cipher.final('hex');
    return crypted;
}

function decrypt(data) {
    const password = constants.ENCRYPT_KEY;
    const key = crypto.createHash('md5').update(password).digest();
    const decipher = crypto.createDecipheriv('aes-128-ecb', key, '');
    let dec = decipher.update(data, 'hex', 'utf8');
    dec += decipher.final('utf8');
    return dec;
}

function encryption(data, key) {
    const iv = "";
    const clearEncoding = 'utf8';
    const cipherEncoding = 'base64';
    const cipherChunks = [];
    const cipher = crypto.createCipheriv('aes-256-ecb', key, iv);
    cipher.setAutoPadding(true);

    cipherChunks.push(cipher.update(data, clearEncoding, cipherEncoding));
    cipherChunks.push(cipher.final(cipherEncoding));

    return cipherChunks.join('').toString('hex');
}

function base64ToHex(str) {
    const raw = atob(str);
    let result = '';
    for (let i = 0; i < raw.length; i++) {
        const hex = raw.charCodeAt(i).toString(16);
        result += (hex.length === 2 ? hex : '0' + hex);
    }
    return result.toUpperCase();
}

function encryptAES(text) {
    const key = CryptoJS.enc.Hex.parse(constants.ENCRYPT_CUSTEM_KEY);
    const iv = CryptoJS.enc.Hex.parse(constants.ENCRYPT_CUSTEM_IV);
    const encrypted = CryptoJS.AES.encrypt(text, key, { iv: iv });
    return encrypted.toString();
}

module.exports = {
    encrypt,
    decrypt,
    encryption,
    base64ToHex,
    encryptAES
};

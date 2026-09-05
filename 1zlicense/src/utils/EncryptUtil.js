import CryptoJS from "crypto-js";

const ENCRYPT_KEY = '67a0fd39e75e37bc0743147d43b9487bde7db1f5ef798da4e570d6595190dd682a9d4491b47ad26c94e11e1e464e8bb1';
const ENCRYPT_CUSTEM_KEY = '67a0fd39e75e37bc0743147d43b9487a';
const ENCRYPT_CUSTEM_IV = 'bde7db1f5ef798da4e570d6595190ddb';

let EncryptUtil = {

    encrypt(data) {
        // Node's createCipher('aes-128-ecb', password) uses a legacy EVP_BytesToKey derivation with MD5
        // However, the original code seems to be using a raw key approach in decrypt
        // To be safe and compatible with the existing decrypt logic:
        const key = CryptoJS.MD5(ENCRYPT_KEY);
        const encrypted = CryptoJS.AES.encrypt(data, key, {
            mode: CryptoJS.mode.ECB,
            padding: CryptoJS.pad.Pkcs7
        });
        return encrypted.ciphertext.toString(CryptoJS.enc.Hex);
    },

    decrypt(data) {
        const key = CryptoJS.MD5(ENCRYPT_KEY);
        const ciphertext = CryptoJS.enc.Hex.parse(data);
        const decrypted = CryptoJS.AES.decrypt({ ciphertext: ciphertext }, key, {
            mode: CryptoJS.mode.ECB,
            padding: CryptoJS.pad.Pkcs7
        });
        return decrypted.toString(CryptoJS.enc.Utf8);
    },

    encryptAES(text) {
        var key = CryptoJS.enc.Hex.parse(ENCRYPT_CUSTEM_KEY);
        var iv = CryptoJS.enc.Hex.parse(ENCRYPT_CUSTEM_IV);
        var encrypted = CryptoJS.AES.encrypt(text, key, { iv: iv });
        return encrypted.toString();
    },

    decryptAES(ciphertext) {
        var key = CryptoJS.enc.Hex.parse(ENCRYPT_CUSTEM_KEY);
        var iv = CryptoJS.enc.Hex.parse(ENCRYPT_CUSTEM_IV);
        var bytes = CryptoJS.AES.decrypt(ciphertext, key, { iv: iv });
        return bytes.toString(CryptoJS.enc.Utf8);
    }
}

export default EncryptUtil;
const crypto = require('crypto');
const hashSalt = process.env.HASH_SALT || 'No-salt';

const IV_LENGTH = 16;

const sha256 = (str) => {
    return crypto.createHash('sha256').update(hashSalt).update(str).digest('hex');
};

const sha512 = (str) => {
    return crypto.createHash('sha512').update(hashSalt).update(str).digest('hex');
};

const aesEncrypt = (str, key) => {
    const iv = crypto.randomBytes(IV_LENGTH);
    let cypher = crypto.createCipheriv('aes-256-cbc', Buffer.from(sha256(key), 'hex'), iv);
    let encrypted = cypher.update(Buffer.from(str));
    encrypted = Buffer.concat([encrypted, cypher.final()]);
    return `${iv.toString('hex')}:${encrypted.toString('hex')}`;
};

const aesDecrypt = (str, key) => {
    const [iv, encryptedText] = str.split(':').map(part => Buffer.from(part, 'hex'));
    let decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(sha256(key), 'hex'), iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted;
};

export { sha256, sha512, aesDecrypt, aesEncrypt };

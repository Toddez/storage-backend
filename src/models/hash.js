const crypto = require('crypto');
const hashSalt = process.env.HASH_SALT || 'No-salt';

const sha256 = (str) => {
    return crypto.createHash('sha256').update(hashSalt).update(str).digest('hex');
};

export { sha256 };

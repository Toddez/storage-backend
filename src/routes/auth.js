import Database from '../db';

const express = require('express');
const router = express.Router();

import util from 'util';
import crypto from 'crypto';
import qrcode from 'qrcode';
import base32Encode from 'base32-encode';
import { verifyTOTP } from '../models/2fa';

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const saltrounds = 10;
const jwtSecret = process.env.JWT_SECRET || 'No-secret';

import { sha256 } from '../models/crpyto';

const checkToken = (req, res, next) => {
    const token = req.headers['x-access-token'];

    jwt.verify(token, jwtSecret, (err, payload) => {
        if (err) {
            let err = new Error('Invalid token');
            err.status = 403;
            return next(err);
        }

        req.user = payload;

        if (payload.auth === false) {
            let err = new Error('Invalid token');
            err.status = 403;
            return next(err);
        }

        next();
    });
};

const createUser = async (id, key) => {
    return new Promise((resolve) => {
        bcrypt.hash(key, saltrounds, (err, hash) => {
            Database.collection('users').insertOne({ id: sha256(id), key: hash, auth: false, authKey: null }, {new: true}, (err, response) => {
                const user = response.ops[0];
                resolve(user);
            });
        });
    });
};

router.post('/2faqrc', async (req, res, next) => {
    const token = req.headers['x-access-token'];

    jwt.verify(token, jwtSecret, async (err, payload) => {
        if (err) {
            let err = new Error('Invalid token');
            err.status = 403;
            return next(err);
        }

        if (await Database.collection('users').findOne({ id: sha256(payload.id) }).auth) {
            let err = new Error('Invalid token');
            err.status = 403;
            return next(err);
        }

        if (payload.first === true) {
            const buffer = await util.promisify (crypto.randomBytes)(14);
            const secret = base32Encode(buffer, 'RFC4648', { padding: false });
            await Database.collection('users').updateOne({ id: sha256(payload.id) }, {
                $set: {
                    authKey: secret
                }
            }, {});

            const issuer = 'Storage';
            const algorithm = 'SHA1';
            const digits = '6';
            const period = '30';
            const otpType = 'totp';
            const config = `otpauth://${otpType}/${issuer}?algorithm=${algorithm}&digits=${digits}&period=${period}&issuer=${issuer}&secret=${secret}`;

            res.setHeader('Content-Type', 'image/png');
            qrcode.toFileStream(res, config);
        } else {
            if (err) {
                let err = new Error('Invalid token');
                err.status = 403;
                return next(err);
            }
        }
    });
});

router.post('/2fa', async (req, res, next) => {
    const token = req.headers['x-access-token'];
    const authKey = req.body.authKey;

    jwt.verify(token, jwtSecret, async (err, payload) => {
        if (err) {
            let err = new Error('Invalid token');
            err.status = 403;
            return next(err);
        }

        const user = await Database.collection('users').findOne({ id: sha256(payload.id) });
        if (verifyTOTP(authKey, user.authKey)) {
            const newPayload = { id: payload.id, key: payload.key, first: false, auth: true };
            const newToken = jwt.sign(newPayload, jwtSecret, { expiresIn: '24h' });
            req.session.token = newToken;

            await Database.collection('users').updateOne({ id: sha256(payload.id) }, {
                $set: {
                    auth: true
                }
            }, {});

            return res.status(200).json({
                data: {
                    message: 'Successfully authorized',
                    token: newToken
                }
            });
        }

        err = new Error('Invalid token');
        err.status = 403;
        return next(err);
    });
});

// All routes requiring valid jwt
router.use('/storage', checkToken);

router.post('/logout', (req, res) => {
    delete req.session.token;

    return res.status(200).json({
        data: {
            message: 'Logged out'
        }
    });
});

router.post('/checkup', (req, res, next) => {
    if (!req.session.token) {
        return res.status(200).json({
            data: {
                token: null
            }
        });
    }

    jwt.verify(req.session.token, jwtSecret, (err, payload) => {
        if (err) {
            let err = new Error('Invalid token');
            err.status = 403;
            return next(err);
        }

        req.user = payload;

        return res.status(200).json({
            data: {
                token: req.session.token,
                auth: req.user.auth
            }
        });
    });
});

router.post('/authorize', (req, res, next) => {
    const id = req.body.id;
    const key = req.body.key;

    if (!id) {
        let err = new Error('Missing id');
        err.status = 401;
        return next(err);
    }

    if (!key) {
        let err = new Error('Missing key');
        err.status = 401;
        return next(err);
    }

    Database.collection('users').findOne({ id: sha256(id) }, async (err, user) => {
        if (err)
            return next(new Error('Database error'));

        let newUser = !user;
        if (newUser)
            user = await createUser(id, key);

        bcrypt.compare(key, user.key, (_, result) => {
            if (result) {
                const payload = { id: id, key: key, first: newUser || user.authKey === null || user.auth === false, auth: false };
                const token = jwt.sign(payload, jwtSecret, { expiresIn: '24h' });
                req.session.token = token;

                return res.status(200).json({
                    data: {
                        token: token
                    }
                });
            }

            const payload = { id: id, key: key, first: false, auth: false };
            const token = jwt.sign(payload, jwtSecret, { expiresIn: '24h' });
            req.session.token = token;

            return res.status(200).json({
                data: {
                    token: token
                }
            });
        });
    });
});

export default router;

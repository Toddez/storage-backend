import Database from '../db';

const express = require('express');
const router = express.Router();

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

        next();
    });
};


const createUser = async (id, key) => {
    return new Promise((resolve) => {
        bcrypt.hash(key, saltrounds, (err, hash) => {
            Database.collection('users').insertOne({ id: sha256(id), key: hash }, {new: true}, (err, response) => {
                const user = response.ops[0];
                resolve(user);
            });
        });
    });
};

// All routes requiring valid jwt
router.use('/storage', checkToken);

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

        if (!user)
            user = await createUser(id, key);

        bcrypt.compare(key, user.key, (_, result) => {
            if (result) {
                const payload = { id: id, key: key };
                const token = jwt.sign(payload, jwtSecret, { expiresIn: '24h' });

                return res.status(200).json({
                    data: {
                        message: 'Successfully authorized',
                        token: token
                    }
                });
            }

            let err = new Error("Invalid key");
            err.status = 401;
            return next(err);
        });
    });
});

export default router;

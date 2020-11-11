const express = require('express');
const router = express.Router();

import { sha256 } from '../models/hash';
import { Storage } from '../models/storage';

router.get('/tree', async (req, res) => {
    const user = req.user;
    const id = sha256(user.id);
    const key = user.key;

    const storage = new Storage(id, key);

    return res.status(200).json({
        tree: await storage.tree()
    });
});

export default router;

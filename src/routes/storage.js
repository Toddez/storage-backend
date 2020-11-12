const express = require('express');
const router = express.Router();

import { Storage, NodeType } from '../models/storage';

router.get('/tree', async (req, res) => {
    const user = req.user;
    const id = user.id;
    const key = user.key;

    const storage = new Storage(id, key);

    return res.status(200).json({
        tree: await storage.export(storage.root),
        types: NodeType
    });
});

export default router;

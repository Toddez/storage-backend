const express = require('express');
const router = express.Router();

import { Storage, NodeType } from '../models/storage';

router.get('/', async (req, res) => {
    const user = req.user;
    const id = user.id;
    const key = user.key;

    const storage = new Storage(id, key);

    return res.status(200).json({
        tree: await storage.export(storage.root),
        types: NodeType
    });
});

router.get('/read/*', async (req, res) => {
    const user = req.user;
    const localPath = req.params[0];
    const id = user.id;
    const key = user.key;

    const storage = new Storage(id, key);

    let data = await storage.readFile(localPath);

    return res.status(200).json({
        path: localPath,
        data: data,
        types: NodeType
    });
});

router.post('/write/*', async (req, res) => {
    const user = req.user;
    const localPath = req.params[0];
    const data = req.body.data;
    const id = user.id;
    const key = user.key;

    const storage = new Storage(id, key);

    await storage.writeFile(localPath, data);

    return res.status(200).json({
        path: localPath,
        types: NodeType
    });
});

export default router;

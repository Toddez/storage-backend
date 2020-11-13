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
        data: data
    });
});

router.post('/write/*', async (req, res, next) => {
    const user = req.user;
    const localPath = req.params[0];
    const type =  req.body.type;
    const data = req.body.data;
    const id = user.id;
    const key = user.key;

    const storage = new Storage(id, key);

    if (type & NodeType.FILE)
        await storage.writeFile(localPath, data);
    else if (type & NodeType.DIR)
        await storage.createDir(localPath);
    else {
        let err = new Error('Invalid type');
        err.status = 400;
        return next(err);
    }

    return res.status(200).json({
        path: localPath
    });
});

router.post('/delete/*', async (req, res) => {
    const user = req.user;
    const localPath = req.params[0];
    const id = user.id;
    const key = user.key;

    const storage = new Storage(id, key);
    const deleted = await storage.delete(localPath);

    return res.status(200).json({
        deleted: deleted
    });
});

export default router;

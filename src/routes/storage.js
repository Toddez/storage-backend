const express = require('express');
const router = express.Router();

import { Storage, NodeType, getExtension, identify } from '../models/storage';

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

    const pathParts = localPath.split('/');
    const fileName = pathParts[pathParts.length - 1];
    const extension = getExtension(fileName);
    const data = await storage.readFile(localPath);

    return res.status(200).json({
        path: localPath,
        file: fileName,
        extension: extension,
        type: identify(extension),
        data: data,
        lines: data.split('\n').length,
        size: (new TextEncoder().encode(data)).length,
        types: NodeType
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

    let err = new Error('Path collision');
    err.status = 400;

    if (type & NodeType.FILE) {
        if (!await storage.writeFile(localPath, data))
            return next(err);
    } else if (type & NodeType.DIR) {
        if (!await storage.createDir(localPath))
            return next(err);
    }else {
        let err = new Error('Invalid type');
        err.status = 400;
        return next(err);
    }

    return res.status(201).json({
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

    return res.status(201).json({
        deleted: deleted
    });
});

export default router;

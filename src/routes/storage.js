const express = require('express');
const router = express.Router();
const { TextEncoder } = require('util');
const fetch = require('node-fetch');

import { Storage, NodeType, getExtension, identify } from '../models/storage';

router.get('/', (req, res) => {
    const user = req.user;
    const id = user.id;
    const key = user.key;

    const storage = new Storage(id, key);

    return res.status(200).json({
        tree: storage.export(),
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
    let data = Buffer.from(storage.readFile(localPath));

    if (!(identify(extension) & NodeType.IMAGE || identify(extension) & NodeType.VIDEO)) {
        data = data.toString('utf8');
    } else {
        data = data.toString('base64');
    }

    return res.status(200).json({
        path: localPath,
        file: fileName,
        extension: extension,
        type: identify(extension),
        data: data,
        lines: data.toString('utf8').split('\n').length,
        size: (new TextEncoder().encode(data.toString('utf8'))).length,
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

    let err = new Error('Could not write file');
    err.status = 400;

    if (type & NodeType.FILE) {
        if (!storage.writeFile(localPath, data))
            return next(err);
    } else if (type & NodeType.DIR) {
        if (!storage.createDir(localPath))
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

const multer = require('multer');
const upload = multer();

router.post('/upload/*', upload.array('files'), async (req, res, next) => {
    const user = req.user;
    const localPath = req.params[0];
    const files = req.files;
    const id = user.id;
    const key = user.key;

    const storage = new Storage(id, key);

    let err = new Error('Could not upload file');
    err.status = 400;

    for (const file of files)
        if (!storage.writeFile(`${localPath}${localPath !== '' ? '/' : ''}${file.originalname}`, file.buffer))
            return next(err);

    return res.status(201).json({
        uploaded: true
    });
});

router.post('/uploadFromURL/*', async (req, res, next) => {
    const user = req.user;
    const localPath = req.params[0];
    const url = req.body.url;
    const id = user.id;
    const key = user.key;

    const storage = new Storage(id, key);

    const fileRes = await fetch(url);
    const data = await fileRes.buffer();
    const fileName = url.split('/').pop();

    let err = new Error('Could not write file');
    err.status = 400;

    if (!storage.writeFile(`${localPath}${localPath !== '' ? '/' : ''}${fileName}`, data))
        return next(err);

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
    const deleted = storage.delete(localPath);

    return res.status(201).json({
        deleted: deleted
    });
});

router.post('/rename/*', async (req, res) => {
    const user = req.user;
    const localPath = req.params[0];
    const id = user.id;
    const key = user.key;
    const name = req.body.name;

    const storage = new Storage(id, key);
    const renamed = storage.rename(localPath, name);

    return res.status(201).json({
        renamed: renamed
    });
});

export default router;

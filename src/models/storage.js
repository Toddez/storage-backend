const fs = require('fs');
const path = require('path');

import { aesEncrypt, aesDecrypt, sha256 } from './crpyto';

const BIT = (...x) => {
    let res = 0x0;

    for (const y of x) {
        res |= 0x1 << y;
    }

    return res;
};

const NodeType = {
    NULL:       BIT(),

    ROOT:       BIT(0),
    DIR:        BIT(1),
    CRAWLABLE:  BIT(0, 1),

    RAW:        BIT(2),
    IMAGE:      BIT(3),
    VIDEO:      BIT(4),
    TEXT:       BIT(5),
    FILE:       BIT(2, 3, 4, 5)
};

class Node {
    constructor(type, parent, localPath) {
        this.children = [];
        this.type = type;
        this.localPath = localPath;
        this.data = {};
        this.parent = parent;

        if (this.type & NodeType.ROOT)
            this.data.resolvedPath = 'root';

        if (this.parent)
            this.parent.children.push(this);
    }
}

class Storage {
    constructor(id, key) {
        this.root = new Node(NodeType.ROOT | NodeType.DIR, null, sha256(id));
        this.key = key;
        this.crawled = false;
        this.crawling = false;
        this.crawlPromise = null;
    }

    path(localPath) {
        return path.resolve(__dirname, `storage/${localPath || ''}`);
    }

    async crawl(node) {
        return new Promise((resolveAll) => {
            if (node.type & NodeType.CRAWLABLE) {
                fs.readdir(this.path(node.localPath), async (err, files) => {
                    if (!err) {
                        let promises = [];
                        for (const file of files) {
                            promises.push(new Promise((resolve) => {
                                fs.stat(this.path(`${node.localPath}/${file}`), async (err, stat) => {
                                    if (!err) {
                                        let type = NodeType.NULL;

                                        if (stat.isDirectory())
                                            type = NodeType.DIR;

                                        if (stat.isFile())
                                            type = NodeType.FILE;

                                        const newNode = new Node(type, node, `${node.localPath}/${file}`);
                                        const fileName = await this.decrypt(file).toString('utf8');

                                        newNode.data.resolvedPath = `${node.data.resolvedPath}/${fileName}`;
                                        if (type & NodeType.FILE)
                                            newNode.data.file = fileName;

                                        await this.crawl(newNode);

                                        resolve();
                                    }
                                });
                            }));
                        }

                        await Promise.all(promises);
                        resolveAll();
                    }
                });
            } else {
                resolveAll();
            }
        });
    }

    async tree() {
        if (this.crawling)
            return this.crawlPromise;

        if (this.crawled)
            return this.root;

        this.crawling = true;

        this.crawlPromise = new Promise((resolve) => {
            fs.mkdir(this.path(this.root.localPath), { recursive: true }, async () => {
                await this.crawl(this.root);
                this.crawled = true;
                this.crawling = false;
                this.crawlPromise = null;
                resolve(this.root);
            });
        });

        return this.crawlPromise;
    }

    async export(node) {
        if (!this.crawled)
            await this.tree();

        const out = {};
        out.type = node.type;
        out.file = node.data.file;
        out.path = node.data.resolvedPath;
        out.children = [];

        for (const child of node.children) {
            const newChild = await this.export(child);
            out.children.push(newChild);
        }

        return out;
    }

    encrypt(str) {
        return aesEncrypt(str, this.key);
    }

    decrypt(str) {
        return aesDecrypt(str, this.key);
    }

    find(node, localPath) {
        for (const child of node.children)
            if (localPath.startsWith(child.data.resolvedPath))
                return this.find(child, localPath);

        return node.localPath;
    }

    deepPath(localPath) {
        const deepestPath = this.find(this.root, `${this.root.data.resolvedPath}/${localPath}`);
        const depth = deepestPath.split('/').length;

        const split = localPath.split('/');
        const encryptedPath = split.slice(depth - 1, split.length + 1).map((bit) => this.encrypt(bit));

        const dirPath = this.path([deepestPath, ...encryptedPath.slice(0, -1)].join('/'));
        const fullPath = this.path([deepestPath, ...encryptedPath].join('/'));

        return {
            dir: dirPath,
            file: fullPath
        };
    }

    async writeFile(localPath, data) {
        if (!this.crawled)
            await this.tree();

        const {dir, file} = this.deepPath(localPath);

        await fs.mkdir(dir, { recursive: true }, () => null);
        await fs.writeFile(file, this.encrypt(data), () => null);
    }

    async readFile(localPath) {
        if (!this.crawled)
            await this.tree();

        const {file} = this.deepPath(localPath);

        await fs.readFile(file, (err, data) => {
            return this.decrypt(data.toString('utf8')).toString('utf8');
        });
    }
}

export { Storage, NodeType };

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

    BINARY:     BIT(2),
    RAW:        BIT(3),

    PNG:        BIT(4),
    JPG:        BIT(5),
    GIF:        BIT(6),
    IMAGE:      BIT(4, 5, 6),

    MP4:        BIT(7),
    WMV:        BIT(8),
    VIDEO:      BIT(7, 8),

    UNKNOWN:    BIT(9),
    FILE:       BIT(2, 3, 4, 5, 6, 7, 8, 9)
};

const Extensions = {
    [NodeType.RAW]: ['txt', 'md', 'js', 'jsx', 'ts', 'tsx'],
    [NodeType.PNG]: ['png'],
    [NodeType.JPG]: ['jpg', 'jpeg'],
    [NodeType.GIF]: ['gif'],
    [NodeType.MP4]: ['mp4'],
    [NodeType.WMV]: ['wmv'],
    [NodeType.BINARY]: ['', 'out', 'bin'],
};

const getExtension = (fileName) => {
    const fileParts = fileName.split('.');
    return (fileParts.length > 1 ? fileParts[fileParts.length - 1] : '').toLowerCase();
};

const identify = (ext) => {
    for (const type of Object.keys(Extensions)) {
        for (const ending of Extensions[type]) {
            if (ending === ext)
                return type;
        }
    }

    return NodeType.UNKNOWN;
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

const deleteFolderRecursive = function(localPath) {
    if (fs.existsSync(localPath)) {
        fs.readdirSync(localPath).forEach((file) => {
            const curPath = path.join(localPath, file);
            if (fs.lstatSync(curPath).isDirectory()) {
                deleteFolderRecursive(curPath);
            } else {
                fs.unlinkSync(curPath);
            }
        });
        fs.rmdirSync(localPath);
    }
};

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

                                        const fileName = await this.decrypt(file).toString('utf8');
                                        const extension = getExtension(fileName);

                                        if (stat.isFile())
                                            type = identify(extension);

                                        const newNode = new Node(type, node, `${node.localPath}/${file}`);
                                        newNode.data.resolvedPath = `${node.data.resolvedPath}/${fileName}`;
                                        if (type & NodeType.FILE) {
                                            newNode.data.file = fileName;
                                            newNode.data.extension = extension;
                                        }

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
        out.extension = node.data.extension;
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

        return node;
    }

    deepPath(localPath) {
        const deepestPath = this.find(this.root, `${this.root.data.resolvedPath}/${localPath}`).localPath;
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

    async createDir(localPath) {
        if (!this.crawled)
            await this.tree();

        const { file } = this.deepPath(localPath);

        return new Promise((resolve) => {
            fs.mkdir(file, { recursive: true }, () => {
                resolve();
            });
        });
    }

    async writeFile(localPath, data) {
        if (!this.crawled)
            await this.tree();

        const { dir, file } = this.deepPath(localPath);

        return new Promise((resolve) => {
            fs.mkdir(dir, { recursive: true }, () => {
                fs.writeFile(file, this.encrypt(data), () => {
                    resolve();
                });
            });
        });
    }

    async readFile(localPath) {
        if (!this.crawled)
            await this.tree();

        const { file } = this.deepPath(localPath);

        return new Promise((resolve) => {
            fs.readFile(file, (err, data) => {
                if (!data)
                    return '';

                resolve(this.decrypt(data.toString('utf8')).toString('utf8'));
            });
        });
    }

    async delete(localPath) {
        if (!this.crawled)
            await this.tree();

        return new Promise((resolve) => {
            let node = this.find(this.root, `${this.root.data.resolvedPath}/${localPath}`);

            if ('root/' + localPath !== node.data.resolvedPath) {
                resolve(false);
                return;
            }

            const fullPath = this.path(node.localPath);

            if (node.type & NodeType.DIR)
                deleteFolderRecursive(fullPath);
            else if (node.type & NodeType.FILE)
                fs.unlinkSync(fullPath);

            resolve(true);
        });
    }
}

export { Storage, NodeType, getExtension, identify };

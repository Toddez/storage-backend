const fs = require('fs');
const path = require('path');

class NodeType {}
NodeType.NULL = 'UNKNOWN';
NodeType.ROOT = 'ROOT';
NodeType.DIR = 'DIR';
NodeType.FILE = 'FILE';
NodeType.CRAWABLE = [NodeType.ROOT, NodeType.DIR];

class Node {
    constructor(type, parent, localPath) {
        this.children = [];
        this.type = type;
        this.localPath = localPath;

        if (parent)
            parent.children.push(this);
    }
}

class Storage {
    constructor(id, key) {
        this.root = new Node(NodeType.ROOT, null, id);
        this.key = key;
        this.crawled = false;
    }

    path(localPath) {
        return path.resolve(__dirname, `storage/${localPath || ''}`);
    }

    async crawl(node) {
        return new Promise((resolveAll) => {
            if (NodeType.CRAWABLE.includes(node.type)) {
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
        if (this.crawled) {
            return this.root;
        }

        return new Promise((resolve) => {
            fs.mkdir(this.path(), { recursive: true }, async () => {
                await this.crawl(this.root);
                this.crawled = true;
                resolve(this.root);
            });
        });

    }
}

export { Storage };

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
    [NodeType.RAW]: ['abap', 'actionscript', 'ada', 'arduino', 'autoit', 'c', 'clojure', 'cs', 'c', 'cpp', 'coffeescript', 'csharp', 'css', 'cuda', 'd', 'dart', 'delph', 'elixir', 'elm', 'erlang', 'fortran', 'foxpro', 'fsharp', 'go', 'graphql', 'gql', 'groovy', 'haskell', 'haxe', 'html', 'java',' javascript', 'json', 'julia', 'jsx', 'js', 'kotlin', 'latex', 'lisp', 'livescript', 'lua', 'mathematica', 'makefile', 'matlab', 'objectivec', 'objective', 'objectpascal', 'ocaml', 'octave', 'perl', 'php', 'powershell', 'prolog', 'puppet', 'python', 'qml', 'r', 'racket', 'restructuredtext', 'rest', 'ruby', 'rust', 'sass', 'less',' scala', 'scheme', 'shell', 'smalltalk', 'sql', 'standardml', 'sml', 'swift', 'tcl', 'tex', 'text', 'tsx', 'ts', 'typescript', 'vala', 'vbnet', 'verilog', 'vhdl', 'xml', 'xquery'],
    [NodeType.PNG]: ['png'],
    [NodeType.JPG]: ['jpg', 'jpeg'],
    [NodeType.GIF]: ['gif'],
    [NodeType.MP4]: ['mp4'],
    [NodeType.VIDEO]: ['webm'],
    [NodeType.WMV]: ['wmv'],
    [NodeType.BINARY]: [''],
};

const getExtension = (fileName) => {
    const fileParts = fileName.split('.');
    return (fileParts.length > 1 ? fileParts[fileParts.length - 1] : '').toLowerCase();
};

const identify = (ext) => {
    for (const type of Object.keys(Extensions)) {
        for (const ending of Extensions[type]) {
            if (ending === ext)
                return parseInt(type);
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
        this.id = id;
        this.key = key;
        this.root = new Node(NodeType.ROOT | NodeType.DIR, null, sha256(this.id));
    }

    resolvePath(path) {
        const split = path.split('/');
        for (let i = 0; i < split.length; i++) {
            if (split[i] === '..') {
                if (i > 0) {
                    split.splice(i - 1, 1);
                    i--;
                }

                split.splice(i, 1);
                i--;
            }

            if (split[i] === '.') {
                split.splice(i, 1);
                i--;
            }
        }

        return split.join('/');
    }

    path(localPath) {
        return path.resolve(__dirname, `storage/${localPath || ''}`);
    }

    crawl(node) {
        if (node.type & NodeType.CRAWLABLE) {
            const files = fs.readdirSync(this.path(node.localPath));
            for (const file of files) {
                const stat = fs.statSync(this.path(`${node.localPath}/${file}`));

                let type = NodeType.NULL;

                if (stat.isDirectory())
                    type = NodeType.DIR;

                const fileName = this.decrypt(file).toString('utf8');
                const extension = getExtension(fileName);

                if (stat.isFile())
                    type = identify(extension);

                const newNode = new Node(type, node, `${node.localPath}/${file}`);
                newNode.data.resolvedPath = `${node.data.resolvedPath}/${fileName}`;
                if (type & NodeType.FILE) {
                    newNode.data.file = fileName;
                    newNode.data.extension = extension;
                }

                this.crawl(newNode);
            }
        }
    }

    tree() {
        this.root = new Node(NodeType.ROOT | NodeType.DIR, null, sha256(this.id));
        fs.mkdirSync(this.path(this.root.localPath), { recursive: true });
        this.crawl(this.root);
    }

    export(node, first=true) {
        if (first) {
            this.tree();
            node = this.root;
        }

        const out = {};
        out.type = node.type;
        out.file = node.data.file;
        out.extension = node.data.extension;
        out.path = node.data.resolvedPath;
        out.children = [];

        for (const child of node.children) {
            const newChild = this.export(child, false);
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

    find(node, localPath, depth=0) {
        for (const child of node.children) {
            const current = localPath.split('/')[depth];
            const compare = child.data.resolvedPath.split('/')[1 + depth];

            if (current === compare)
                return this.find(child, localPath, depth + 1);
        }

        return node;
    }

    createDir(localPath) {
        this.tree();

        if (localPath[localPath.length - 1] === '/')
            localPath = localPath.slice(0, -1);

        const deepest = this.find(this.root, localPath);
        const depth = deepest.data.resolvedPath.split('/').length - 1;
        const spl = localPath.split('/');
        const resolvedPath = [deepest.localPath, ...spl.slice(depth, spl.length).map((bit) => this.encrypt(bit))].join('/');

        try {
            fs.mkdirSync(this.path(resolvedPath), { recursive: true });
            return true;
        } catch (err) {
            return false;
        }
    }

    writeFile(localPath, data) {
        const spl = localPath.split('/');
        if (spl.length > 1) {
            if (!this.createDir(spl.slice(0, -1).join('/')))
                return false;

            this.tree();
        }

        this.tree();

        const deepest = this.find(this.root, localPath);
        const depth = deepest.data.resolvedPath.split('/').length - 1;
        const resolvedPath = [deepest.localPath, ...spl.slice(depth, spl.length).map((bit) => this.encrypt(bit))].join('/');

        try {
            fs.writeFileSync(this.path(resolvedPath), this.encrypt(data));
            return true;
        } catch (err) {
            return false;
        }
    }

    readFile(localPath) {
        this.tree();

        const deepest = this.find(this.root, localPath);

        if (('root/' + localPath) !== deepest.data.resolvedPath)
            return '';

        try {
            return this.decrypt(fs.readFileSync(this.path(deepest.localPath)).toString('utf8'));
        } catch (err) {
            return '';
        }
    }

    delete(localPath) {
        this.tree();

        const deepest = this.find(this.root, localPath);

        if ('root/' + localPath !== deepest.data.resolvedPath)
            return false;

        const fullPath = this.path(deepest.localPath);

        try {
            if (deepest.type & NodeType.DIR)
                deleteFolderRecursive(fullPath);
            else if (deepest.type & NodeType.FILE)
                fs.unlinkSync(fullPath);

            return true;
        } catch (err) {
            return false;
        }
    }

    rename(localPath, name) {
        this.tree();

        const deepestPrevious = this.find(this.root, localPath);

        if ('root/' + localPath !== deepestPrevious.data.resolvedPath)
            return false;

        const previousPath = this.path(deepestPrevious.localPath);

        let targetPath = localPath.split('/').slice(0, -1);
        targetPath.push(name);
        targetPath = targetPath.join('/');

        targetPath = this.resolvePath(targetPath);

        const spl = targetPath.split('/');
        if (spl.length > 1) {
            if (!this.createDir(spl.slice(0, -1).join('/')))
                return false;

            this.tree();
        }

        const deepestTarget = this.find(this.root, targetPath);
        const depth = deepestTarget.data.resolvedPath.split('/').length - 1;
        const resolvedPath = this.path([deepestTarget.localPath, ...spl.slice(depth, spl.length).map((bit) => this.encrypt(bit))].join('/'));

        try {
            fs.renameSync(previousPath, resolvedPath);

            return true;
        } catch (err) {
            return false;
        }
    }
}

export { Storage, NodeType, getExtension, identify };

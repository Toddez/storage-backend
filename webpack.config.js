const path = require('path');
let nodeExternals = require('webpack-node-externals');

module.exports = {
    entry: path.resolve(__dirname, 'src/server.js'),
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: 'bundle.js'
    },
    target: 'node',
    externals: [nodeExternals()],
};

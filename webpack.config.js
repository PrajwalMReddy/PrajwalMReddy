const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = {
    entry: './src/index.js',
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: 'bundle.js',
        publicPath: '/', // important for routing
    },
    resolve: {
        alias: {
            '@public': path.resolve(__dirname, 'public'),
        },
        extensions: ['.js', '.jsx', '.json'], // ensure JSX files are handled
    },
    module: {
        rules: [
            {
                test: /\.jsx?$/, // .js and .jsx files
                exclude: /node_modules/,
                use: {
                    loader: 'babel-loader',
                },
            },
            {
                test: /\.(png|jpe?g|gif|svg)$/i,
                type: 'asset/resource',
                generator: {
                    filename: 'assets/images/[name][ext]', // ensure image output path
                },
            },
            {
                test: /\.css$/i,
                use: ['style-loader', 'css-loader'],
            },
        ],
    },
    plugins: [
        new HtmlWebpackPlugin({
            template: './public/index.html',
        }),
        new CopyPlugin({
            patterns: [
                {
                    from: path.resolve(__dirname, 'public/manifest.json'),
                    to: 'manifest.json',
                    noErrorOnMissing: true,
                },
                {
                    from: path.resolve(__dirname, 'public/sw.js'),
                    to: 'sw.js',
                    noErrorOnMissing: true,
                },
                {
                    from: path.resolve(__dirname, 'public/icons'),
                    to: 'icons',
                    noErrorOnMissing: true,
                },
                {
                    from: path.resolve(__dirname, 'public/hurricane.ico'),
                    to: 'hurricane.ico',
                    noErrorOnMissing: true,
                },
                {
                    from: path.resolve(__dirname, 'public/hurricane.png'),
                    to: 'hurricane.png',
                    noErrorOnMissing: true,
                },
            ],
        }),
    ],
    devServer: {
        historyApiFallback: true,
        static: {
            directory: path.resolve(__dirname, 'public'),
            watch: false,
        },
        proxy: [
            {
                context: ['/api'],
                target: 'http://localhost:3000',
                changeOrigin: true,
            },
        ],
    },
    mode: 'production',
};


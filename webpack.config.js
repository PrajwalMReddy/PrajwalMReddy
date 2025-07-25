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
        // No longer using @img alias; all images are in /src/content/img or /src/content/photography
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
                    from: path.resolve(__dirname, 'src/content/blog'),
                    to: 'blog',
                },
                {
                    from: path.resolve(__dirname, 'src/content/research'),
                    to: 'research',
                },
                {
                    from: path.resolve(__dirname, 'src/content/photography'),
                    to: 'photography',
                },
                {
                    from: path.resolve(__dirname, 'src/content/img'),
                    to: 'img',
                },
            ],
        }),
    ],
    devServer: {
        historyApiFallback: true,
    },
    mode: 'production',
};

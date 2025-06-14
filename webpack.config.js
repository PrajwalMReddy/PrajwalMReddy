const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = (env, argv) => {
    const isProduction = argv.mode === 'production';
    const isServeDist = process.env.SERVE_DIST === 'true';

    return {
        entry: './src/index.js',
        output: {
            path: path.resolve(__dirname, 'dist'),
            filename: 'bundle.js',
            publicPath: isServeDist ? './' : (isProduction ? '/' : '/'),
            clean: true // Clean the output directory before emit
        },
        module: {
            rules: [
                {
                    test: /\.(js|jsx)$/,
                    exclude: /node_modules/,
                    use: {
                        loader: 'babel-loader',
                        options: {
                            presets: ['@babel/preset-env', '@babel/preset-react']
                        }
                    }
                },
                {
                    test: /\.css$/,
                    use: ['style-loader', 'css-loader']
                },
                {
                    test: /\.(png|svg|jpg|jpeg|gif|ico)$/i,
                    type: 'asset/resource',
                    generator: {
                        filename: 'assets/images/[name][ext]'
                    }
                }
            ]
        },
        resolve: {
            extensions: ['.js', '.jsx'],
            alias: {
                '@img': path.resolve(__dirname, 'src/assets/img'),
                '@favicon': path.resolve(__dirname, 'src/assets/favicon')
            }
        },
        plugins: [
            new HtmlWebpackPlugin({
                template: './public/index.html',
                favicon: './src/assets/favicon/hurricane.ico',
                inject: true,
                minify: isProduction ? {
                    removeComments: true,
                    collapseWhitespace: true,
                    removeRedundantAttributes: true,
                    useShortDoctype: true,
                    removeEmptyAttributes: true,
                    removeStyleLinkTypeAttributes: true,
                    keepClosingSlash: true,
                    minifyJS: true,
                    minifyCSS: true,
                    minifyURLs: true
                } : false,
                base: isServeDist ? './' : undefined
            }),
            new CopyWebpackPlugin({
                patterns: [
                    {
                        from: 'src/assets/img',
                        to: 'assets/images'
                    }
                ]
            })
        ],
        devServer: {
            historyApiFallback: {
                disableDotRule: true,
                rewrites: [
                    {from: /^\/$/, to: '/index.html'},
                    {from: /./, to: '/index.html'}
                ]
            },
            static: {
                directory: path.join(__dirname, 'public'),
                publicPath: '/'
            },
            port: 3000,
            hot: true,
            open: true,
            client: {
                overlay: true,
                progress: true
            }
        }
    };
}; 
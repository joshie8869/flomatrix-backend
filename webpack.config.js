const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const CopyPlugin = require("copy-webpack-plugin");

module.exports = {
  entry: {
    index: "./src/index.ts",
    chart: "./src/pages/chart.ts"
  },

  output: {
    filename: "[name].bundle.js",
    path: path.resolve(__dirname, "dist"),
    clean: true
  },

  resolve: {
    extensions: [".ts", ".js"],
    alias: {
      "@core": path.resolve(__dirname, "src/core"),
      "@render": path.resolve(__dirname, "src/render"),
      "@utils": path.resolve(__dirname, "src/utils"),
      "@shaders": path.resolve(__dirname, "src/shaders")
    }
  },

  module: {
    rules: [
      {
        test: /\.ts$/,
        use: "ts-loader",
        exclude: /node_modules/
      }
    ]
  },

  plugins: [
    new HtmlWebpackPlugin({
      template: "public/index.html",
      chunks: ["index"],
      filename: "index.html"
    }),

    new HtmlWebpackPlugin({
      template: "public/chart.html",
      chunks: ["chart"],
      filename: "chart.html"
    }),

    new CopyPlugin({
      patterns: [
        { from: "public/assets", to: "assets" }
      ]
    })
  ],

  devServer: {
    static: { directory: path.join(__dirname, "dist") },
    compress: true,
    port: 8080,
    hot: true,
    open: true
  }
};

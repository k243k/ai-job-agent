import CopyPlugin from "copy-webpack-plugin";

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["pdf-parse"],
  },
  webpack: (config, { isServer }) => {
    // @react-pdf/renderer はクライアントのみで使用。
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        stream: false,
        zlib: false,
        util: false,
        buffer: false,
      };
    }
    // PDFKit の AFM フォントデータをバンドルに含める
    if (isServer) {
      config.plugins.push(
        new CopyPlugin({
          patterns: [
            {
              from: "node_modules/pdfkit/js/data",
              to: "vendor-chunks/data",
            },
          ],
        })
      );
    }
    return config;
  },
};

export default nextConfig;

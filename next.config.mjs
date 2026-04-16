import CopyPlugin from "copy-webpack-plugin";

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["pdf-parse"],
    outputFileTracingIncludes: {
      "/api/documents/pdf": ["./public/fonts/**/*"],
    },
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
    // PDFKit の AFM フォントデータを各API Routeのチャンク出力先にコピー
    if (isServer) {
      config.plugins.push(
        new CopyPlugin({
          patterns: [
            {
              from: "node_modules/pdfkit/js/data",
              to: "app/api/documents/pdf/data",
            },
          ],
        })
      );
    }
    return config;
  },
};

export default nextConfig;

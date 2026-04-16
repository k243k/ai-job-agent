import CopyPlugin from "copy-webpack-plugin";
import path from "path";

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["pdf-parse"],
    // Vercelでフォントファイルをサーバーレス関数にバンドルする
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
    // PDFKit の AFM フォントデータをサーバーバンドルに含める
    if (isServer) {
      config.plugins.push(
        new CopyPlugin({
          patterns: [
            {
              from: "node_modules/pdfkit/js/data",
              to: path.join(config.output.path, "data"),
            },
          ],
        })
      );
    }
    return config;
  },
};

export default nextConfig;

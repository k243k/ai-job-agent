import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI転職エージェント",
  description: "AIがあなたの転職を完全サポート。ヒアリングから応募管理まで。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className="h-full">
      <body className="min-h-full flex flex-col bg-white text-gray-900 antialiased">
        {children}
      </body>
    </html>
  );
}

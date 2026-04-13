import Link from "next/link";

const features = [
  {
    title: "AIヒアリング",
    description: "自然な会話であなたのスキル・経験・希望を深掘りします。",
    icon: "1",
  },
  {
    title: "求人マッチング",
    description: "AIがあなたのプロフィールに最適な求人をスコアリング。",
    icon: "2",
  },
  {
    title: "書類自動生成",
    description: "履歴書・職務経歴書・志望動機をAIが作成します。",
    icon: "3",
  },
  {
    title: "面接対策",
    description: "想定質問と模擬面接でAIが徹底サポート。",
    icon: "4",
  },
  {
    title: "応募管理",
    description: "応募状況をテーブル形式で一元管理。",
    icon: "5",
  },
  {
    title: "完全無料",
    description: "全機能を無料でご利用いただけます。",
    icon: "6",
  },
];

export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <header className="border-b bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-xl font-bold text-blue-600">AI転職エージェント</h1>
          <div className="flex gap-4">
            <Link
              href="/login"
              className="text-sm text-gray-600 hover:text-gray-900 py-2 px-4"
            >
              ログイン
            </Link>
            <Link
              href="/signup"
              className="text-sm bg-blue-600 text-white rounded-lg py-2 px-4 hover:bg-blue-700"
            >
              無料で始める
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="flex-1 flex items-center justify-center bg-gradient-to-b from-blue-50 to-white py-20">
        <div className="max-w-4xl mx-auto text-center px-4">
          <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-6">
            AIがあなたの転職を
            <br />
            <span className="text-blue-600">完全サポート</span>
          </h2>
          <p className="text-lg text-gray-600 mb-8 max-w-2xl mx-auto">
            ヒアリングから求人マッチング、書類作成、面接対策、応募管理まで。
            AIエージェントがあなたの転職活動を一気通貫でサポートします。
          </p>
          <Link
            href="/signup"
            className="inline-block bg-blue-600 text-white text-lg font-semibold rounded-lg py-3 px-8 hover:bg-blue-700 transition-colors"
          >
            無料で始める
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h3 className="text-3xl font-bold text-center text-gray-900 mb-12">
            6つのフェーズで転職を完全サポート
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="border rounded-xl p-6 hover:shadow-lg transition-shadow"
              >
                <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold text-lg mb-4">
                  {feature.icon}
                </div>
                <h4 className="text-xl font-semibold mb-2">{feature.title}</h4>
                <p className="text-gray-600">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 text-center text-sm text-gray-500">
          &copy; 2026 AI転職エージェント. All rights reserved.
        </div>
      </footer>
    </div>
  );
}

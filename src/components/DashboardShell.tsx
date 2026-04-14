"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const navItems = [
  { href: "/profile", label: "プロフィール" },
  { href: "/profile/upload", label: "履歴書アップロード" },
  { href: "/hearing", label: "ヒアリング" },
  { href: "/jobs", label: "求人一覧" },
  { href: "/documents", label: "書類作成" },
  { href: "/interview", label: "面接対策" },
  { href: "/applications", label: "応募管理" },
];

interface DashboardShellProps {
  children: React.ReactNode;
  userEmail: string;
}

export default function DashboardShell({ children, userEmail }: DashboardShellProps) {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-64 bg-gray-900 text-white flex flex-col">
        <div className="p-4 border-b border-gray-700">
          <Link href="/hearing" className="text-lg font-bold text-blue-400">
            AI転職エージェント
          </Link>
        </div>
        <nav className="flex-1 py-4">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`block px-4 py-3 text-sm transition-colors ${
                pathname === item.href
                  ? "bg-gray-800 text-white border-r-2 border-blue-400"
                  : "text-gray-400 hover:text-white hover:bg-gray-800"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="p-4 border-t border-gray-700">
          <p className="text-xs text-gray-400 truncate mb-2">{userEmail}</p>
          <button
            onClick={handleLogout}
            className="text-sm text-gray-400 hover:text-white transition-colors"
          >
            ログアウト
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 bg-gray-50 overflow-auto">
        <div className="p-6">{children}</div>
      </main>
    </div>
  );
}

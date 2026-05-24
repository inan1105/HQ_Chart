"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/", label: "대시보드", icon: "📊" },
  { href: "/chart", label: "차트", icon: "📈" },
  { href: "/signals", label: "매매신호", icon: "🔔" },
  { href: "/backtest", label: "백테스팅", icon: "🧪" },
  { href: "/portfolio", label: "포트폴리오", icon: "💼" },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-56 bg-panel border-r border-border flex flex-col shrink-0">
      <div className="p-4 border-b border-border">
        <h1 className="text-lg font-bold tracking-tight">TradingMVP</h1>
        <p className="text-xs text-gray-500 mt-0.5">종합 트레이딩 플랫폼</p>
      </div>
      <nav className="flex-1 p-2 space-y-0.5">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                active
                  ? "bg-blue-600/20 text-blue-400"
                  : "text-gray-400 hover:bg-gray-800 hover:text-gray-200"
              }`}
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="p-3 border-t border-border text-xs text-gray-600">
        v0.1.0 MVP
      </div>
    </aside>
  );
}

"use client";

import { useEffect, useState } from "react";
import { fetchHistory } from "@/lib/api";
import { detectSignals } from "@/lib/signals";
import { OHLCV, Signal } from "@/types";
import ChartWidget from "@/components/ChartWidget";
import Link from "next/link";

const WATCHLIST = [
  { code: "005930", name: "삼성전자", market: "kospi" },
  { code: "000660", name: "SK하이닉스", market: "kospi" },
  { code: "128820", name: "대성엘텍", market: "kospi" },
  { code: "035420", name: "NAVER", market: "kospi" },
];

export default function Dashboard() {
  const [data, setData] = useState<OHLCV[]>([]);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [selected, setSelected] = useState(WATCHLIST[0]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchHistory(selected.market, "d", selected.code, 200)
      .then((d) => {
        setData(d);
        setSignals(detectSignals(d));
      })
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, [selected]);

  const latest = data.length > 0 ? data[data.length - 1] : null;
  const prev = data.length > 1 ? data[data.length - 2] : null;
  const change = latest && prev ? ((latest.close - prev.close) / prev.close) * 100 : 0;

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h2 className="text-2xl font-bold">대시보드</h2>
        <p className="text-sm text-gray-500 mt-1">관심종목 현황과 최신 매매신호를 한눈에 확인하세요.</p>
      </div>

      <div className="grid grid-cols-4 gap-3">
        {WATCHLIST.map((stock) => (
          <button
            key={stock.code}
            onClick={() => setSelected(stock)}
            className={`p-3 rounded-lg border text-left transition-colors ${
              selected.code === stock.code
                ? "border-blue-500 bg-blue-600/10"
                : "border-border bg-panel hover:border-gray-500"
            }`}
          >
            <div className="text-sm font-medium">{stock.name}</div>
            <div className="text-xs text-gray-500">{stock.code}</div>
          </button>
        ))}
      </div>

      {latest && (
        <div className="grid grid-cols-4 gap-3">
          <Stat label="현재가" value={latest.close.toLocaleString()} suffix="원" />
          <Stat
            label="등락률"
            value={`${change >= 0 ? "+" : ""}${change.toFixed(2)}%`}
            color={change >= 0 ? "text-up" : "text-down"}
          />
          <Stat label="거래량" value={latest.volume.toLocaleString()} />
          <Stat label="감지 신호" value={String(signals.length)} suffix="건" />
        </div>
      )}

      <div className="bg-panel rounded-lg border border-border p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">
            {selected.name} ({selected.code})
          </h3>
          <Link href="/chart" className="text-xs text-blue-400 hover:underline">
            상세 차트 보기
          </Link>
        </div>
        {loading ? (
          <div className="flex items-center justify-center h-64 text-gray-500">로딩 중...</div>
        ) : (
          <ChartWidget data={data} height={350} />
        )}
      </div>

      {signals.length > 0 && (
        <div className="bg-panel rounded-lg border border-border p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">최근 매매 신호</h3>
            <Link href="/signals" className="text-xs text-blue-400 hover:underline">
              전체 보기
            </Link>
          </div>
          <div className="space-y-2">
            {signals.slice(0, 5).map((sig, i) => (
              <div
                key={i}
                className="flex items-center gap-3 p-2 rounded bg-surface text-sm"
              >
                <span
                  className={`px-2 py-0.5 rounded text-xs font-medium ${
                    sig.type === "buy" ? "bg-red-900/50 text-red-400" : "bg-blue-900/50 text-blue-400"
                  }`}
                >
                  {sig.type === "buy" ? "매수" : "매도"}
                </span>
                <span className="text-gray-400 text-xs">{sig.date}</span>
                <span className="font-medium">{sig.strategy}</span>
                <span className="text-gray-500 text-xs ml-auto">{sig.reason}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  suffix,
  color,
}: {
  label: string;
  value: string;
  suffix?: string;
  color?: string;
}) {
  return (
    <div className="bg-panel rounded-lg border border-border p-3">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className={`text-lg font-semibold ${color || ""}`}>
        {value}
        {suffix && <span className="text-xs text-gray-500 ml-1">{suffix}</span>}
      </div>
    </div>
  );
}

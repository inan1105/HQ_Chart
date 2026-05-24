"use client";

import { useEffect, useState } from "react";
import { fetchHistory } from "@/lib/api";
import { detectSignals } from "@/lib/signals";
import { OHLCV, Signal } from "@/types";
import StockForm from "@/components/StockForm";

export default function SignalsPage() {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [loading, setLoading] = useState(false);
  const [params, setParams] = useState({
    market: "kospi",
    period: "d",
    code: "128820",
    limit: 200,
  });

  const load = (market: string, period: string, code: string, limit: number) => {
    setParams({ market, period, code, limit });
    setLoading(true);
    fetchHistory(market, period, code, limit)
      .then((data) => setSignals(detectSignals(data)))
      .catch(() => setSignals([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load(params.market, params.period, params.code, params.limit);
  }, []);

  return (
    <div className="space-y-4 max-w-4xl">
      <div>
        <h2 className="text-2xl font-bold">매매 신호</h2>
        <p className="text-sm text-gray-500 mt-1">
          MA 크로스, MACD, RSI, 볼린저밴드 기반 자동 감지
        </p>
      </div>

      <div className="bg-panel rounded-lg border border-border p-4">
        <StockForm {...params} onSubmit={load} loading={loading} />
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40 text-gray-500">분석 중...</div>
      ) : signals.length === 0 ? (
        <div className="bg-panel rounded-lg border border-border p-8 text-center text-gray-500">
          최근 10일 내 감지된 매매 신호가 없습니다.
        </div>
      ) : (
        <div className="space-y-2">
          {signals.map((sig, i) => (
            <div
              key={i}
              className="bg-panel rounded-lg border border-border p-4 flex items-start gap-4"
            >
              <div
                className={`shrink-0 w-14 text-center py-1 rounded text-sm font-bold ${
                  sig.type === "buy"
                    ? "bg-red-900/40 text-red-400 border border-red-800"
                    : "bg-blue-900/40 text-blue-400 border border-blue-800"
                }`}
              >
                {sig.type === "buy" ? "매수" : "매도"}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{sig.strategy}</span>
                  <span
                    className={`text-xs px-1.5 py-0.5 rounded ${
                      sig.strength === "strong"
                        ? "bg-yellow-900/40 text-yellow-400"
                        : sig.strength === "moderate"
                        ? "bg-gray-800 text-gray-400"
                        : "bg-gray-900 text-gray-600"
                    }`}
                  >
                    {sig.strength === "strong" ? "강력" : sig.strength === "moderate" ? "보통" : "약함"}
                  </span>
                </div>
                <p className="text-sm text-gray-400 mt-1">{sig.reason}</p>
              </div>
              <div className="text-right shrink-0">
                <div className="text-sm font-medium">{sig.price.toLocaleString()}원</div>
                <div className="text-xs text-gray-500">{sig.date}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

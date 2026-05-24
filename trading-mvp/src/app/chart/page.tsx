"use client";

import { useEffect, useState } from "react";
import { fetchHistory } from "@/lib/api";
import { OHLCV } from "@/types";
import { rsi, macd } from "@/lib/indicators";
import ChartWidget from "@/components/ChartWidget";
import StockForm from "@/components/StockForm";

export default function ChartPage() {
  const [data, setData] = useState<OHLCV[]>([]);
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
      .then(setData)
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load(params.market, params.period, params.code, params.limit);
  }, []);

  const closes = data.map((d) => d.close);
  const rsiValues = rsi(closes, 14);
  const macdValues = macd(closes, 12, 26, 9);

  const latestRSI = [...rsiValues].reverse().find((v) => !isNaN(v));
  const latestMACD = [...macdValues.macd].reverse().find((v) => !isNaN(v));
  const latestSignal = [...macdValues.signal].reverse().find((v) => !isNaN(v));

  return (
    <div className="space-y-4 max-w-6xl">
      <h2 className="text-2xl font-bold">차트 분석</h2>

      <div className="bg-panel rounded-lg border border-border p-4">
        <StockForm {...params} onSubmit={load} loading={loading} />
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-96 bg-panel rounded-lg border border-border text-gray-500">
          로딩 중...
        </div>
      ) : (
        <>
          <div className="bg-panel rounded-lg border border-border p-4">
            <ChartWidget data={data} height={450} />
          </div>

          {data.length > 0 && (
            <div className="grid grid-cols-3 gap-3">
              <IndicatorCard
                title="RSI (14)"
                value={latestRSI?.toFixed(1) ?? "-"}
                status={
                  latestRSI === undefined
                    ? "neutral"
                    : latestRSI > 70
                    ? "overbought"
                    : latestRSI < 30
                    ? "oversold"
                    : "neutral"
                }
              />
              <IndicatorCard
                title="MACD"
                value={latestMACD?.toFixed(2) ?? "-"}
                status={
                  latestMACD === undefined || latestSignal === undefined
                    ? "neutral"
                    : latestMACD > latestSignal
                    ? "bullish"
                    : "bearish"
                }
              />
              <IndicatorCard
                title="거래량"
                value={data.length > 0 ? data[data.length - 1].volume.toLocaleString() : "-"}
                status="neutral"
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}

function IndicatorCard({
  title,
  value,
  status,
}: {
  title: string;
  value: string;
  status: "overbought" | "oversold" | "bullish" | "bearish" | "neutral";
}) {
  const statusMap = {
    overbought: { label: "과매수", color: "text-red-400 bg-red-900/30" },
    oversold: { label: "과매도", color: "text-blue-400 bg-blue-900/30" },
    bullish: { label: "상승세", color: "text-red-400 bg-red-900/30" },
    bearish: { label: "하락세", color: "text-blue-400 bg-blue-900/30" },
    neutral: { label: "중립", color: "text-gray-400 bg-gray-800" },
  };
  const s = statusMap[status];

  return (
    <div className="bg-panel rounded-lg border border-border p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-gray-400">{title}</span>
        <span className={`text-xs px-2 py-0.5 rounded ${s.color}`}>{s.label}</span>
      </div>
      <div className="text-xl font-bold">{value}</div>
    </div>
  );
}

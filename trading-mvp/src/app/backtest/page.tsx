"use client";

import { useState } from "react";
import { fetchHistory } from "@/lib/api";
import { runBacktest } from "@/lib/backtest";
import { BacktestConfig, BacktestResult, Strategy } from "@/types";

const STRATEGIES: { value: Strategy; label: string; description: string }[] = [
  { value: "ma_crossover", label: "이동평균 교차", description: "단기 MA가 장기 MA를 교차할 때 매매" },
  { value: "macd_crossover", label: "MACD 교차", description: "MACD선이 시그널선을 교차할 때 매매" },
  { value: "rsi_oversold", label: "RSI 과매도/과매수", description: "RSI가 과매도/과매수 구간을 벗어날 때 매매" },
  { value: "bollinger_bounce", label: "볼린저밴드 반등", description: "주가가 볼린저 밴드에 닿으면 매매" },
];

export default function BacktestPage() {
  const [config, setConfig] = useState<BacktestConfig>({
    strategy: "ma_crossover",
    initialCapital: 10_000_000,
    commission: 0.00015,
    params: { fast: 5, slow: 20 },
  });
  const [stockParams, setStockParams] = useState({
    market: "kospi",
    period: "d",
    code: "128820",
    limit: 500,
  });
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [loading, setLoading] = useState(false);

  const handleRun = async () => {
    setLoading(true);
    try {
      const data = await fetchHistory(stockParams.market, stockParams.period, stockParams.code, stockParams.limit);
      const res = runBacktest(data, config);
      setResult(res);
    } catch {
      setResult(null);
    }
    setLoading(false);
  };

  return (
    <div className="space-y-4 max-w-5xl">
      <div>
        <h2 className="text-2xl font-bold">백테스팅</h2>
        <p className="text-sm text-gray-500 mt-1">과거 데이터로 매매 전략을 시뮬레이션합니다.</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-panel rounded-lg border border-border p-4 space-y-3">
          <h3 className="font-semibold text-sm">종목 설정</h3>
          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1 text-xs text-gray-400">
              시장
              <select
                value={stockParams.market}
                onChange={(e) => setStockParams((s) => ({ ...s, market: e.target.value }))}
                className="bg-surface border border-border rounded px-2 py-1.5 text-sm text-gray-200"
              >
                <option value="kospi">KOSPI</option>
                <option value="kosdaq">KOSDAQ</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-gray-400">
              주기
              <select
                value={stockParams.period}
                onChange={(e) => setStockParams((s) => ({ ...s, period: e.target.value }))}
                className="bg-surface border border-border rounded px-2 py-1.5 text-sm text-gray-200"
              >
                <option value="d">일간</option>
                <option value="w">주간</option>
                <option value="m">월간</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-gray-400">
              종목코드
              <input
                value={stockParams.code}
                onChange={(e) => setStockParams((s) => ({ ...s, code: e.target.value }))}
                maxLength={6}
                className="bg-surface border border-border rounded px-2 py-1.5 text-sm text-gray-200"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-gray-400">
              데이터 수
              <input
                type="number"
                value={stockParams.limit}
                onChange={(e) => setStockParams((s) => ({ ...s, limit: Number(e.target.value) }))}
                min={50}
                max={1000}
                className="bg-surface border border-border rounded px-2 py-1.5 text-sm text-gray-200"
              />
            </label>
          </div>
        </div>

        <div className="bg-panel rounded-lg border border-border p-4 space-y-3">
          <h3 className="font-semibold text-sm">전략 설정</h3>
          <div className="space-y-2">
            {STRATEGIES.map((s) => (
              <label
                key={s.value}
                className={`flex items-start gap-2 p-2 rounded border cursor-pointer transition-colors ${
                  config.strategy === s.value
                    ? "border-blue-500 bg-blue-600/10"
                    : "border-border hover:border-gray-500"
                }`}
              >
                <input
                  type="radio"
                  name="strategy"
                  value={s.value}
                  checked={config.strategy === s.value}
                  onChange={() => setConfig((c) => ({ ...c, strategy: s.value }))}
                  className="mt-0.5"
                />
                <div>
                  <div className="text-sm font-medium">{s.label}</div>
                  <div className="text-xs text-gray-500">{s.description}</div>
                </div>
              </label>
            ))}
          </div>

          <label className="flex flex-col gap-1 text-xs text-gray-400">
            초기 자본금
            <input
              type="number"
              value={config.initialCapital}
              onChange={(e) => setConfig((c) => ({ ...c, initialCapital: Number(e.target.value) }))}
              className="bg-surface border border-border rounded px-2 py-1.5 text-sm text-gray-200"
            />
          </label>

          <button
            onClick={handleRun}
            disabled={loading}
            className="w-full py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 rounded font-medium text-sm transition-colors"
          >
            {loading ? "시뮬레이션 중..." : "백테스트 실행"}
          </button>
        </div>
      </div>

      {result && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <MetricCard
              label="총 수익률"
              value={`${result.totalReturn >= 0 ? "+" : ""}${result.totalReturn.toFixed(2)}%`}
              color={result.totalReturn >= 0 ? "text-up" : "text-down"}
            />
            <MetricCard label="승률" value={`${result.winRate.toFixed(1)}%`} />
            <MetricCard label="총 거래 수" value={String(result.totalTrades)} />
            <MetricCard label="최대 낙폭" value={`-${result.maxDrawdown.toFixed(2)}%`} color="text-down" />
            <MetricCard label="샤프 비율" value={result.sharpeRatio.toFixed(2)} />
            <MetricCard
              label="수익 팩터"
              value={result.profitFactor === Infinity ? "Inf" : result.profitFactor.toFixed(2)}
            />
          </div>

          {result.trades.length > 0 && (
            <div className="bg-panel rounded-lg border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-gray-400 text-xs">
                    <th className="text-left p-3">진입일</th>
                    <th className="text-left p-3">청산일</th>
                    <th className="text-right p-3">진입가</th>
                    <th className="text-right p-3">청산가</th>
                    <th className="text-right p-3">수익률</th>
                  </tr>
                </thead>
                <tbody>
                  {result.trades.map((t, i) => (
                    <tr key={i} className="border-b border-border/50 hover:bg-surface/50">
                      <td className="p-3">{t.entryDate}</td>
                      <td className="p-3">{t.exitDate}</td>
                      <td className="p-3 text-right">{t.entryPrice.toLocaleString()}</td>
                      <td className="p-3 text-right">{t.exitPrice.toLocaleString()}</td>
                      <td
                        className={`p-3 text-right font-medium ${
                          t.returnPct >= 0 ? "text-up" : "text-down"
                        }`}
                      >
                        {t.returnPct >= 0 ? "+" : ""}
                        {t.returnPct.toFixed(2)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MetricCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="bg-panel rounded-lg border border-border p-4">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className={`text-xl font-bold ${color || ""}`}>{value}</div>
    </div>
  );
}

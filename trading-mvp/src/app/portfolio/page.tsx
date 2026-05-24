"use client";

import { useState } from "react";
import { PortfolioItem } from "@/types";

const INITIAL_PORTFOLIO: PortfolioItem[] = [
  { id: "1", code: "005930", name: "삼성전자", market: "kospi", quantity: 10, avgPrice: 72000, currentPrice: 72000 },
  { id: "2", code: "000660", name: "SK하이닉스", market: "kospi", quantity: 5, avgPrice: 180000, currentPrice: 180000 },
];

export default function PortfolioPage() {
  const [items, setItems] = useState<PortfolioItem[]>(INITIAL_PORTFOLIO);
  const [showAdd, setShowAdd] = useState(false);

  const totalInvested = items.reduce((sum, i) => sum + i.avgPrice * i.quantity, 0);
  const totalCurrent = items.reduce((sum, i) => sum + i.currentPrice * i.quantity, 0);
  const totalPnL = totalCurrent - totalInvested;
  const totalPnLPct = totalInvested > 0 ? (totalPnL / totalInvested) * 100 : 0;

  const handleAdd = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const newItem: PortfolioItem = {
      id: Date.now().toString(),
      code: fd.get("code") as string,
      name: fd.get("name") as string,
      market: fd.get("market") as "kospi" | "kosdaq",
      quantity: Number(fd.get("quantity")),
      avgPrice: Number(fd.get("avgPrice")),
      currentPrice: Number(fd.get("avgPrice")),
    };
    setItems((prev) => [...prev, newItem]);
    setShowAdd(false);
  };

  const handleRemove = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  return (
    <div className="space-y-4 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">포트폴리오</h2>
          <p className="text-sm text-gray-500 mt-1">보유 종목을 관리하고 손익을 추적합니다.</p>
        </div>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded text-sm font-medium transition-colors"
        >
          + 종목 추가
        </button>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <SummaryCard label="총 투자금" value={`${totalInvested.toLocaleString()}원`} />
        <SummaryCard label="총 평가금" value={`${totalCurrent.toLocaleString()}원`} />
        <SummaryCard
          label="총 손익"
          value={`${totalPnL >= 0 ? "+" : ""}${totalPnL.toLocaleString()}원`}
          color={totalPnL >= 0 ? "text-up" : "text-down"}
        />
        <SummaryCard
          label="수익률"
          value={`${totalPnLPct >= 0 ? "+" : ""}${totalPnLPct.toFixed(2)}%`}
          color={totalPnLPct >= 0 ? "text-up" : "text-down"}
        />
      </div>

      {showAdd && (
        <form
          onSubmit={handleAdd}
          className="bg-panel rounded-lg border border-border p-4 flex flex-wrap items-end gap-3"
        >
          <label className="flex flex-col gap-1 text-xs text-gray-400">
            종목명
            <input name="name" required className="bg-surface border border-border rounded px-2 py-1.5 text-sm text-gray-200 w-28" />
          </label>
          <label className="flex flex-col gap-1 text-xs text-gray-400">
            종목코드
            <input name="code" maxLength={6} required className="bg-surface border border-border rounded px-2 py-1.5 text-sm text-gray-200 w-24" />
          </label>
          <label className="flex flex-col gap-1 text-xs text-gray-400">
            시장
            <select name="market" className="bg-surface border border-border rounded px-2 py-1.5 text-sm text-gray-200">
              <option value="kospi">KOSPI</option>
              <option value="kosdaq">KOSDAQ</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-gray-400">
            수량
            <input name="quantity" type="number" min={1} required className="bg-surface border border-border rounded px-2 py-1.5 text-sm text-gray-200 w-20" />
          </label>
          <label className="flex flex-col gap-1 text-xs text-gray-400">
            평균매입가
            <input name="avgPrice" type="number" min={1} required className="bg-surface border border-border rounded px-2 py-1.5 text-sm text-gray-200 w-28" />
          </label>
          <button type="submit" className="px-4 py-1.5 bg-green-600 hover:bg-green-700 rounded text-sm font-medium transition-colors">
            추가
          </button>
          <button type="button" onClick={() => setShowAdd(false)} className="px-4 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-sm transition-colors">
            취소
          </button>
        </form>
      )}

      <div className="bg-panel rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-gray-400 text-xs">
              <th className="text-left p-3">종목</th>
              <th className="text-right p-3">수량</th>
              <th className="text-right p-3">평균매입가</th>
              <th className="text-right p-3">현재가</th>
              <th className="text-right p-3">평가금액</th>
              <th className="text-right p-3">손익</th>
              <th className="text-right p-3">수익률</th>
              <th className="text-center p-3"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const invested = item.avgPrice * item.quantity;
              const current = item.currentPrice * item.quantity;
              const pnl = current - invested;
              const pnlPct = invested > 0 ? (pnl / invested) * 100 : 0;
              return (
                <tr key={item.id} className="border-b border-border/50 hover:bg-surface/50">
                  <td className="p-3">
                    <div className="font-medium">{item.name}</div>
                    <div className="text-xs text-gray-500">{item.code}</div>
                  </td>
                  <td className="p-3 text-right">{item.quantity.toLocaleString()}</td>
                  <td className="p-3 text-right">{item.avgPrice.toLocaleString()}</td>
                  <td className="p-3 text-right">{item.currentPrice.toLocaleString()}</td>
                  <td className="p-3 text-right">{current.toLocaleString()}</td>
                  <td className={`p-3 text-right ${pnl >= 0 ? "text-up" : "text-down"}`}>
                    {pnl >= 0 ? "+" : ""}{pnl.toLocaleString()}
                  </td>
                  <td className={`p-3 text-right font-medium ${pnlPct >= 0 ? "text-up" : "text-down"}`}>
                    {pnlPct >= 0 ? "+" : ""}{pnlPct.toFixed(2)}%
                  </td>
                  <td className="p-3 text-center">
                    <button
                      onClick={() => handleRemove(item.id)}
                      className="text-gray-500 hover:text-red-400 text-xs transition-colors"
                    >
                      삭제
                    </button>
                  </td>
                </tr>
              );
            })}
            {items.length === 0 && (
              <tr>
                <td colSpan={8} className="p-8 text-center text-gray-500">
                  보유 종목이 없습니다. 위의 &quot;종목 추가&quot; 버튼으로 추가하세요.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="bg-panel rounded-lg border border-border p-3">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className={`text-lg font-semibold ${color || ""}`}>{value}</div>
    </div>
  );
}

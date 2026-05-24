"use client";

interface Props {
  market: string;
  period: string;
  code: string;
  limit: number;
  onSubmit: (market: string, period: string, code: string, limit: number) => void;
  loading?: boolean;
}

export default function StockForm({ market, period, code, limit, onSubmit, loading }: Props) {
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    onSubmit(
      fd.get("market") as string,
      fd.get("period") as string,
      fd.get("code") as string,
      Number(fd.get("limit"))
    );
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
      <label className="flex flex-col gap-1 text-xs text-gray-400">
        시장
        <select
          name="market"
          defaultValue={market}
          className="bg-panel border border-border rounded px-2.5 py-1.5 text-sm text-gray-200"
        >
          <option value="kospi">KOSPI</option>
          <option value="kosdaq">KOSDAQ</option>
        </select>
      </label>

      <label className="flex flex-col gap-1 text-xs text-gray-400">
        주기
        <select
          name="period"
          defaultValue={period}
          className="bg-panel border border-border rounded px-2.5 py-1.5 text-sm text-gray-200"
        >
          <option value="d">일간</option>
          <option value="w">주간</option>
          <option value="m">월간</option>
        </select>
      </label>

      <label className="flex flex-col gap-1 text-xs text-gray-400">
        종목코드
        <input
          name="code"
          defaultValue={code}
          maxLength={6}
          pattern="[A-Za-z0-9]{6}"
          required
          className="bg-panel border border-border rounded px-2.5 py-1.5 text-sm text-gray-200 w-24"
        />
      </label>

      <label className="flex flex-col gap-1 text-xs text-gray-400">
        데이터 수
        <input
          name="limit"
          type="number"
          defaultValue={limit}
          min={1}
          max={1000}
          required
          className="bg-panel border border-border rounded px-2.5 py-1.5 text-sm text-gray-200 w-20"
        />
      </label>

      <button
        type="submit"
        disabled={loading}
        className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-sm font-medium rounded transition-colors"
      >
        {loading ? "로딩..." : "조회"}
      </button>
    </form>
  );
}

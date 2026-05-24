import { OHLCV } from "@/types";

const API_BASE = "https://api.iamchart.com";

export async function fetchHistory(
  market: string,
  period: string,
  code: string,
  limit: number
): Promise<OHLCV[]> {
  const res = await fetch(
    `/api/history?market=${market}&period=${period}&code=${code}&limit=${limit}`
  );
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  const data = await res.json();
  return parseOHLCV(data);
}

function parseOHLCV(raw: string[][]): OHLCV[] {
  return raw
    .filter((row) => row.length >= 6)
    .map((row) => ({
      date: formatDate(row[0]),
      open: Number(row[1]),
      high: Number(row[2]),
      low: Number(row[3]),
      close: Number(row[4]),
      volume: Number(row[5]),
    }))
    .reverse();
}

function formatDate(raw: string): string {
  if (raw.length === 8) {
    return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
  }
  return raw;
}

export async function fetchHistoryServer(
  market: string,
  period: string,
  code: string,
  limit: number
): Promise<string[][]> {
  const url = `${API_BASE}/stock/${market}/${period}/${code}/${limit}`;
  const res = await fetch(url, { next: { revalidate: 60 } });
  if (!res.ok) throw new Error(`Upstream API error: ${res.status}`);
  return res.json();
}

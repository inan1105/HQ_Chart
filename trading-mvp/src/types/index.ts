export interface OHLCV {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface Signal {
  date: string;
  type: "buy" | "sell";
  strategy: string;
  price: number;
  reason: string;
  strength: "strong" | "moderate" | "weak";
}

export interface BacktestResult {
  trades: Trade[];
  totalReturn: number;
  winRate: number;
  maxDrawdown: number;
  sharpeRatio: number;
  totalTrades: number;
  profitFactor: number;
}

export interface Trade {
  entryDate: string;
  exitDate: string;
  entryPrice: number;
  exitPrice: number;
  returnPct: number;
  type: "long" | "short";
}

export interface PortfolioItem {
  id: string;
  code: string;
  name: string;
  market: "kospi" | "kosdaq";
  quantity: number;
  avgPrice: number;
  currentPrice: number;
}

export interface IndicatorValues {
  sma: Record<number, number[]>;
  ema: Record<number, number[]>;
  macd: { macd: number[]; signal: number[]; histogram: number[] };
  rsi: number[];
  bollingerBands: { upper: number[]; middle: number[]; lower: number[] };
}

export type Strategy = "ma_crossover" | "macd_crossover" | "rsi_oversold" | "bollinger_bounce";

export interface BacktestConfig {
  strategy: Strategy;
  initialCapital: number;
  commission: number;
  params: Record<string, number>;
}

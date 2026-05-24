import { OHLCV, BacktestConfig, BacktestResult, Trade, Strategy } from "@/types";
import { sma, ema, macd, rsi, bollingerBands } from "./indicators";

export function runBacktest(data: OHLCV[], config: BacktestConfig): BacktestResult {
  const closes = data.map((d) => d.close);
  const signals = generateStrategySignals(data, closes, config.strategy, config.params);
  const trades = executeTrades(data, signals, config.initialCapital, config.commission);
  return computeMetrics(trades, config.initialCapital);
}

type SignalAction = "buy" | "sell" | "hold";

function generateStrategySignals(
  data: OHLCV[],
  closes: number[],
  strategy: Strategy,
  params: Record<string, number>
): SignalAction[] {
  switch (strategy) {
    case "ma_crossover":
      return maCrossoverSignals(closes, params.fast || 5, params.slow || 20);
    case "macd_crossover":
      return macdCrossoverSignals(closes);
    case "rsi_oversold":
      return rsiSignals(closes, params.period || 14, params.oversold || 30, params.overbought || 70);
    case "bollinger_bounce":
      return bollingerSignals(closes, params.period || 20, params.stdDev || 2);
    default:
      return new Array(data.length).fill("hold");
  }
}

function maCrossoverSignals(closes: number[], fast: number, slow: number): SignalAction[] {
  const fastMA = sma(closes, fast);
  const slowMA = sma(closes, slow);
  const signals: SignalAction[] = new Array(closes.length).fill("hold");

  for (let i = 1; i < closes.length; i++) {
    if (isNaN(fastMA[i]) || isNaN(slowMA[i]) || isNaN(fastMA[i - 1]) || isNaN(slowMA[i - 1]))
      continue;
    if (fastMA[i - 1] <= slowMA[i - 1] && fastMA[i] > slowMA[i]) signals[i] = "buy";
    if (fastMA[i - 1] >= slowMA[i - 1] && fastMA[i] < slowMA[i]) signals[i] = "sell";
  }
  return signals;
}

function macdCrossoverSignals(closes: number[]): SignalAction[] {
  const { macd: macdLine, signal: signalLine } = macd(closes, 12, 26, 9);
  const signals: SignalAction[] = new Array(closes.length).fill("hold");

  for (let i = 1; i < closes.length; i++) {
    if (isNaN(macdLine[i]) || isNaN(signalLine[i]) || isNaN(macdLine[i - 1]) || isNaN(signalLine[i - 1]))
      continue;
    if (macdLine[i - 1] <= signalLine[i - 1] && macdLine[i] > signalLine[i]) signals[i] = "buy";
    if (macdLine[i - 1] >= signalLine[i - 1] && macdLine[i] < signalLine[i]) signals[i] = "sell";
  }
  return signals;
}

function rsiSignals(closes: number[], period: number, oversold: number, overbought: number): SignalAction[] {
  const rsiValues = rsi(closes, period);
  const signals: SignalAction[] = new Array(closes.length).fill("hold");

  for (let i = 1; i < closes.length; i++) {
    if (isNaN(rsiValues[i]) || isNaN(rsiValues[i - 1])) continue;
    if (rsiValues[i - 1] <= oversold && rsiValues[i] > oversold) signals[i] = "buy";
    if (rsiValues[i - 1] >= overbought && rsiValues[i] < overbought) signals[i] = "sell";
  }
  return signals;
}

function bollingerSignals(closes: number[], period: number, stdDev: number): SignalAction[] {
  const { upper, lower } = bollingerBands(closes, period, stdDev);
  const signals: SignalAction[] = new Array(closes.length).fill("hold");

  for (let i = 1; i < closes.length; i++) {
    if (isNaN(upper[i]) || isNaN(lower[i])) continue;
    if (closes[i - 1] <= lower[i - 1] && closes[i] > lower[i]) signals[i] = "buy";
    if (closes[i - 1] >= upper[i - 1] && closes[i] < upper[i]) signals[i] = "sell";
  }
  return signals;
}

function executeTrades(
  data: OHLCV[],
  signals: SignalAction[],
  capital: number,
  commission: number
): Trade[] {
  const trades: Trade[] = [];
  let inPosition = false;
  let entryIdx = 0;

  for (let i = 0; i < signals.length; i++) {
    if (signals[i] === "buy" && !inPosition) {
      inPosition = true;
      entryIdx = i;
    } else if (signals[i] === "sell" && inPosition) {
      inPosition = false;
      const entry = data[entryIdx].close * (1 + commission);
      const exit = data[i].close * (1 - commission);
      trades.push({
        entryDate: data[entryIdx].date,
        exitDate: data[i].date,
        entryPrice: data[entryIdx].close,
        exitPrice: data[i].close,
        returnPct: ((exit - entry) / entry) * 100,
        type: "long",
      });
    }
  }
  return trades;
}

function computeMetrics(trades: Trade[], initialCapital: number): BacktestResult {
  if (trades.length === 0) {
    return {
      trades: [],
      totalReturn: 0,
      winRate: 0,
      maxDrawdown: 0,
      sharpeRatio: 0,
      totalTrades: 0,
      profitFactor: 0,
    };
  }

  const wins = trades.filter((t) => t.returnPct > 0);
  const losses = trades.filter((t) => t.returnPct <= 0);
  const winRate = (wins.length / trades.length) * 100;

  let equity = initialCapital;
  let peak = equity;
  let maxDrawdown = 0;
  const returns: number[] = [];

  for (const trade of trades) {
    const pnl = equity * (trade.returnPct / 100);
    equity += pnl;
    returns.push(trade.returnPct);
    if (equity > peak) peak = equity;
    const dd = ((peak - equity) / peak) * 100;
    if (dd > maxDrawdown) maxDrawdown = dd;
  }

  const totalReturn = ((equity - initialCapital) / initialCapital) * 100;

  const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
  const stdReturn = Math.sqrt(
    returns.reduce((sum, r) => sum + (r - avgReturn) ** 2, 0) / returns.length
  );
  const sharpeRatio = stdReturn === 0 ? 0 : (avgReturn / stdReturn) * Math.sqrt(252);

  const grossProfit = wins.reduce((sum, t) => sum + t.returnPct, 0);
  const grossLoss = Math.abs(losses.reduce((sum, t) => sum + t.returnPct, 0));
  const profitFactor = grossLoss === 0 ? grossProfit > 0 ? Infinity : 0 : grossProfit / grossLoss;

  return {
    trades,
    totalReturn,
    winRate,
    maxDrawdown,
    sharpeRatio,
    totalTrades: trades.length,
    profitFactor,
  };
}

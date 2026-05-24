import { OHLCV, Signal } from "@/types";
import { sma, macd, rsi, bollingerBands } from "./indicators";

export function detectSignals(data: OHLCV[]): Signal[] {
  const closes = data.map((d) => d.close);
  const signals: Signal[] = [];

  signals.push(...detectMACrossover(data, closes));
  signals.push(...detectMACDSignals(data, closes));
  signals.push(...detectRSISignals(data, closes));
  signals.push(...detectBollingerSignals(data, closes));

  signals.sort((a, b) => b.date.localeCompare(a.date));
  return signals;
}

function detectMACrossover(data: OHLCV[], closes: number[]): Signal[] {
  const ma5 = sma(closes, 5);
  const ma20 = sma(closes, 20);
  const signals: Signal[] = [];
  const recent = Math.max(0, closes.length - 10);

  for (let i = Math.max(1, recent); i < closes.length; i++) {
    if (isNaN(ma5[i]) || isNaN(ma20[i]) || isNaN(ma5[i - 1]) || isNaN(ma20[i - 1])) continue;

    if (ma5[i - 1] <= ma20[i - 1] && ma5[i] > ma20[i]) {
      signals.push({
        date: data[i].date,
        type: "buy",
        strategy: "MA 골든크로스",
        price: data[i].close,
        reason: "5일 이동평균선이 20일선을 상향 돌파",
        strength: "strong",
      });
    }
    if (ma5[i - 1] >= ma20[i - 1] && ma5[i] < ma20[i]) {
      signals.push({
        date: data[i].date,
        type: "sell",
        strategy: "MA 데드크로스",
        price: data[i].close,
        reason: "5일 이동평균선이 20일선을 하향 돌파",
        strength: "strong",
      });
    }
  }
  return signals;
}

function detectMACDSignals(data: OHLCV[], closes: number[]): Signal[] {
  const { macd: macdLine, signal: signalLine } = macd(closes);
  const signals: Signal[] = [];
  const recent = Math.max(1, closes.length - 10);

  for (let i = recent; i < closes.length; i++) {
    if (isNaN(macdLine[i]) || isNaN(signalLine[i]) || isNaN(macdLine[i - 1]) || isNaN(signalLine[i - 1])) continue;

    if (macdLine[i - 1] <= signalLine[i - 1] && macdLine[i] > signalLine[i]) {
      signals.push({
        date: data[i].date,
        type: "buy",
        strategy: "MACD 골든크로스",
        price: data[i].close,
        reason: "MACD선이 시그널선을 상향 돌파",
        strength: macdLine[i] < 0 ? "strong" : "moderate",
      });
    }
    if (macdLine[i - 1] >= signalLine[i - 1] && macdLine[i] < signalLine[i]) {
      signals.push({
        date: data[i].date,
        type: "sell",
        strategy: "MACD 데드크로스",
        price: data[i].close,
        reason: "MACD선이 시그널선을 하향 돌파",
        strength: macdLine[i] > 0 ? "strong" : "moderate",
      });
    }
  }
  return signals;
}

function detectRSISignals(data: OHLCV[], closes: number[]): Signal[] {
  const rsiValues = rsi(closes, 14);
  const signals: Signal[] = [];
  const recent = Math.max(1, closes.length - 10);

  for (let i = recent; i < closes.length; i++) {
    if (isNaN(rsiValues[i]) || isNaN(rsiValues[i - 1])) continue;

    if (rsiValues[i - 1] <= 30 && rsiValues[i] > 30) {
      signals.push({
        date: data[i].date,
        type: "buy",
        strategy: "RSI 과매도 탈출",
        price: data[i].close,
        reason: `RSI가 과매도 구간(30) 탈출 (${rsiValues[i].toFixed(1)})`,
        strength: rsiValues[i - 1] < 20 ? "strong" : "moderate",
      });
    }
    if (rsiValues[i - 1] >= 70 && rsiValues[i] < 70) {
      signals.push({
        date: data[i].date,
        type: "sell",
        strategy: "RSI 과매수 이탈",
        price: data[i].close,
        reason: `RSI가 과매수 구간(70) 이탈 (${rsiValues[i].toFixed(1)})`,
        strength: rsiValues[i - 1] > 80 ? "strong" : "moderate",
      });
    }
  }
  return signals;
}

function detectBollingerSignals(data: OHLCV[], closes: number[]): Signal[] {
  const { upper, lower } = bollingerBands(closes, 20, 2);
  const signals: Signal[] = [];
  const recent = Math.max(1, closes.length - 10);

  for (let i = recent; i < closes.length; i++) {
    if (isNaN(upper[i]) || isNaN(lower[i])) continue;

    if (closes[i - 1] <= lower[i - 1] && closes[i] > lower[i]) {
      signals.push({
        date: data[i].date,
        type: "buy",
        strategy: "볼린저 하단 반등",
        price: data[i].close,
        reason: "주가가 볼린저 하단밴드에서 반등",
        strength: "moderate",
      });
    }
    if (closes[i - 1] >= upper[i - 1] && closes[i] < upper[i]) {
      signals.push({
        date: data[i].date,
        type: "sell",
        strategy: "볼린저 상단 이탈",
        price: data[i].close,
        reason: "주가가 볼린저 상단밴드에서 하락 반전",
        strength: "moderate",
      });
    }
  }
  return signals;
}

'use strict';

function calcSMA(values, period) {
  var result = new Array(values.length).fill(null);
  var sum = 0;
  for (var i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    if (i >= period - 1) result[i] = sum / period;
  }
  return result;
}

function calcEMA(values, period) {
  var result = new Array(values.length).fill(null);
  var k = 2 / (period + 1);
  var prev = null;
  for (var i = 0; i < values.length; i++) {
    if (values[i] === null || values[i] === undefined) continue;
    prev = prev === null ? values[i] : values[i] * k + prev * (1 - k);
    result[i] = prev;
  }
  return result;
}

function calcRSI(closes, period) {
  var result = new Array(closes.length).fill(null);
  if (closes.length < period + 1) return result;
  var gainSum = 0, lossSum = 0;
  for (var i = 1; i <= period; i++) {
    var diff = closes[i] - closes[i - 1];
    if (diff >= 0) gainSum += diff; else lossSum -= diff;
  }
  var avgGain = gainSum / period;
  var avgLoss = lossSum / period;
  result[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  for (var i = period + 1; i < closes.length; i++) {
    var diff = closes[i] - closes[i - 1];
    avgGain = (avgGain * (period - 1) + Math.max(diff, 0)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(-diff, 0)) / period;
    result[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return result;
}

function calcMACD(closes, fast, slow, signalPeriod) {
  var fastEma = calcEMA(closes, fast);
  var slowEma = calcEMA(closes, slow);
  var line = closes.map(function (_, i) {
    return fastEma[i] !== null && slowEma[i] !== null ? fastEma[i] - slowEma[i] : null;
  });
  var signal = calcEMA(line, signalPeriod);
  var histogram = line.map(function (v, i) {
    return v !== null && signal[i] !== null ? v - signal[i] : null;
  });
  return { line: line, signal: signal, histogram: histogram };
}

function calcBollinger(closes, period, multiplier) {
  var mid = calcSMA(closes, period);
  var upper = new Array(closes.length).fill(null);
  var lower = new Array(closes.length).fill(null);
  var pctB = new Array(closes.length).fill(null);
  for (var i = period - 1; i < closes.length; i++) {
    var slice = closes.slice(i - period + 1, i + 1);
    var avg = mid[i];
    var variance = 0;
    for (var j = 0; j < slice.length; j++) variance += Math.pow(slice[j] - avg, 2);
    var sd = Math.sqrt(variance / period);
    upper[i] = avg + multiplier * sd;
    lower[i] = avg - multiplier * sd;
    var bandWidth = upper[i] - lower[i];
    pctB[i] = bandWidth > 0 ? (closes[i] - lower[i]) / bandWidth : 0.5;
  }
  return { mid: mid, upper: upper, lower: lower, pctB: pctB };
}

function calcStochastic(highs, lows, closes, kPeriod, kSmooth, dSmooth) {
  var rawK = new Array(closes.length).fill(null);
  for (var i = kPeriod - 1; i < closes.length; i++) {
    var hh = -Infinity, ll = Infinity;
    for (var j = i - kPeriod + 1; j <= i; j++) {
      if (highs[j] > hh) hh = highs[j];
      if (lows[j] < ll) ll = lows[j];
    }
    rawK[i] = hh === ll ? 50 : ((closes[i] - ll) / (hh - ll)) * 100;
  }
  var k = calcSMA(rawK.map(function (v) { return v === null ? 0 : v; }), kSmooth);
  for (var i = 0; i < kPeriod - 1 + kSmooth - 1; i++) k[i] = null;
  var d = calcSMA(k.map(function (v) { return v === null ? 0 : v; }), dSmooth);
  for (var i = 0; i < kPeriod - 1 + kSmooth - 1 + dSmooth - 1; i++) d[i] = null;
  return { k: k, d: d };
}

function calcWilliamsR(highs, lows, closes, period) {
  var result = new Array(closes.length).fill(null);
  for (var i = period - 1; i < closes.length; i++) {
    var hh = -Infinity, ll = Infinity;
    for (var j = i - period + 1; j <= i; j++) {
      if (highs[j] > hh) hh = highs[j];
      if (lows[j] < ll) ll = lows[j];
    }
    result[i] = hh === ll ? -50 : ((hh - closes[i]) / (hh - ll)) * -100;
  }
  return result;
}

function calcATR(highs, lows, closes, period) {
  var tr = new Array(closes.length).fill(null);
  tr[0] = highs[0] - lows[0];
  for (var i = 1; i < closes.length; i++) {
    tr[i] = Math.max(highs[i] - lows[i], Math.abs(highs[i] - closes[i - 1]), Math.abs(lows[i] - closes[i - 1]));
  }
  var result = new Array(closes.length).fill(null);
  var sum = 0;
  for (var i = 0; i < closes.length; i++) {
    sum += tr[i];
    if (i >= period) sum -= tr[i - period];
    if (i >= period - 1) result[i] = sum / period;
  }
  return result;
}

function calcCCI(highs, lows, closes, period) {
  var tp = closes.map(function (c, i) { return (highs[i] + lows[i] + c) / 3; });
  var result = new Array(closes.length).fill(null);
  for (var i = period - 1; i < closes.length; i++) {
    var slice = tp.slice(i - period + 1, i + 1);
    var avg = slice.reduce(function (a, b) { return a + b; }, 0) / period;
    var md = slice.reduce(function (a, v) { return a + Math.abs(v - avg); }, 0) / period;
    result[i] = md === 0 ? 0 : (tp[i] - avg) / (0.015 * md);
  }
  return result;
}

function calcOBV(closes, volumes) {
  var result = new Array(closes.length).fill(null);
  result[0] = volumes[0] || 0;
  for (var i = 1; i < closes.length; i++) {
    if (closes[i] > closes[i - 1]) result[i] = result[i - 1] + (volumes[i] || 0);
    else if (closes[i] < closes[i - 1]) result[i] = result[i - 1] - (volumes[i] || 0);
    else result[i] = result[i - 1];
  }
  return result;
}

var INDICATORS = {
  sma: {
    id: 'sma', name: '이동평균선 (SMA)', category: '추세', overlay: true, scorable: true,
    defaultParams: { short: 5, mid: 20, long: 60 },
    paramLabels: { short: '단기', mid: '중기', long: '장기' },
    help: {
      summary: '일정 기간 종가의 산술 평균을 연결한 선입니다.',
      formula: 'SMA(N) = (C1 + C2 + ... + CN) / N',
      meaning: '가격이 이동평균선 위에 있으면 상승 추세, 아래에 있으면 하락 추세로 판단합니다.',
      usage: '단기선이 장기선을 상향 돌파하면 골든크로스(매수 신호), 하향 돌파하면 데드크로스(매도 신호)입니다. 5일선은 초단기, 20일선은 중기, 60일선은 장기 추세를 나타냅니다.'
    },
    calculate: function (data, params) {
      return {
        short: calcSMA(data.closes, params.short),
        mid: calcSMA(data.closes, params.mid),
        long: calcSMA(data.closes, params.long)
      };
    },
    score: function (data, result) {
      var i = data.closes.length - 1;
      var c = data.closes[i];
      var s = 50;
      if (result.mid[i] !== null) s = c > result.mid[i] ? 65 : 35;
      if (result.short[i] !== null && result.mid[i] !== null) {
        if (result.short[i] > result.mid[i]) s = Math.min(s + 10, 85);
        else s = Math.max(s - 10, 15);
      }
      return s;
    },
    traces: function (dates, result, params, yaxis) {
      return [
        { x: dates, y: result.short, type: 'scatter', mode: 'lines', name: 'SMA ' + params.short, line: { color: '#2d6cdf', width: 1.3 }, yaxis: yaxis },
        { x: dates, y: result.mid, type: 'scatter', mode: 'lines', name: 'SMA ' + params.mid, line: { color: '#ef8f22', width: 1.3 }, yaxis: yaxis },
        { x: dates, y: result.long, type: 'scatter', mode: 'lines', name: 'SMA ' + params.long, line: { color: '#16815c', width: 1.3 }, yaxis: yaxis }
      ];
    }
  },

  ema: {
    id: 'ema', name: '지수이동평균 (EMA)', category: '추세', overlay: true, scorable: true,
    defaultParams: { short: 12, long: 26 },
    paramLabels: { short: '단기', long: '장기' },
    help: {
      summary: '최근 가격에 더 높은 가중치를 부여하는 이동평균입니다.',
      formula: 'EMA = 종가 x K + 전일EMA x (1-K), K = 2/(N+1)',
      meaning: 'SMA보다 최근 추세에 민감하게 반응합니다. 빠른 추세 전환 감지에 유리합니다.',
      usage: '단기 EMA가 장기 EMA를 상향 돌파하면 매수 신호, 하향 돌파하면 매도 신호입니다.'
    },
    calculate: function (data, params) {
      return {
        short: calcEMA(data.closes, params.short),
        long: calcEMA(data.closes, params.long)
      };
    },
    score: function (data, result) {
      var i = data.closes.length - 1;
      if (result.short[i] === null || result.long[i] === null) return 50;
      var diff = result.short[i] - result.long[i];
      var pct = diff / data.closes[i] * 100;
      return Math.max(0, Math.min(100, 50 + pct * 10));
    },
    traces: function (dates, result, params, yaxis) {
      return [
        { x: dates, y: result.short, type: 'scatter', mode: 'lines', name: 'EMA ' + params.short, line: { color: '#8b5cf6', width: 1.3, dash: 'dot' }, yaxis: yaxis },
        { x: dates, y: result.long, type: 'scatter', mode: 'lines', name: 'EMA ' + params.long, line: { color: '#ec4899', width: 1.3, dash: 'dot' }, yaxis: yaxis }
      ];
    }
  },

  rsi: {
    id: 'rsi', name: 'RSI', category: '모멘텀', overlay: false, scorable: true,
    defaultParams: { period: 14, oversold: 30, overbought: 70 },
    paramLabels: { period: '기간', oversold: '과매도', overbought: '과매수' },
    help: {
      summary: '일정 기간 동안 상승폭과 하락폭의 상대적 강도를 0~100으로 나타냅니다.',
      formula: 'RSI = 100 - 100/(1 + RS), RS = 평균상승폭 / 평균하락폭',
      meaning: '30 이하는 과매도(반등 가능), 70 이상은 과매수(조정 가능)로 해석합니다.',
      usage: 'RSI가 과매도 구간에서 반등하면 매수, 과매수 구간에서 하락하면 매도 시점입니다. 다이버전스(가격은 신고가인데 RSI는 하락)도 중요한 신호입니다.'
    },
    calculate: function (data, params) {
      return { values: calcRSI(data.closes, params.period) };
    },
    score: function (data, result) {
      var i = data.closes.length - 1;
      var v = result.values[i];
      return v === null ? 50 : v;
    },
    traces: function (dates, result, params, yaxis) {
      return [
        { x: dates, y: result.values, type: 'scatter', mode: 'lines', name: 'RSI(' + params.period + ')', line: { color: '#8b5cf6', width: 1.5 }, yaxis: yaxis }
      ];
    },
    shapes: function (params, yaxis) {
      var ya = yaxis.replace('y', 'y');
      return [
        { type: 'line', x0: 0, x1: 1, xref: 'paper', y0: params.overbought, y1: params.overbought, yref: ya, line: { color: '#d33f49', width: 1, dash: 'dash' } },
        { type: 'line', x0: 0, x1: 1, xref: 'paper', y0: params.oversold, y1: params.oversold, yref: ya, line: { color: '#1f6feb', width: 1, dash: 'dash' } },
        { type: 'line', x0: 0, x1: 1, xref: 'paper', y0: 50, y1: 50, yref: ya, line: { color: '#9ca3af', width: 0.5, dash: 'dot' } }
      ];
    }
  },

  macd: {
    id: 'macd', name: 'MACD', category: '모멘텀', overlay: false, scorable: true,
    defaultParams: { fast: 12, slow: 26, signal: 9 },
    paramLabels: { fast: '단기EMA', slow: '장기EMA', signal: '시그널' },
    help: {
      summary: '두 지수이동평균의 차이와 그 시그널선으로 추세의 방향과 강도를 파악합니다.',
      formula: 'MACD = EMA(단기) - EMA(장기), Signal = EMA(MACD, 시그널), Histogram = MACD - Signal',
      meaning: 'MACD가 시그널선 위에 있으면 상승 모멘텀, 아래에 있으면 하락 모멘텀입니다.',
      usage: 'MACD가 시그널선을 상향 돌파하면 매수, 하향 돌파하면 매도 신호입니다. 히스토그램이 커질수록 모멘텀이 강합니다.'
    },
    calculate: function (data, params) {
      return calcMACD(data.closes, params.fast, params.slow, params.signal);
    },
    score: function (data, result) {
      var i = data.closes.length - 1;
      var h = result.histogram[i];
      if (h === null) return 50;
      var maxH = 0;
      for (var j = 0; j < result.histogram.length; j++) {
        if (result.histogram[j] !== null) maxH = Math.max(maxH, Math.abs(result.histogram[j]));
      }
      if (maxH === 0) return 50;
      return Math.max(0, Math.min(100, 50 + (h / maxH) * 40));
    },
    traces: function (dates, result, params, yaxis) {
      var histColors = result.histogram.map(function (v) { return v >= 0 ? 'rgba(211,63,73,0.6)' : 'rgba(36,116,198,0.6)'; });
      return [
        { x: dates, y: result.histogram, type: 'bar', name: 'Histogram', marker: { color: histColors }, yaxis: yaxis },
        { x: dates, y: result.line, type: 'scatter', mode: 'lines', name: 'MACD', line: { color: '#1f6feb', width: 1.5 }, yaxis: yaxis },
        { x: dates, y: result.signal, type: 'scatter', mode: 'lines', name: 'Signal', line: { color: '#ef8f22', width: 1.5 }, yaxis: yaxis }
      ];
    },
    shapes: function (params, yaxis) {
      var ya = yaxis.replace('y', 'y');
      return [
        { type: 'line', x0: 0, x1: 1, xref: 'paper', y0: 0, y1: 0, yref: ya, line: { color: '#9ca3af', width: 0.5, dash: 'dot' } }
      ];
    }
  },

  bollinger: {
    id: 'bollinger', name: '볼린저밴드', category: '변동성', overlay: true, scorable: true,
    defaultParams: { period: 20, multiplier: 2 },
    paramLabels: { period: '기간', multiplier: '배수' },
    help: {
      summary: '이동평균선을 중심으로 표준편차의 배수만큼 상하 밴드를 그려 변동성을 시각화합니다.',
      formula: '중심선 = SMA(N), 상단 = 중심선 + K×σ, 하단 = 중심선 - K×σ',
      meaning: '밴드가 좁아지면 변동성 축소(곧 큰 움직임 예상), 넓어지면 변동성 확대입니다.',
      usage: '가격이 하단밴드 아래로 이탈하면 과매도(반등 기대), 상단밴드 위로 돌파하면 추세 강화 또는 과매수입니다. %B 값이 0 이하면 과매도, 1 이상이면 과매수입니다.'
    },
    calculate: function (data, params) {
      return calcBollinger(data.closes, params.period, params.multiplier);
    },
    score: function (data, result) {
      var i = data.closes.length - 1;
      var b = result.pctB[i];
      if (b === null) return 50;
      return Math.max(0, Math.min(100, b * 100));
    },
    traces: function (dates, result, params, yaxis) {
      return [
        { x: dates, y: result.upper, type: 'scatter', mode: 'lines', name: 'BB Upper', line: { color: '#9ca3af', width: 1, dash: 'dash' }, yaxis: yaxis },
        { x: dates, y: result.mid, type: 'scatter', mode: 'lines', name: 'BB Mid', line: { color: '#9ca3af', width: 0.8, dash: 'dot' }, yaxis: yaxis },
        { x: dates, y: result.lower, type: 'scatter', mode: 'lines', name: 'BB Lower', line: { color: '#9ca3af', width: 1, dash: 'dash' }, fill: 'tonexty', fillcolor: 'rgba(156,163,175,0.08)', yaxis: yaxis }
      ];
    }
  },

  stochastic: {
    id: 'stochastic', name: '스토캐스틱', category: '모멘텀', overlay: false, scorable: true,
    defaultParams: { kPeriod: 14, kSmooth: 3, dSmooth: 3, oversold: 20, overbought: 80 },
    paramLabels: { kPeriod: '%K 기간', kSmooth: '%K 평활', dSmooth: '%D 평활', oversold: '과매도', overbought: '과매수' },
    help: {
      summary: '일정 기간의 최고가·최저가 범위에서 현재 종가의 상대적 위치를 0~100으로 나타냅니다.',
      formula: '%K = (종가 - 최저가) / (최고가 - 최저가) × 100, %D = SMA(%K)',
      meaning: '20 이하는 과매도, 80 이상은 과매수 구간입니다.',
      usage: '%K가 %D를 상향 돌파하면 매수, 하향 돌파하면 매도 신호입니다. 과매도 구간에서의 골든크로스가 특히 유효합니다.'
    },
    calculate: function (data, params) {
      return calcStochastic(data.highs, data.lows, data.closes, params.kPeriod, params.kSmooth, params.dSmooth);
    },
    score: function (data, result) {
      var i = data.closes.length - 1;
      return result.k[i] === null ? 50 : result.k[i];
    },
    traces: function (dates, result, params, yaxis) {
      return [
        { x: dates, y: result.k, type: 'scatter', mode: 'lines', name: '%K', line: { color: '#1f6feb', width: 1.5 }, yaxis: yaxis },
        { x: dates, y: result.d, type: 'scatter', mode: 'lines', name: '%D', line: { color: '#ef8f22', width: 1.3, dash: 'dash' }, yaxis: yaxis }
      ];
    },
    shapes: function (params, yaxis) {
      var ya = yaxis.replace('y', 'y');
      return [
        { type: 'line', x0: 0, x1: 1, xref: 'paper', y0: params.overbought, y1: params.overbought, yref: ya, line: { color: '#d33f49', width: 1, dash: 'dash' } },
        { type: 'line', x0: 0, x1: 1, xref: 'paper', y0: params.oversold, y1: params.oversold, yref: ya, line: { color: '#1f6feb', width: 1, dash: 'dash' } }
      ];
    }
  },

  williamsR: {
    id: 'williamsR', name: 'Williams %R', category: '모멘텀', overlay: false, scorable: true,
    defaultParams: { period: 14, oversold: -80, overbought: -20 },
    paramLabels: { period: '기간', oversold: '과매도', overbought: '과매수' },
    help: {
      summary: '일정 기간의 최고가 대비 현재 종가의 위치를 -100~0 범위로 나타냅니다.',
      formula: '%R = (최고가 - 종가) / (최고가 - 최저가) × (-100)',
      meaning: '-80 이하는 과매도, -20 이상은 과매수로 해석합니다.',
      usage: '스토캐스틱과 유사하지만 스케일이 반전되어 있습니다. 과매도에서 상승 반전 시 매수, 과매수에서 하락 반전 시 매도 시점입니다.'
    },
    calculate: function (data, params) {
      return { values: calcWilliamsR(data.highs, data.lows, data.closes, params.period) };
    },
    score: function (data, result) {
      var i = data.closes.length - 1;
      var v = result.values[i];
      return v === null ? 50 : (v + 100);
    },
    traces: function (dates, result, params, yaxis) {
      return [
        { x: dates, y: result.values, type: 'scatter', mode: 'lines', name: '%R(' + params.period + ')', line: { color: '#7c3aed', width: 1.5 }, yaxis: yaxis }
      ];
    },
    shapes: function (params, yaxis) {
      var ya = yaxis.replace('y', 'y');
      return [
        { type: 'line', x0: 0, x1: 1, xref: 'paper', y0: params.overbought, y1: params.overbought, yref: ya, line: { color: '#d33f49', width: 1, dash: 'dash' } },
        { type: 'line', x0: 0, x1: 1, xref: 'paper', y0: params.oversold, y1: params.oversold, yref: ya, line: { color: '#1f6feb', width: 1, dash: 'dash' } },
        { type: 'line', x0: 0, x1: 1, xref: 'paper', y0: -50, y1: -50, yref: ya, line: { color: '#9ca3af', width: 0.5, dash: 'dot' } }
      ];
    }
  },

  atr: {
    id: 'atr', name: 'ATR', category: '변동성', overlay: false, scorable: false,
    defaultParams: { period: 14 },
    paramLabels: { period: '기간' },
    help: {
      summary: '일정 기간의 True Range 평균으로 변동성의 크기를 측정합니다.',
      formula: 'TR = max(고가-저가, |고가-전일종가|, |저가-전일종가|), ATR = SMA(TR, N)',
      meaning: 'ATR이 높으면 변동성이 크고, 낮으면 변동성이 작습니다. 방향성은 알려주지 않습니다.',
      usage: '손절폭 설정(예: 2×ATR)이나 포지션 크기 결정에 활용합니다. ATR 급등은 추세 전환이나 큰 움직임의 시작을 의미할 수 있습니다.'
    },
    calculate: function (data, params) {
      return { values: calcATR(data.highs, data.lows, data.closes, params.period) };
    },
    score: function () { return 50; },
    traces: function (dates, result, params, yaxis) {
      return [
        { x: dates, y: result.values, type: 'scatter', mode: 'lines', name: 'ATR(' + params.period + ')', line: { color: '#f59e0b', width: 1.5 }, fill: 'tozeroy', fillcolor: 'rgba(245,158,11,0.1)', yaxis: yaxis }
      ];
    }
  },

  cci: {
    id: 'cci', name: 'CCI', category: '모멘텀', overlay: false, scorable: true,
    defaultParams: { period: 20, oversold: -100, overbought: 100 },
    paramLabels: { period: '기간', oversold: '과매도', overbought: '과매수' },
    help: {
      summary: '통계적 평균 가격 대비 현재 가격의 이탈 정도를 측정합니다.',
      formula: 'CCI = (TP - SMA(TP)) / (0.015 × 평균편차), TP = (고가+저가+종가)/3',
      meaning: '+100 초과는 과매수, -100 미만은 과매도로 해석합니다. 0은 평균 수준입니다.',
      usage: '-100 아래에서 위로 돌파하면 매수, +100 위에서 아래로 돌파하면 매도 신호입니다. 추세가 강할 때는 오래 과매수/과매도 구간에 머물 수 있습니다.'
    },
    calculate: function (data, params) {
      return { values: calcCCI(data.highs, data.lows, data.closes, params.period) };
    },
    score: function (data, result, params) {
      var i = data.closes.length - 1;
      var v = result.values[i];
      if (v === null) return 50;
      return Math.max(0, Math.min(100, 50 + (v / 200) * 50));
    },
    traces: function (dates, result, params, yaxis) {
      return [
        { x: dates, y: result.values, type: 'scatter', mode: 'lines', name: 'CCI(' + params.period + ')', line: { color: '#059669', width: 1.5 }, yaxis: yaxis }
      ];
    },
    shapes: function (params, yaxis) {
      var ya = yaxis.replace('y', 'y');
      return [
        { type: 'line', x0: 0, x1: 1, xref: 'paper', y0: params.overbought, y1: params.overbought, yref: ya, line: { color: '#d33f49', width: 1, dash: 'dash' } },
        { type: 'line', x0: 0, x1: 1, xref: 'paper', y0: params.oversold, y1: params.oversold, yref: ya, line: { color: '#1f6feb', width: 1, dash: 'dash' } },
        { type: 'line', x0: 0, x1: 1, xref: 'paper', y0: 0, y1: 0, yref: ya, line: { color: '#9ca3af', width: 0.5, dash: 'dot' } }
      ];
    }
  },

  obv: {
    id: 'obv', name: 'OBV', category: '거래량', overlay: false, scorable: false,
    defaultParams: { signalPeriod: 20 },
    paramLabels: { signalPeriod: '시그널 기간' },
    help: {
      summary: '가격 변동 방향에 따라 거래량을 누적하여 매집·분산을 파악합니다.',
      formula: '상승일: OBV += 거래량, 하락일: OBV -= 거래량, 보합: OBV 유지',
      meaning: 'OBV 상승은 매집(accumulation), 하락은 분산(distribution)을 의미합니다.',
      usage: '가격은 횡보하는데 OBV가 상승하면 조만간 가격 상승이 예상됩니다. 반대로 가격이 올라가는데 OBV가 하락하면 상승세가 약해지는 신호입니다.'
    },
    calculate: function (data, params) {
      var obv = calcOBV(data.closes, data.volumes);
      var signal = calcSMA(obv, params.signalPeriod);
      return { values: obv, signal: signal };
    },
    score: function () { return 50; },
    traces: function (dates, result, params, yaxis) {
      return [
        { x: dates, y: result.values, type: 'scatter', mode: 'lines', name: 'OBV', line: { color: '#6366f1', width: 1.5 }, yaxis: yaxis },
        { x: dates, y: result.signal, type: 'scatter', mode: 'lines', name: 'OBV Signal', line: { color: '#f97316', width: 1.2, dash: 'dash' }, yaxis: yaxis }
      ];
    }
  }
};

function getRubric(score) {
  if (score <= 20) return { text: '강한 과매도', css: 'rubric-strong-oversold' };
  if (score <= 40) return { text: '과매도', css: 'rubric-oversold' };
  if (score <= 60) return { text: '중립', css: 'rubric-neutral' };
  if (score <= 80) return { text: '과매수', css: 'rubric-overbought' };
  return { text: '강한 과매수', css: 'rubric-strong-overbought' };
}

function getRubricColor(score) {
  if (score <= 20) return '#1f6feb';
  if (score <= 40) return '#2d9cdb';
  if (score <= 60) return '#6b7280';
  if (score <= 80) return '#ef8f22';
  return '#d33f49';
}

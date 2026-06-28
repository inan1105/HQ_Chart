/**
 * PAN-TIS — Google Apps Script 포팅 (Core)
 *
 * Python 패키지(pantis/, Sprint 1~3)의 분석 파이프라인을 그대로 JavaScript 로 옮긴
 * 것이다. 외부 의존성(numpy/pandas)은 본 파일에서 직접 구현한다.
 * GAS 와 Node 양쪽에서 동작하도록, 파일 끝에 가드된 module.exports 를 둔다
 * (GAS 에서는 `module` 이 undefined 이므로 무시된다).
 *
 * 결과값은 Python 구현과 수치적으로 일치한다(동일 입력 → 동일 판정).
 */

/** 기본 설정 (pantis/config/config.yaml 과 동일). */
var CONFIG = {
  app: { lookback: 120 },
  api: {
    base_url: 'https://iamchart-proxy.inan1105.workers.dev',
    path: '/',
    default_market: 'kospi',
    timeout_seconds: 10
  },
  interval_period_map: { '1d': 'd' },
  user_defaults: {
    buy_fee_pct: 0.015, sell_fee_pct: 0.015, tax_pct: 0.18,
    other_cost_pct: 0.0, target_net_profit_pct: 2.0
  },
  pattern: { doji_threshold_pct_of_range: 10, shadow_epsilon_pct_of_range: 5 },
  robust_stats: { window: 10 },
  trend: { sma_windows: [5, 20, 60] },
  gap: { normal_pct: 1.0, excess_pct: 5.0 },
  energy: { normal_ratio: 1.5, high_ratio: 2.5 },
  beta: { mock_seed: 7, mock_noise: 0.3 },
  prediction: {
    transition_weight: 0.40, trend_weight: 0.20, gap_weight: 0.15,
    beta_weight: 0.10, similarity_weight: 0.15, ngram_max: 3, similarity_top_k: 15
  },
  trading: { rr_strong: 2.0, rr_conditional: 1.5, confidence_strong: 0.80 },
  exit: { atr_window: 14, stop_atr_mult: 0.5, stop_buffer_pct: 0.5 },
  scenario: { open_offsets_pct: [-1.0, 0.0, 1.0, 2.0] },
  validation: { reject_data_error: true, keep_market_event: true, market_event_change_pct: 29.5 }
};

/* ========================= 수치 헬퍼 (numpy 대체) ========================= */

function mean(a) { if (!a.length) return 0; var s = 0; for (var i = 0; i < a.length; i++) s += a[i]; return s / a.length; }
function median(a) {
  if (!a.length) return 0;
  var b = a.slice().sort(function (x, y) { return x - y; });
  var m = Math.floor(b.length / 2);
  return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2;
}
function mad(a) { if (!a.length) return 0; var med = median(a); var d = a.map(function (x) { return Math.abs(x - med); }); return median(d); }
function popVar(a) { if (!a.length) return 0; var m = mean(a); var s = 0; for (var i = 0; i < a.length; i++) s += (a[i] - m) * (a[i] - m); return s / a.length; }
function popStd(a) { return Math.sqrt(popVar(a)); }
function sampleCov(x, y) {
  var n = Math.min(x.length, y.length);
  if (n < 2) return 0;
  var mx = mean(x), my = mean(y), s = 0;
  for (var i = 0; i < n; i++) s += (x[i] - mx) * (y[i] - my);
  return s / (n - 1); // numpy np.cov 기본 ddof=1
}
function pearson(x, y) {
  var n = Math.min(x.length, y.length);
  if (n < 2) return 0;
  var sx = popStd(x), sy = popStd(y);
  if (sx === 0 || sy === 0) return 0;
  var mx = mean(x), my = mean(y), s = 0;
  for (var i = 0; i < n; i++) s += (x[i] - mx) * (y[i] - my);
  return (s / n) / (sx * sy);
}
function cosine(a, b) {
  var na = 0, nb = 0, dot = 0;
  for (var i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  na = Math.sqrt(na); nb = Math.sqrt(nb);
  if (na === 0 || nb === 0) return 0;
  return dot / (na * nb);
}
function safeDivide(num, den, def) {
  if (def === undefined) def = 0.0;
  if (den === 0 || !isFinite(den)) return def;
  var r = num / den;
  return isFinite(r) ? r : def;
}
function robustZ(x, values) {
  if (!values.length) return 0;
  var med = median(values), m = mad(values);
  if (m === 0) return 0;
  return 0.6745 * (x - med) / m;
}

/* ========================= Provider 매핑 ========================= */

var PROXY_FIELD_MAP = {
  datetime: 'bzDd', open: 'opnPrc', high: 'hgPrc', high_time: 'hgTm',
  low: 'lwPrc', low_time: 'lwTm', close: 'trdPrc', volume: 'accTrdvol'
};

/** 프록시 응답 dict → 시간 오름차순 캔들 배열 (Python map_proxy_payload 동일). */
function mapProxyPayload(payload) {
  var result = payload.Result || {};
  if (result.ResultCode !== 0) throw new Error('프록시 ResultCode 비정상: ' + (result.ResultMsg || 'unknown'));
  var rows = payload.ResultData;
  if (!Array.isArray(rows)) throw new Error('ResultData 가 배열이 아닙니다.');
  var candles = rows.map(function (r) {
    return {
      datetime: String(r.bzDd), open: parseFloat(r.opnPrc),
      high_time: String(r.hgTm), high: parseFloat(r.hgPrc),
      low_time: String(r.lwTm), low: parseFloat(r.lwPrc),
      close: parseFloat(r.trdPrc), volume: parseFloat(r.accTrdvol)
    };
  });
  candles.reverse(); // 최신순 → 과거→최신
  return candles;
}

/* ========================= Validation ========================= */

function isValidHHMMSS(v) {
  if (!v || !/^\d+$/.test(v)) return false;
  if (v.length > 6) return false;
  var p = ('000000' + v).slice(-6);
  var hh = +p.slice(0, 2), mm = +p.slice(2, 4), ss = +p.slice(4, 6);
  return hh <= 23 && mm <= 59 && ss <= 59;
}

function validateCandle(c, prevClose, cfg) {
  var v = cfg.validation;
  var messages = [], anomaly = 'NORMAL', score = 100.0, anomalyScore = 0.0;

  if (c.high < Math.max(c.open, c.close, c.low)) { messages.push('High<max(O,C,L)'); score -= 40; anomaly = 'DATA_ERROR'; }
  if (c.low > Math.min(c.open, c.close, c.high)) { messages.push('Low>min(O,C,H)'); score -= 40; anomaly = 'DATA_ERROR'; }
  if (c.volume < 0) { messages.push('Volume<0'); score -= 30; anomaly = 'DATA_ERROR'; }
  if (!isValidHHMMSS(c.high_time)) { messages.push('HighTime invalid'); score -= 15; anomaly = 'DATA_ERROR'; }
  if (!isValidHHMMSS(c.low_time)) { messages.push('LowTime invalid'); score -= 15; anomaly = 'DATA_ERROR'; }

  if (anomaly === 'DATA_ERROR') {
    return {
      status: v.reject_data_error ? 'REJECTED' : 'WARNING',
      data_quality_score: Math.max(0, score), anomaly_score: messages.length,
      anomaly_type: 'DATA_ERROR', messages: messages
    };
  }
  if (prevClose != null && prevClose > 0) {
    var changePct = (c.close - prevClose) / prevClose * 100.0;
    if (Math.abs(changePct) >= v.market_event_change_pct) {
      anomaly = 'MARKET_EVENT'; anomalyScore = Math.abs(changePct);
      messages.push('전일대비 ' + changePct.toFixed(2) + '%: MARKET_EVENT');
      score -= 5;
    }
  }
  var status = anomaly === 'MARKET_EVENT' ? 'WARNING' : 'VERIFIED';
  return { status: status, data_quality_score: Math.max(0, score), anomaly_score: anomalyScore, anomaly_type: anomaly, messages: messages };
}

function validateSeries(candles, cfg) {
  var out = [], prev = null;
  for (var i = 0; i < candles.length; i++) { out.push(validateCandle(candles[i], prev, cfg)); prev = candles[i].close; }
  return out;
}

/* ========================= Path / Pattern ========================= */

function toSeconds(hhmmss) {
  var p = ('000000' + hhmmss).slice(-6);
  return (+p.slice(0, 2)) * 3600 + (+p.slice(2, 4)) * 60 + (+p.slice(4, 6));
}
function pathCode(c) { return toSeconds(c.low_time) < toSeconds(c.high_time) ? 'L' : 'H'; }

function patternCode(c, path, cfg) {
  var dojiRatio = cfg.pattern.doji_threshold_pct_of_range / 100.0;
  var shadowRatio = cfg.pattern.shadow_epsilon_pct_of_range / 100.0;
  var range = c.high - c.low;
  var body = Math.abs(c.close - c.open);
  var ch1 = (range <= 0 || body <= dojiRatio * range) ? 'C' : (c.close > c.open ? 'A' : 'B');
  var upper = c.high - Math.max(c.open, c.close);
  var ch2 = (range > 0 && upper > shadowRatio * range) ? 'D' : 'E';
  var lower = Math.min(c.open, c.close) - c.low;
  var ch3 = (range > 0 && lower > shadowRatio * range) ? 'F' : 'G';
  var ch4 = path != null ? path : pathCode(c);
  return ch1 + ch2 + ch3 + ch4;
}

/* ========================= 분류 ========================= */

function classifySize(r) { if (r < 0.5) return 'TINY'; if (r < 1.5) return 'NORMAL'; if (r < 2.5) return 'LARGE'; return 'LONG'; }
function classifyEnergy(tr, normalRatio, highRatio) { if (tr < 0.5) return 'LOW'; if (tr < normalRatio) return 'NORMAL'; if (tr < highRatio) return 'HIGH'; return 'EXPLOSIVE'; }
function classifyGap(g, normalPct, excessPct) {
  if (g <= -excessPct) return 'EXCESS_DOWN';
  if (g <= -normalPct) return 'GAP_DOWN';
  if (g < normalPct) return 'NORMAL';
  if (g < excessPct) return 'GAP_UP';
  return 'EXCESS_UP';
}

/* ========================= Feature ========================= */

function typicalPrice(o, h, l, c) { return (o + h + l + c) / 4.0; }

function computeFeatures(candles, cfg) {
  var window = cfg.robust_stats.window;
  var volumes = [], turnovers = [], features = [];
  for (var i = 0; i < candles.length; i++) {
    var c = candles[i];
    var body = Math.abs(c.close - c.open);
    var upper = c.high - Math.max(c.open, c.close);
    var lower = Math.min(c.open, c.close) - c.low;
    var range = c.high - c.low;
    var tp = typicalPrice(c.open, c.high, c.low, c.close);
    var tv = tp * c.volume;
    volumes.push(c.volume); turnovers.push(tv);
    var volWin = volumes.slice(-window), tovWin = turnovers.slice(-window);
    features.push({
      datetime: c.datetime, body: body, upper_shadow: upper, lower_shadow: lower, total_range: range,
      body_ratio_to_range: safeDivide(body, range), upper_ratio_to_range: safeDivide(upper, range),
      lower_ratio_to_range: safeDivide(lower, range), typical_price: tp, turnover: tv,
      volume_ratio: safeDivide(c.volume, median(volWin), 1.0),
      turnover_ratio: safeDivide(tv, median(tovWin), 1.0)
    });
  }
  return features;
}

/* ========================= Trend / Gap / Beta ========================= */

function smaAt(closes, index, window) {
  if (index + 1 < window) return null;
  return mean(closes.slice(index + 1 - window, index + 1));
}
function computeTrends(candles, cfg) {
  var w = cfg.trend.sma_windows, closes = candles.map(function (c) { return c.close; }), out = [];
  for (var i = 0; i < candles.length; i++) {
    var s = smaAt(closes, i, w[0]), m = smaAt(closes, i, w[1]), l = smaAt(closes, i, w[2]);
    if (s == null || m == null || l == null) out.push('FLAT');
    else if (s > m && m > l) out.push('UP');
    else if (s < m && m < l) out.push('DOWN');
    else out.push('FLAT');
  }
  return out;
}
function gapPct(open, prevClose) { return prevClose === 0 ? 0 : (open - prevClose) / prevClose * 100.0; }
function classifyGapSeries(candles, cfg) {
  var out = [], prev = null;
  for (var i = 0; i < candles.length; i++) {
    if (prev == null) out.push('NORMAL');
    else out.push(classifyGap(gapPct(candles[i].open, prev), cfg.gap.normal_pct, cfg.gap.excess_pct));
    prev = candles[i].close;
  }
  return out;
}
function resolveOpen(marketState, openMode, prevClose, userOpen) {
  if (openMode === '전일종가') return prevClose;
  if (userOpen != null && userOpen > 0) return userOpen;
  return prevClose;
}
function computeGap(marketState, openMode, prevClose, benchmarkGapPct, beta, userOpen, cfg) {
  var actualOpen = resolveOpen(marketState, openMode, prevClose, userOpen);
  var actualGap = gapPct(actualOpen, prevClose);
  var expectedGap = benchmarkGapPct * beta;
  return {
    actual_open: actualOpen, previous_close: prevClose, gap_pct: actualGap,
    expected_gap: expectedGap, gap_surprise: actualGap - expectedGap,
    gap_class: classifyGap(actualGap, cfg.gap.normal_pct, cfg.gap.excess_pct)
  };
}
function returnsOf(series) { var o = []; for (var i = 1; i < series.length; i++) { var p = series[i - 1]; o.push(p ? (series[i] - p) / p : 0); } return o; }
function computeBeta(candles, cfg) {
  var closes = candles.map(function (c) { return c.close; });
  if (closes.length < 2) return { beta: 0, correlation: 0, benchmark_returns: [], benchmark_last_gap_pct: 0 };
  var seed = cfg.beta.mock_seed, noise = cfg.beta.mock_noise;
  var bench = [1000.0];
  for (var i = 1; i < closes.length; i++) {
    var sr = closes[i - 1] ? (closes[i] - closes[i - 1]) / closes[i - 1] : 0;
    var nz = noise * Math.sin((i + seed) * 0.7) * 0.01;
    bench.push(bench[bench.length - 1] * (1 + 0.6 * sr + nz));
  }
  var sret = returnsOf(closes), bret = returnsOf(bench);
  var varB = popVar(bret);
  var cov = sret.length > 1 ? sampleCov(sret, bret) : 0;
  var beta = varB > 0 ? cov / varB : 0;
  var corr = pearson(sret, bret);
  var lastGap = bret.length ? bret[bret.length - 1] * 100.0 : 0;
  return { beta: beta, correlation: corr, benchmark_returns: bret, benchmark_last_gap_pct: lastGap };
}

/* ========================= Market Token ========================= */

function buildTokens(candles, features, validations, trends, gaps, betaResult, cfg) {
  var window = cfg.robust_stats.window;
  var bodyH = [], upperH = [], lowerH = [], tokens = [];
  for (var i = 0; i < candles.length; i++) {
    var c = candles[i], f = features[i], v = validations[i];
    bodyH.push(f.body); upperH.push(f.upper_shadow); lowerH.push(f.lower_shadow);
    var bw = bodyH.slice(-window), uw = upperH.slice(-window), lw = lowerH.slice(-window);
    var path = pathCode(c), pat = patternCode(c, path, cfg);
    tokens.push({
      datetime: c.datetime, pattern_code: pat, path_code: path, trend_class: trends[i],
      body_class: classifySize(safeDivide(f.body, median(bw), 0.0)),
      upper_class: classifySize(safeDivide(f.upper_shadow, median(uw), 0.0)),
      lower_class: classifySize(safeDivide(f.lower_shadow, median(lw), 0.0)),
      gap_class: gaps[i],
      energy_class: classifyEnergy(f.turnover_ratio, cfg.energy.normal_ratio, cfg.energy.high_ratio),
      body_z: robustZ(f.body, bw), upper_z: robustZ(f.upper_shadow, uw), lower_z: robustZ(f.lower_shadow, lw),
      volume_ratio: f.volume_ratio, turnover_ratio: f.turnover_ratio,
      beta: betaResult.beta, correlation: betaResult.correlation,
      data_quality_score: v.data_quality_score, anomaly_type: v.anomaly_type
    });
  }
  return tokens;
}

/* ========================= Scenario (n-gram / 조건부 / 유사도) ========================= */

var TREND_NUM = { UP: 1.0, FLAT: 0.0, DOWN: -1.0 };
var ENERGY_NUM = { LOW: 0.0, NORMAL: 1.0, HIGH: 2.0, EXPLOSIVE: 3.0 };
var GAP_NUM = { EXCESS_DOWN: -2.0, GAP_DOWN: -1.0, NORMAL: 0.0, GAP_UP: 1.0, EXCESS_UP: 2.0 };

function tokenVector(t) {
  return [t.body_z, t.upper_z, t.lower_z, t.volume_ratio, t.turnover_ratio,
  TREND_NUM[t.trend_class] || 0, GAP_NUM[t.gap_class] || 0, ENERGY_NUM[t.energy_class] != null ? ENERGY_NUM[t.energy_class] : 1.0];
}
function normalizeCounter(counter) {
  var total = 0, k; for (k in counter) total += counter[k];
  var out = {}; if (total === 0) return out;
  for (k in counter) out[k] = counter[k] / total;
  return out;
}
function ngramDistribution(patterns, n) {
  if (patterns.length <= n) return { dist: {}, samples: 0 };
  var table = {};
  for (var i = 0; i < patterns.length - n; i++) {
    var ctx = patterns.slice(i, i + n).join('|'), nxt = patterns[i + n];
    if (!table[ctx]) table[ctx] = {};
    table[ctx][nxt] = (table[ctx][nxt] || 0) + 1;
  }
  var key = patterns.slice(patterns.length - n).join('|');
  var counter = table[key];
  if (!counter) return { dist: {}, samples: 0 };
  var s = 0, p; for (p in counter) s += counter[p];
  return { dist: normalizeCounter(counter), samples: s };
}
function transitionDistribution(tokens, cfg) {
  var patterns = tokens.map(function (t) { return t.pattern_code; });
  var weights = { 3: 0.5, 2: 0.3, 1: 0.2 };
  var blended = {}, topSamples = 0, hi = Math.min(cfg.prediction.ngram_max, 3);
  for (var n = hi; n >= 1; n--) {
    var r = ngramDistribution(patterns, n);
    if (!Object.keys(r.dist).length) continue;
    if (n === hi || topSamples === 0) topSamples = Math.max(topSamples, r.samples);
    var w = weights[n] || 0, pat;
    for (pat in r.dist) blended[pat] = (blended[pat] || 0) + w * r.dist[pat];
  }
  if (!Object.keys(blended).length) return { dist: {}, samples: 0 };
  return { dist: normalizeCounter(blended), samples: topSamples };
}
function conditionalDistribution(tokens, attr, value) {
  var counter = {}, s = 0;
  for (var i = 0; i < tokens.length - 1; i++) {
    if (tokens[i][attr] === value) { var nx = tokens[i + 1].pattern_code; counter[nx] = (counter[nx] || 0) + 1; s++; }
  }
  return { dist: normalizeCounter(counter), samples: s };
}
function baseRate(tokens) {
  var counter = {};
  for (var i = 1; i < tokens.length; i++) { var p = tokens[i].pattern_code; counter[p] = (counter[p] || 0) + 1; }
  return normalizeCounter(counter);
}
function similarityDistribution(tokens, cfg) {
  if (tokens.length < 3) return { dist: {}, neighbors: 0, avgSim: 0 };
  var query = tokenVector(tokens[tokens.length - 1]);
  var sims = [];
  for (var i = 0; i < tokens.length - 1; i++) sims.push([i, cosine(query, tokenVector(tokens[i]))]);
  sims.sort(function (a, b) { return b[1] - a[1]; });
  var top = sims.slice(0, cfg.prediction.similarity_top_k);
  if (!top.length) return { dist: {}, neighbors: 0, avgSim: 0 };
  var weighted = {}, simSum = 0;
  for (var j = 0; j < top.length; j++) {
    var idx = top[j][0], sim = top[j][1];
    simSum += sim;
    var nx = tokens[idx + 1].pattern_code;
    weighted[nx] = (weighted[nx] || 0) + Math.max(sim, 0);
  }
  return { dist: normalizeCounter(weighted), neighbors: top.length, avgSim: simSum / top.length };
}

/* ========================= Prediction ========================= */

var PRED_COMPONENTS = ['transition', 'trend', 'gap', 'beta', 'similarity'];

function predict(tokens, candles, decisionGapClass, cfg) {
  var pred = cfg.prediction;
  var weights = {
    transition: pred.transition_weight, trend: pred.trend_weight, gap: pred.gap_weight,
    beta: pred.beta_weight, similarity: pred.similarity_weight
  };
  var current = tokens[tokens.length - 1], currentCandle = candles[candles.length - 1];
  var gapClass = decisionGapClass || current.gap_class;

  var tr = transitionDistribution(tokens, cfg);
  var trend = conditionalDistribution(tokens, 'trend_class', current.trend_class);
  var gap = conditionalDistribution(tokens, 'gap_class', gapClass);
  var betaDist = baseRate(tokens);
  var sim = similarityDistribution(tokens, cfg);

  var dists = { transition: tr.dist, trend: trend.dist, gap: gap.dist, beta: betaDist, similarity: sim.dist };
  var candidates = {};
  PRED_COMPONENTS.forEach(function (c) { for (var k in dists[c]) candidates[k] = true; });
  var cands = Object.keys(candidates);

  if (!cands.length) return fallbackPrediction(current, currentCandle);

  var scores = {}, total = 0;
  cands.forEach(function (cd) {
    var sc = 0;
    PRED_COMPONENTS.forEach(function (c) { sc += weights[c] * (dists[c][cd] || 0); });
    scores[cd] = sc; total += sc;
  });
  if (total <= 0) return fallbackPrediction(current, currentCandle);

  var expected = null, best = -1;
  cands.forEach(function (cd) { var pr = scores[cd] / total; if (pr > best) { best = pr; expected = cd; } });
  var probability = best;
  var expectedPath = expected.length === 4 ? expected.charAt(3) : current.path_code;
  var breakdown = {};
  PRED_COMPONENTS.forEach(function (c) { breakdown[c] = dists[c][expected] || 0; });
  var cases = tr.samples + sim.neighbors;

  var ohlc = predictOHLC(tokens, candles, expected, currentCandle.close);
  var confidence = confidenceScore(probability, cases, sim.avgSim);
  var reasons = explain(current, breakdown, sim.avgSim, cases);

  return {
    current_pattern: current.pattern_code, current_path: current.path_code,
    current_trend: current.trend_class, current_energy: current.energy_class,
    expected_pattern: expected, expected_path: expectedPath,
    expected_open: ohlc[0], expected_high: ohlc[1], expected_low: ohlc[2], expected_close: ohlc[3],
    probability: probability, confidence: confidence, historical_cases: cases,
    score_breakdown: breakdown, reasons: reasons
  };
}
function predictOHLC(tokens, candles, expected, currentClose) {
  var matched = [];
  for (var i = 0; i < tokens.length - 1; i++) if (tokens[i + 1].pattern_code === expected && candles[i].close > 0) matched.push(i);
  if (!matched.length) { matched = []; for (var j = 0; j < candles.length - 1; j++) if (candles[j].close > 0) matched.push(j); }
  if (!matched.length) return [currentClose, currentClose, currentClose, currentClose];
  var ro = [], rh = [], rl = [], rc = [];
  matched.forEach(function (i) {
    var base = candles[i].close, nx = candles[i + 1];
    ro.push(nx.open / base); rh.push(nx.high / base); rl.push(nx.low / base); rc.push(nx.close / base);
  });
  var eo = currentClose * median(ro), eh = currentClose * median(rh), el = currentClose * median(rl), ec = currentClose * median(rc);
  return [eo, Math.max(eo, eh, el, ec), Math.min(eo, eh, el, ec), ec];
}
function confidenceScore(probability, cases, avgSim) {
  var support = Math.min(1.0, cases / 20.0);
  var simStr = Math.max(0, Math.min(1, avgSim));
  return Math.max(0, Math.min(1, 0.5 * probability + 0.3 * support + 0.2 * simStr));
}
function explain(current, breakdown, avgSim, cases) {
  var r = [];
  r.push('Transition ' + Math.round(breakdown.transition * 100) + '%');
  r.push(current.trend_class !== 'FLAT' ? 'Trend Match (' + current.trend_class + ')' : 'Trend Flat');
  r.push('Energy ' + current.energy_class);
  r.push('Similarity ' + Math.round(Math.max(0, avgSim) * 100) + '%');
  r.push('Historical Cases ' + cases);
  return r;
}
function fallbackPrediction(current, candle) {
  var c = candle.close, br = {}; PRED_COMPONENTS.forEach(function (k) { br[k] = 0; });
  return {
    current_pattern: current.pattern_code, current_path: current.path_code,
    current_trend: current.trend_class, current_energy: current.energy_class,
    expected_pattern: current.pattern_code, expected_path: current.path_code,
    expected_open: c, expected_high: c, expected_low: c, expected_close: c,
    probability: 0, confidence: 0, historical_cases: 0, score_breakdown: br,
    reasons: ['근거 데이터 부족: 현재 패턴 유지로 가정']
  };
}

/* ========================= Risk / Entry / Exit / Decision ========================= */

function atr(candles, window) {
  if (candles.length < 2) return 0;
  var trs = [];
  for (var i = 1; i < candles.length; i++) {
    var h = candles[i].high, l = candles[i].low, pc = candles[i - 1].close;
    trs.push(Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc)));
  }
  var w = trs.slice(-window);
  return w.length ? mean(w) : 0;
}
var VERDICT = {
  BUY: '★★★★★ 매수', COND: '★★★★☆ 조건부 매수', HOLD: '★★★☆☆ 관망',
  REDUCE: '★★☆☆☆ 비중축소', SELL: '★☆☆☆☆ 매도'
};
function decide(prediction, candles, cfg, userSettings) {
  var ud = cfg.user_defaults;
  var minNet = (userSettings && userSettings.target_net_profit_pct != null) ? userSettings.target_net_profit_pct : ud.target_net_profit_pct;
  var cost = ud.buy_fee_pct + ud.sell_fee_pct + ud.tax_pct + ud.other_cost_pct;

  // entry
  var target1 = prediction.expected_close;
  var required = 1.0 + (minNet + cost) / 100.0;
  var profitCapped = safeDivide(target1, required, prediction.expected_open);
  var entryLow = prediction.expected_low;
  var entryHigh = Math.min(prediction.expected_open, profitCapped);
  if (entryLow > entryHigh) entryLow = entryHigh;
  var entryRef = (entryLow + entryHigh) / 2.0;

  // exit
  var target2 = prediction.expected_high;
  var a = atr(candles, cfg.exit.atr_window);
  var stop = a > 0 ? prediction.expected_low - cfg.exit.stop_atr_mult * a
    : prediction.expected_low * (1 - cfg.exit.stop_buffer_pct / 100.0);

  var gross = safeDivide(target1 - entryRef, entryRef, 0) * 100.0;
  var net = gross - cost;
  var riskPct = safeDivide(entryRef - stop, entryRef, 0) * 100.0;
  var rewardPct = safeDivide(target1 - entryRef, entryRef, 0) * 100.0;
  var rr = safeDivide(rewardPct, riskPct, 0);

  var upP = prediction.probability, downP = 1 - upP;
  var ev = upP * rewardPct - downP * riskPct - cost;

  var verdict;
  if (ev >= minNet && rr >= cfg.trading.rr_strong && prediction.confidence >= cfg.trading.confidence_strong) verdict = VERDICT.BUY;
  else if (ev > 0 && rr >= cfg.trading.rr_conditional) verdict = VERDICT.COND;
  else if (ev <= -minNet) verdict = VERDICT.SELL;
  else if (ev < 0) verdict = VERDICT.REDUCE;
  else verdict = VERDICT.HOLD;

  var reasons = prediction.reasons.slice();
  reasons.push('Confidence ' + Math.round(prediction.confidence * 100) + '%');
  reasons.push('EV ' + (ev >= 0 ? '+' : '') + ev.toFixed(2) + '%');
  reasons.push('R/R ' + rr.toFixed(2));
  reasons.push('예상 순수익 ' + (net >= 0 ? '+' : '') + net.toFixed(2) + '%');
  reasons.push('최종판정 ' + verdict);

  return {
    total_cost_pct: cost, entry_low: entryLow, entry_high: entryHigh, entry_ref: entryRef,
    target_1: target1, target_2: target2, stop_loss: stop,
    gross_return_pct: gross, net_return_pct: net, risk_pct: riskPct, reward_pct: rewardPct, rr: rr,
    up_probability: upP, down_probability: downP, avg_upside: rewardPct, avg_downside: riskPct,
    expected_value: ev, verdict: verdict, reasons: reasons
  };
}

/* ========================= Scenario sensitivity ========================= */

function runScenarios(candles, tokens, betaResult, cfg, userSettings) {
  var prevClose = candles[candles.length - 1].close;
  return cfg.scenario.open_offsets_pct.map(function (off) {
    var assumedOpen = prevClose * (1 + off / 100.0);
    var gap = computeGap('개장전', '예상시가', prevClose, betaResult.benchmark_last_gap_pct, betaResult.beta, assumedOpen, cfg);
    var p = predict(tokens, candles, gap.gap_class, cfg);
    var d = decide(p, candles, cfg, userSettings);
    return {
      label: '예상시가 ' + (off >= 0 ? '+' : '') + off.toFixed(0) + '%', offset_pct: off, assumed_open: assumedOpen,
      expected_pattern: p.expected_pattern, expected_path: p.expected_path, probability: p.probability,
      confidence: p.confidence, expected_value: d.expected_value, rr: d.rr, net_return_pct: d.net_return_pct, verdict: d.verdict
    };
  });
}

/* ========================= Pipeline ========================= */

/**
 * 전체 파이프라인 실행 (조회 결과 캔들 → Sprint 1~3 결과).
 * @param {Array} candles 시간 오름차순 캔들 배열(보통 120개).
 * @param {Object} opts {code, market, interval, market_state, open_mode, user_open, min_net, cfg}
 * @return {Object} 결과(table/prediction/decision/scenarios/tokens/...).
 */
function runPipeline(candles, opts) {
  opts = opts || {};
  var cfg = opts.cfg || CONFIG;
  var lookback = cfg.app.lookback;
  if (candles.length > lookback) candles = candles.slice(candles.length - lookback);

  var validations = validateSeries(candles, cfg);
  var features = computeFeatures(candles, cfg);
  var trends = computeTrends(candles, cfg);
  var gaps = classifyGapSeries(candles, cfg);
  var betaResult = computeBeta(candles, cfg);
  var tokens = buildTokens(candles, features, validations, trends, gaps, betaResult, cfg);

  var marketState = opts.market_state || '개장전';
  var openMode = opts.open_mode || '전일종가';
  var userSettings = { target_net_profit_pct: opts.min_net != null ? opts.min_net : cfg.user_defaults.target_net_profit_pct };

  var prevClose = candles[candles.length - 1].close;
  var gap = computeGap(marketState, openMode, prevClose, betaResult.benchmark_last_gap_pct, betaResult.beta, opts.user_open, cfg);
  var prediction = predict(tokens, candles, gap.gap_class, cfg);
  var decision = decide(prediction, candles, cfg, userSettings);
  var scenarios = marketState === '개장전' ? runScenarios(candles, tokens, betaResult, cfg, userSettings) : [];

  return {
    code: opts.code || '', candles: candles, validations: validations, features: features,
    tokens: tokens, prediction: prediction, decision: decision, scenarios: scenarios,
    meta: {
      code: opts.code || '', interval: opts.interval || '1d', market_state: marketState, open_mode: openMode
    }
  };
}

/* GAS + Node 양립용 export (GAS 에서는 무시됨). */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    CONFIG: CONFIG, mapProxyPayload: mapProxyPayload, runPipeline: runPipeline,
    median: median, mad: mad, robustZ: robustZ, cosine: cosine,
    pathCode: pathCode, patternCode: patternCode, computeBeta: computeBeta
  };
}

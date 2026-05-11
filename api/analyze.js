const OPENAI_URL = "https://api.openai.com/v1/responses";
const DEFAULT_MODEL = "gpt-5.1";
const NAVER_THEME_URL = "https://finance.naver.com/sise/theme.naver";
const NAVER_UPJONG_URL = "https://finance.naver.com/sise/sise_group.naver?type=upjong";
const IAMCHART_HISTORY_URL = "https://was002.iamchart.com/be.asp/ty.a/api/iamchart/SeriES/stock/history/v2";

module.exports = async function handler(req, res) {
  setCors(res);

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== "POST") {
    sendJson(res, 405, { error: "POST 요청만 사용할 수 있습니다." });
    return;
  }

  try {
    const body = await readJson(req);
    const rawSymbol = String(body.symbol || "").trim();
    const name = String(body.name || "").trim();
    const market = String(body.market || "").trim();
    const mode = normalizeMode(body.mode);
    const chartPeriod = normalizeChartPeriod(body.chartPeriod || body.period);
    const chartRange = normalizeChartRange(body.chartRange || body.range);
    const chartOnly = Boolean(body.chartOnly);
    const message = String(body.message || "").trim();
    const history = Array.isArray(body.history) ? body.history.slice(-8) : [];

    if (!rawSymbol) {
      const modeForMarket = mode === "overview" ? "market" : mode;
      const context = await gatherExternalContext({
        symbol: "",
        rawSymbol: "",
        name: "",
        market,
        mode: modeForMarket,
        message,
      });
      const openAiResult = await callOpenAI({
        symbol: "",
        name: "",
        market,
        mode: modeForMarket,
        message,
        history,
        candles: [],
        metrics: {},
        context,
      });

      sendJson(res, 200, {
        symbol: "",
        name: "",
        mode: modeForMarket,
        market,
        currency: "",
        chartPeriod,
        chartRange,
        periodLabel: chartPeriodLabel(chartPeriod),
        metrics: {},
        candles: [],
        answer: openAiResult.answer,
        suggestions: openAiResult.suggestions,
        sources: mergeSources(context.sources, openAiResult.sources),
      });
      return;
    }

    const symbol = await normalizeYahooSymbol(rawSymbol, market);
    const candles = await fetchCandles({ symbol, rawSymbol, market, period: chartPeriod, range: chartRange });
    const metrics = calculateMetrics(candles, chartPeriod, chartRange);

    if (chartOnly) {
      sendJson(res, 200, {
        symbol,
        name,
        mode,
        market,
        metrics,
        currency: inferCurrency(symbol),
        chartPeriod,
        chartRange,
        periodLabel: chartPeriodLabel(chartPeriod),
        candles,
        answer: "",
        suggestions: [],
        sources: [],
      });
      return;
    }

    const context = await gatherExternalContext({
      symbol,
      rawSymbol,
      name,
      market,
      mode,
      message,
    });
    const openAiResult = await callOpenAI({
      symbol,
      name,
      market,
      mode,
      message,
      history,
      candles,
      metrics,
      context,
    });

    sendJson(res, 200, {
      symbol,
      name,
      mode,
      market,
      metrics,
      currency: inferCurrency(symbol),
      chartPeriod,
      chartRange,
      periodLabel: chartPeriodLabel(chartPeriod),
      rangeLabel: chartRangeLabel(chartRange),
      candles,
      answer: openAiResult.answer,
      suggestions: openAiResult.suggestions,
      sources: mergeSources(context.sources, openAiResult.sources),
    });
  } catch (error) {
    sendJson(res, 500, {
      error: error.message || "처리 중 오류가 발생했습니다.",
    });
  }
};

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

function readJson(req) {
  if (req.body && typeof req.body === "object") {
    return Promise.resolve(req.body);
  }

  if (typeof req.body === "string") {
    try {
      return Promise.resolve(JSON.parse(req.body));
    } catch {
      return Promise.reject(new Error("요청 형식이 올바르지 않습니다."));
    }
  }

  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
    });
    req.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(new Error("요청 형식이 올바르지 않습니다."));
      }
    });
    req.on("error", reject);
  });
}

function normalizeMode(mode) {
  const value = String(mode || "overview").toLowerCase();
  if (["overview", "market", "news", "technical", "fundamental"].includes(value)) return value;
  return "overview";
}

async function normalizeYahooSymbol(input, market = "") {
  const symbol = String(input || "").trim().toUpperCase();
  if (!symbol) return "";
  if (symbol.includes(".")) return symbol;

  if (/^\d{6}$/.test(symbol)) {
    const marketText = String(market || "").toUpperCase();
    if (marketText.includes("KOSDAQ")) return `${symbol}.KQ`;
    if (marketText.includes("KOSPI")) return `${symbol}.KS`;
    const candidates = [`${symbol}.KQ`, `${symbol}.KS`];
    for (const candidate of candidates) {
      if (await hasYahooChartData(candidate)) return candidate;
    }
  }

  return symbol;
}

async function hasYahooChartData(symbol) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    symbol,
  )}?range=1mo&interval=1d`;

  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 Stockr/0.2" },
    });
    if (!response.ok) return false;
    const payloadText = await response.text();
  const payload = JSON.parse(payloadText);
    const result = payload.chart?.result?.[0];
    return Boolean(result?.timestamp?.length);
  } catch {
    return false;
  }
}

function normalizeChartPeriod(period) {
  const value = String(period || "d").toLowerCase();
  if (["d", "w", "m"].includes(value)) return value;
  return "d";
}

function chartPeriodLabel(period) {
  const map = {
    d: "일봉",
    w: "주봉",
    m: "월봉",
  };
  return map[normalizeChartPeriod(period)] || map.d;
}

function normalizeChartRange(range) {
  const value = String(range || "1m").toLowerCase();
  if (["1m", "3m", "6m", "1y", "3y"].includes(value)) return value;
  return "1m";
}

function chartRangeLabel(range) {
  const map = {
    "1m": "1개월",
    "3m": "3개월",
    "6m": "6개월",
    "1y": "1년",
    "3y": "3년",
  };
  return map[normalizeChartRange(range)] || map["1m"];
}

function chartLimitForRangePeriod(range, period) {
  const value = normalizeChartRange(range);
  const unit = normalizeChartPeriod(period);
  const limits = {
    d: { "1m": 22, "3m": 66, "6m": 132, "1y": 260, "3y": 780 },
    w: { "1m": 5, "3m": 13, "6m": 26, "1y": 52, "3y": 156 },
    m: { "1m": 2, "3m": 4, "6m": 7, "1y": 12, "3y": 36 },
  };
  return limits[unit]?.[value] || limits.d["1m"];
}

function chartFetchLimitForRangePeriod(range, period) {
  const visibleLimit = chartLimitForRangePeriod(range, period);
  const unit = normalizeChartPeriod(period);
  const minimumForIndicators = unit === "d" ? 260 : unit === "w" ? 52 : 12;
  return Math.max(visibleLimit, minimumForIndicators);
}

function yahooRangeForChartRange(range) {
  const value = normalizeChartRange(range);
  return value === "3y" ? "3y" : "1y";
}

async function fetchCandles({ symbol, rawSymbol, market, period, range }) {
  const normalizedPeriod = normalizeChartPeriod(period);
  const normalizedRange = normalizeChartRange(range);
  if (isDomesticSymbol(symbol, rawSymbol, market)) {
    try {
      return await fetchIamChartCandles({ symbol, rawSymbol, market, period: normalizedPeriod, range: normalizedRange });
    } catch (iamError) {
      try {
        return await fetchYahooCandles(symbol, normalizedPeriod, normalizedRange);
      } catch {
        throw new Error(`국내 차트 데이터를 불러오지 못했습니다. IamChart 연결 실패: ${iamError.message || "fetch failed"}`);
      }
    }
  }
  return fetchYahooCandles(symbol, normalizedPeriod, normalizedRange);
}

function isDomesticSymbol(symbol, rawSymbol, market) {
  const value = String(symbol || rawSymbol || "");
  const combined = `${symbol || ""} ${rawSymbol || ""} ${market || ""}`.toUpperCase();
  return /^\d{6}(?:\.(KS|KQ))?$/i.test(value) || /KOSPI|KOSDAQ|\.KS|\.KQ/.test(combined);
}

async function fetchIamChartCandles({ symbol, rawSymbol, market, period, range }) {
  const code = stripExchangeSuffix(symbol || rawSymbol || "");
  if (!/^\d{6}$/.test(code)) {
    throw new Error(`국내 종목코드가 올바르지 않습니다: ${code || symbol}`);
  }

  const params = new URLSearchParams({
    market: iamChartMarket({ symbol, rawSymbol, market }),
    period: normalizeChartPeriod(period),
    code,
    limit: String(chartFetchLimitForRangePeriod(range, period)),
  });
  const url = `${IAMCHART_HISTORY_URL}?${params.toString()}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3500);

  const response = await fetch(url, {
    signal: controller.signal,
    headers: {
      "User-Agent": "Mozilla/5.0 Stockr/0.5",
      Accept: "application/json,text/plain,*/*",
      Referer: "https://www.iamchart.com/",
    },
  }).finally(() => clearTimeout(timeout));

  if (!response.ok) {
    throw new Error(`IamChart 조회 실패: ${code}`);
  }

  const payloadText = await response.text();
  const payload = JSON.parse(payloadText);
  const resultCode = Number(payload?.Result?.ResultCode ?? 0);
  if (resultCode !== 0) {
    throw new Error(payload?.Result?.ResultMsg || `IamChart 데이터가 없습니다: ${code}`);
  }

  const rows = Array.isArray(payload?.ResultData) ? payload.ResultData : [];
  const candles = rows
    .map(normalizeIamChartRow)
    .filter(Boolean)
    .sort((a, b) => a.date.localeCompare(b.date));

  if (candles.length < 2) {
    throw new Error(`유효한 차트 데이터가 부족합니다: ${code}`);
  }

  return candles;
}

function iamChartMarket({ symbol, rawSymbol, market }) {
  const text = `${symbol || ""} ${rawSymbol || ""} ${market || ""}`.toUpperCase();
  if (text.includes("KOSDAQ") || text.includes(".KQ")) return "kosdaq";
  return "kospi";
}

function normalizeIamChartRow(row) {
  const clean = {};
  for (const [key, value] of Object.entries(row || {})) {
    clean[String(key || "").replace(/\s+/g, "")] = value;
  }

  const date = formatIamChartDate(clean.bzDd);
  const open = parseCompactNumber(clean.opnPrc);
  const high = parseCompactNumber(clean.hgPrc);
  const low = parseCompactNumber(clean.lwPrc);
  const close = parseCompactNumber(clean.trdPrc);
  const volume = parseCompactNumber(clean.accTrdvol) ?? 0;

  if (!date || [open, high, low, close].some((value) => !Number.isFinite(value))) return null;

  return {
    date,
    open,
    high,
    low,
    close,
    volume,
  };
}

function formatIamChartDate(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length < 8) return "";
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
}

function parseCompactNumber(value) {
  if (value == null) return null;
  const cleaned = String(value).replace(/[^0-9.-]/g, "");
  if (!cleaned || cleaned === "-" || cleaned === ".") return null;
  const number = Number(cleaned);
  return Number.isFinite(number) ? number : null;
}

async function fetchYahooCandles(symbol, period = "d", range = "1m") {
  const config = yahooPeriodConfig(period, range);
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    symbol,
  )}?range=${config.range}&interval=${config.interval}&events=history&includeAdjustedClose=true`;

  const response = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 Stockr/0.2" },
  });

  if (!response.ok) {
    throw new Error(`Yahoo Finance 조회 실패: ${symbol}`);
  }

  const payloadText = await response.text();
  const payload = JSON.parse(payloadText);
  const chart = payload.chart;
  if (!chart || chart.error) {
    throw new Error(chart?.error?.description || `시세 데이터가 없습니다: ${symbol}`);
  }

  const result = chart.result?.[0];
  if (!result || !Array.isArray(result.timestamp)) {
    throw new Error(`시세 데이터가 없습니다: ${symbol}`);
  }
  const timestamps = result.timestamp || [];
  const quote = result?.indicators?.quote?.[0] || {};
  const rows = [];

  for (let i = 0; i < timestamps.length; i += 1) {
    const open = quote.open?.[i];
    const high = quote.high?.[i];
    const low = quote.low?.[i];
    const close = quote.close?.[i];
    const volume = quote.volume?.[i];

    if ([open, high, low, close, volume].some((value) => value == null)) continue;

    rows.push({
      date: new Date(timestamps[i] * 1000).toISOString().slice(0, 10),
      open,
      high,
      low,
      close,
      volume,
    });
  }

  const candles = rows.slice(-chartFetchLimitForRangePeriod(range, period));
  if (candles.length < 2) {
    throw new Error(`유효한 차트 데이터가 부족합니다: ${symbol}`);
  }

  return candles;
}

function yahooPeriodConfig(period, range = "1m") {
  const value = normalizeChartPeriod(period);
  const yahooRange = yahooRangeForChartRange(range);
  if (value === "w") return { interval: "1wk", range: yahooRange };
  if (value === "m") return { interval: "1mo", range: yahooRange };
  return { interval: "1d", range: yahooRange };
}

function calculateMetrics(candles, period = "d", range = "1m") {
  if (!Array.isArray(candles) || candles.length < 2) return {};
  const closes = candles.map((item) => item.close);
  const volumes = candles.map((item) => item.volume);
  const last = candles[candles.length - 1];
  const previous = candles[candles.length - 2];
  const recent60 = candles.slice(-60);
  const recent120 = candles.slice(-120);

  return {
    chartPeriod: normalizeChartPeriod(period),
    chartRange: normalizeChartRange(range),
    periodLabel: chartPeriodLabel(period),
    lastDate: last.date,
    lastClose: last.close,
    previousClose: previous.close,
    changePercent: ((last.close - previous.close) / previous.close) * 100,
    lastVolume: last.volume,
    averageVolume20: average(volumes.slice(-20)),
    sma20: average(closes.slice(-20)),
    sma60: average(closes.slice(-60)),
    sma120: average(closes.slice(-120)),
    rsi14: calculateRsi(closes, 14),
    support60: Math.min(...recent60.map((item) => item.low)),
    resistance60: Math.max(...recent60.map((item) => item.high)),
    high120: Math.max(...recent120.map((item) => item.high)),
    low120: Math.min(...recent120.map((item) => item.low)),
  };
}

function average(values) {
  const usable = values.filter((value) => Number.isFinite(value));
  if (!usable.length) return null;
  return usable.reduce((sum, value) => sum + value, 0) / usable.length;
}

function calculateRsi(closes, period) {
  if (closes.length <= period) return null;

  const recent = closes.slice(-(period + 1));
  let gains = 0;
  let losses = 0;

  for (let i = 1; i < recent.length; i += 1) {
    const diff = recent[i] - recent[i - 1];
    if (diff >= 0) gains += diff;
    else losses += Math.abs(diff);
  }

  const averageGain = gains / period;
  const averageLoss = losses / period;
  if (averageLoss === 0) return 100;
  const rs = averageGain / averageLoss;
  return 100 - 100 / (1 + rs);
}

async function gatherExternalContext({ symbol, rawSymbol, name, market, mode, message }) {
  const notes = [];
  const sources = [];
  const plainSymbol = stripExchangeSuffix(symbol || rawSymbol || "");
  const queryName = name || plainSymbol || "한국 증시";

  sources.push(...buildSearchSources({ symbol: plainSymbol, name: queryName, market, mode, message }));

  const wantsTheme = mode === "market" || /테마|유망|섹터|시장/.test(message);
  const wantsUpjong = mode === "market" || /업종|업종 상위|산업/.test(message);
  const wantsFundamental = Boolean(plainSymbol && /^\d{6}$/.test(plainSymbol) && (mode === "fundamental" || /기본|실적|재무|per|pbr|밸류|fn가이드|fnguide/i.test(message)));

  const tasks = [];
  if (wantsTheme) tasks.push(fetchNaverRanking(NAVER_THEME_URL, "네이버 테마 상위"));
  if (wantsUpjong) tasks.push(fetchNaverRanking(NAVER_UPJONG_URL, "네이버 업종 상위"));
  if (wantsFundamental) tasks.push(fetchFnGuide(plainSymbol));

  const settled = await Promise.allSettled(tasks);
  for (const item of settled) {
    if (item.status !== "fulfilled" || !item.value) continue;
    if (item.value.note) notes.push(item.value.note);
    if (item.value.sources) sources.push(...item.value.sources);
  }

  return {
    notes,
    sources: mergeSources(sources, []),
  };
}

function buildSearchSources({ symbol, name, market, mode, message }) {
  const baseQuery = [name, symbol].filter(Boolean).join(" ").trim() || "한국 증시";
  const sources = [];

  if (mode === "news" || /뉴스|이슈|왜 오르|왜 내리|호재|악재/.test(message)) {
    const newsSources = stockNewsSources({ symbol, name, market });
    if (newsSources.length) {
      sources.push(...newsSources);
    } else {
      sources.push({
        title: `${name || symbol || "시장"} 뉴스`,
        url: `https://news.naver.com/main/search/search.naver?query=${encodeURIComponent(`${baseQuery} 주가 뉴스`)}`,
      });
    }
  }

  if (mode === "market" || /테마|유망/.test(message)) {
    sources.push({ title: "네이버 테마", url: NAVER_THEME_URL });
  }

  if (mode === "market" || /업종/.test(message)) {
    sources.push({ title: "네이버 업종별 시세", url: NAVER_UPJONG_URL });
  }

  if (/^\d{6}$/.test(symbol || "") && (mode === "fundamental" || /기본|실적|재무|밸류|fn가이드|fnguide/i.test(message))) {
    sources.push({ title: "FnGuide 기업 정보", url: fnGuideUrl(symbol) });
  }

  return sources;
}

function stockNewsSources({ symbol, name, market }) {
  const plainSymbol = stripExchangeSuffix(symbol || "");
  const upper = String(plainSymbol || "").toUpperCase();
  const label = name || upper || plainSymbol;

  if (!upper) return [];

  if (/^\d{6}$/.test(upper)) {
    return [
      {
        title: `${label} 네이버 종목뉴스`,
        url: `https://m.stock.naver.com/domestic/stock/${upper}/news`,
      },
    ];
  }

  if (upper.includes("-USD") || /CRYPTO/i.test(market || "")) {
    const coin = upper.replace(/-USD$/i, "");
    return [
      {
        title: `${coin} 업비트 뉴스`,
        url: `https://m.stock.naver.com/crypto/UPBIT/${coin}/news/marketUpdates`,
      },
      {
        title: `${coin} 빗썸 뉴스`,
        url: `https://m.stock.naver.com/crypto/BITHUMB/${coin}/news/marketUpdates`,
      },
    ];
  }

  const naverSymbol = toNaverWorldNewsSymbol(upper, market);
  if (!naverSymbol) return [];

  return [
    {
      title: `${label} 네이버 해외뉴스`,
      url: `https://m.stock.naver.com/worldstock/stock/${naverSymbol}/worldNews`,
    },
  ];
}

function toNaverWorldNewsSymbol(symbol, market) {
  const code = String(symbol || "").trim().toUpperCase().replace(/-/g, ".");
  if (!code) return "";

  const marketText = String(market || "").toUpperCase();
  if (marketText.includes("NASDAQ")) return `${code}.O`;
  if (marketText.includes("NYSE") || marketText.includes("BATS") || marketText.includes("IEX")) return `${code}.K`;
  if (marketText.includes("AMEX") || marketText.includes("AMERICAN")) return `${code}.A`;

  return `${code}.K`;
}

async function fetchNaverRanking(url, label) {
  const html = await fetchKoreanHtml(url);
  const rows = parseLinkedRows(html).slice(0, 8);
  if (!rows.length) return null;

  return {
    note: {
      label,
      items: rows.map((row) => `${row.name}${row.change ? ` ${row.change}` : ""}`),
    },
    sources: [{ title: label, url }],
  };
}

async function fetchFnGuide(symbol) {
  const url = fnGuideUrl(symbol);
  const html = await fetchKoreanHtml(url);
  const text = htmlToText(html).slice(0, 2200);
  return {
    note: {
      label: "FnGuide 기업 정보",
      url,
      summaryText: text,
    },
    sources: [{ title: "FnGuide 기업 정보", url }],
  };
}

async function fetchKoreanHtml(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1800);

  const response = await fetch(url, {
    signal: controller.signal,
    headers: {
      "User-Agent": "Mozilla/5.0 Stockr/0.3",
      Accept: "text/html,application/xhtml+xml",
    },
  }).finally(() => clearTimeout(timeout));
  if (!response.ok) throw new Error(`${safeHostname(url)} 조회 실패`);
  const buffer = await response.arrayBuffer();
  return decodeKorean(buffer);
}

function decodeKorean(buffer) {
  const bytes = new Uint8Array(buffer);
  try {
    return new TextDecoder("euc-kr").decode(bytes);
  } catch {
    return new TextDecoder("utf-8").decode(bytes);
  }
}

function parseLinkedRows(html) {
  const rows = [];
  const rowMatches = String(html || "").match(/<tr[\s\S]*?<\/tr>/gi) || [];
  for (const row of rowMatches) {
    const link = row.match(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i);
    if (!link) continue;
    const name = htmlToText(link[2]);
    if (!name || name.length < 2 || /토론|뉴스|시세/.test(name)) continue;
    const change = (htmlToText(row).match(/[+-]?\d+(?:\.\d+)?%/) || [])[0] || "";
    rows.push({ name, change });
  }
  return uniqueBy(rows, (item) => item.name);
}

function htmlToText(html) {
  return String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function fnGuideUrl(symbol) {
  return `https://comp.fnguide.com/SVO2/ASP/SVD_main.asp?pGB=1&gicode=A${stripExchangeSuffix(symbol)}&cID=&MenuYn=Y&ReportGB=&NewMenuID=11&stkGb=&strResearchYN=`;
}

function stripExchangeSuffix(symbol) {
  return String(symbol || "").replace(/\.(KS|KQ)$/i, "");
}

function shouldUseWebSearch(mode, message) {
  if (mode === "market") {
    return /뉴스|최신|실시간|이슈|오늘 왜|왜 오르|왜 내리/.test(message);
  }

  return (
    mode === "news" ||
    mode === "fundamental" ||
    /뉴스|이슈|왜 오르|왜 내리|호재|악재|검색/.test(message)
  );
}

async function callOpenAI({ symbol, name, market, mode, message, history, candles, metrics, context }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return {
      answer: "OpenAI API 키가 아직 설정되지 않았습니다. Vercel 환경 변수에 OPENAI_API_KEY를 넣으면 분석 답변이 생성됩니다.",
      suggestions: fallbackSuggestions(mode),
      sources: [],
    };
  }

  const prompt = buildPromptV2({ symbol, name, market, mode, message, history, candles, metrics, context });
  const model = process.env.OPENAI_MODEL || DEFAULT_MODEL;
  const payload = {
    model,
    input: prompt,
    max_output_tokens: 1100,
  };

  if (shouldUseWebSearch(mode, message)) {
    payload.tools = [{ type: "web_search" }];
  }

  const result = await requestOpenAI(payload, apiKey);
  const text = extractText(result);
  const parsed = parseAssistantJson(text, symbol, mode);

  return {
    answer: parsed.answer,
    suggestions: parsed.suggestions,
    sources: extractSources(result),
  };
}

async function requestOpenAI(payload, apiKey) {
  let response = await postOpenAI(payload, apiKey);
  let data = await response.json().catch(() => ({}));

  if (!response.ok && payload.tools && JSON.stringify(data).includes("web_search")) {
    response = await postOpenAI({ ...payload, tools: [{ type: "web_search_preview" }] }, apiKey);
    data = await response.json().catch(() => ({}));
  }

  if (!response.ok && payload.tools) {
    const { tools, ...withoutTools } = payload;
    response = await postOpenAI(withoutTools, apiKey);
    data = await response.json().catch(() => ({}));
  }

  if (!response.ok) {
    throw new Error(data.error?.message || "OpenAI API 호출에 실패했습니다.");
  }

  return data;
}

function postOpenAI(payload, apiKey) {
  return fetch(OPENAI_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

function buildPromptV2({ symbol, name, market, mode, message, history, candles, metrics, context }) {
  const safeCandles = Array.isArray(candles) ? candles : [];
  const compactCandles = safeCandles.slice(-100).map((item) => ({
    d: item.date,
    o: round(item.open),
    h: round(item.high),
    l: round(item.low),
    c: round(item.close),
    v: item.volume,
  }));

  const taskByMode = {
    overview: "사용자의 질문 의도를 먼저 보고, 현재 종목을 쉽게 요약하세요.",
    market: "종목이 없어도 답하세요. 현재 시장 분위기, 강한 테마, 업종 흐름을 쉽게 설명하세요.",
    news: "실시간 정보가 필요한 질문입니다. 검색 결과와 제공된 링크 정보를 반영해 핵심만 설명하세요.",
    technical: "제공된 차트 데이터로 추세, 거래량, 지지선과 저항선을 쉽게 설명하세요.",
    fundamental: "FnGuide에서 가져온 정보와 공개 정보를 바탕으로 실적, 재무 안정성, 밸류에이션을 쉽게 설명하세요.",
  };

  return [
    "당신은 Stockr의 주식 대화 도우미입니다.",
    "반드시 JSON 하나만 반환하세요. 설명, 코드블록, 마크다운은 쓰지 마세요.",
    "JSON 형식은 {\"answer\":\"...\",\"suggestions\":[\"...\",\"...\",\"...\"]} 입니다.",
    "answer는 한국어로 작성하세요. 어려운 용어는 쉽게 풀어 말하세요.",
    "문장 하나를 길게 늘이지 마세요. 한 문장은 되도록 25~45자 안쪽으로 짧게 끊어 쓰세요.",
    "쉼표로 여러 생각을 이어 붙이지 말고, 짧은 문장 2개로 나눠 쓰세요.",
    "answer는 3단락으로 나누세요. 전체 길이는 700~900자 안쪽으로 유지하세요.",
    "첫 줄은 핵심 판단, 중간은 2~3개의 짧은 요약, 마지막 줄은 조심할 점이나 다음 확인 포인트입니다.",
    "중간 요약은 각 줄을 'ㆍ'으로 시작하세요. 하이픈이나 별표는 쓰지 마세요.",
    "단락 제목으로 '결론', '불렛 포인트 요약', '마무리'라는 단어를 직접 쓰지 마세요.",
    "같은 글자나 기호를 반복하지 마세요. 답변이 끊길 것 같으면 마지막 문장을 짧게 마무리하세요.",
    "매수나 매도 지시는 하지 말고 참고용 해석으로 말하세요.",
    "현재 종목이 새로 지정되었다면 이전 대화의 다른 종목과 섞지 마세요.",
    "suggestions는 사용자가 다음에 누를 수 있는 짧고 쉬운 질문 3개로 만드세요.",
    "suggestions는 단어를 억지로 줄이지 말고, 처음 보는 사람도 뜻을 바로 알 수 있게 쓰세요.",
    "suggestions는 매번 다르게 만들고, 기본적 분석, 뉴스, 테마, 업종 상위, 종목 뉴스, 시장 분위기 질문을 섞어도 됩니다.",
    "테마, 업종, 시장 질문일 때 suggestions 중 하나는 관련 종목을 묻는 질문으로 만드세요.",
    "사용자 질문에 없는 낯선 티커나 회사명을 suggestions에 갑자기 넣지 마세요.",
    "suggestions는 각 문장을 16~42자 정도의 자연스러운 질문으로 쓰세요.",
    "suggestions의 각 문장은 반드시 완성된 의문문으로 끝내고, 끝에 물음표를 붙이세요.",
    "",
    `현재 종목: ${symbol || "지정 없음"}`,
    `종목명: ${name || "지정 없음"}`,
    `시장 구분: ${market || "지정 없음"}`,
    `요청 유형: ${mode}`,
    `사용자 질문: ${message || "짧게 분석해줘"}`,
    `작업 지시: ${taskByMode[mode] || taskByMode.overview}`,
    "",
    "이전 대화:",
    JSON.stringify(Array.isArray(history) ? history : [], null, 2),
    "",
    "계산된 지표:",
    JSON.stringify(metrics || {}, null, 2),
    "",
    "최근 차트 데이터:",
    JSON.stringify(compactCandles, null, 2),
    "",
    "외부 참고 정보:",
    JSON.stringify(context?.notes || [], null, 2),
  ].join("\n");
}

function buildPrompt({ symbol, name, mode, message, history, candles, metrics }) {
  const safeCandles = Array.isArray(candles) ? candles : [];
  const compactCandles = safeCandles.slice(-100).map((item) => ({
    d: item.date,
    o: round(item.open),
    h: round(item.high),
    l: round(item.low),
    c: round(item.close),
    v: item.volume,
  }));

  const taskByMode = {
    overview: "사용자의 질문 의도를 우선 반영해서 현재 종목을 간단히 해석하세요.",
    market: "종목이 지정되지 않은 시장 질문입니다. 현재 시장 분위기, 주요 테마, 섹터 흐름, 금리·환율 같은 큰 변수를 간단히 해석하세요.",
    news: "최신 뉴스와 이슈가 필요하면 검색 결과를 반영하되, 확인 가능한 내용만 간단히 해석하세요.",
    technical: "제공된 차트 데이터 기준으로 추세, 이동평균, 지지선, 저항선, 거래량, RSI를 간단히 해석하세요.",
    fundamental: "공개 정보와 사용자 질문을 바탕으로 실적, 재무 안정성, 밸류에이션 관점을 간단히 해석하세요.",
  };

  return [
    "당신은 Stockr의 한국어 주식 대화 보조자입니다.",
    "반드시 JSON 하나만 반환하세요. 설명, 코드블록, 마크다운, 목록, 제목을 쓰지 마세요.",
    "JSON 형식은 {\"answer\":\"...\",\"suggestions\":[\"...\",\"...\",\"...\"]} 입니다.",
    "answer는 한국어 한 단락, 420자 이내, 줄바꿈 없이 작성하세요.",
    "answer에는 굵게, 별표, 번호, 대괄호, 링크 마크다운을 절대 쓰지 마세요.",
    "매수/매도 지시를 하지 말고 참고용 해석으로 말하세요.",
    "suggestions는 앞선 대화, 현재 질문, 방금 만든 answer를 바탕으로 사용자가 다음에 궁금해할 만한 질문 3개를 새로 만드세요.",
    "suggestions는 고정 문구가 아니라 맥락별로 달라야 하며, 각 문장은 클릭 가능한 버튼 문구처럼 16~34자 정도의 자연스러운 질문으로 쓰세요.",
    "",
    `종목: ${symbol || "지정 없음"}`,
    `종목명: ${name || "지정 없음"}`,
    `요청 유형: ${mode}`,
    `사용자 질문: ${message || "이 종목을 짧게 분석해줘"}`,
    `작업: ${taskByMode[mode]}`,
    "",
    "최근 대화:",
    JSON.stringify(Array.isArray(history) ? history : [], null, 2),
    "",
    "계산된 지표:",
    JSON.stringify(metrics || {}, null, 2),
    "",
    "최근 차트 데이터:",
    JSON.stringify(compactCandles, null, 2),
  ].join("\n");
}

function parseAssistantJson(text, symbol, mode) {
  const source = String(text || "").trim();
  const fallback = {
    answer: sanitizeAnswer(extractAnswerFromJsonLike(source) || source || `${stripExchangeSuffix(symbol) || "시장"} 기준으로 답변을 만들지 못했습니다.\n\n질문을 조금 더 구체적으로 입력하면 다시 확인하겠습니다.`),
    suggestions: fallbackSuggestions(mode),
  };

  const jsonText = extractJsonObject(source);
  if (!jsonText) return fallback;

  try {
    const parsed = JSON.parse(jsonText);
    const answer = sanitizeAnswer(parsed.answer || extractAnswerFromJsonLike(source));
    const suggestions = normalizeSuggestions(parsed.suggestions, mode);
    return { answer: answer || fallback.answer, suggestions };
  } catch {
    const answer = sanitizeAnswer(extractAnswerFromJsonLike(source));
    const suggestions = normalizeSuggestions(extractSuggestionsFromJsonLike(source), mode);
    return { answer: answer || fallback.answer, suggestions };
  }
}

function extractAnswerFromJsonLike(text) {
  const source = String(text || "").trim();
  if (!source) return "";
  try {
    const parsed = JSON.parse(source);
    if (parsed && typeof parsed.answer === "string") return parsed.answer;
  } catch {}

  const match = source.match(/"answer"\s*:\s*"([\s\S]*?)(?<!\\)"\s*,\s*"suggestions"/);
  if (!match) return "";
  return unescapeLooseJsonString(match[1]);
}

function extractSuggestionsFromJsonLike(text) {
  const source = String(text || "");
  try {
    const parsed = JSON.parse(source);
    return Array.isArray(parsed?.suggestions) ? parsed.suggestions : [];
  } catch {}

  const match = source.match(/"suggestions"\s*:\s*\[([\s\S]*?)\]/);
  if (!match) return [];
  return [...match[1].matchAll(/"([\s\S]*?)(?<!\\)"/g)]
    .map((item) => unescapeLooseJsonString(item[1]))
    .filter(Boolean)
    .slice(0, 3);
}

function unescapeLooseJsonString(value) {
  return String(value || "")
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\n")
    .replace(/\\t/g, " ")
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, "\\")
    .trim();
}

function extractJsonObject(text) {
  const withoutFence = text.replace(/```(?:json)?/gi, "").replace(/```/g, "").trim();
  const start = withoutFence.indexOf("{");
  const end = withoutFence.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return "";
  return withoutFence.slice(start, end + 1);
}

function sanitizeAnswer(value) {
  const text = cleanAnswer(value);
  return text || "";
}

function normalizeSuggestions(value, mode) {
  const items = Array.isArray(value) ? value : [];
  const cleaned = items.map(normalizeQuestion).filter(Boolean).slice(0, 3);
  while (cleaned.length < 3) {
    cleaned.push(normalizeQuestion(fallbackSuggestions(mode)[cleaned.length]));
  }
  return cleaned.slice(0, 3);
}

function fallbackSuggestions(mode) {
  const common = {
    overview: [
      "지금 흐름은 괜찮은가요?",
      "중요한 가격대는 어디인가요?",
      "최근 뉴스는 주가에 어떤가요?",
      "실적 기준으로는 어떤가요?",
      "관련 테마도 같이 볼까요?",
    ],
    market: [
      "오늘 강한 테마는 무엇인가요?",
      "그 테마에는 어떤 종목이 있나요?",
      "업종 상위 흐름은 어디가 강한가요?",
      "지금 시장 리스크는 무엇인가요?",
      "코스닥 분위기는 어떤가요?",
    ],
    news: [
      "이 뉴스가 주가에 중요한가요?",
      "호재와 악재를 나눠볼까요?",
      "단기 영향은 어느 정도인가요?",
      "새로 확인할 이슈가 있나요?",
      "네이버 종목뉴스 핵심은 뭔가요?",
    ],
    technical: [
      "저항선은 넘었다고 볼 수 있나요?",
      "거래량은 의미 있게 늘었나요?",
      "가까운 지지선은 어디인가요?",
      "차트보다 뉴스가 더 중요한가요?",
      "같은 테마 종목도 강한가요?",
    ],
    fundamental: [
      "실적은 좋아지는 흐름인가요?",
      "현재 가격 부담은 큰 편인가요?",
      "재무 안정성은 괜찮은가요?",
      "꼭 볼 핵심 숫자는 무엇인가요?",
      "관련 테마도 받쳐주고 있나요?",
    ],
  };
  return shuffle(common[mode] || common.overview).slice(0, 3);
}

function inferCurrency(symbol) {
  return /^\d{6}\.(KS|KQ)$/i.test(String(symbol || "")) ? "KRW" : "USD";
}

function extractText(result) {
  if (result.output_text) return result.output_text;

  const chunks = [];
  for (const item of result.output || []) {
    for (const content of item.content || []) {
      if (content.type === "output_text" && content.text) chunks.push(content.text);
      if (content.type === "text" && content.text) chunks.push(content.text);
    }
  }
  return chunks.join("\n").trim();
}

function extractSources(result) {
  const seen = new Set();
  const sources = [];

  for (const item of result.output || []) {
    for (const content of item.content || []) {
      const annotations = content.annotations || [];
      for (const annotation of annotations) {
        const url = annotation.url || annotation.uri;
        if (!url || seen.has(url)) continue;
        seen.add(url);
        sources.push({
          title: annotation.title || safeHostname(url),
          url,
        });
      }
    }
  }

  return sources;
}

function mergeSources(...groups) {
  const seen = new Set();
  const merged = [];
  for (const group of groups) {
    for (const source of group || []) {
      if (!source?.url || seen.has(source.url)) continue;
      seen.add(source.url);
      merged.push({
        title: plainText(source.title || safeHostname(source.url)).slice(0, 120),
        url: source.url,
      });
    }
  }
  return merged.slice(0, 8);
}

function uniqueBy(items, keyFn) {
  const seen = new Set();
  return items.filter((item) => {
    const key = keyFn(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function shuffle(items) {
  const rows = [...items];
  for (let i = rows.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [rows[i], rows[j]] = [rows[j], rows[i]];
  }
  return rows;
}

function safeHostname(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return "출처";
  }
}

function cleanAnswer(value) {
  return String(value || "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/\[(.*?)\]\((.*?)\)/g, "$1")
    .replace(/[`>#]/g, "")
    .replace(/乂+/g, "")
    .replace(/([^\s])\1{8,}/gu, "$1$1$1")
    .split(/\n+/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n")
    .trim();
}

function normalizeQuestion(value) {
  let text = plainText(value).replace(/[.。!！]+$/g, "").trim();
  if (!text) return "";
  if (text.length > 48) {
    text = text
      .replace(/해당 종목/g, "종목")
      .replace(/현재 /g, "")
      .replace(/쉽게 /g, "")
      .replace(/알려줄 수 있나요/g, "알려줘")
      .replace(/볼 수 있나요/g, "볼까요")
      .trim();
  }
  if (text.length > 48) text = text.slice(0, 48).replace(/[,\s·ㆍ]+$/g, "");
  return /[?？]$/.test(text) ? text : `${text}?`;
}

function plainText(value) {
  return String(value || "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/\[(.*?)\]\((.*?)\)/g, "$1")
    .replace(/[`*_>#-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function round(value) {
  return Number.isFinite(value) ? Number(value.toFixed(4)) : value;
}

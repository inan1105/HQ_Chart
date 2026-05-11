const STORAGE_KEY = "stockr.conversations.v1";

const COMMON_ALIASES = [
  { aliases: ["삼성전자", "삼전"], symbol: "005930", yahoo: "005930.KS", name: "삼성전자", country: "KR", market: "KOSPI" },
  { aliases: ["현대차", "현대자동차"], symbol: "005380", yahoo: "005380.KS", name: "현대차", country: "KR", market: "KOSPI" },
  { aliases: ["기아"], symbol: "000270", yahoo: "000270.KS", name: "기아", country: "KR", market: "KOSPI" },
  { aliases: ["sk하이닉스", "하이닉스"], symbol: "000660", yahoo: "000660.KS", name: "SK하이닉스", country: "KR", market: "KOSPI" },
  { aliases: ["셀트리온"], symbol: "068270", yahoo: "068270.KS", name: "셀트리온", country: "KR", market: "KOSPI" },
  { aliases: ["테슬라"], symbol: "TSLA", yahoo: "TSLA", name: "Tesla", country: "US", market: "NASDAQ" },
  { aliases: ["애플"], symbol: "AAPL", yahoo: "AAPL", name: "Apple", country: "US", market: "NASDAQ" },
  { aliases: ["엔비디아"], symbol: "NVDA", yahoo: "NVDA", name: "NVIDIA", country: "US", market: "NASDAQ" },
  { aliases: ["마이크로소프트", "마소"], symbol: "MSFT", yahoo: "MSFT", name: "Microsoft", country: "US", market: "NASDAQ" },
  { aliases: ["구글", "알파벳"], symbol: "GOOGL", yahoo: "GOOGL", name: "Alphabet", country: "US", market: "NASDAQ" },
  { aliases: ["아마존"], symbol: "AMZN", yahoo: "AMZN", name: "Amazon", country: "US", market: "NASDAQ" },
  { aliases: ["메타", "페이스북"], symbol: "META", yahoo: "META", name: "Meta", country: "US", market: "NASDAQ" },
  { aliases: ["넷플릭스"], symbol: "NFLX", yahoo: "NFLX", name: "Netflix", country: "US", market: "NASDAQ" },
];

const CRYPTO_ALIASES = [
  ["비트코인", "bitcoin", "btc", "BTC-USD", "Bitcoin"],
  ["이더리움", "ethereum", "eth", "ETH-USD", "Ethereum"],
  ["리플", "엑스알피", "xrp", "XRP-USD", "XRP"],
  ["솔라나", "solana", "sol", "SOL-USD", "Solana"],
  ["바이낸스코인", "bnb", "BNB-USD", "BNB"],
  ["도지코인", "dogecoin", "doge", "DOGE-USD", "Dogecoin"],
  ["에이다", "카르다노", "cardano", "ada", "ADA-USD", "Cardano"],
  ["트론", "tron", "trx", "TRX-USD", "TRON"],
  ["체인링크", "chainlink", "link", "LINK-USD", "Chainlink"],
  ["아발란체", "avalanche", "avax", "AVAX-USD", "Avalanche"],
  ["스텔라루멘", "stellar", "xlm", "XLM-USD", "Stellar"],
  ["수이", "sui", "SUI-USD", "Sui"],
  ["헤데라", "hedera", "hbar", "HBAR-USD", "Hedera"],
  ["톤코인", "toncoin", "ton", "TON-USD", "Toncoin"],
  ["폴카닷", "polkadot", "dot", "DOT-USD", "Polkadot"],
  ["시바이누", "shiba", "shib", "SHIB-USD", "Shiba Inu"],
  ["라이트코인", "litecoin", "ltc", "LTC-USD", "Litecoin"],
  ["비트코인캐시", "bitcoin cash", "bch", "BCH-USD", "Bitcoin Cash"],
  ["유니스왑", "uniswap", "uni", "UNI-USD", "Uniswap"],
  ["아비트럼", "arbitrum", "arb", "ARB-USD", "Arbitrum"],
  ["옵티미즘", "optimism", "op", "OP-USD", "Optimism"],
  ["니어", "near", "NEAR-USD", "NEAR Protocol"],
  ["앱토스", "aptos", "apt", "APT-USD", "Aptos"],
  ["이더리움클래식", "ethereum classic", "etc", "ETC-USD", "Ethereum Classic"],
  ["파일코인", "filecoin", "fil", "FIL-USD", "Filecoin"],
  ["코스모스", "cosmos", "atom", "ATOM-USD", "Cosmos"],
  ["렌더", "render", "rndr", "RNDR-USD", "Render"],
  ["인터넷컴퓨터", "internet computer", "icp", "ICP-USD", "Internet Computer"],
  ["폴리곤", "polygon", "matic", "MATIC-USD", "Polygon"],
].map(([ko, en, short, yahoo, name]) => ({
  aliases: [ko, en, short, yahoo],
  symbol: yahoo,
  yahoo,
  name,
  country: "CRYPTO",
  market: "CRYPTO",
}));

const state = {
  activeSymbol: "",
  activeSymbolName: "",
  activeMode: "overview",
  currency: "KRW",
  activeMarket: "",
  history: [],
  messages: [],
  sessions: [],
  currentSessionId: "",
  symbols: [],
  symbolsLoaded: false,
  chartData: [],
  lastMetrics: {},
  chartPeriod: "d",
  chartRange: "1m",
  chartHoverIndex: null,
  chartManuallySized: false,
  chartAutoCompactDone: false,
  textOnlyMode: false,
  autocompleteItems: [],
  autocompleteIndex: -1,
  autocompleteTerm: "",
  autocompleteKeyboardActive: false,
};

const els = {
  chatForm: document.querySelector("#chatForm"),
  messageInput: document.querySelector("#messageInput"),
  newChatButton: document.querySelector("#newChatButton"),
  historyToggle: document.querySelector("#historyToggle"),
  historyClose: document.querySelector("#historyClose"),
  historyDrawer: document.querySelector("#historyDrawer"),
  drawerBackdrop: document.querySelector("#drawerBackdrop"),
  conversationList: document.querySelector("#conversationList"),
  resolvedSymbol: document.querySelector("#resolvedSymbol"),
  lastClose: document.querySelector("#lastClose"),
  changeText: document.querySelector("#changeText"),
  sma20: document.querySelector("#sma20"),
  sma60: document.querySelector("#sma60"),
  sma20Label: document.querySelector("#sma20Label"),
  sma60Label: document.querySelector("#sma60Label"),
  rsi14: document.querySelector("#rsi14"),
  volume: document.querySelector("#volume"),
  chart: document.querySelector("#priceChart"),
  chartCurrency: document.querySelector("#chartCurrency"),
  chartPeriodMenu: document.querySelector("#chartPeriodMenu"),
  chartTooltip: document.querySelector("#chartTooltip"),
  chartDates: document.querySelector("#chartDates"),
  chartToggle: document.querySelector("#chartToggle"),
  textOnlyToggle: document.querySelector("#textOnlyToggle"),
  periodRow: document.querySelector("#periodRow"),
  chatLog: document.querySelector("#chatLog"),
  suggestionPanel: document.querySelector("#suggestionPanel"),
  autocompletePanel: document.querySelector("#autocompletePanel"),
};

els.chatForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const prompt = els.messageInput.value.trim();
  if (!prompt) return;
  els.messageInput.value = "";
  resizeComposer();
  await submitPrompt(prompt);
});

els.messageInput.addEventListener("input", () => {
  state.autocompleteKeyboardActive = false;
  resizeComposer();
  handleAutocompleteInput();
});

els.messageInput.addEventListener("compositionend", handleAutocompleteInput);

els.messageInput.addEventListener("keydown", (event) => {
  if (handleAutocompleteKeydown(event)) return;

  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    els.chatForm.requestSubmit();
  }
});

els.newChatButton.addEventListener("click", startNewConversation);
els.historyToggle.addEventListener("click", openDrawer);
els.historyClose.addEventListener("click", closeDrawer);
els.drawerBackdrop.addEventListener("click", closeDrawer);

document.addEventListener("mousedown", (event) => {
  if (!event.target.closest(".chart-period-control")) {
    closeChartPeriodMenu();
  }

  if (!els.autocompletePanel.classList.contains("has-items")) return;
  if (els.chatForm.contains(event.target)) return;
  clearAutocomplete();
});

els.chartToggle.addEventListener("click", () => {
  state.chartManuallySized = true;
  state.textOnlyMode = false;
  document.body.classList.remove("text-only");
  document.body.classList.toggle("chart-compact");
  syncChartToggleText();
  requestAnimationFrame(() => {
    drawChart();
    requestAnimationFrame(() => drawChart());
  });
});

els.textOnlyToggle.addEventListener("click", () => {
  state.textOnlyMode = !state.textOnlyMode;
  document.body.classList.toggle("text-only", state.textOnlyMode);
  syncChartToggleText();
  requestAnimationFrame(() => {
    drawChart();
    requestAnimationFrame(() => drawChart());
  });
});

els.chartCurrency.addEventListener("click", (event) => {
  event.stopPropagation();
  cycleChartPeriod();
});

els.chartPeriodMenu?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-chart-period], [data-period]");
  if (!button) return;
  setChartPeriod(button.dataset.chartPeriod || button.dataset.period);
  closeChartPeriodMenu();
});

els.periodRow.addEventListener("click", (event) => {
  const button = event.target.closest("[data-range]");
  if (!button) return;
  setChartRange(button.dataset.range);
});

els.chart.addEventListener("pointermove", handleChartHover);
els.chart.addEventListener("pointerdown", handleChartHover);
els.chart.addEventListener("pointerleave", () => {
  state.chartHoverIndex = null;
  els.chartTooltip.classList.remove("visible");
  drawChart();
});

window.addEventListener("scroll", () => {
  if (
    !document.body.classList.contains("has-results") ||
    state.chartManuallySized ||
    state.chartAutoCompactDone ||
    document.body.classList.contains("chart-compact") ||
    window.scrollY <= 360
  ) {
    return;
  }
  state.chartAutoCompactDone = true;
  document.body.classList.add("chart-compact");
  syncChartToggleText();
  drawChart();
});

window.addEventListener("resize", () => drawChart());

loadSessions();
renderConversationList();
syncPeriodButtons();
drawChart();
loadSymbols();

async function submitPrompt(prompt) {
  clearSuggestions();
  clearAutocomplete();
  addMessage("user", prompt);
  compactChartForReply();
  const loading = addLoadingMessage(inferQuickMode(prompt));

  try {
    await loadSymbols();
    const parsed = parsePrompt(prompt);
    const marketOnly = shouldUseMarketOnly(prompt, Boolean(parsed.symbol));
    const previousSymbol = state.activeSymbol;
    const symbolChanged =
      Boolean(parsed.symbol) && stripExchangeSuffix(parsed.symbol) !== stripExchangeSuffix(previousSymbol);
    const symbol = marketOnly ? "" : parsed.symbol || state.activeSymbol;
    const message = parsed.message || prompt;
    const mode = marketOnly || !symbol ? "market" : inferMode(message, symbolChanged ? "overview" : state.activeMode);
    const market = parsed.market || state.activeMarket || "";
    const historyForRequest = symbolChanged ? [] : state.history.slice(-8);

    if (parsed.symbol) {
      if (symbolChanged) {
        state.history = [];
        state.activeMode = "overview";
      }
      state.activeSymbol = parsed.symbol;
      state.activeSymbolName = parsed.name || "";
      state.activeMarket = parsed.market || "";
      state.currency = parsed.currency || inferCurrency(parsed.symbol);
    }

    state.activeMode = mode;
    const response = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        symbol,
        name: parsed.name || state.activeSymbolName,
        market,
        mode,
        chartPeriod: state.chartPeriod,
        chartRange: state.chartRange,
        message,
        history: historyForRequest,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "요청을 처리하지 못했습니다.");
    }

    loading.remove();

    if (data.symbol) {
      state.activeSymbol = stripExchangeSuffix(data.symbol);
      state.activeSymbolName = data.name || state.activeSymbolName || findSymbolName(state.activeSymbol);
      state.currency = data.currency || inferCurrency(data.symbol);
      state.activeMarket = data.market || state.activeMarket;
      updateQuote(data);
    }

    const assistantMessage = addMessage("assistant", data.answer, false, data.sources || []);
    renderSuggestions(data.suggestions || []);
    scrollMessageToStart(assistantMessage, "smooth");
    remember("user", prompt);
    remember("assistant", data.answer);
    saveCurrentSession();
  } catch (error) {
    loading.remove();
    addMessage("assistant", error.message, true);
    saveCurrentSession();
  }
}

function parsePrompt(prompt) {
  const text = prompt.trim();
  const symbolMatch = findSymbolInPrompt(text);

  if (!symbolMatch.symbol) {
    return { symbol: "", name: "", market: "", message: text, currency: "" };
  }

  const message = text
    .slice(0, symbolMatch.start)
    .concat(" ", text.slice(symbolMatch.end))
    .replace(/\s+/g, " ")
    .trim();

  return {
    symbol: symbolMatch.symbol,
    name: symbolMatch.name || "",
    market: symbolMatch.market || "",
    currency: symbolMatch.currency || inferCurrency(symbolMatch.symbol),
    message: message || "이 종목을 짧게 분석해줘",
  };
}

function findSymbolInPrompt(text) {
  const codeMatch = text.match(/(^|\s)(\d{6})(?=\s|$|[.,!?])/u);
  if (codeMatch) {
    const code = codeMatch[2];
    const item = findSymbolItem(code);
    const start = codeMatch.index + codeMatch[1].length;
    return {
      symbol: code,
      name: item?.name || "",
      market: item?.market || "",
      currency: item ? inferCurrency(item.yahoo) : "KRW",
      start,
      end: start + code.length,
    };
  }

  const tickerMatch = text.match(/(^|\s)([A-Za-z]{1,8}(?:[.-][A-Za-z]{1,3})?)(?=\s|$|[.,!?])/u);
  if (tickerMatch) {
    const raw = tickerMatch[2].toUpperCase();
    const item = state.symbols.find(
      (entry) => entry.symbol.toUpperCase() === raw || entry.yahoo.toUpperCase() === raw,
    );
    if (item) {
      const start = tickerMatch.index + tickerMatch[1].length;
      return {
        symbol: item.symbol,
        name: item.name,
        market: item.market || "",
        currency: inferCurrency(item.yahoo),
        start,
        end: start + tickerMatch[2].length,
      };
    }

    if (/^[A-Z0-9]{2,12}-USD$/.test(raw)) {
      const start = tickerMatch.index + tickerMatch[1].length;
      return {
        symbol: raw,
        name: raw.replace("-USD", ""),
        market: "CRYPTO",
        currency: "USD",
        start,
        end: start + tickerMatch[2].length,
      };
    }
  }

  const aliasMatch = findAliasInText(text);
  if (aliasMatch) {
    return aliasMatch;
  }

  const byName = state.symbols
    .filter((item) => item && typeof item.name === "string" && item.name.length >= 2 && text.includes(item.name))
    .sort((a, b) => b.name.length - a.name.length)[0];

  if (byName) {
    const start = text.indexOf(byName.name);
    return {
      symbol: byName.symbol,
      name: byName.name,
      market: byName.market || "",
      currency: inferCurrency(byName.yahoo),
      start,
      end: start + byName.name.length,
    };
  }

  return { symbol: "", name: "", market: "", currency: "", start: 0, end: 0 };
}

function findAliasInText(text) {
  const lowered = normalizeSearchText(text);
  for (const item of [...COMMON_ALIASES, ...CRYPTO_ALIASES]) {
    for (const alias of item.aliases) {
      const index = lowered.indexOf(normalizeSearchText(alias));
      if (index === -1) continue;
      const originalStart = text.toLowerCase().indexOf(alias.toLowerCase());
      const start = originalStart >= 0 ? originalStart : index;
      return {
        symbol: item.symbol,
        name: item.name,
        market: item.market || "",
        currency: inferCurrency(item.yahoo),
        start,
        end: start + alias.length,
      };
    }
  }
  return null;
}

function inferMode(message, fallback) {
  const text = String(message || "").toLowerCase();
  if (/뉴스|이슈|기사|공시|검색|왜 오르|왜 내리|호재|악재/.test(text)) return "news";
  if (isGeneralMarketRequest(text)) return "market";
  if (/실적|재무|per|pbr|roe|매출|영업이익|순이익|가이던스|밸류|기본/.test(text)) return "fundamental";
  if (/차트|기술|이동평균|지지|저항|rsi|거래량|추세/.test(text)) return "technical";
  return fallback || "overview";
}

function inferQuickMode(message) {
  return inferMode(message, "market");
}

function shouldUseMarketOnly(message, hasExplicitSymbol) {
  if (hasExplicitSymbol) return false;
  if (!state.activeSymbol) return true;
  return isGeneralMarketRequest(message);
}

function isGeneralMarketRequest(message) {
  return /시장|증시|테마|섹터|업종|코스피|코스닥|나스닥|환율|금리|유망|종목\s*추천|종목추천|추천\s*종목|관심종목|종목\s*골라|뭐\s*살|살\s*만한/.test(
    String(message || "").toLowerCase(),
  );
}

function normalizeChartPeriod(period) {
  const value = String(period || "d").toLowerCase();
  if (["d", "w", "m"].includes(value)) return value;
  return "d";
}

function normalizeChartRange(range) {
  const value = String(range || "1m").toLowerCase();
  if (["1m", "3m", "6m", "1y", "3y"].includes(value)) return value;
  return "1m";
}

function chartPeriodLabel(period) {
  const map = {
    d: "일봉",
    w: "주봉",
    m: "월봉",
  };
  return map[normalizeChartPeriod(period)] || map.d;
}

function chartPeriodUnit(period) {
  const map = {
    d: "일",
    w: "주",
    m: "월",
  };
  return map[normalizeChartPeriod(period)] || map.d;
}

function chartRangeLimitForPeriod(period, range) {
  const normalizedPeriod = normalizeChartPeriod(period);
  const normalizedRange = normalizeChartRange(range);
  const map = {
    d: { "1m": 22, "3m": 66, "6m": 132, "1y": 260, "3y": 780 },
    w: { "1m": 6, "3m": 14, "6m": 28, "1y": 56, "3y": 160 },
    m: { "1m": 2, "3m": 4, "6m": 7, "1y": 13, "3y": 37 },
  };
  return map[normalizedPeriod]?.[normalizedRange] || map.d["1m"];
}

function syncPeriodButtons() {
  const period = normalizeChartPeriod(state.chartPeriod);
  const range = normalizeChartRange(state.chartRange);

  els.periodRow.querySelectorAll("button[data-range]").forEach((button) => {
    button.classList.toggle("active", normalizeChartRange(button.dataset.range) === range);
  });

  els.chartPeriodMenu?.querySelectorAll("button[data-chart-period], button[data-period]").forEach((button) => {
    button.classList.toggle("active", normalizeChartPeriod(button.dataset.chartPeriod || button.dataset.period) === period);
  });

  els.chartCurrency.textContent = chartPeriodLabel(period);
  els.chartCurrency.title = `${chartPeriodLabel(period)} 기준입니다. 클릭하면 일봉, 주봉, 월봉 순서로 바뀝니다.`;
  if (els.sma20Label) els.sma20Label.textContent = `20${chartPeriodUnit(period)}`;
  if (els.sma60Label) els.sma60Label.textContent = `60${chartPeriodUnit(period)}`;
}

function openChartPeriodMenu() {
  els.chartPeriodMenu?.classList.add("open");
  syncPeriodButtons();
}

function closeChartPeriodMenu() {
  els.chartPeriodMenu?.classList.remove("open");
  syncPeriodButtons();
}

function cycleChartPeriod() {
  const order = ["d", "w", "m"];
  const current = normalizeChartPeriod(state.chartPeriod);
  const index = order.indexOf(current);
  const next = order[(index + 1) % order.length] || "d";
  setChartPeriod(next);
}

async function setChartPeriod(period) {
  const next = normalizeChartPeriod(period);
  if (next === state.chartPeriod) return;

  const previous = state.chartPeriod;
  state.chartPeriod = next;
  syncPeriodButtons();
  state.chartHoverIndex = null;

  if (!state.activeSymbol) {
    drawChart();
    return;
  }

  try {
    await refreshChartOnly();
  } catch (error) {
    state.chartPeriod = previous;
    syncPeriodButtons();
    addMessage("assistant", error.message || "차트 데이터를 다시 불러오지 못했습니다.", true);
  }
}

async function setChartRange(range) {
  const next = normalizeChartRange(range);
  if (next === state.chartRange) return;

  const previous = state.chartRange;
  state.chartRange = next;
  syncPeriodButtons();
  state.chartHoverIndex = null;

  if (!state.activeSymbol) {
    drawChart();
    return;
  }

  if (state.chartData.length >= chartRangeLimitForPeriod(state.chartPeriod, state.chartRange)) {
    drawChart();
    saveCurrentSession();
    return;
  }

  try {
    await refreshChartOnly();
  } catch (error) {
    state.chartRange = previous;
    syncPeriodButtons();
    addMessage("assistant", error.message || "차트 데이터를 다시 불러오지 못했습니다.", true);
  }
}

async function refreshChartOnly() {
  const symbol = stripExchangeSuffix(state.activeSymbol);
  els.periodRow.classList.add("loading");
  els.chartCurrency.classList.add("loading");

  try {
    const response = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chartOnly: true,
        symbol,
        name: state.activeSymbolName,
        market: state.activeMarket,
        mode: state.activeMode,
        chartPeriod: state.chartPeriod,
        chartRange: state.chartRange,
        message: "차트만 다시 불러오기",
        history: [],
      }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || "차트 데이터를 다시 불러오지 못했습니다.");
    }

    updateQuote({
      ...data,
      name: data.name || state.activeSymbolName,
      market: data.market || state.activeMarket,
    });
    saveCurrentSession();
  } finally {
    els.periodRow.classList.remove("loading");
    els.chartCurrency.classList.remove("loading");
  }
}

function updateQuote(data) {
  const metrics = data.metrics || {};
  const symbol = stripExchangeSuffix(data.symbol || state.activeSymbol);
  const name = data.name || state.activeSymbolName || findSymbolName(symbol);
  state.chartData = Array.isArray(data.candles) ? data.candles : [];
  state.lastMetrics = metrics;
  state.currency = data.currency || state.currency || inferCurrency(data.symbol);
  state.activeMarket = data.market || state.activeMarket;
  state.chartPeriod = normalizeChartPeriod(data.chartPeriod || state.chartPeriod);
  state.chartRange = normalizeChartRange(data.chartRange || state.chartRange);
  syncPeriodButtons();
  state.chartManuallySized = false;
  state.chartAutoCompactDone = document.body.classList.contains("chart-compact");

  document.body.classList.add("has-results");
  els.resolvedSymbol.textContent = name ? `${name} ${symbol}` : symbol || "-";
  els.lastClose.textContent = formatPrice(metrics.lastClose, state.currency);
  els.changeText.textContent = formatChange(metrics.changePercent);
  els.sma20.textContent = formatPrice(metrics.sma20, state.currency);
  els.sma60.textContent = formatPrice(metrics.sma60, state.currency);
  els.rsi14.textContent = formatNumber(metrics.rsi14);
  els.volume.textContent = formatNumber(metrics.lastVolume, true);
  syncPeriodButtons();
  drawChart();
}

function compactChartForReply() {
  if (!document.body.classList.contains("has-results")) return;
  if (document.body.classList.contains("chart-compact")) return;
  state.chartAutoCompactDone = true;
  document.body.classList.add("chart-compact");
  syncChartToggleText();
  requestAnimationFrame(() => drawChart());
}

function renderQuoteFromState() {
  const metrics = state.lastMetrics || {};
  const symbol = stripExchangeSuffix(state.activeSymbol);
  const name = state.activeSymbolName || findSymbolName(symbol);

  document.body.classList.add("has-results");
  els.resolvedSymbol.textContent = name ? `${name} ${symbol}` : symbol || "-";
  els.lastClose.textContent = formatPrice(metrics.lastClose, state.currency);
  els.changeText.textContent = formatChange(metrics.changePercent);
  els.sma20.textContent = formatPrice(metrics.sma20, state.currency);
  els.sma60.textContent = formatPrice(metrics.sma60, state.currency);
  els.rsi14.textContent = formatNumber(metrics.rsi14);
  els.volume.textContent = formatNumber(metrics.lastVolume, true);
  syncPeriodButtons();
  drawChart();
}

function addMessage(role, text, isError = false, sources = []) {
  document.body.classList.add("conversation-started");

  const article = document.createElement("article");
  article.className = `message ${role}${isError ? " error" : ""}`;

  const roleLabel = document.createElement("div");
  roleLabel.className = "role";
  roleLabel.textContent = role === "user" ? "나" : "Stockr";

  const bubble = document.createElement("div");
  bubble.className = "bubble";
  const clean = role === "assistant" ? cleanAnswer(text) : plainText(text);
  if (role === "assistant" && !isError) {
    bubble.classList.add("structured-answer");
    renderStructuredAnswer(bubble, clean);
  } else {
    bubble.textContent = clean;
  }

  article.append(roleLabel, bubble);

  if (sources.length) {
    const sourceWrap = document.createElement("div");
    sourceWrap.className = "sources";
    sources.slice(0, 4).forEach((source, index) => {
      const link = document.createElement("a");
      link.href = source.url;
      link.target = "_blank";
      link.rel = "noreferrer";
      link.textContent = source.title || `출처 ${index + 1}`;
      sourceWrap.appendChild(link);
    });
    article.appendChild(sourceWrap);
  }

  els.chatLog.appendChild(article);
  state.messages.push({ role, text: clean, isError, sources });
  if (role === "assistant") {
    scrollMessageToStart(article, "smooth");
  } else {
    window.setTimeout(() => article.scrollIntoView({ behavior: "auto", block: "nearest" }), 0);
  }
  return article;
}

function scrollMessageToStart(article, behavior = "smooth") {
  if (!article) return;
  window.setTimeout(() => {
    article.scrollIntoView({ behavior, block: "start" });
  }, 60);
}

function addLoadingMessage(mode) {
  document.body.classList.add("conversation-started");
  const article = document.createElement("article");
  article.className = "message assistant loading-message";

  const roleLabel = document.createElement("div");
  roleLabel.className = "role";
  roleLabel.textContent = "Stockr";

  const bubble = document.createElement("div");
  bubble.className = "bubble";
  const text = loadingText(mode);
  bubble.innerHTML = `
    <span class="thinking">
      <span class="thinking-dots"><span></span><span></span><span></span></span>
      <span>${text}</span>
    </span>
  `;

  article.append(roleLabel, bubble);
  els.chatLog.appendChild(article);
  article.scrollIntoView({ behavior: "smooth", block: "nearest" });
  return article;
}

function loadingText(mode) {
  const map = {
    market: "시장 분위기와 주요 이슈를 살펴보고 있습니다",
    news: "관련 뉴스와 가격 데이터를 같이 확인하고 있습니다",
    technical: "차트 흐름과 거래량을 계산하고 있습니다",
    fundamental: "재무와 공개 정보를 함께 정리하고 있습니다",
    overview: "가격 데이터와 질문 의도를 맞춰보고 있습니다",
  };
  return map[mode] || map.overview;
}

function renderSuggestions(suggestions) {
  clearSuggestions();
  const usable = suggestions.map(normalizeQuestion).filter(Boolean).slice(0, 3);
  if (!usable.length) return;

  els.suggestionPanel.classList.add("has-items");
  usable.forEach((question) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "suggestion-button";
    button.textContent = question;
    button.addEventListener("click", () => submitPrompt(question));
    els.suggestionPanel.appendChild(button);
  });
}

function handleAutocompleteKeydown(event) {
  if (!els.autocompletePanel.classList.contains("has-items") || !state.autocompleteItems.length) {
    return false;
  }

  if (event.key === "ArrowDown") {
    event.preventDefault();
    state.autocompleteKeyboardActive = true;
    state.autocompleteIndex =
      state.autocompleteIndex < 0 ? 0 : (state.autocompleteIndex + 1) % state.autocompleteItems.length;
    syncAutocompleteActive();
    return true;
  }

  if (event.key === "ArrowUp") {
    event.preventDefault();
    state.autocompleteKeyboardActive = true;
    state.autocompleteIndex =
      state.autocompleteIndex < 0
        ? state.autocompleteItems.length - 1
        : (state.autocompleteIndex - 1 + state.autocompleteItems.length) % state.autocompleteItems.length;
    syncAutocompleteActive();
    return true;
  }

  if (event.key === "Enter" && state.autocompleteKeyboardActive && state.autocompleteIndex >= 0) {
    event.preventDefault();
    selectSymbol(state.autocompleteItems[state.autocompleteIndex]);
    state.autocompleteKeyboardActive = false;
    return true;
  }

  if (event.key === "Escape") {
    event.preventDefault();
    clearAutocomplete();
    return true;
  }

  return false;
}

function syncAutocompleteActive() {
  els.autocompletePanel.querySelectorAll(".symbol-option").forEach((button, index) => {
    button.classList.toggle("is-selected", state.autocompleteKeyboardActive && index === state.autocompleteIndex);
    if (state.autocompleteKeyboardActive && index === state.autocompleteIndex) {
      button.scrollIntoView({ block: "nearest" });
    }
  });
}

function clearSuggestions() {
  els.suggestionPanel.classList.remove("has-items");
  els.suggestionPanel.replaceChildren();
}

async function loadSymbols() {
  if (state.symbolsLoaded) return state.symbols;

  try {
    const response = await fetch("/symbols.json");
    if (!response.ok) throw new Error("symbols unavailable");
    state.symbols = enhanceSymbols(await response.json());
  } catch {
    state.symbols = enhanceSymbols([]);
  } finally {
    state.symbolsLoaded = true;
  }

  return state.symbols;
}

function enhanceSymbols(symbols) {
  const rows = Array.isArray(symbols) ? [...symbols] : [];
  const seen = new Set(rows.map((item) => `${item.country}:${item.symbol}`));

  for (const alias of [...COMMON_ALIASES, ...CRYPTO_ALIASES]) {
    const key = `${alias.country}:${alias.symbol}`;
    const existing = rows.find((item) => item.country === alias.country && item.symbol === alias.symbol);
    const search = `${alias.symbol} ${alias.yahoo} ${alias.name} ${alias.aliases.join(" ")}`;

    if (existing) {
      existing.search = `${existing.search || ""} ${search}`.trim();
      continue;
    }

    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({
      symbol: alias.symbol,
      yahoo: alias.yahoo,
      name: alias.name,
      country: alias.country,
      market: alias.market,
      search,
    });
  }

  return rows;
}

async function handleAutocompleteInput() {
  await loadSymbols();
  const terms = getAutocompleteTerms(els.messageInput.value);
  const matches = [];
  let matchedTerm = "";

  for (const term of terms) {
    const found = searchSymbols(term);
    if (found.length && !matchedTerm) matchedTerm = term;
    matches.push(...found);
    if (matches.length >= 8) break;
  }

  const items = uniqueSymbols(matches).slice(0, 8);
  renderAutocomplete(items);
  state.autocompleteTerm = items.length ? matchedTerm : "";
}

function getAutocompleteTerms(value) {
  const text = String(value || "").trim();
  if (!text) return [];

  const tokens = text
    .split(/\s+/)
    .map((item) => item.replace(/[.,!?()[\]{}]/g, ""))
    .filter((item) => item.length >= 2);

  return [...tokens].reverse();
}

function searchSymbols(term) {
  const q = normalizeSearchText(term);
  const scored = [];

  for (const item of state.symbols) {
    if (!item || !item.symbol || !item.name) continue;
    const symbol = normalizeSearchText(item.symbol);
    const yahoo = normalizeSearchText(item.yahoo);
    const name = normalizeSearchText(item.name);
    const search = normalizeSearchText(item.search || `${symbol} ${yahoo} ${name}`);

    let score = -1;
    if (symbol.startsWith(q)) score = 0;
    else if (yahoo.startsWith(q)) score = 1;
    else if (name.startsWith(q)) score = 2;
    else if (name.includes(q)) score = 3;
    else if (search.includes(q)) score = 4;

    if (score >= 0) scored.push({ item, score });
  }

  return scored
    .sort((a, b) => a.score - b.score || marketRank(a.item.market) - marketRank(b.item.market))
    .map((entry) => entry.item);
}

function renderAutocomplete(items) {
  clearAutocomplete();
  if (!items.length) return;

  state.autocompleteItems = items;
  state.autocompleteIndex = -1;
  state.autocompleteKeyboardActive = false;
  els.autocompletePanel.classList.add("has-items");

  items.forEach((item, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "symbol-option";
    button.classList.toggle("is-selected", state.autocompleteKeyboardActive && index === state.autocompleteIndex);

    const textWrap = document.createElement("div");
    textWrap.className = "symbol-main";
    const name = document.createElement("strong");
    name.textContent = item.name;
    const meta = document.createElement("span");
    meta.className = "symbol-meta";
    meta.textContent = countryLabel(item.country);
    const code = document.createElement("span");
    code.className = "symbol-code";
    code.textContent = item.symbol;
    textWrap.append(name, meta);
    textWrap.appendChild(code);

    button.appendChild(textWrap);
    button.addEventListener("click", () => selectSymbol(item));
    els.autocompletePanel.appendChild(button);
  });
}

function selectSymbol(item, options = {}) {
  state.activeSymbol = item.symbol;
  state.activeSymbolName = item.name;
  state.activeMarket = item.market || "";
  state.currency = inferCurrency(item.yahoo);

  const current = els.messageInput.value;
  const term = state.autocompleteTerm || getAutocompleteTerms(current)[0] || "";
  if (term) {
    const index = lastIndexOfIgnoreCase(current, term);
    const before = index >= 0 ? current.slice(0, index) : "";
    const after = index >= 0 ? current.slice(index + term.length).trimStart() : current;
    els.messageInput.value = `${before}${item.name}${after ? ` ${after}` : " "}`.replace(/\s+/g, " ");
  } else {
    els.messageInput.value = `${item.name} `;
  }

  state.autocompleteKeyboardActive = false;
  clearAutocomplete();
  resizeComposer();
  els.messageInput.focus();

  if (options.submitAfterSelect) {
    requestAnimationFrame(() => els.chatForm.requestSubmit());
  }
}

function clearAutocomplete() {
  els.autocompletePanel.classList.remove("has-items");
  els.autocompletePanel.replaceChildren();
  state.autocompleteItems = [];
  state.autocompleteIndex = -1;
  state.autocompleteTerm = "";
  state.autocompleteKeyboardActive = false;
}

function drawChart() {
  const canvas = els.chart;
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const cssWidth = Math.max(320, rect.width || canvas.clientWidth || 720);
  const cssHeight = Math.max(58, rect.height || canvas.clientHeight || 180);
  canvas.width = Math.floor(cssWidth * dpr);
  canvas.height = Math.floor(cssHeight * dpr);

  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssWidth, cssHeight);

  const candles = filteredCandles();
  if (candles.length < 2) {
    updateDateLabels([]);
    return;
  }

  const closes = candles.map((item) => item.close).filter(Number.isFinite);
  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const span = max - min || 1;
  const compact = document.body.classList.contains("chart-compact");
  const padLeft = compact ? 8 : 12;
  const padRight = compact ? 8 : 64;
  const padTop = compact ? 8 : 14;
  const padBottom = compact ? 8 : 22;
  const width = cssWidth - padLeft - padRight;
  const height = cssHeight - padTop - padBottom;

  if (!compact) {
    ctx.strokeStyle = "#f2f4f6";
    ctx.lineWidth = 1;
    for (let i = 0; i < 3; i += 1) {
      const y = padTop + (height / 2) * i;
      ctx.beginPath();
      ctx.moveTo(padLeft, y);
      ctx.lineTo(cssWidth - padRight + 4, y);
      ctx.stroke();

      const labelValue = max - (span / 2) * i;
      ctx.fillStyle = "#8b95a1";
      ctx.font = "11px system-ui, -apple-system, sans-serif";
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      ctx.fillText(formatAxisNumber(labelValue), cssWidth - 6, y);
    }
  }

  ctx.beginPath();
  candles.forEach((item, index) => {
    const point = pointForCandle(item, index, candles.length, min, span, padLeft, padTop, width, height);
    if (index === 0) ctx.moveTo(point.x, point.y);
    else ctx.lineTo(point.x, point.y);
  });
  ctx.strokeStyle = "#3182f6";
  ctx.lineWidth = compact ? 2 : 2.5;
  ctx.stroke();

  if (!compact && state.chartHoverIndex != null && candles[state.chartHoverIndex]) {
    const item = candles[state.chartHoverIndex];
    const point = pointForCandle(item, state.chartHoverIndex, candles.length, min, span, padLeft, padTop, width, height);
    ctx.strokeStyle = "#8b95a1";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(point.x, padTop);
    ctx.lineTo(point.x, cssHeight - padBottom);
    ctx.stroke();
    ctx.fillStyle = "#3182f6";
    ctx.beginPath();
    ctx.arc(point.x, point.y, 4, 0, Math.PI * 2);
    ctx.fill();
    positionTooltip(item, point.x, point.y, cssWidth);
  }

  updateDateLabels(candles);
}

function filteredCandles() {
  if (!state.chartData.length) return [];
  const limit = chartRangeLimitForPeriod(state.chartPeriod, state.chartRange);
  return state.chartData.slice(-limit);
}

function pointForCandle(item, index, length, min, span, padLeft, padTop, width, height) {
  return {
    x: padLeft + (width / Math.max(1, length - 1)) * index,
    y: padTop + height - ((item.close - min) / span) * height,
  };
}

function handleChartHover(event) {
  if (document.body.classList.contains("chart-compact")) return;

  const candles = filteredCandles();
  if (candles.length < 2) return;

  const rect = els.chart.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const padLeft = 12;
  const padRight = 64;
  const width = rect.width - padLeft - padRight;
  const index = Math.round(((x - padLeft) / width) * (candles.length - 1));
  state.chartHoverIndex = Math.max(0, Math.min(candles.length - 1, index));
  if (event.cancelable) event.preventDefault();
  drawChart();
}

function positionTooltip(item, x, y, chartWidth) {
  els.chartTooltip.classList.add("visible");
  els.chartTooltip.style.left = `${Math.min(Math.max(x, 82), chartWidth - 82)}px`;
  els.chartTooltip.style.top = `${y}px`;
  els.chartTooltip.innerHTML = `
    <strong>${formatFullDate(item.date)}</strong><br>
    시가 ${formatPrice(item.open, state.currency)}<br>
    종가 ${formatPrice(item.close, state.currency)}<br>
    고가 ${formatPrice(item.high, state.currency)} · 저가 ${formatPrice(item.low, state.currency)}<br>
    거래량 ${formatNumber(item.volume, true)}
  `;
}

function updateDateLabels(candles) {
  els.chartDates.replaceChildren();
  if (!candles.length) return;
  const first = candles[0];
  const mid = candles[Math.floor(candles.length / 2)];
  const last = candles[candles.length - 1];
  [first, mid, last].forEach((item) => {
    const span = document.createElement("span");
    span.textContent = formatDate(item.date);
    els.chartDates.appendChild(span);
  });
}

function syncChartToggleText() {
  els.chartToggle.textContent = document.body.classList.contains("chart-compact") ? "크게 보기" : "작게 보기";
  els.textOnlyToggle.textContent = state.textOnlyMode ? "차트 보기" : "텍스트만";
  els.textOnlyToggle.classList.toggle("active", state.textOnlyMode);
}

function remember(role, content) {
  state.history.push({ role, content: plainText(content) });
  if (state.history.length > 10) {
    state.history.splice(0, state.history.length - 10);
  }
}

function startNewConversation() {
  state.currentSessionId = "";
  state.activeSymbol = "";
  state.activeSymbolName = "";
  state.activeMode = "overview";
  state.currency = "KRW";
  state.activeMarket = "";
  state.history = [];
  state.messages = [];
  state.chartData = [];
  state.lastMetrics = {};
  state.chartPeriod = "d";
  state.chartRange = "1m";
  state.chartManuallySized = false;
  state.chartAutoCompactDone = false;
  state.textOnlyMode = false;
  document.body.classList.remove("conversation-started", "has-results", "chart-compact", "text-only");
  syncChartToggleText();
  syncPeriodButtons();
  els.chatLog.replaceChildren();
  clearSuggestions();
  clearAutocomplete();
  drawChart();
  els.messageInput.focus();
}

function saveCurrentSession() {
  if (!state.messages.length) return;
  const firstUser = state.messages.find((item) => item.role === "user")?.text || "새 대화";
  const now = Date.now();
  const session = {
    id: state.currentSessionId || String(now),
    title: firstUser.slice(0, 34),
    updatedAt: now,
    activeSymbol: state.activeSymbol,
    activeSymbolName: state.activeSymbolName,
    activeMode: state.activeMode,
    currency: state.currency,
    activeMarket: state.activeMarket,
    chartPeriod: state.chartPeriod,
    chartRange: state.chartRange,
    textOnlyMode: state.textOnlyMode,
    chartData: state.chartData,
    lastMetrics: state.lastMetrics,
    history: state.history,
    messages: state.messages,
  };

  state.currentSessionId = session.id;
  state.sessions = [session, ...state.sessions.filter((item) => item.id !== session.id)].slice(0, 20);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.sessions));
  renderConversationList();
}

function loadSessions() {
  try {
    state.sessions = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    state.sessions = [];
  }
}

function renderConversationList() {
  els.conversationList.replaceChildren();
  if (!state.sessions.length) {
    const empty = document.createElement("div");
    empty.className = "conversation-item";
    empty.innerHTML = "<strong>아직 대화가 없습니다</strong><span>질문을 시작하면 여기에 저장됩니다.</span>";
    els.conversationList.appendChild(empty);
    return;
  }

  state.sessions.forEach((session) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "conversation-item";
    button.innerHTML = `<strong>${escapeHtml(session.title)}</strong><span>${formatSessionDate(session.updatedAt)}</span>`;
    button.addEventListener("click", () => restoreSession(session.id));
    els.conversationList.appendChild(button);
  });
}

function restoreSession(id) {
  const session = state.sessions.find((item) => item.id === id);
  if (!session) return;

  state.currentSessionId = session.id;
  state.activeSymbol = session.activeSymbol || "";
  state.activeSymbolName = session.activeSymbolName || "";
  state.activeMode = session.activeMode || "overview";
  state.currency = session.currency || "KRW";
  state.activeMarket = session.activeMarket || "";
  state.chartPeriod = normalizeChartPeriod(session.chartPeriod || "d");
  state.chartRange = normalizeChartRange(session.chartRange || "1m");
  state.textOnlyMode = Boolean(session.textOnlyMode);
  state.chartData = session.chartData || [];
  state.lastMetrics = session.lastMetrics || {};
  state.chartHoverIndex = null;
  state.chartManuallySized = false;
  state.chartAutoCompactDone = document.body.classList.contains("chart-compact");
  state.history = session.history || [];
  state.messages = [];
  document.body.classList.toggle("text-only", state.textOnlyMode);
  syncChartToggleText();
  syncPeriodButtons();
  els.chatLog.replaceChildren();
  clearSuggestions();

  (session.messages || []).forEach((item) => {
    addMessage(item.role, item.text, item.isError, item.sources || []);
  });

  if (state.chartData.length) {
    renderQuoteFromState();
  } else {
    document.body.classList.remove("has-results");
    drawChart();
  }

  closeDrawer();
}

function openDrawer() {
  document.body.classList.add("drawer-open");
}

function closeDrawer() {
  document.body.classList.remove("drawer-open");
}

function resizeComposer() {
  els.messageInput.style.height = "auto";
  els.messageInput.style.height = `${Math.min(132, els.messageInput.scrollHeight)}px`;
}

function findSymbolItem(symbol) {
  const value = stripExchangeSuffix(symbol).toUpperCase();
  return state.symbols.find(
    (item) => item.symbol.toUpperCase() === value || stripExchangeSuffix(item.yahoo).toUpperCase() === value,
  );
}

function findSymbolName(symbol) {
  return findSymbolItem(symbol)?.name || "";
}

function lastIndexOfIgnoreCase(text, term) {
  return String(text || "").toLowerCase().lastIndexOf(String(term || "").toLowerCase());
}

function uniqueSymbols(items) {
  items = Array.isArray(items) ? items.filter(Boolean) : [];
  const seen = new Set();
  return items.filter((item) => {
    const key = `${item.country}:${item.symbol}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function marketRank(market) {
  const ranks = {
    KOSPI: 0,
    KOSDAQ: 1,
    NASDAQ: 2,
    NYSE: 3,
    "NYSE American": 4,
    CRYPTO: 5,
  };
  return ranks[market] ?? 9;
}

function countryLabel(country) {
  if (country === "KR") return "국내";
  if (country === "CRYPTO") return "가상자산";
  return "미국";
}

function normalizeSearchText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .trim();
}

function stripExchangeSuffix(symbol) {
  return String(symbol || "").replace(/\.(KS|KQ)$/i, "");
}

function inferCurrency(symbol) {
  return /^\d{6}(\.(KS|KQ))?$/i.test(String(symbol || "")) ? "KRW" : "USD";
}

function formatPrice(value, currency) {
  if (!Number.isFinite(value)) return "-";
  const digits = currency === "KRW" ? 0 : 2;
  const formatted = new Intl.NumberFormat("ko-KR", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(value);
  return currency === "KRW" ? `${formatted}원` : `$${formatted}`;
}

function formatNumber(value, compact = false) {
  if (!Number.isFinite(value)) return "-";
  return new Intl.NumberFormat("ko-KR", {
    maximumFractionDigits: value > 100 ? 0 : 2,
    notation: compact ? "compact" : "standard",
  }).format(value);
}

function formatChange(value) {
  if (!Number.isFinite(value)) return "-";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value || "");
  return `${String(date.getFullYear()).slice(2)}.${date.getMonth() + 1}.${date.getDate()}`;
}

function formatFullDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value || "");
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")}`;
}

function formatAxisNumber(value) {
  if (!Number.isFinite(value)) return "";
  if (Math.abs(value) >= 1000000) return new Intl.NumberFormat("ko-KR", { notation: "compact", maximumFractionDigits: 1 }).format(value);
  if (Math.abs(value) >= 1000) return new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 0 }).format(value);
  return new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 2 }).format(value);
}

function formatSessionDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getMonth() + 1}.${date.getDate()} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function cleanAnswer(value) {
  const extracted = extractAnswerFromJsonLike(value);
  return String(extracted || value || "")
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

function extractAnswerFromJsonLike(value) {
  const source = String(value || "").trim();
  if (!source || !/^\s*\{/.test(source)) return "";
  try {
    const parsed = JSON.parse(source);
    if (typeof parsed?.answer === "string") return parsed.answer;
  } catch {}
  const match = source.match(/"answer"\s*:\s*"([\s\S]*?)(?<!\\)"\s*,\s*"suggestions"/);
  if (!match) return "";
  return match[1]
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\n")
    .replace(/\\t/g, " ")
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, "\\")
    .trim();
}

function renderStructuredAnswer(container, text) {
  const lines = String(text || "")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) {
    container.textContent = "답변을 만들지 못했습니다.";
    return;
  }

  let currentList = null;

  const appendInline = (parent, value) => {
    const parts = String(value || "").split(/(\*\*[^*]+\*\*)/g);
    for (const part of parts) {
      if (!part) continue;
      const boldMatch = part.match(/^\*\*([^*]+)\*\*$/);
      if (boldMatch) {
        const strong = document.createElement("strong");
        strong.textContent = boldMatch[1].trim();
        parent.appendChild(strong);
      } else {
        parent.appendChild(document.createTextNode(part));
      }
    }
  };

  for (const line of lines) {
    const heading = line.match(/^\*\*([^*]+)\*\*:?$/);
    const bullet = line.match(/^(?:[-•ㆍ·])\s*(.+)$/);

    if (heading) {
      currentList = null;
      const el = document.createElement("strong");
      el.className = container.children.length === 0 ? "answer-title" : "answer-subtitle";
      el.textContent = heading[1].trim();
      container.appendChild(el);
      continue;
    }

    if (bullet) {
      if (!currentList) {
        currentList = document.createElement("ul");
        currentList.className = "answer-list";
        container.appendChild(currentList);
      }
      const li = document.createElement("li");
      appendInline(li, bullet[1]);
      currentList.appendChild(li);
      continue;
    }

    currentList = null;
    const p = document.createElement("p");
    appendInline(p, line);
    container.appendChild(p);
  }
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
  if (/[?？]$/.test(text)) return text;
  return `${text}?`;
}

function plainText(value) {
  return String(value || "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[`*_>#-]/g, "")
    .replace(/\[(.*?)\]\((.*?)\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

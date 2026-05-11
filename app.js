const form = document.querySelector("#chartForm");
const statusEl = document.querySelector("#status");
const summaryEl = document.querySelector("#summary");
const readoutEl = document.querySelector("#readout");
const emptyStateEl = document.querySelector("#emptyState");
const canvas = document.querySelector("#chart");
const ctx = canvas.getContext("2d");

const STOCK_NAME_TO_CODE = {
  "삼성전자": "005930",
  "sk하이닉스": "000660",
  "현대차": "005380",
  "기아": "000270",
  "네이버": "035420",
  "naver": "035420",
  "카카오": "035720",
  "셀트리온": "068270",
  "lg에너지솔루션": "373220",
  "포스코홀딩스": "005490",
  "두산": "000150",
  "아모레퍼시픽": "090430",
  "삼양식품": "003230",
  "삼아알미늄": "006110",
  "다우데이타": "032190",
  "oracle": "128820",
};

const colors = {
  ink: "#172033",
  muted: "#667085",
  grid: "#e5eaf2",
  axis: "#a7b1c2",
  up: "#d33f49",
  down: "#2474c6",
  ma5: "#2d6cdf",
  ma20: "#ef8f22",
  ma60: "#16815c",
  ma100: "#7b4fc4",
  band: "#697386",
  bandFill: "rgba(105, 115, 134, 0.10)",
  macd: "#1f6feb",
  signal: "#ef8f22",
  histUp: "rgba(211, 63, 73, 0.62)",
  histDown: "rgba(36, 116, 198, 0.62)",
};

let state = {
  candles: [],
  indicators: null,
  hoverIndex: null,
  layout: null,
  params: {
    market: "kospi",
    period: "d",
    code: "128820",
    limit: 200,
  },
};

function setStatus(text, type = "ready") {
  statusEl.textContent = text;
  statusEl.classList.toggle("is-loading", type === "loading");
  statusEl.classList.toggle("is-error", type === "error");
}

function toNumber(value) {
  const number = Number(String(value ?? "").replace(/,/g, ""));
  return Number.isFinite(number) ? number : null;
}

function formatDate(raw, period) {
  const value = String(raw ?? "");
  if (/^\d{8}$/.test(value)) {
    return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
  }

  if (/^\d{12}$/.test(value)) {
    return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)} ${value.slice(8, 10)}:${value.slice(10, 12)}`;
  }

  if (/^\d{14}$/.test(value)) {
    return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)} ${value.slice(8, 10)}:${value.slice(10, 12)}`;
  }

  return period === "m" ? value : value || "-";
}

function shortDate(label) {
  if (label.includes(" ")) return label.slice(5);
  if (/^\d{4}-\d{2}-\d{2}$/.test(label)) return label.slice(5);
  return label;
}

function normalizeHistory(payload, period) {
  const rows =
    payload?.ResultData ||
    payload?.resultData ||
    payload?.data ||
    payload?.items ||
    [];

  if (!Array.isArray(rows)) return [];

  return rows
    .map((row) => {
      const dateRaw = String(
        row.bzDd ?? row.date ?? row.trdDd ?? row.time ?? row.datetime ?? "",
      );

      return {
        dateRaw,
        date: formatDate(dateRaw, period),
        open: toNumber(row.opnPrc ?? row.open ?? row.o),
        high: toNumber(row.hgPrc ?? row.high ?? row.h),
        low: toNumber(row.lwPrc ?? row.low ?? row.l),
        close: toNumber(row.trdPrc ?? row.close ?? row.c),
        volume: toNumber(row.accTrdvol ?? row.volume ?? row.v),
      };
    })
    .filter(
      (row) =>
        row.dateRaw &&
        row.open !== null &&
        row.high !== null &&
        row.low !== null &&
        row.close !== null,
    )
    .sort((a, b) => a.dateRaw.localeCompare(b.dateRaw));
}

function movingAverage(values, period) {
  const result = Array(values.length).fill(null);
  let sum = 0;

  for (let i = 0; i < values.length; i += 1) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    if (i >= period - 1) result[i] = sum / period;
  }

  return result;
}

function bollingerBands(values, period = 10, multiplier = 2) {
  const middle = movingAverage(values, period);
  const upper = Array(values.length).fill(null);
  const lower = Array(values.length).fill(null);

  for (let i = period - 1; i < values.length; i += 1) {
    const slice = values.slice(i - period + 1, i + 1);
    const avg = middle[i];
    const variance =
      slice.reduce((total, value) => total + (value - avg) ** 2, 0) / period;
    const deviation = Math.sqrt(variance);

    upper[i] = avg + deviation * multiplier;
    lower[i] = avg - deviation * multiplier;
  }

  return { middle, upper, lower };
}

function ema(values, period) {
  const result = Array(values.length).fill(null);
  const multiplier = 2 / (period + 1);
  let previous = null;

  for (let i = 0; i < values.length; i += 1) {
    const value = values[i];
    if (value === null || value === undefined) continue;
    previous = previous === null ? value : value * multiplier + previous * (1 - multiplier);
    result[i] = previous;
  }

  return result;
}

function macd(values, fast = 12, slow = 26, signalPeriod = 9) {
  const fastEma = ema(values, fast);
  const slowEma = ema(values, slow);
  const line = values.map((_, index) =>
    fastEma[index] === null || slowEma[index] === null
      ? null
      : fastEma[index] - slowEma[index],
  );
  const signal = ema(line, signalPeriod);
  const histogram = line.map((value, index) =>
    value === null || signal[index] === null ? null : value - signal[index],
  );

  return { line, signal, histogram };
}

function buildIndicators(candles) {
  const closes = candles.map((row) => row.close);

  return {
    ma5: movingAverage(closes, 5),
    ma20: movingAverage(closes, 20),
    ma60: movingAverage(closes, 60),
    ma100: movingAverage(closes, 100),
    bands: bollingerBands(closes, 10, 2),
    macd: macd(closes, 12, 26, 9),
  };
}

function niceNumber(value) {
  return Math.round(value).toLocaleString("ko-KR");
}

function paddedRange(values, fallback = [0, 1]) {
  const filtered = values.filter((value) => Number.isFinite(value));
  if (filtered.length === 0) return fallback;

  let min = Math.min(...filtered);
  let max = Math.max(...filtered);
  if (min === max) {
    min *= 0.98;
    max *= 1.02;
  }

  const padding = (max - min) * 0.08;
  return [min - padding, max + padding];
}

function linePath(series, xFor, yFor) {
  ctx.beginPath();
  let started = false;

  series.forEach((value, index) => {
    if (!Number.isFinite(value)) {
      started = false;
      return;
    }

    const x = xFor(index);
    const y = yFor(value);
    if (!started) {
      ctx.moveTo(x, y);
      started = true;
    } else {
      ctx.lineTo(x, y);
    }
  });
}

function drawGrid(panel, range, formatter) {
  ctx.save();
  ctx.strokeStyle = colors.grid;
  ctx.fillStyle = colors.muted;
  ctx.lineWidth = 1;
  ctx.font = "12px Segoe UI, Malgun Gothic, sans-serif";
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";

  for (let i = 0; i <= 4; i += 1) {
    const ratio = i / 4;
    const y = panel.y + panel.h * ratio;
    const value = range[1] - (range[1] - range[0]) * ratio;
    ctx.beginPath();
    ctx.moveTo(panel.x, y);
    ctx.lineTo(panel.x + panel.w, y);
    ctx.stroke();
    ctx.fillText(formatter(value), panel.x - 8, y);
  }

  ctx.strokeStyle = colors.axis;
  ctx.strokeRect(panel.x, panel.y, panel.w, panel.h);
  ctx.restore();
}

function drawPanelTitle(text, panel) {
  ctx.save();
  ctx.fillStyle = colors.ink;
  ctx.font = "700 13px Segoe UI, Malgun Gothic, sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "bottom";
  ctx.fillText(text, panel.x, panel.y - 8);
  ctx.restore();
}

function drawXAxis(candles, panel, xFor) {
  const count = candles.length;
  if (!count) return;

  const ticks = Math.min(7, count);
  ctx.save();
  ctx.fillStyle = colors.muted;
  ctx.font = "12px Segoe UI, Malgun Gothic, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";

  for (let i = 0; i < ticks; i += 1) {
    const index = Math.round((count - 1) * (i / Math.max(1, ticks - 1)));
    const x = xFor(index);
    ctx.fillText(shortDate(candles[index].date), x, panel.y + panel.h + 8);
  }

  ctx.restore();
}

function drawBandFill(upper, lower, xFor, yFor) {
  ctx.save();
  ctx.beginPath();
  let started = false;

  upper.forEach((value, index) => {
    if (!Number.isFinite(value) || !Number.isFinite(lower[index])) {
      started = false;
      return;
    }

    const x = xFor(index);
    const y = yFor(value);
    if (!started) {
      ctx.moveTo(x, y);
      started = true;
    } else {
      ctx.lineTo(x, y);
    }
  });

  for (let i = lower.length - 1; i >= 0; i -= 1) {
    if (!Number.isFinite(upper[i]) || !Number.isFinite(lower[i])) continue;
    ctx.lineTo(xFor(i), yFor(lower[i]));
  }

  ctx.closePath();
  ctx.fillStyle = colors.bandFill;
  ctx.fill();
  ctx.restore();
}

function drawLine(series, color, xFor, yFor, width = 1.8, dash = []) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.setLineDash(dash);
  linePath(series, xFor, yFor);
  ctx.stroke();
  ctx.restore();
}

function drawCandles(candles, panel, xFor, yFor) {
  const candleWidth = Math.max(1.4, Math.min(11, (panel.w / candles.length) * 0.58));

  candles.forEach((row, index) => {
    const x = xFor(index);
    const up = row.close >= row.open;
    const color = up ? colors.up : colors.down;
    const yHigh = yFor(row.high);
    const yLow = yFor(row.low);
    const yOpen = yFor(row.open);
    const yClose = yFor(row.close);
    const top = Math.min(yOpen, yClose);
    const height = Math.max(1, Math.abs(yClose - yOpen));

    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, yHigh);
    ctx.lineTo(x, yLow);
    ctx.stroke();
    ctx.fillRect(x - candleWidth / 2, top, candleWidth, height);
  });
}

function drawVolume(candles, panel, xFor) {
  const maxVolume = Math.max(1, ...candles.map((row) => row.volume || 0));
  const barWidth = Math.max(1, Math.min(12, (panel.w / candles.length) * 0.72));

  drawGrid(panel, [0, maxVolume], (value) =>
    value >= 1000000 ? `${(value / 1000000).toFixed(1)}M` : niceNumber(value),
  );
  drawPanelTitle("거래량", panel);

  candles.forEach((row, index) => {
    const height = ((row.volume || 0) / maxVolume) * panel.h;
    const x = xFor(index) - barWidth / 2;
    const y = panel.y + panel.h - height;
    ctx.fillStyle = row.close >= row.open ? colors.up : colors.down;
    ctx.globalAlpha = 0.78;
    ctx.fillRect(x, y, barWidth, Math.max(1, height));
    ctx.globalAlpha = 1;
  });
}

function drawMacd(panel, xFor) {
  const { line, signal, histogram } = state.indicators.macd;
  const range = paddedRange([...line, ...signal, ...histogram, 0], [-1, 1]);
  const yFor = (value) =>
    panel.y + panel.h - ((value - range[0]) / (range[1] - range[0])) * panel.h;

  drawGrid(panel, range, (value) => value.toFixed(0));
  drawPanelTitle("MACD 12,26,9", panel);

  const zeroY = yFor(0);
  const barWidth = Math.max(1, Math.min(12, (panel.w / histogram.length) * 0.72));
  ctx.save();
  ctx.strokeStyle = "#8591a3";
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(panel.x, zeroY);
  ctx.lineTo(panel.x + panel.w, zeroY);
  ctx.stroke();
  ctx.setLineDash([]);

  histogram.forEach((value, index) => {
    if (!Number.isFinite(value)) return;
    const x = xFor(index) - barWidth / 2;
    const y = yFor(value);
    ctx.fillStyle = value >= 0 ? colors.histUp : colors.histDown;
    ctx.fillRect(x, Math.min(y, zeroY), barWidth, Math.max(1, Math.abs(zeroY - y)));
  });
  ctx.restore();

  drawLine(line, colors.macd, xFor, yFor, 1.9);
  drawLine(signal, colors.signal, xFor, yFor, 1.7);
}

function getLayout(width, height) {
  const left = width < 560 ? 54 : 72;
  const right = width < 560 ? 12 : 22;
  const top = 34;
  const bottom = 34;
  const gap = 38;
  const plotWidth = Math.max(80, width - left - right);
  const available = height - top - bottom - gap * 2;
  const priceHeight = Math.round(available * 0.57);
  const volumeHeight = Math.round(available * 0.18);
  const macdHeight = available - priceHeight - volumeHeight;
  const price = { x: left, y: top, w: plotWidth, h: priceHeight };
  const volume = { x: left, y: price.y + price.h + gap, w: plotWidth, h: volumeHeight };
  const macdPanel = {
    x: left,
    y: volume.y + volume.h + gap,
    w: plotWidth,
    h: macdHeight,
  };

  return { price, volume, macd: macdPanel };
}

function render() {
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(320, Math.floor(rect.width));
  const height = Math.max(620, Math.floor(rect.height));
  const dpr = window.devicePixelRatio || 1;

  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);

  if (!state.candles.length || !state.indicators) {
    state.layout = null;
    emptyStateEl.hidden = false;
    return;
  }

  emptyStateEl.hidden = true;

  const layout = getLayout(width, height);
  state.layout = layout;
  const candles = state.candles;
  const indicators = state.indicators;
  const xFor = (index) =>
    candles.length === 1
      ? layout.price.x + layout.price.w / 2
      : layout.price.x + (index / (candles.length - 1)) * layout.price.w;

  const priceValues = [
    ...candles.flatMap((row) => [row.high, row.low]),
    ...indicators.ma5,
    ...indicators.ma20,
    ...indicators.ma60,
    ...indicators.ma100,
    ...indicators.bands.upper,
    ...indicators.bands.lower,
  ];
  const priceRange = paddedRange(priceValues, [0, 1]);
  const yForPrice = (value) =>
    layout.price.y +
    layout.price.h -
    ((value - priceRange[0]) / (priceRange[1] - priceRange[0])) * layout.price.h;

  drawGrid(layout.price, priceRange, niceNumber);
  drawPanelTitle("주가 · 이동평균 · 볼린저밴드", layout.price);
  drawBandFill(indicators.bands.upper, indicators.bands.lower, xFor, yForPrice);
  drawLine(indicators.bands.upper, colors.band, xFor, yForPrice, 1.2, [5, 4]);
  drawLine(indicators.bands.middle, colors.band, xFor, yForPrice, 1.1, [2, 4]);
  drawLine(indicators.bands.lower, colors.band, xFor, yForPrice, 1.2, [5, 4]);
  drawCandles(candles, layout.price, xFor, yForPrice);
  drawLine(indicators.ma5, colors.ma5, xFor, yForPrice, 1.8);
  drawLine(indicators.ma20, colors.ma20, xFor, yForPrice, 1.8);
  drawLine(indicators.ma60, colors.ma60, xFor, yForPrice, 1.8);
  drawLine(indicators.ma100, colors.ma100, xFor, yForPrice, 1.8);

  drawVolume(candles, layout.volume, xFor);
  drawMacd(layout.macd, xFor);
  drawXAxis(candles, layout.macd, xFor);

  if (state.hoverIndex !== null) {
    drawHover(state.hoverIndex, xFor, layout);
  }
}

function drawHover(index, xFor, layout) {
  const row = state.candles[index];
  const x = xFor(index);

  ctx.save();
  ctx.strokeStyle = "rgba(23, 32, 51, 0.38)";
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(x, layout.price.y);
  ctx.lineTo(x, layout.macd.y + layout.macd.h);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = colors.ink;
  ctx.font = "700 12px Segoe UI, Malgun Gothic, sans-serif";
  ctx.textAlign = x > layout.price.x + layout.price.w - 120 ? "right" : "left";
  ctx.textBaseline = "top";
  const textX = ctx.textAlign === "right" ? x - 8 : x + 8;
  ctx.fillText(`${row.date}  종가 ${niceNumber(row.close)}`, textX, layout.price.y + 8);
  ctx.restore();
}

function updateReadout(index = state.hoverIndex) {
  if (index === null || !state.candles[index]) {
    readoutEl.textContent = "마우스를 차트 위에 올리면 선택한 날짜의 값이 표시됩니다.";
    return;
  }

  const row = state.candles[index];
  const macdLine = state.indicators.macd.line[index];
  const signal = state.indicators.macd.signal[index];
  const histogram = state.indicators.macd.histogram[index];

  readoutEl.textContent =
    `${row.date} · 시가 ${niceNumber(row.open)} · 고가 ${niceNumber(row.high)} · ` +
    `저가 ${niceNumber(row.low)} · 종가 ${niceNumber(row.close)} · ` +
    `거래량 ${niceNumber(row.volume || 0)} · MACD ${macdLine?.toFixed(2) ?? "-"} · ` +
    `Signal ${signal?.toFixed(2) ?? "-"} · Hist ${histogram?.toFixed(2) ?? "-"}`;
}

function paramsFromForm() {
  const data = new FormData(form);
  const rawCode = String(data.get("code") || "128820").trim();
  const normalizedCode = normalizeStockCode(rawCode);
  return {
    market: String(data.get("market") || "kospi").toLowerCase(),
    period: String(data.get("period") || "d").toLowerCase(),
    code: normalizedCode,
    limit: Number(data.get("limit") || 200),
  };
}

function normalizeStockCode(input) {
  const compact = String(input || "").trim();
  if (/^[a-z0-9]{6}$/i.test(compact)) {
    return compact.toUpperCase();
  }

  const normalizedName = compact.toLowerCase().replace(/\s+/g, "");
  if (!normalizedName) return "128820";

  if (Object.prototype.hasOwnProperty.call(STOCK_NAME_TO_CODE, normalizedName)) {
    return STOCK_NAME_TO_CODE[normalizedName];
  }

  const matchedName = Object.keys(STOCK_NAME_TO_CODE).find((name) =>
    name.includes(normalizedName),
  );
  return matchedName ? STOCK_NAME_TO_CODE[matchedName] : compact.toUpperCase();
}

function periodLabel(period) {
  if (period === "d") return "일간";
  if (period === "w") return "주간";
  return "월간";
}

async function loadChart(params = paramsFromForm()) {
  state.params = params;
  state.hoverIndex = null;
  setStatus("불러오는 중", "loading");
  summaryEl.textContent = `${params.market} · ${periodLabel(params.period)} · ${params.code} · ${params.limit}`;
  updateReadout(null);

  const query = new URLSearchParams({
    market: params.market,
    period: params.period,
    code: params.code,
    limit: String(params.limit),
  });

  try {
    const response = await fetch(`/api/history?${query.toString()}`);
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || "데이터를 불러오지 못했습니다.");
    }
    if (payload?.Result?.ResultCode && payload.Result.ResultCode !== 0) {
      throw new Error(payload.Result.ResultMsg || "API 응답 오류가 발생했습니다.");
    }

    const candles = normalizeHistory(payload, params.period);
    state.candles = candles;
    state.indicators = buildIndicators(candles);
    setStatus(`${candles.length}개 표시`);
    render();
  } catch (error) {
    state.candles = [];
    state.indicators = null;
    setStatus("오류", "error");
    emptyStateEl.hidden = false;
    readoutEl.textContent =
      error instanceof Error ? error.message : "데이터를 불러오지 못했습니다.";
    render();
  }
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  loadChart();
});

canvas.addEventListener("pointermove", (event) => {
  if (!state.candles.length || !state.layout) return;

  const rect = canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const { price } = state.layout;
  const ratio = Math.min(1, Math.max(0, (x - price.x) / price.w));
  const index = Math.round(ratio * (state.candles.length - 1));
  state.hoverIndex = index;
  updateReadout(index);
  render();
});

canvas.addEventListener("pointerleave", () => {
  state.hoverIndex = null;
  updateReadout(null);
  render();
});

window.addEventListener("resize", render);

loadChart(state.params);

'use strict';

var SETTINGS_KEY = 'TA_SETTINGS_V2';

var state = {
  data: null,
  settings: null,
  results: {},
  scores: {}
};

function getDefaultSettings() {
  var settings = {};
  var enabledByDefault = ['sma', 'rsi', 'macd', 'bollinger', 'stochastic'];
  var ids = Object.keys(INDICATORS);
  var enabledCount = enabledByDefault.length;
  var defaultWeight = Math.round((100 / enabledCount) * 100) / 100;

  ids.forEach(function (id) {
    var ind = INDICATORS[id];
    var enabled = enabledByDefault.indexOf(id) !== -1;
    settings[id] = {
      enabled: enabled,
      weight: enabled ? defaultWeight : 0,
      params: JSON.parse(JSON.stringify(ind.defaultParams))
    };
  });
  return settings;
}

function loadSettings() {
  try {
    var raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      var saved = JSON.parse(raw);
      var defaults = getDefaultSettings();
      Object.keys(defaults).forEach(function (id) {
        if (!saved[id]) saved[id] = defaults[id];
        Object.keys(defaults[id].params).forEach(function (p) {
          if (saved[id].params[p] === undefined) saved[id].params[p] = defaults[id].params[p];
        });
      });
      return saved;
    }
  } catch (e) { /* ignore */ }
  return getDefaultSettings();
}

function saveSettings(settings) {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch (e) { /* ignore */ }
}

function equalizeWeights() {
  var settings = collectSettingsFromUI();
  var enabledIds = Object.keys(settings).filter(function (id) {
    return settings[id].enabled && INDICATORS[id] && INDICATORS[id].scorable;
  });
  var w = enabledIds.length > 0 ? Math.round((100 / enabledIds.length) * 100) / 100 : 0;
  Object.keys(settings).forEach(function (id) {
    if (enabledIds.indexOf(id) !== -1) settings[id].weight = w;
    else settings[id].weight = 0;
  });
  renderSettingsContent(settings);
}

function resetAllSettings() {
  renderSettingsContent(getDefaultSettings());
}

function setStatus(text, type) {
  var el = document.getElementById('status');
  el.textContent = text;
  el.classList.toggle('is-loading', type === 'loading');
  el.classList.toggle('is-error', type === 'error');
}

function toNumber(value) {
  var n = Number(String(value == null ? '' : value).replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

function formatDate(raw, period) {
  var s = String(raw || '');
  if (/^\d{8}$/.test(s)) return s.slice(0, 4) + '-' + s.slice(4, 6) + '-' + s.slice(6, 8);
  if (/^\d{12,14}$/.test(s)) return s.slice(0, 4) + '-' + s.slice(4, 6) + '-' + s.slice(6, 8);
  return s || '-';
}

function normalizeData(payload, period) {
  var rows = payload && (payload.ResultData || payload.resultData || payload.data || payload.items || payload.result || []);
  if (!Array.isArray(rows)) {
    if (Array.isArray(payload)) rows = payload;
    else return [];
  }

  return rows.map(function (row) {
    var dateRaw = String(row.bzDd || row.date || row.trdDd || row.time || row.datetime || row.dt || '');
    return {
      dateRaw: dateRaw,
      date: formatDate(dateRaw, period),
      open: toNumber(row.opnPrc || row.open || row.o),
      high: toNumber(row.hgPrc || row.high || row.h),
      low: toNumber(row.lwPrc || row.low || row.l),
      close: toNumber(row.trdPrc || row.close || row.c),
      volume: toNumber(row.accTrdvol || row.volume || row.v)
    };
  }).filter(function (r) {
    return r.dateRaw && r.open !== null && r.high !== null && r.low !== null && r.close !== null;
  }).sort(function (a, b) { return a.dateRaw.localeCompare(b.dateRaw); });
}

function runIndicators(data, settings) {
  var results = {};
  var scores = {};
  var indicatorData = {
    dates: data.map(function (r) { return r.date; }),
    opens: data.map(function (r) { return r.open; }),
    highs: data.map(function (r) { return r.high; }),
    lows: data.map(function (r) { return r.low; }),
    closes: data.map(function (r) { return r.close; }),
    volumes: data.map(function (r) { return r.volume || 0; })
  };

  Object.keys(INDICATORS).forEach(function (id) {
    if (!settings[id] || !settings[id].enabled) return;
    var ind = INDICATORS[id];
    var params = settings[id].params;
    try {
      results[id] = ind.calculate(indicatorData, params);
      if (ind.scorable) {
        scores[id] = ind.score(indicatorData, results[id], params);
      }
    } catch (e) {
      console.error('Indicator error:', id, e);
    }
  });

  return { results: results, scores: scores };
}

function calculateCompositeScore(scores, settings) {
  var totalWeight = 0;
  var weightedSum = 0;
  Object.keys(scores).forEach(function (id) {
    var w = settings[id] ? settings[id].weight : 0;
    weightedSum += scores[id] * w;
    totalWeight += w;
  });
  return totalWeight > 0 ? weightedSum / totalWeight : 50;
}

function renderScoreBoard(scores, settings) {
  var board = document.getElementById('scoreBoard');
  var compositeEl = document.getElementById('compositeScore');
  var rubricEl = document.getElementById('compositeRubric');
  var individualsEl = document.getElementById('individualScores');

  var composite = calculateCompositeScore(scores, settings);
  var rubric = getRubric(composite);

  compositeEl.textContent = composite.toFixed(1);
  compositeEl.style.color = getRubricColor(composite);
  rubricEl.textContent = rubric.text;
  rubricEl.className = 'score-rubric ' + rubric.css;

  var html = '';
  Object.keys(scores).forEach(function (id) {
    var ind = INDICATORS[id];
    var s = scores[id];
    var r = getRubric(s);
    var w = settings[id] ? settings[id].weight : 0;
    html += '<div class="score-card">' +
      '<div class="score-card-name">' + ind.name + '</div>' +
      '<div class="score-card-value" style="color:' + getRubricColor(s) + '">' + s.toFixed(1) + '</div>' +
      '<div class="score-card-rubric ' + r.css + '" style="font-size:10px;padding:1px 6px;border-radius:3px">' + r.text + '</div>' +
      '<div class="score-card-weight">가중치 ' + w.toFixed(1) + '%</div>' +
      '</div>';
  });
  individualsEl.innerHTML = html;
  board.classList.remove('hidden');
}

function buildChart(data, results, settings) {
  var dates = data.map(function (r) { return r.date; });
  var opens = data.map(function (r) { return r.open; });
  var highs = data.map(function (r) { return r.high; });
  var lows = data.map(function (r) { return r.low; });
  var closes = data.map(function (r) { return r.close; });
  var volumes = data.map(function (r) { return r.volume || 0; });

  var separatePanels = [];
  Object.keys(INDICATORS).forEach(function (id) {
    if (settings[id] && settings[id].enabled && !INDICATORS[id].overlay) {
      separatePanels.push(id);
    }
  });

  var totalPanels = 2 + separatePanels.length;
  var gap = 0.025;
  var totalGap = gap * (totalPanels - 1);
  var available = 1.0 - totalGap;

  var priceRatio = 0.40;
  var volumeRatio = 0.08;
  var remainingRatio = 1.0 - priceRatio - volumeRatio;
  var indicatorRatio = separatePanels.length > 0 ? remainingRatio / separatePanels.length : 0;

  var panelDomains = {};
  var top = 1.0;

  var ph = priceRatio * available;
  panelDomains.price = [top - ph, top];
  top -= ph + gap;

  var vh = volumeRatio * available;
  panelDomains.volume = [top - vh, top];
  top -= vh + gap;

  separatePanels.forEach(function (id) {
    var ih = indicatorRatio * available;
    panelDomains[id] = [top - ih, top];
    top -= ih + gap;
  });

  var traces = [];
  var shapes = [];

  var volColors = closes.map(function (c, i) {
    return i === 0 ? 'rgba(107,114,128,0.5)' : (c >= closes[i - 1] ? 'rgba(211,63,73,0.5)' : 'rgba(36,116,198,0.5)');
  });

  traces.push({
    x: dates, open: opens, high: highs, low: lows, close: closes,
    type: 'candlestick', name: '가격',
    increasing: { line: { color: '#d33f49' } },
    decreasing: { line: { color: '#2474c6' } },
    yaxis: 'y'
  });

  traces.push({
    x: dates, y: volumes, type: 'bar', name: '거래량',
    marker: { color: volColors },
    yaxis: 'y2'
  });

  var axisMap = { price: 'y', volume: 'y2' };
  var axisNum = 3;
  separatePanels.forEach(function (id) {
    axisMap[id] = 'y' + axisNum;
    axisNum++;
  });

  Object.keys(results).forEach(function (id) {
    var ind = INDICATORS[id];
    var params = settings[id].params;
    var yaxis = ind.overlay ? 'y' : axisMap[id];
    if (!yaxis) return;

    var indTraces = ind.traces(dates, results[id], params, yaxis);
    traces = traces.concat(indTraces);

    if (ind.shapes) {
      var indShapes = ind.shapes(params, yaxis);
      shapes = shapes.concat(indShapes);
    }
  });

  if (settings.sma && settings.sma.enabled && results.sma) {
    var volMA = calcSMA(volumes, 20);
    traces.push({
      x: dates, y: volMA, type: 'scatter', mode: 'lines', name: 'Vol MA20',
      line: { color: '#f59e0b', width: 1.2, dash: 'dash' }, yaxis: 'y2'
    });
  }

  var chartHeight = Math.max(600, 400 + separatePanels.length * 130);

  var layout = {
    height: chartHeight,
    showlegend: true,
    legend: { orientation: 'h', y: -0.06, font: { size: 10 } },
    hovermode: 'x unified',
    hoverdistance: 50,
    spikedistance: 200,
    margin: { l: 55, r: 15, t: 25, b: 50 },
    xaxis: {
      rangeslider: { visible: false },
      showspikes: true, spikemode: 'across',
      spikethickness: 1, spikecolor: '#999', spikedash: 'dot'
    },
    shapes: shapes,
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor: 'rgba(0,0,0,0)'
  };

  layout.yaxis = {
    domain: panelDomains.price,
    title: { text: '가격', font: { size: 11 } },
    gridcolor: '#eef1f6', zerolinecolor: '#eef1f6',
    tickformat: ','
  };

  layout.yaxis2 = {
    domain: panelDomains.volume,
    title: { text: '거래량', font: { size: 10 } },
    gridcolor: '#eef1f6', zerolinecolor: '#eef1f6',
    tickformat: '.2s'
  };

  var panelTitles = {
    rsi: 'RSI', macd: 'MACD', stochastic: 'Stochastic',
    williamsR: 'Williams %R', atr: 'ATR', cci: 'CCI', obv: 'OBV'
  };

  axisNum = 3;
  separatePanels.forEach(function (id) {
    var key = 'yaxis' + axisNum;
    layout[key] = {
      domain: panelDomains[id],
      title: { text: panelTitles[id] || id, font: { size: 10 } },
      gridcolor: '#eef1f6', zerolinecolor: '#eef1f6'
    };
    if (id === 'rsi' || id === 'stochastic') {
      layout[key].range = [0, 100];
    } else if (id === 'williamsR') {
      layout[key].range = [-100, 0];
    }
    axisNum++;
  });

  return { traces: traces, layout: layout };
}

function renderChart(data, results, settings) {
  var chartDiv = document.getElementById('chart');
  var emptyState = document.getElementById('emptyState');

  if (!data || data.length === 0) {
    chartDiv.innerHTML = '';
    emptyState.classList.remove('hidden-state');
    return;
  }

  emptyState.classList.add('hidden-state');
  var chart = buildChart(data, results, settings);

  Plotly.newPlot(chartDiv, chart.traces, chart.layout, {
    responsive: true,
    displayModeBar: true,
    modeBarButtonsToRemove: ['lasso2d', 'select2d'],
    displaylogo: false
  });

  chartDiv.on('plotly_hover', function (eventData) {
    if (!eventData || !eventData.points || !eventData.points.length) return;
    var idx = eventData.points[0].pointIndex || eventData.points[0].pointNumber;
    if (idx === undefined || !data[idx]) return;
    updateReadout(data, results, settings, idx);
  });

  chartDiv.on('plotly_unhover', function () {
    document.getElementById('readout').textContent = '마우스를 차트 위에 올리면 해당 시점의 값이 표시됩니다.';
  });
}

function updateReadout(data, results, settings, idx) {
  var row = data[idx];
  if (!row) return;

  var parts = [
    row.date,
    '시가 ' + Number(row.open).toLocaleString(),
    '고가 ' + Number(row.high).toLocaleString(),
    '저가 ' + Number(row.low).toLocaleString(),
    '종가 ' + Number(row.close).toLocaleString(),
    '거래량 ' + Number(row.volume || 0).toLocaleString()
  ];

  Object.keys(results).forEach(function (id) {
    var ind = INDICATORS[id];
    var r = results[id];
    if (id === 'sma') {
      if (r.mid && r.mid[idx] !== null) parts.push('SMA' + settings[id].params.mid + ' ' + r.mid[idx].toFixed(0));
    } else if (id === 'ema') {
      if (r.short && r.short[idx] !== null) parts.push('EMA' + settings[id].params.short + ' ' + r.short[idx].toFixed(0));
    } else if (id === 'rsi') {
      if (r.values && r.values[idx] !== null) parts.push('RSI ' + r.values[idx].toFixed(1));
    } else if (id === 'macd') {
      if (r.histogram && r.histogram[idx] !== null) parts.push('MACD ' + r.line[idx].toFixed(2) + ' Hist ' + r.histogram[idx].toFixed(2));
    } else if (id === 'bollinger') {
      if (r.pctB && r.pctB[idx] !== null) parts.push('%B ' + (r.pctB[idx] * 100).toFixed(1));
    } else if (id === 'stochastic') {
      if (r.k && r.k[idx] !== null) parts.push('%K ' + r.k[idx].toFixed(1));
    } else if (id === 'williamsR') {
      if (r.values && r.values[idx] !== null) parts.push('%R ' + r.values[idx].toFixed(1));
    } else if (id === 'cci') {
      if (r.values && r.values[idx] !== null) parts.push('CCI ' + r.values[idx].toFixed(1));
    } else if (id === 'atr') {
      if (r.values && r.values[idx] !== null) parts.push('ATR ' + r.values[idx].toFixed(1));
    } else if (id === 'obv') {
      if (r.values && r.values[idx] !== null) parts.push('OBV ' + r.values[idx].toLocaleString());
    }
  });

  document.getElementById('readout').textContent = parts.join(' · ');
}

function renderSettingsContent(settings) {
  var html = '';
  var categories = { '추세': [], '모멘텀': [], '변동성': [], '거래량': [] };

  Object.keys(INDICATORS).forEach(function (id) {
    var ind = INDICATORS[id];
    if (categories[ind.category]) categories[ind.category].push(id);
    else categories[ind.category] = [id];
  });

  Object.keys(categories).forEach(function (cat) {
    categories[cat].forEach(function (id) {
      var ind = INDICATORS[id];
      var cfg = settings[id] || { enabled: false, weight: 0, params: JSON.parse(JSON.stringify(ind.defaultParams)) };
      var checked = cfg.enabled ? 'checked' : '';

      html += '<div class="indicator-settings" data-id="' + id + '">';
      html += '<div class="indicator-header">';
      html += '<input type="checkbox" class="indicator-toggle" data-id="' + id + '" ' + checked + ' />';
      html += '<span class="indicator-name">' + ind.name + '</span>';
      html += '<span class="indicator-category">' + ind.category + '</span>';
      html += '<button type="button" class="indicator-help-btn" onclick="showHelp(\'' + id + '\')">?</button>';
      html += '</div>';

      html += '<div class="indicator-params">';
      Object.keys(ind.defaultParams).forEach(function (p) {
        var label = ind.paramLabels[p] || p;
        var val = cfg.params[p] !== undefined ? cfg.params[p] : ind.defaultParams[p];
        html += '<div class="param-group">';
        html += '<label>' + label + '</label>';
        html += '<input type="number" data-id="' + id + '" data-param="' + p + '" value="' + val + '" step="any" />';
        html += '</div>';
      });
      html += '</div>';

      if (ind.scorable) {
        html += '<div class="weight-row">';
        html += '<label>가중치</label>';
        html += '<input type="range" min="0" max="100" step="0.1" value="' + cfg.weight + '" data-id="' + id + '" data-weight="true" oninput="this.nextElementSibling.textContent=Number(this.value).toFixed(1)+\'%\'" />';
        html += '<span class="weight-display">' + cfg.weight.toFixed(1) + '%</span>';
        html += '</div>';
      }

      html += '</div>';
    });
  });

  document.getElementById('settingsContent').innerHTML = html;
}

function collectSettingsFromUI() {
  var settings = {};
  var toggles = document.querySelectorAll('.indicator-toggle');
  toggles.forEach(function (el) {
    var id = el.getAttribute('data-id');
    settings[id] = { enabled: el.checked, weight: 0, params: {} };
  });

  var paramInputs = document.querySelectorAll('.indicator-params input[data-param]');
  paramInputs.forEach(function (el) {
    var id = el.getAttribute('data-id');
    var param = el.getAttribute('data-param');
    if (settings[id]) settings[id].params[param] = Number(el.value);
  });

  var weightInputs = document.querySelectorAll('input[data-weight]');
  weightInputs.forEach(function (el) {
    var id = el.getAttribute('data-id');
    if (settings[id]) settings[id].weight = Number(el.value);
  });

  Object.keys(INDICATORS).forEach(function (id) {
    if (!settings[id]) {
      var ind = INDICATORS[id];
      settings[id] = { enabled: false, weight: 0, params: JSON.parse(JSON.stringify(ind.defaultParams)) };
    }
  });

  return settings;
}

function openSettings() {
  renderSettingsContent(state.settings);
  document.getElementById('settingsModal').classList.remove('hidden');
}

function closeSettings() {
  document.getElementById('settingsModal').classList.add('hidden');
}

function applySettings() {
  var settings = collectSettingsFromUI();
  state.settings = settings;
  saveSettings(settings);
  closeSettings();
  if (state.data && state.data.length > 0) {
    runAnalysis();
  }
}

function showHelp(id) {
  var ind = INDICATORS[id];
  if (!ind) return;

  document.getElementById('helpTitle').textContent = ind.name + ' 도움말';

  var html = '';
  html += '<div class="help-section"><h3>개요</h3><p>' + ind.help.summary + '</p></div>';
  html += '<div class="help-section"><h3>산출 공식</h3><div class="formula">' + ind.help.formula + '</div></div>';
  html += '<div class="help-section"><h3>해석 방법</h3><p>' + ind.help.meaning + '</p></div>';
  html += '<div class="help-section"><h3>활용법</h3><p>' + ind.help.usage + '</p></div>';

  html += '<div class="help-section"><h3>기본 파라미터</h3><p>';
  Object.keys(ind.defaultParams).forEach(function (p) {
    html += (ind.paramLabels[p] || p) + ': ' + ind.defaultParams[p] + '&nbsp;&nbsp;';
  });
  html += '</p></div>';

  if (ind.scorable) {
    html += '<div class="help-section"><h3>루브릭 판정 기준</h3>';
    html += '<table style="width:100%;border-collapse:collapse;font-size:13px">';
    html += '<tr style="background:#f0f4f8"><th style="padding:6px;text-align:left;border:1px solid #ddd">점수 구간</th><th style="padding:6px;text-align:left;border:1px solid #ddd">판정</th><th style="padding:6px;text-align:left;border:1px solid #ddd">해석</th></tr>';
    html += '<tr><td style="padding:6px;border:1px solid #ddd">0 ~ 20</td><td style="padding:6px;border:1px solid #ddd;color:#1f6feb;font-weight:700">강한 과매도</td><td style="padding:6px;border:1px solid #ddd">기술적 반등 가능성 높음</td></tr>';
    html += '<tr><td style="padding:6px;border:1px solid #ddd">21 ~ 40</td><td style="padding:6px;border:1px solid #ddd;color:#2d9cdb;font-weight:700">과매도</td><td style="padding:6px;border:1px solid #ddd">하락 과열 구간</td></tr>';
    html += '<tr><td style="padding:6px;border:1px solid #ddd">41 ~ 60</td><td style="padding:6px;border:1px solid #ddd;color:#6b7280;font-weight:700">중립</td><td style="padding:6px;border:1px solid #ddd">방향성 확인 필요</td></tr>';
    html += '<tr><td style="padding:6px;border:1px solid #ddd">61 ~ 80</td><td style="padding:6px;border:1px solid #ddd;color:#ef8f22;font-weight:700">과매수</td><td style="padding:6px;border:1px solid #ddd">상승 과열 구간</td></tr>';
    html += '<tr><td style="padding:6px;border:1px solid #ddd">81 ~ 100</td><td style="padding:6px;border:1px solid #ddd;color:#d33f49;font-weight:700">강한 과매수</td><td style="padding:6px;border:1px solid #ddd">단기 조정 가능성 주의</td></tr>';
    html += '</table></div>';
  }

  document.getElementById('helpBody').innerHTML = html;
  document.getElementById('helpModal').classList.remove('hidden');
}

function closeHelp() {
  document.getElementById('helpModal').classList.add('hidden');
}

function openHelpList() {
  document.getElementById('helpTitle').textContent = '기술적분석 지표 도움말';

  var html = '';
  Object.keys(INDICATORS).forEach(function (id) {
    var ind = INDICATORS[id];
    html += '<div class="help-list-item" onclick="closeHelp();showHelp(\'' + id + '\')">';
    html += '<span class="help-list-name">' + ind.name + '</span>';
    html += '<span class="help-list-cat">' + ind.category + '</span>';
    html += '</div>';
  });

  document.getElementById('helpBody').innerHTML = html;
  document.getElementById('helpModal').classList.remove('hidden');
}

function runAnalysis() {
  var result = runIndicators(state.data, state.settings);
  state.results = result.results;
  state.scores = result.scores;
  renderChart(state.data, state.results, state.settings);
  if (Object.keys(state.scores).length > 0) {
    renderScoreBoard(state.scores, state.settings);
  }
}

function paramsFromForm() {
  return {
    market: document.getElementById('market').value,
    period: document.getElementById('period').value,
    code: document.getElementById('code').value.trim(),
    limit: Number(document.getElementById('limit').value) || 200
  };
}

async function loadData(params) {
  if (!params) params = paramsFromForm();
  setStatus('불러오는 중...', 'loading');

  var query = new URLSearchParams({
    market: params.market,
    period: params.period,
    code: params.code,
    limit: String(params.limit)
  });

  try {
    var response = await fetch('/api/history?' + query.toString());
    var payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.error || '데이터를 불러오지 못했습니다.');
    }
    if (payload && payload.Result && payload.Result.ResultCode && payload.Result.ResultCode !== 0) {
      throw new Error(payload.Result.ResultMsg || 'API 응답 오류');
    }

    var data = normalizeData(payload, params.period);
    if (data.length === 0) {
      throw new Error('조회된 데이터가 없습니다.');
    }

    state.data = data;
    setStatus(data.length + '개 로드됨');
    runAnalysis();
  } catch (err) {
    state.data = [];
    state.results = {};
    state.scores = {};
    setStatus('오류', 'error');
    document.getElementById('scoreBoard').classList.add('hidden');
    document.getElementById('chart').innerHTML = '';
    document.getElementById('emptyState').classList.remove('hidden-state');
    document.getElementById('readout').textContent = err.message || '데이터를 불러오지 못했습니다.';
  }
}

document.getElementById('market').addEventListener('change', function () {
  var market = this.value;
  var codeInput = document.getElementById('code');
  if (market === 'kospi' || market === 'kosdaq') {
    codeInput.value = '000660';
    codeInput.placeholder = '6자리 코드 (예: 000660)';
  } else {
    codeInput.value = 'AAPL';
    codeInput.placeholder = '심볼 (예: AAPL)';
  }
});

document.getElementById('chartForm').addEventListener('submit', function (e) {
  e.preventDefault();
  loadData();
});

(function init() {
  state.settings = loadSettings();
})();

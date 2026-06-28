/**
 * PAN-TIS — Google Apps Script 웹앱 진입점.
 *
 * 배포(웹앱)하면 공개 URL 이 생기고, `?code=003070&market=kospi` 처럼 종목코드를
 * 파라미터로 받아 프록시에서 일간 데이터를 조회하고 Sprint 1~3 One Screen 을
 * HTML 로 렌더링한다. Core.gs 의 순수 로직을 사용한다.
 *
 * 데이터 소스:
 *  - 기본: 프록시 실데이터(UrlFetchApp). GAS 는 구글 서버에서 실행되므로 프록시에
 *    직접 접근할 수 있다.
 *  - source=demo: 네트워크 없이 결정론적 가짜 데이터(점검용).
 *
 * [먹통 수정] 종목코드 입력 후 멈추던 원인은 입력 폼이었다.
 *  GAS 웹앱은 doGet 출력을 googleusercontent.com 의 "샌드박스 iframe" 안에서 보여준다.
 *  폼에 target="_top" 과 action(배포 /exec URL) 이 없으면, 제출이 그 죽은 iframe
 *  내부로 들어가 doGet 이 재호출되지 않는다 → 화면이 그대로 멈춤(=먹통).
 *  아래 renderForm 은 target="_top" + 배포 URL action 을 복원해 이 문제를 해결한다.
 */

/** 웹앱 GET 핸들러. */
function doGet(e) {
  var p = (e && e.parameter) || {};
  var code = (p.code || '').trim();
  var market = (p.market || CONFIG.api.default_market).toLowerCase();
  var interval = p.interval || '1d';
  var marketState = p.marketState || p.market_state || '개장전';
  var openMode = p.openMode || p.open_mode || '전일종가';
  var userOpen = p.userOpen ? parseFloat(p.userOpen) : null;
  var minNet = p.minNet ? parseFloat(p.minNet) : CONFIG.user_defaults.target_net_profit_pct;
  var source = p.source || 'api';

  var html;
  if (!code) {
    html = renderForm();
  } else {
    try {
      var candles = (source === 'demo') ? demoCandles(code) : fetchProxyCandles(market, interval, code);
      var res = runPipeline(candles, {
        code: code, market: market, interval: interval,
        market_state: marketState, open_mode: openMode, user_open: userOpen, min_net: minNet
      });
      res.meta.source = (source === 'demo') ? 'demo' : 'api';
      html = renderForm(p) + buildHtml(res);
    } catch (err) {
      html = renderForm(p) +
        '<div class="zone" style="border-color:#7a2222"><b>오류</b><br>' + esc(String(err)) +
        '<br><br>종목코드/시장을 확인하거나, 점검용으로 <code>?code=' + esc(code) + '&source=demo</code> 를 시도하세요.</div>';
    }
  }
  return HtmlService.createHtmlOutput(pageShell(html))
    .setTitle('PAN-TIS One Screen')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/** 배포된 웹앱의 실행 URL(/exec). 폼 action 에 사용. 실패 시 빈 문자열. */
function webAppUrl() {
  try { return ScriptApp.getService().getUrl() || ''; } catch (e) { return ''; }
}

/** 프록시를 호출해 캔들 배열을 반환한다. */
function fetchProxyCandles(market, interval, code) {
  var period = CONFIG.interval_period_map[interval] || interval;
  var limit = CONFIG.app.lookback;
  var url = CONFIG.api.base_url.replace(/\/$/, '') + '/' +
    '?market=' + encodeURIComponent(market) +
    '&period=' + encodeURIComponent(period) +
    '&code=' + encodeURIComponent(code) +
    '&limit=' + encodeURIComponent(limit);
  var resp = UrlFetchApp.fetch(url, {
    muteHttpExceptions: true,
    followRedirects: true,
    method: 'get'
  });
  var status = resp.getResponseCode();
  if (status !== 200) throw new Error('프록시 HTTP ' + status + ' — ' + url);
  var text = resp.getContentText();
  var payload;
  try { payload = JSON.parse(text); }
  catch (e) { throw new Error('프록시 응답이 JSON 이 아닙니다: ' + text.slice(0, 120)); }
  return mapProxyPayload(payload);
}

/** 점검용 결정론적 가짜 캔들(네트워크 불필요). */
function demoCandles(code) {
  var seed = 0; for (var k = 0; k < code.length; k++) seed += code.charCodeAt(k);
  var out = [];
  for (var i = 0; i < CONFIG.app.lookback; i++) {
    var wave = Math.sin((i + seed) * 0.15);
    var open = Math.round(1000 * (1 + 0.01 * wave) * 100) / 100;
    var close = Math.round(open * (1 + 0.005 * Math.cos(i * 0.2)) * 100) / 100;
    var high = Math.round(Math.max(open, close) * 1.01 * 100) / 100;
    var low = Math.round(Math.min(open, close) * 0.99 * 100) / 100;
    var lt = (i % 2 === 0) ? '100000' : '143000';
    var ht = (i % 2 === 0) ? '143000' : '100000';
    out.push({ datetime: String(20260101 + i), open: open, high_time: ht, high: high, low_time: lt, low: low, close: close, volume: 1000 + ((i * 37 + seed) % 500) });
  }
  return out;
}

/* ========================= HTML 렌더링 ========================= */

function esc(s) {
  return String(s).replace(/[&<>"]/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
  });
}

function pageShell(body) {
  var css = [
    'body{font-family:-apple-system,"Segoe UI","Noto Sans KR",sans-serif;margin:0;background:#0e1117;color:#e6e6e6}',
    '.wrap{max-width:1100px;margin:0 auto;padding:24px}',
    'h1{font-size:22px;margin:0 0 4px}.cap{color:#9aa4b2;font-size:13px;margin-bottom:14px}',
    '.zone{background:#161b22;border:1px solid #2a313c;border-radius:12px;padding:16px 18px;margin-bottom:16px}',
    '.zlabel{display:inline-block;font-weight:700;font-size:13px;color:#7ee787;background:#10261a;border:1px solid #1f6f3a;padding:2px 8px;border-radius:6px;margin-bottom:12px}',
    '.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px}',
    '.metric{background:#0e1117;border:1px solid #222933;border-radius:8px;padding:10px 12px}',
    '.metric .k{font-size:11.5px;color:#8b949e}.metric .v{font-size:18px;font-weight:700;margin-top:3px}',
    'table{width:100%;border-collapse:collapse;font-size:11.5px}',
    'th,td{border:1px solid #222933;padding:4px 6px;text-align:right;white-space:nowrap}',
    'th{background:#0e1117;color:#9aa4b2}td:first-child,th:first-child{text-align:left}',
    '.scroll{overflow-x:auto}.verdict-big{font-size:24px;font-weight:800;color:#f0c674;margin:6px 0 14px}',
    'ul{margin:6px 0 0;padding-left:20px}li{margin:3px 0;font-size:13px}',
    'input,select{background:#0e1117;color:#e6e6e6;border:1px solid #2a313c;border-radius:6px;padding:6px 8px}',
    'button{background:#1f6f3a;color:#fff;border:0;border-radius:6px;padding:8px 16px;font-weight:700;cursor:pointer}',
    '.foot{color:#6e7681;font-size:12px;border-top:1px solid #2a313c;margin-top:18px;padding-top:12px}',
    '.flat{color:#d29922}.up{color:#7ee787}.down{color:#ff7b72}.row{display:flex;gap:8px;flex-wrap:wrap;align-items:end}'
  ].join('');
  return '<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8"><style>' + css + '</style></head>' +
    '<body><div class="wrap"><h1>PAN-TIS — One Screen</h1>' +
    '<div class="cap">Market State Tokenization MVP · 최근 ' + CONFIG.app.lookback + '개 고정 · Apps Script</div>' +
    body +
    '<div class="foot">본 시스템은 투자 의사결정 지원 도구이며, 자동매매 또는 수익 보장을 의미하지 않습니다. 모든 투자 판단과 책임은 사용자에게 있습니다.</div>' +
    '</div></body></html>';
}

function renderForm(p) {
  p = p || {};
  function opt(list, sel) { return list.map(function (x) { return '<option' + (x === sel ? ' selected' : '') + '>' + x + '</option>'; }).join(''); }
  // [먹통 수정] 샌드박스 iframe 탈출을 위해 target="_top" 필수. action 은 배포 /exec URL.
  var actionUrl = webAppUrl();
  var actionAttr = actionUrl ? ' action="' + esc(actionUrl) + '"' : '';
  return '<div class="zone"><span class="zlabel">A. INPUT</span>' +
    '<form method="get"' + actionAttr + ' target="_top" class="row">' +
    '<div><div class="metric"><div class="k">종목코드</div><input name="code" value="' + esc(p.code || '') + '" placeholder="예: 003070"></div></div>' +
    '<div><div class="metric"><div class="k">시장</div><select name="market">' + opt(['kospi', 'kosdaq'], (p.market || 'kospi')) + '</select></div></div>' +
    '<div><div class="metric"><div class="k">시장상태</div><select name="marketState">' + opt(['개장전', '장중'], (p.marketState || '개장전')) + '</select></div></div>' +
    '<div><div class="metric"><div class="k">시가모드</div><select name="openMode">' + opt(['전일종가', '예상시가', '실제시가'], (p.openMode || '전일종가')) + '</select></div></div>' +
    '<div><div class="metric"><div class="k">최소순수익률(%)</div><input name="minNet" value="' + esc(p.minNet || '2.0') + '" size="4"></div></div>' +
    '<div><button type="submit">예측하기</button></div>' +
    '</form></div>';
}

function metric(k, v, cls) { return '<div class="metric"><div class="k">' + esc(k) + '</div><div class="v ' + (cls || '') + '">' + esc(v) + '</div></div>'; }

function buildHtml(res) {
  var tok = res.tokens[res.tokens.length - 1];
  var p = res.prediction, d = res.decision, m = res.meta;
  var sourceName = m.source === 'demo' ? '점검용 데모데이터' : '실데이터 (프록시)';

  // B. Market status
  var b = '<div class="zone"><span class="zlabel">B. MARKET STATUS</span><div class="grid">' +
    metric('현재 추세', tok.trend_class, 'flat') + metric('현재 PatternCode', tok.pattern_code) +
    metric('현재 PathCode', tok.path_code) + metric('EnergyClass', tok.energy_class) +
    metric('DataQualityScore', tok.data_quality_score.toFixed(0)) + metric('AnomalyType', tok.anomaly_type) +
    '</div><div class="cap">β=' + tok.beta.toFixed(2) + ' corr=' + tok.correlation.toFixed(2) + '</div></div>';

  // 표 (앞 5 / 뒤 5)
  var cols = ['DateTime', 'Open', 'HighTime', 'High', 'LowTime', 'Low', 'Close', 'Volume', 'PathCode', 'PatternCode', 'Turnover', 'DataQualityScore', 'AnomalyType'];
  function rowHtml(i) {
    var c = res.candles[i], f = res.features[i], t = res.tokens[i];
    var cells = [c.datetime, c.open, c.high_time, c.high, c.low_time, c.low, c.close, c.volume, t.path_code, t.pattern_code,
    f.turnover.toFixed(0), t.data_quality_score.toFixed(0), t.anomaly_type];
    return '<tr>' + cells.map(function (x) { return '<td>' + esc(x) + '</td>'; }).join('') + '</tr>';
  }
  var n = res.candles.length, body = '';
  for (var i = 0; i < Math.min(5, n); i++) body += rowHtml(i);
  if (n > 10) body += '<tr><td colspan="13" style="text-align:center;color:#6e7681">⋯ (총 ' + n + '행) ⋯</td></tr>';
  for (var j = Math.max(5, n - 5); j < n; j++) body += rowHtml(j);
  var table = '<div class="zone"><span class="zlabel">조회 데이터 (' + n + ')</span><div class="scroll"><table><thead><tr>' +
    cols.map(function (c) { return '<th>' + esc(c) + '</th>'; }).join('') + '</tr></thead><tbody>' + body + '</tbody></table></div></div>';

  // C. Prediction
  var c = '<div class="zone"><span class="zlabel">C. PREDICTION</span><div class="grid">' +
    metric('예상 PatternCode', p.expected_pattern) + metric('예상 PathCode', p.expected_path) +
    metric('Probability', (p.probability * 100).toFixed(1) + '%') + metric('Confidence', (p.confidence * 100).toFixed(1) + '%') +
    metric('Historical Cases', String(p.historical_cases)) + '</div>' +
    '<div class="scroll" style="margin-top:10px"><table><thead><tr><th>ExpectedOpen</th><th>ExpectedHigh</th><th>ExpectedLow</th><th>ExpectedClose</th></tr></thead><tbody><tr>' +
    '<td>' + p.expected_open.toFixed(2) + '</td><td>' + p.expected_high.toFixed(2) + '</td><td>' + p.expected_low.toFixed(2) + '</td><td>' + p.expected_close.toFixed(2) + '</td>' +
    '</tr></tbody></table></div></div>';

  // D. Decision
  var scenRows = res.scenarios.map(function (s) {
    return '<tr><td>' + esc(s.label) + '</td><td>' + s.assumed_open.toFixed(1) + '</td><td>' + esc(s.expected_pattern) + '</td>' +
      '<td>' + (s.probability * 100).toFixed(1) + '%</td><td>' + (s.confidence * 100).toFixed(1) + '%</td>' +
      '<td>' + (s.expected_value >= 0 ? '+' : '') + s.expected_value.toFixed(2) + '</td><td>' + s.rr.toFixed(2) + '</td>' +
      '<td>' + (s.net_return_pct >= 0 ? '+' : '') + s.net_return_pct.toFixed(2) + '%</td><td style="text-align:left;color:#f0c674">' + esc(s.verdict) + '</td></tr>';
  }).join('');
  var scenTable = res.scenarios.length ?
    '<div style="margin-top:10px"><b>개장전 예상시가 민감도</b></div><div class="scroll"><table><thead><tr>' +
    '<th>Scenario</th><th>AssumedOpen</th><th>예상Pattern</th><th>Prob</th><th>Conf</th><th>EV</th><th>RR</th><th>Net</th><th>Verdict</th></tr></thead><tbody>' +
    scenRows + '</tbody></table></div>' : '';
  var dd = '<div class="zone"><span class="zlabel">D. TRADING DECISION</span><div class="verdict-big">' + esc(d.verdict) + '</div><div class="grid">' +
    metric('추천 진입', d.entry_low.toFixed(1) + ' ~ ' + d.entry_high.toFixed(1)) +
    metric('목표가 1/2', d.target_1.toFixed(1) + ' / ' + d.target_2.toFixed(1)) +
    metric('손절가', d.stop_loss.toFixed(1)) + metric('예상 순수익', (d.net_return_pct >= 0 ? '+' : '') + d.net_return_pct.toFixed(2) + '%', 'up') +
    metric('Expected Value', (d.expected_value >= 0 ? '+' : '') + d.expected_value.toFixed(2) + '%') +
    metric('Risk / Reward', d.rr.toFixed(2)) + metric('총비용', d.total_cost_pct.toFixed(3) + '%') +
    '</div>' + scenTable + '</div>';

  // E. Why
  var e = '<div class="zone"><span class="zlabel">E. WHY?</span><ul>' +
    d.reasons.map(function (r) { return '<li>' + esc(r) + '</li>'; }).join('') + '</ul></div>';

  var badge = '<div class="cap">조회: <b>' + esc(m.code) + '</b> · ' + esc(m.interval) + ' · 데이터 소스 = <b>' + esc(sourceName) + '</b></div>';
  return badge + b + table + c + dd + e;
}

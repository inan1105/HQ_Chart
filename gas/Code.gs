var PROXY_BASE = 'https://iamchart-proxy.inan1105.workers.dev/';
var API_PATH = 'be.asp/ty.a/api/iamchart/SeriES/stock/history/v2';

function doGet() {
  return HtmlService
    .createTemplateFromFile('Index')
    .evaluate()
    .setTitle('IAMChart 기술적분석 플랫폼')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function fetchStockHistory(params) {
  var market = (params.market || 'kospi').toLowerCase();
  var period = (params.period || 'w').toLowerCase();
  var code = (params.code || '000660').toUpperCase();
  var limit = Number(params.limit) || 200;

  var validMarkets = ['kospi', 'kosdaq', 'nasdaq', 'nyse'];
  if (validMarkets.indexOf(market) === -1) {
    throw new Error('market은 kospi, kosdaq, nasdaq, nyse만 가능합니다.');
  }
  if (['m', 'd', 'w'].indexOf(period) === -1) {
    throw new Error('period는 m, d, w만 가능합니다.');
  }
  if (limit < 1 || limit > 1000) {
    throw new Error('limit은 1~1000 사이의 숫자여야 합니다.');
  }

  var url = PROXY_BASE + API_PATH
    + '?market=' + encodeURIComponent(market)
    + '&period=' + encodeURIComponent(period)
    + '&code=' + encodeURIComponent(code)
    + '&limit=' + encodeURIComponent(String(limit));

  var response = UrlFetchApp.fetch(url, {
    method: 'get',
    muteHttpExceptions: true
  });

  var status = response.getResponseCode();
  var text = response.getContentText();

  if (status !== 200) {
    throw new Error('API 조회 실패: HTTP ' + status);
  }

  return JSON.parse(text);
}

function saveUserSettings(settings) {
  PropertiesService
    .getUserProperties()
    .setProperty('TA_SETTINGS_V2', JSON.stringify(settings));
  return { ok: true };
}

function loadUserSettings() {
  var raw = PropertiesService
    .getUserProperties()
    .getProperty('TA_SETTINGS_V2');

  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

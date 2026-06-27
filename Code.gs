const PROXY_BASE = 'https://iamchart-proxy.inan1105.workers.dev/';

function doGet() {
  return HtmlService
    .createTemplateFromFile('Index')
    .evaluate()
    .setTitle('IamChart 기술적분석 앱')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function fetchStockHistory(params) {
  let market = params.market || 'kospi';
  const period = params.period || 'd';
  const code = params.code || '000660';
  const limit = params.limit || 200;

  // kospi(기본값)로 파라미터 오류가 날 경우 kosdaq로 1회 더 실행
  const markets = (market === 'kospi') ? ['kospi', 'kosdaq'] : [market];
  let lastStatus = 0;

  for (let i = 0; i < markets.length; i++) {
    market = markets[i];

    const targetPath =
      `be.asp/ty.a/api/iamchart/SeriES/stock/history/v2?market=${market}&period=${period}&code=${code}&limit=${limit}`;

    const url = PROXY_BASE + targetPath;

    const response = UrlFetchApp.fetch(url, {
      method: 'get',
      muteHttpExceptions: true
    });

    const status = response.getResponseCode();
    const text = response.getContentText();

    if (status === 200) {
      return JSON.parse(text);
    }

    lastStatus = status;
  }

  throw new Error('API 조회 실패: HTTP ' + lastStatus);
}

function saveUserSettings(settings) {
  PropertiesService
    .getUserProperties()
    .setProperty('TA_SETTINGS', JSON.stringify(settings));

  return {
    ok: true
  };
}

function loadUserSettings() {
  const raw = PropertiesService
    .getUserProperties()
    .getProperty('TA_SETTINGS');

  if (!raw) {
    return getDefaultSettings();
  }

  return JSON.parse(raw);
}

function getDefaultSettings() {
  return {
    indicators: {
      sma: {
        enabled: true,
        weight: 15,
        params: {
          short: 5,
          mid: 20,
          long: 60
        }
      },

      rsi: {
        enabled: true,
        weight: 15,
        params: {
          period: 10,
          oversold: 20,
          overbought: 80
        }
      },

      macd: {
        enabled: true,
        weight: 10,
        params: {
          fast: 10,
          slow: 20,
          signal: 5
        }
      },

      bollinger: {
        enabled: true,
        weight: 20,
        params: {
          period: 10,
          multiplier: 2
        }
      },

      dmi: {
        enabled: true,
        weight: 20,
        params: {
          period: 10
        }
      },

      obv: {
        enabled: true,
        weight: 20,
        params: {
          period: 20
        }
      }
    }
  };
}



/*
function testFetch() {
  return fetchStockHistory({
    market: 'kospi',
    period: 'd',
    code: '000660',
    limit: 10
  });
}
*/

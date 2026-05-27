const https = require("node:https");
const { URL } = require("node:url");

const PROXY_BASE = "https://iamchart-proxy.inan1105.workers.dev/";
const API_PATH = "be.asp/ty.a/api/iamchart/SeriES/stock/history/v2";
const VALID_MARKETS = ["kospi", "kosdaq", "nasdaq", "nyse"];
const KR_MARKETS = ["kospi", "kosdaq"];

function validateHistoryRequest(requestUrl) {
  const url = new URL(requestUrl || "/", "https://hq-chart.vercel.app");
  const market = String(url.searchParams.get("market") || "").toLowerCase();
  const period = String(url.searchParams.get("period") || "").toLowerCase();
  const code = String(url.searchParams.get("code") || "").toUpperCase();
  const limit = Number(url.searchParams.get("limit") || "");

  if (!VALID_MARKETS.includes(market)) {
    return { error: "market은 kospi, kosdaq, nasdaq, nyse만 가능합니다." };
  }
  if (!["m", "d", "w"].includes(period)) {
    return { error: "period는 m, d, w만 가능합니다." };
  }
  if (KR_MARKETS.includes(market)) {
    if (!/^[A-Z0-9]{1,6}$/.test(code)) {
      return { error: "국내 종목코드는 최대 6자리 영숫자입니다." };
    }
  } else {
    if (!/^[A-Z]{1,5}$/.test(code)) {
      return { error: "미국 종목심볼은 1~5자리 영문자입니다." };
    }
  }
  if (!Number.isInteger(limit) || limit < 1 || limit > 1000) {
    return { error: "limit은 1~1000 사이의 숫자여야 합니다." };
  }

  const apiUrl = new URL(PROXY_BASE + API_PATH);
  apiUrl.searchParams.set("market", market);
  apiUrl.searchParams.set("period", period);
  apiUrl.searchParams.set("code", code);
  apiUrl.searchParams.set("limit", String(limit));

  return { apiUrl };
}

function requestText(url, rejectUnauthorized) {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      {
        rejectUnauthorized,
        headers: {
          Accept: "application/json,text/plain,*/*",
          "User-Agent": "hq-chart/2.0",
        },
      },
      (res) => {
        let body = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => { body += chunk; });
        res.on("end", () => resolve({ statusCode: res.statusCode || 500, body }));
      },
    );
    req.setTimeout(15000, () => req.destroy(new Error("API 요청 시간 초과")));
    req.on("error", reject);
  });
}

async function fetchText(url) {
  try {
    return await requestText(url, true);
  } catch (err) {
    if (/certificate|self-signed|unable to verify/i.test(err.message || "")) {
      return requestText(url, false);
    }
    throw err;
  }
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method && req.method !== "GET") {
    res.statusCode = 405;
    res.end(JSON.stringify({ error: "GET 요청만 가능합니다." }));
    return;
  }

  const validation = validateHistoryRequest(req.url);
  if (validation.error) {
    res.statusCode = 400;
    res.end(JSON.stringify({ error: validation.error }));
    return;
  }

  try {
    const apiRes = await fetchText(validation.apiUrl);
    if (apiRes.statusCode < 200 || apiRes.statusCode >= 300) {
      res.statusCode = 502;
      res.end(JSON.stringify({ error: "원격 API 응답 오류: HTTP " + apiRes.statusCode }));
      return;
    }
    res.statusCode = 200;
    res.end(apiRes.body);
  } catch (err) {
    res.statusCode = 502;
    res.end(JSON.stringify({ error: err.message || "API 요청 실패" }));
  }
};

const https = require("node:https");
const { URL } = require("node:url");

const API_BASE =
  "https://was002.iamchart.com/be.asp/ty.a/api/iamchart/SeriES/stock/history";
const DEFAULT_VERSION = "v3";

function validateHistoryRequest(requestUrl) {
  const url = new URL(requestUrl || "/", "https://hq-chart.vercel.app");
  const market = String(url.searchParams.get("market") || "").toLowerCase();
  const period = String(url.searchParams.get("period") || "").toLowerCase();
  const code = String(url.searchParams.get("code") || "").toUpperCase();
  const limitRaw = String(url.searchParams.get("limit") || "");
  const limit = Number(limitRaw);
  const version = String(
    url.searchParams.get("version") || DEFAULT_VERSION,
  ).toLowerCase();

  if (!["kospi", "kosdaq"].includes(market)) {
    return { error: "market은 kospi 또는 kosdaq만 가능합니다." };
  }

  if (!["m", "d", "w"].includes(period)) {
    return { error: "period는 m, d, w만 가능합니다." };
  }

  if (!/^[A-Z0-9]{6}$/.test(code)) {
    return { error: "code는 6자리 영숫자여야 합니다." };
  }

  if (!Number.isInteger(limit) || limit < 1 || limit > 1000) {
    return { error: "limit은 1부터 1000 사이의 숫자여야 합니다." };
  }

  if (!["v2", "v3"].includes(version)) {
    return { error: "version은 v2 또는 v3만 가능합니다." };
  }

  const apiUrl = new URL(`${API_BASE}/${version}`);
  apiUrl.searchParams.set("market", market);
  apiUrl.searchParams.set("period", period);
  apiUrl.searchParams.set("code", code);
  apiUrl.searchParams.set("limit", String(limit));

  return { apiUrl };
}

function requestText(url, allowCertificateFallback = false) {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      {
        rejectUnauthorized: !allowCertificateFallback,
        headers: {
          Accept: "application/json,text/plain,*/*",
          "User-Agent": "hq-chart-vercel/1.0",
        },
      },
      (apiRes) => {
        let body = "";
        apiRes.setEncoding("utf8");
        apiRes.on("data", (chunk) => {
          body += chunk;
        });
        apiRes.on("end", () => {
          resolve({ statusCode: apiRes.statusCode || 500, body });
        });
      },
    );

    req.setTimeout(15000, () => {
      req.destroy(new Error("API 요청 시간이 초과되었습니다."));
    });
    req.on("error", reject);
  });
}

async function fetchText(url) {
  try {
    return await requestText(url);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (/certificate|self-signed|unable to verify/i.test(message)) {
      return requestText(url, true);
    }
    throw error;
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
      res.end(
        JSON.stringify({
          error: `원격 API 응답 오류: HTTP ${apiRes.statusCode}`,
        }),
      );
      return;
    }

    res.statusCode = 200;
    res.end(apiRes.body);
  } catch (error) {
    res.statusCode = 502;
    res.end(
      JSON.stringify({
        error: error instanceof Error ? error.message : "API 요청에 실패했습니다.",
      }),
    );
  }
};

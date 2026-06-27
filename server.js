const http = require("node:http");
const https = require("node:https");
const fs = require("node:fs");
const path = require("node:path");
const { URL } = require("node:url");

const PORT = Number(process.env.PORT || 4173);
const ROOT = __dirname;
const API_BASE =
  "https://was002.iamchart.com/be.asp/ty.a/api/iamchart/SeriES/stock/history";
const DEFAULT_VERSION = "v3";

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".ico": "image/x-icon",
};

function send(res, status, body, headers = {}) {
  res.writeHead(status, {
    "Cache-Control": "no-store",
    ...headers,
  });
  res.end(body);
}

function sendJson(res, status, payload) {
  send(res, status, JSON.stringify(payload), {
    "Content-Type": "application/json; charset=utf-8",
  });
}

function validateHistoryRequest(requestUrl) {
  const url = new URL(requestUrl, `http://localhost:${PORT}`);
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
          "User-Agent": "iamchart-local-chart/1.0",
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

async function handleHistory(req, res) {
  const validation = validateHistoryRequest(req.url || "");
  if (validation.error) {
    sendJson(res, 400, { error: validation.error });
    return;
  }

  try {
    const apiRes = await fetchText(validation.apiUrl);
    if (apiRes.statusCode < 200 || apiRes.statusCode >= 300) {
      sendJson(res, 502, {
        error: `원격 API 응답 오류: HTTP ${apiRes.statusCode}`,
      });
      return;
    }

    send(res, 200, apiRes.body, {
      "Content-Type": "application/json; charset=utf-8",
    });
  } catch (error) {
    sendJson(res, 502, {
      error: error instanceof Error ? error.message : "API 요청에 실패했습니다.",
    });
  }
}

function serveStatic(req, res) {
  const requestUrl = new URL(req.url || "/", `http://localhost:${PORT}`);
  const requestedPath =
    requestUrl.pathname === "/" ? "/index.html" : requestUrl.pathname;
  const decodedPath = decodeURIComponent(requestedPath);
  const filePath = path.resolve(ROOT, `.${decodedPath}`);

  if (!filePath.startsWith(ROOT)) {
    send(res, 403, "Forbidden", { "Content-Type": "text/plain; charset=utf-8" });
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      send(res, 404, "Not found", {
        "Content-Type": "text/plain; charset=utf-8",
      });
      return;
    }

    send(res, 200, data, {
      "Content-Type": mimeTypes[path.extname(filePath)] || "application/octet-stream",
    });
  });
}

const server = http.createServer((req, res) => {
  const requestUrl = new URL(req.url || "/", `http://localhost:${PORT}`);

  if (requestUrl.pathname === "/api/history") {
    handleHistory(req, res);
    return;
  }

  serveStatic(req, res);
});

server.listen(PORT, () => {
  console.log(`IAMChart local app: http://localhost:${PORT}`);
});

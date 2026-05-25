// Cloudflare Worker - IamChart Stock API Proxy
// Deploy: https://dash.cloudflare.com → Workers & Pages → Create Worker

const TARGET_BASE = "https://was002.iamchart.com";
const TARGET_PATH = "/be.asp/ty.a/api/iamchart/SeriES/stock/history/v2";

const ALLOWED_MARKETS = ["kospi", "kodaq"];
const ALLOWED_PERIODS = ["d", "w", "m"];
const MAX_LIMIT = 500;
const DEFAULT_LIMIT = 200;

export default {
  async fetch(request) {
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(),
      });
    }

    if (request.method !== "GET") {
      return jsonResponse({ error: "Method not allowed" }, 405);
    }

    const url = new URL(request.url);
    const market = url.searchParams.get("market") || "kospi";
    const period = url.searchParams.get("period") || "d";
    const code = url.searchParams.get("code") || "";
    let limit = parseInt(url.searchParams.get("limit") || DEFAULT_LIMIT, 10);

    if (!ALLOWED_MARKETS.includes(market)) {
      return jsonResponse({ error: "Invalid market. Use: kospi or kodaq" }, 400);
    }
    if (!ALLOWED_PERIODS.includes(period)) {
      return jsonResponse({ error: "Invalid period. Use: d, w, or m" }, 400);
    }
    if (!/^[A-Za-z0-9]{6}$/.test(code)) {
      return jsonResponse({ error: "Invalid code. Must be 6 alphanumeric characters" }, 400);
    }
    if (isNaN(limit) || limit < 1) limit = DEFAULT_LIMIT;
    if (limit > MAX_LIMIT) limit = MAX_LIMIT;

    const targetUrl = `${TARGET_BASE}${TARGET_PATH}?market=${market}&period=${period}&code=${code}&limit=${limit}`;

    try {
      const resp = await fetch(targetUrl, {
        method: "GET",
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
          "Accept": "application/json, text/plain, */*",
          "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
          "Referer": "https://www.iamchart.com/",
          "Origin": "https://www.iamchart.com",
        },
      });

      const body = await resp.text();
      return new Response(body, {
        status: resp.status,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          ...corsHeaders(),
        },
      });
    } catch (err) {
      return jsonResponse({ error: "Upstream request failed", detail: err.message }, 502);
    }
  },
};

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function jsonResponse(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...corsHeaders(),
    },
  });
}

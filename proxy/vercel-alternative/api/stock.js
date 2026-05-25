// Vercel Serverless Function - IamChart Stock API Proxy
// Deploy: npx vercel --prod

const TARGET_BASE = "https://was002.iamchart.com";
const TARGET_PATH = "/be.asp/ty.a/api/iamchart/SeriES/stock/history/v2";

const ALLOWED_MARKETS = ["kospi", "kodaq"];
const ALLOWED_PERIODS = ["d", "w", "m"];
const MAX_LIMIT = 500;
const DEFAULT_LIMIT = 200;

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { market = "kospi", period = "d", code = "", limit: rawLimit } = req.query;
  let limit = parseInt(rawLimit || DEFAULT_LIMIT, 10);

  if (!ALLOWED_MARKETS.includes(market)) {
    return res.status(400).json({ error: "Invalid market. Use: kospi or kodaq" });
  }
  if (!ALLOWED_PERIODS.includes(period)) {
    return res.status(400).json({ error: "Invalid period. Use: d, w, or m" });
  }
  if (!/^[A-Za-z0-9]{6}$/.test(code)) {
    return res.status(400).json({ error: "Invalid code. Must be 6 alphanumeric characters" });
  }
  if (isNaN(limit) || limit < 1) limit = DEFAULT_LIMIT;
  if (limit > MAX_LIMIT) limit = MAX_LIMIT;

  const targetUrl = `${TARGET_BASE}${TARGET_PATH}?market=${market}&period=${period}&code=${code}&limit=${limit}`;

  try {
    const resp = await fetch(targetUrl, {
      method: "GET",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        Accept: "application/json, text/plain, */*",
        "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
        Referer: "https://www.iamchart.com/",
        Origin: "https://www.iamchart.com",
      },
    });

    const body = await resp.text();
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.status(resp.status).send(body);
  } catch (err) {
    return res.status(502).json({ error: "Upstream request failed", detail: err.message });
  }
}

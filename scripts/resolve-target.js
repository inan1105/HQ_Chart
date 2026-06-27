#!/usr/bin/env node
// 브라우저가 아닌 "서버"에서 시세를 가져올 때 적용할 Base / Target 을 표시하고,
// (서버에는 CORS 가 없으므로) Target 원격 API 를 직접 호출해 검증하는 스크립트.
//
// 사용법:
//   node scripts/resolve-target.js                       # 기본값(000660, kospi, d, 200, v3)
//   node scripts/resolve-target.js 000660 kospi d 200 v3 # code market period limit version
//   node scripts/resolve-target.js --fetch               # Target 을 실제 호출까지 수행
//
// 용어:
//   BASE   = 클라이언트(웹앱/커스텀GPT)가 호출하는 우리 프록시 주소
//   TARGET = 프록시가 서버에서 대신 호출하는 원격 IAMChart API 주소

const https = require("node:https");
const { URL } = require("node:url");

// 환경변수로 덮어쓸 수 있습니다.
const BASE = process.env.PROXY_BASE || "https://hq-chart.vercel.app";
const TARGET_BASE =
  process.env.TARGET_BASE ||
  "https://was002.iamchart.com/be.asp/ty.a/api/iamchart/SeriES/stock/history";

const args = process.argv.slice(2).filter((a) => a !== "--fetch");
const doFetch = process.argv.includes("--fetch");

const [code = "000660", market = "kospi", period = "d", limit = "200", version = "v3"] = args;

function buildUrls() {
  const qs = new URLSearchParams({ market, period, code, limit, version });

  // 프록시는 version 을 경로로 옮기고 나머지는 그대로 전달합니다.
  const targetQs = new URLSearchParams({ market, period, code, limit });

  const proxyUrl = new URL(`${BASE}/api/history`);
  proxyUrl.search = qs.toString();

  const targetUrl = new URL(`${TARGET_BASE}/${version}`);
  targetUrl.search = targetQs.toString();

  return { proxyUrl, targetUrl };
}

function get(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      { headers: { Accept: "application/json,text/plain,*/*", "User-Agent": "resolve-target/1.0" } },
      (res) => {
        let body = "";
        res.setEncoding("utf8");
        res.on("data", (c) => (body += c));
        res.on("end", () => resolve({ status: res.statusCode, body }));
      },
    );
    req.setTimeout(15000, () => req.destroy(new Error("timeout")));
    req.on("error", reject);
  });
}

async function main() {
  const { proxyUrl, targetUrl } = buildUrls();

  console.log("BASE   (클라이언트가 호출):", BASE);
  console.log("  └ 프록시 엔드포인트     :", proxyUrl.toString());
  console.log("TARGET (서버가 대신 호출) :", targetUrl.toString());

  if (!doFetch) {
    console.log("\n실제 호출은 `--fetch` 옵션을 붙여 실행하세요.");
    return;
  }

  console.log("\n서버에서 TARGET 직접 호출 중...");
  const res = await get(targetUrl);
  console.log("HTTP", res.status);
  console.log(res.body.slice(0, 600));
}

main().catch((err) => {
  console.error("ERROR:", err.message);
  process.exit(1);
});

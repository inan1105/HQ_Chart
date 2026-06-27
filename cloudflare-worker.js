// ============================================================
// IAMChart 프록시 — Cloudflare Worker
// ------------------------------------------------------------
// 이 한 파일을 Cloudflare Worker 편집기에 그대로 붙여넣고 배포하면,
// 브라우저가 CORS 제약 없이 IAMChart 원격 API 를 호출할 수 있습니다.
//
// 동작 방식(경로 그대로 전달):
//   요청  https://<당신의-worker>.workers.dev/be.asp/ty.a/api/iamchart/SeriES/stock/history/v3?market=kospi&period=d&code=000660&limit=200
//   전달  https://was002.iamchart.com/be.asp/ty.a/api/iamchart/SeriES/stock/history/v3?market=kospi&period=d&code=000660&limit=200
//
// 즉 Worker 주소 뒤에 붙은 경로/쿼리를 그대로 원격 서버로 넘기고,
// 응답에 CORS 헤더를 더해 돌려줍니다.
// ============================================================

const UPSTREAM = "https://was002.iamchart.com";

// 보안: IAMChart API 경로만 허용합니다(오픈 프록시 방지).
const ALLOW_PREFIX = "/be.asp/ty.a/api/iamchart/";

export default {
  async fetch(request) {
    const url = new URL(request.url);

    // 브라우저의 사전요청(preflight) 처리
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders() });
    }

    if (request.method !== "GET") {
      return json({ error: "GET 요청만 가능합니다." }, 405);
    }

    // 루트(/) 접속 시 간단한 안내
    if (url.pathname === "/" || url.pathname === "") {
      return json(
        {
          ok: true,
          usage:
            "이 주소 뒤에 be.asp/ty.a/api/iamchart/... 경로를 붙여 호출하세요.",
          example:
            "/be.asp/ty.a/api/iamchart/SeriES/stock/history/v3?market=kospi&period=d&code=000660&limit=200",
        },
        200,
      );
    }

    // 허용된 IAMChart 경로만 통과
    if (!url.pathname.startsWith(ALLOW_PREFIX)) {
      return json({ error: "허용되지 않은 경로입니다." }, 403);
    }

    const target = UPSTREAM + url.pathname + url.search;

    let upstream;
    try {
      upstream = await fetch(target, {
        headers: {
          Accept: "application/json,text/plain,*/*",
          "User-Agent": "iamchart-cf-proxy/1.0",
        },
      });
    } catch (err) {
      return json({ error: "원격 API 호출에 실패했습니다: " + err.message }, 502);
    }

    const body = await upstream.arrayBuffer();
    const headers = corsHeaders();
    headers.set(
      "Content-Type",
      upstream.headers.get("Content-Type") || "application/json; charset=utf-8",
    );
    headers.set("Cache-Control", "no-store");

    return new Response(body, { status: upstream.status, headers });
  },
};

function corsHeaders() {
  const h = new Headers();
  h.set("Access-Control-Allow-Origin", "*");
  h.set("Access-Control-Allow-Methods", "GET, OPTIONS");
  h.set("Access-Control-Allow-Headers", "*");
  h.set("Access-Control-Max-Age", "86400");
  return h;
}

function json(obj, status) {
  const h = corsHeaders();
  h.set("Content-Type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(obj), { status, headers: h });
}

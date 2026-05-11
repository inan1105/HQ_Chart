import fs from "node:fs/promises";
import path from "node:path";

const outFile = path.join(process.cwd(), "public", "symbols.json");

const sources = {
  krx: "https://kind.krx.co.kr/corpgeneral/corpList.do?method=download&searchType=13",
  nasdaq: "https://www.nasdaqtrader.com/dynamic/SymDir/nasdaqlisted.txt",
  otherUs: "https://www.nasdaqtrader.com/dynamic/SymDir/otherlisted.txt",
  coingecko:
    "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=250&page=1&sparkline=false",
};

const headers = {
  "user-agent": "Mozilla/5.0 Stockr/0.3",
};

const all = [
  ...(await fetchKoreanSymbols()),
  ...(await fetchUsSymbols()),
  ...(await fetchCryptoSymbols()),
];

const seen = new Set();
const symbols = all
  .filter((item) => {
    const key = `${item.market}:${item.symbol}:${item.yahoo}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  })
  .sort((a, b) => a.market.localeCompare(b.market) || a.symbol.localeCompare(b.symbol));

await fs.writeFile(outFile, `${JSON.stringify(symbols, null, 2)}\n`, "utf8");

console.log(`Wrote ${symbols.length} symbols to ${outFile}`);

async function fetchKoreanSymbols() {
  const response = await fetch(sources.krx, { headers });
  if (!response.ok) {
    throw new Error(`KRX/KIND download failed: ${response.status}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const html = new TextDecoder("euc-kr").decode(buffer);
  const rows = parseHtmlTable(html);

  return rows
    .map((cells) => {
      const [name, rawMarket, rawCode] = cells;
      const code = String(rawCode || "").trim();
      const marketText = String(rawMarket || "").replace(/\s+/g, "");

      if (!/^\d{6}$/.test(code)) return null;
      if (!name) return null;

      if (marketText.includes("코스닥")) {
        return makeSymbol({
          name,
          symbol: code,
          yahoo: `${code}.KQ`,
          market: "KOSDAQ",
          country: "KR",
        });
      }

      if (marketText.includes("유가") || marketText.includes("코스피")) {
        return makeSymbol({
          name,
          symbol: code,
          yahoo: `${code}.KS`,
          market: "KOSPI",
          country: "KR",
        });
      }

      return null;
    })
    .filter(Boolean);
}

const CRYPTO_KOREAN_NAMES = {
  bitcoin: "비트코인",
  ethereum: "이더리움",
  ripple: "리플",
  solana: "솔라나",
  binancecoin: "바이낸스코인",
  dogecoin: "도지코인",
  cardano: "에이다",
  tron: "트론",
  chainlink: "체인링크",
  "avalanche-2": "아발란체",
  stellar: "스텔라루멘",
  sui: "수이",
  "hedera-hashgraph": "헤데라",
  "the-open-network": "톤코인",
  polkadot: "폴카닷",
  "shiba-inu": "시바이누",
  litecoin: "라이트코인",
  "bitcoin-cash": "비트코인캐시",
  uniswap: "유니스왑",
  arbitrum: "아비트럼",
  optimism: "옵티미즘",
  "near": "니어",
  aptos: "앱토스",
  "ethereum-classic": "이더리움클래식",
  filecoin: "파일코인",
  cosmos: "코스모스",
  "render-token": "렌더",
  "internet-computer": "인터넷컴퓨터",
  "matic-network": "폴리곤",
  "polygon-ecosystem-token": "폴리곤",
  monero: "모네로",
  algorand: "알고랜드",
  vechain: "비체인",
  tezos: "테조스",
  fantom: "팬텀",
  flow: "플로우",
  "the-sandbox": "샌드박스",
  decentraland: "디센트럴랜드",
  "axie-infinity": "엑시인피니티",
  immutable: "이뮤터블",
  "lido-dao": "리도다오",
  maker: "메이커",
  aave: "에이브",
  "curve-dao-token": "커브",
};

async function fetchCryptoSymbols() {
  const response = await fetch(sources.coingecko, { headers });
  if (!response.ok) {
    throw new Error(`CoinGecko download failed: ${response.status}`);
  }
  const data = await response.json();
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error("CoinGecko returned empty or invalid data");
  }

  const seenSymbols = new Set();
  return data
    .map((coin) => {
        const rawSymbol = String(coin?.symbol || "").toUpperCase().trim();
        const englishName = String(coin?.name || "").trim();
        const coinId = String(coin?.id || "").trim();
        if (!rawSymbol || !englishName) return null;
        if (rawSymbol.length > 10) return null;
        if (seenSymbols.has(rawSymbol)) return null;
        seenSymbols.add(rawSymbol);

        const yahoo = `${rawSymbol}-USD`;
        const korean = CRYPTO_KOREAN_NAMES[coinId] || "";
        const name = korean ? `${englishName} (${korean})` : englishName;
        const search = [
          rawSymbol,
          yahoo,
          englishName,
          korean,
          coinId,
          "CRYPTO",
          "crypto",
          "가상자산",
          "가상화폐",
          "암호화폐",
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

      return {
        name,
        symbol: yahoo,
        yahoo,
        market: "CRYPTO",
        country: "CRYPTO",
        search,
      };
    })
    .filter(Boolean);
}

async function fetchUsSymbols() {
  const [nasdaqText, otherText] = await Promise.all([
    fetchText(sources.nasdaq),
    fetchText(sources.otherUs),
  ]);

  return [
    ...parseNasdaqListed(nasdaqText),
    ...parseOtherListed(otherText),
  ];
}

async function fetchText(url) {
  const response = await fetch(url, { headers });
  if (!response.ok) throw new Error(`Download failed: ${url} ${response.status}`);
  return response.text();
}

function parseNasdaqListed(text) {
  const lines = text.split(/\r?\n/).slice(1);
  return lines
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("File Creation Time"))
    .map((line) => {
      const [
        symbol,
        name,
        marketCategory,
        testIssue,
        ,
        ,
        etf,
      ] = line.split("|");

      if (testIssue !== "N" || etf !== "N") return null;
      if (!isLikelyCommonStock(symbol, name)) return null;

      return makeSymbol({
        name: cleanUsName(name),
        symbol,
        yahoo: toYahooUsSymbol(symbol),
        market: mapNasdaqMarket(marketCategory),
        country: "US",
      });
    })
    .filter(Boolean);
}

function parseOtherListed(text) {
  const lines = text.split(/\r?\n/).slice(1);
  return lines
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("File Creation Time"))
    .map((line) => {
      const [
        symbol,
        name,
        exchange,
        ,
        etf,
        ,
        testIssue,
      ] = line.split("|");

      if (testIssue !== "N" || etf !== "N") return null;
      if (!isLikelyCommonStock(symbol, name)) return null;

      return makeSymbol({
        name: cleanUsName(name),
        symbol,
        yahoo: toYahooUsSymbol(symbol),
        market: mapUsExchange(exchange),
        country: "US",
      });
    })
    .filter(Boolean);
}

function parseHtmlTable(html) {
  const rows = [];
  const rowPattern = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch;

  while ((rowMatch = rowPattern.exec(html))) {
    const cells = [];
    const cellPattern = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
    let cellMatch;

    while ((cellMatch = cellPattern.exec(rowMatch[1]))) {
      cells.push(cleanHtml(cellMatch[1]));
    }

    if (cells.length) rows.push(cells);
  }

  return rows.slice(1);
}

function cleanHtml(value) {
  return String(value || "")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#40;/g, "(")
    .replace(/&#41;/g, ")")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanUsName(name) {
  return String(name || "")
    .replace(/\s*-\s*Common Stock$/i, "")
    .replace(/\s*Common Stock\s*$/i, "")
    .replace(/\s*Ordinary Shares\s*$/i, "")
    .replace(/\s*Class ([A-Z]) Ordinary Shares\s*$/i, " Class $1")
    .replace(/\s+/g, " ")
    .trim();
}

function isLikelyCommonStock(symbol, name) {
  if (!symbol || !name) return false;
  if (symbol.length > 8) return false;
  if (/[+\^=]/.test(symbol)) return false;

  const value = `${symbol} ${name}`.toLowerCase();
  return ![
    " warrant",
    " warrants",
    " right",
    " rights",
    " unit",
    " units",
    " preferred",
    " preference",
    " note",
    " notes",
    " bond",
    " debenture",
    " etn",
    " fund",
    " trust",
    " acquisition corp. - unit",
  ].some((keyword) => value.includes(keyword));
}

function makeSymbol({ name, symbol, yahoo, market, country }) {
  const search = `${symbol} ${yahoo} ${name} ${market}`.toLowerCase();
  return {
    name,
    symbol,
    yahoo,
    market,
    country,
    search,
  };
}

function toYahooUsSymbol(symbol) {
  return String(symbol || "").replace(/[/.]/g, "-");
}

function mapNasdaqMarket(value) {
  const map = {
    Q: "NASDAQ",
    G: "NASDAQ",
    S: "NASDAQ",
  };
  return map[value] || "NASDAQ";
}

function mapUsExchange(value) {
  const map = {
    A: "NYSE American",
    N: "NYSE",
    P: "NYSE Arca",
    Z: "BATS",
    V: "IEX",
  };
  return map[value] || "US";
}

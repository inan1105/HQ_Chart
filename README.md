# Stockr

Stockr는 종목명, 종목코드, 시장 질문을 입력하면 국내 종목은 IAMChart, 해외/가상자산은 Yahoo Finance 가격 데이터와 OpenAI API를 이용해 분석 답변과 다음 질문을 보여주는 웹앱입니다.

## 주요 기능

- 삼성전자, 현대차, 테슬라처럼 종목명으로 질문해도 인식합니다.
- 한국 종목 차트는 IAMChart API를 사용하며, `KOSPI`는 `kospi`, `KOSDAQ`은 `kosdaq`으로 자동 구분합니다.
- 해외 주식과 가상자산 차트는 Yahoo Finance 데이터를 사용합니다.
- 차트는 일봉, 주봉, 월봉으로 바꿔 볼 수 있습니다.
- 비트코인, 이더리움 등 주요 가상화폐는 자동완성으로 고를 수 있고, `ETH-USD` 같은 Yahoo Finance 티커를 직접 입력해도 조회합니다.
- 뉴스, 시장 테마, 업종 상위처럼 실시간성이 필요한 질문은 웹 검색과 참고 링크를 함께 사용합니다.
- 기본적 분석은 국내 6자리 종목코드일 때 FnGuide 기업 정보 링크를 함께 사용합니다.
- 답변은 짧은 단락으로 정리하고, 이어서 클릭 가능한 추천 질문 3개를 보여줍니다.

## 포함 데이터

`public/symbols.json`에는 자동완성용 종목 사전이 들어 있습니다.

포함 범위:

```text
KOSPI
KOSDAQ
NASDAQ
NYSE
NYSE American
CRYPTO (시가총액 상위 250개 가상자산)
```

종목 사전은 아래 명령으로 다시 만들 수 있습니다.

```bash
npm run build:symbols
```

## Vercel 환경 변수

Vercel 프로젝트의 `Settings` -> `Environment Variables`에 아래 값을 넣어주세요.

```text
OPENAI_API_KEY=본인의 OpenAI API 키
OPENAI_MODEL=gpt-5.1
```

API 키는 GitHub 파일에 넣지 말고 Vercel 환경 변수에만 넣는 것이 안전합니다.

## 로컬 실행

Node.js가 설치되어 있다면 아래 명령으로 확인할 수 있습니다.

```bash
npm run dev
```

그 다음 브라우저에서 `http://localhost:3000`을 엽니다.

## 이번 수정 사항

- 차트 기간 버튼은 `1개월 / 3개월 / 6개월 / 1년 / 3년`으로 유지했습니다.
- 차트 봉 선택은 상단의 `일봉` 버튼을 눌러 `일봉 / 주봉 / 월봉` 중 선택하도록 변경했습니다.
- 국내 종목은 IamChart API를 먼저 사용합니다.
- IamChart 연결이 실패하면 앱이 멈추지 않도록 Yahoo Finance 데이터로 자동 대체합니다.

## 자동 종목 사전 갱신

이 프로젝트에는 GitHub Actions 자동 갱신 워크플로가 포함되어 있습니다.

- 파일 위치: `.github/workflows/update-symbols.yml`
- 실행 시간: 매일 07:10 KST (GitHub Actions cron 기준 `10 22 * * *` UTC)
- 실행 내용: `npm run build:symbols`로 `public/symbols.json`을 새로 생성합니다.
- 자동으로 갱신되는 시장:
  - 국내주식: KOSPI, KOSDAQ (KRX KIND)
  - 해외주식: NASDAQ, NYSE, NYSE American (Nasdaq Trader Symbol Directory)
  - 가상자산: 시가총액 상위 250개 코인 (CoinGecko 공개 API)
- 변경 사항이 있으면 GitHub Actions가 `public/symbols.json`을 자동 커밋하고 푸시합니다.
- Vercel 프로젝트가 GitHub 저장소와 연결되어 있으면, 이 푸시를 기준으로 자동 재배포가 진행됩니다.

07:10 KST를 기본값으로 둔 이유는 미국 정규장이 끝난 뒤이고, 한국 정규장이 열리기 전이기 때문입니다. 미국 서머타임 여부와 관계없이 미국 장 마감 이후에 실행되도록 여유를 둔 시간입니다. 가상자산은 24시간 거래되어 시점 제약이 없으므로 같은 스케줄에 함께 갱신합니다.

`삼전`, `마소`, `비트코인`처럼 앱 내부에서 관리하는 한국어 별칭 목록은 `public/app.js`에 그대로 유지됩니다. 자동 갱신은 일반 종목 사전인 `public/symbols.json`만 새로 만들며, 자동 생성된 항목과 별칭은 앱 실행 시 자동으로 병합됩니다.

수동으로 바로 갱신하고 싶을 때는 GitHub Actions 화면에서 `Update Stockr symbols` 워크플로를 선택한 뒤 `Run workflow`를 누르면 됩니다.

Vercel 자동 배포를 쓰지 않는 경우에는 Vercel Deploy Hook URL을 GitHub Secrets의 `VERCEL_DEPLOY_HOOK_URL`에 넣고 워크플로에 호출 step을 추가하면 됩니다.

### 안전장치

`scripts/build-symbols.mjs`는 KRX, Nasdaq Trader, CoinGecko 중 어느 한 소스라도 응답에 실패하면 워크플로 전체가 실패하도록 되어 있습니다. 부분 데이터로 기존 `symbols.json`을 덮어쓰는 사고를 막기 위해서입니다. 그날은 기존 사전이 그대로 유지되고, 다음 날 다시 갱신을 시도합니다.


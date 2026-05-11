# IAMChart 기술지표 차트 앱

비개발자도 순서대로 따라 실행할 수 있도록 만든 로컬 웹앱입니다.

외부 접속용 배포는 [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)를 따라 진행합니다.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Finan1105%2FHQ_Chart&project-name=hq-chart&repository-name=HQ_Chart)

## 실행 순서

1. Node.js LTS를 설치합니다. 이미 설치되어 있으면 건너뜁니다.
   - 다운로드: https://nodejs.org
2. 이 폴더에서 `start-windows.bat` 파일을 더블클릭합니다.
3. 브라우저가 열리면 기본값 `kospi`, `일간`, `128820`, `200`으로 차트가 자동 생성됩니다.
4. 필요하면 시장, 주기, 종목코드, 데이터 수를 바꾸고 `차트 생성`을 누릅니다.

## 생성되는 차트

- 첫 번째 패널: 주가 캔들 차트, 이동평균선 5/20/60/100, 볼린저밴드 10/2
- 두 번째 패널: 동일 날짜 기준 거래량 막대 그래프
- 세 번째 패널: MACD 12/26/9, Signal, Histogram

## 입력값 규칙

- 시장: `kospi` 또는 `kosdaq`
- 주기: `d` 일간, `w` 주간, `m` 월간
- 종목코드: 6자리 영숫자
- 데이터 수: 1부터 1000 사이 숫자

## 참고

브라우저에서 원격 API를 직접 호출하면 CORS 정책 때문에 막힐 수 있습니다. 그래서 이 앱은 `server.js`가 로컬에서 API를 대신 호출하고, 화면은 `/api/history` 경로로 데이터를 받습니다.

# IAMChart 기술지표 차트 앱

비개발자도 순서대로 따라 실행할 수 있도록 만든 주식 기술지표 차트 앱입니다.

## 외부 접속

이미 Vercel 배포가 완료되어 있습니다.

- 외부 접속 주소: https://hq-chart.vercel.app
- GitHub 저장소: https://github.com/inan1105/HQ_Chart

새로 배포하거나 다른 Vercel 계정에 복제 배포할 때만 아래 버튼을 사용합니다.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Finan1105%2FHQ_Chart&project-name=hq-chart&repository-name=HQ_Chart)

자세한 배포 절차는 [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)를 확인합니다.

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

## 프록시 API (`/api/history`)

브라우저에서 원격 API를 직접 호출하면 CORS 정책 때문에 막힐 수 있습니다. 그래서 이 앱은 원격 API를 대신 호출해 주는 프록시를 제공합니다. 로컬 개발에서는 `server.js`가, 배포(Vercel) 환경에서는 `api/history.js`(서버리스 함수)가 같은 역할을 합니다.

웹앱에서는 아래 경로로 데이터를 받습니다.

```
/api/history?market=kospi&period=d&code=000660&limit=200
```

이 프록시는 내부적으로 다음 원격 URL을 호출합니다.

```
https://was002.iamchart.com/be.asp/ty.a/api/iamchart/SeriES/stock/history/v3?market=kospi&period=d&code=000660&limit=200
```

### 쿼리 파라미터

- `market`: `kospi` 또는 `kosdaq`
- `period`: `d` 일간, `w` 주간, `m` 월간
- `code`: 6자리 영숫자 종목코드
- `limit`: 1부터 1000 사이 숫자
- `version`: `v3`(기본값) 또는 `v2` — 원격 API 버전 선택

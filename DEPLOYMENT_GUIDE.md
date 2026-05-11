# HQ_Chart GitHub 및 Vercel 확인 가이드

이 문서는 비개발자가 GitHub 저장소와 Vercel 배포 상태를 확인하고, 필요할 때 다시 배포하는 순서입니다.

## 1. 현재 상태

저장소와 Vercel 배포는 이미 만들어져 있습니다.

- GitHub 저장소: https://github.com/inan1105/HQ_Chart
- 기본 브랜치: `main`
- 외부 접속 주소: https://hq-chart.vercel.app

## 2. 외부 접속 확인하기

1. https://hq-chart.vercel.app 로 이동합니다.
2. 기본값 `kospi`, `일간`, `128820`, `200`으로 차트가 표시되는지 확인합니다.
3. 필요하면 시장, 주기, 종목코드, 데이터 수를 바꾸고 `차트 생성`을 누릅니다.

확인할 항목:

- 첫 번째 패널에 주가, 이동평균선 5/20/60/100, 볼린저밴드 10/2가 표시됩니다.
- 두 번째 패널에 거래량 막대 그래프가 표시됩니다.
- 세 번째 패널에 MACD 12/26/9가 표시됩니다.

## 3. 다시 배포해야 할 때

이미 배포된 사이트를 확인하는 목적이라면 아래 버튼을 누를 필요가 없습니다. 다른 Vercel 계정에 새로 복제 배포하거나, 배포를 처음부터 다시 만들 때만 사용합니다.

1. README 안의 `Deploy with Vercel` 버튼을 누르거나 아래 버튼을 누릅니다.

   [![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Finan1105%2FHQ_Chart&project-name=hq-chart&repository-name=HQ_Chart)

2. Continue with GitHub를 선택합니다.
3. GitHub 로그인 또는 Vercel 권한 승인이 나오면 진행합니다.
4. Import Git Repository 목록에서 `HQ_Chart`를 찾습니다.
5. Import를 누릅니다.
6. Project Name은 기본값 `hq-chart`를 사용합니다.
7. Framework Preset은 Other 또는 자동 감지 상태로 둡니다.
8. Build Command, Output Directory는 비워 둡니다.
9. Deploy를 누릅니다.

## 4. 수정 후 다시 배포하기

GitHub의 `main` 브랜치에 새 파일이 올라가면 Vercel은 자동으로 다시 배포합니다.

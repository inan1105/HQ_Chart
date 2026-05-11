# HQ_Chart GitHub 및 Vercel 배포 가이드

이 문서는 비개발자가 GitHub 저장소를 만들고 Vercel에 연결해 외부 접속 주소를 만드는 순서입니다.

## 1. GitHub 저장소 만들기

1. 브라우저에서 https://github.com/new 로 이동합니다.
2. 로그인 계정이 `inan1105`인지 확인합니다.
3. Repository name에 `HQ_Chart`를 입력합니다.
4. Public을 선택합니다.
5. Add a README file은 체크하지 않습니다.
6. Create repository 버튼을 누릅니다.

## 2. 이 폴더의 파일을 GitHub에 올리기

저장소 생성 후에는 Codex가 파일 업로드를 이어서 진행할 수 있습니다. 저장소가 만들어졌다고 알려 주세요.

직접 올리고 싶다면 GitHub 저장소 화면에서 uploading an existing file을 눌러 이 폴더의 파일과 `api` 폴더를 모두 업로드하면 됩니다.

## 3. Vercel에서 GitHub 저장소 연결하기

1. https://vercel.com/new 로 이동합니다.
2. Continue with GitHub를 선택합니다.
3. Import Git Repository 목록에서 `HQ_Chart`를 찾습니다.
4. Import를 누릅니다.
5. Project Name은 기본값 `hq-chart`를 사용합니다.
6. Framework Preset은 Other 또는 자동 감지 상태로 둡니다.
7. Build Command, Output Directory는 비워 둡니다.
8. Deploy를 누릅니다.

## 4. 외부 접속 확인

배포가 끝나면 Vercel이 `https://...vercel.app` 주소를 보여줍니다.

그 주소를 열고 기본값 `kospi`, `일간`, `128820`, `200`으로 차트가 표시되는지 확인합니다.

확인할 항목:

- 첫 번째 패널에 주가, 이동평균선 5/20/60/100, 볼린저밴드 10/2가 표시됩니다.
- 두 번째 패널에 거래량 막대 그래프가 표시됩니다.
- 세 번째 패널에 MACD 12/26/9가 표시됩니다.

## 5. 수정 후 다시 배포하기

GitHub의 `main` 브랜치에 새 파일이 올라가면 Vercel은 자동으로 다시 배포합니다.

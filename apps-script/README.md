# PAN-TIS — Google Apps Script 웹앱

종목코드를 입력하면 프록시(Cloudflare Worker)를 통해 iamChart 일간 데이터를
조회하고, 시장상태 토큰화/예측/매매판정(One Screen)을 HTML 로 보여주는 GAS 웹앱.

## 파일

| 파일 | 역할 |
|------|------|
| `Core.gs` | 순수 분석 로직(검증·패턴·예측·판정). 외부 의존성 없음. |
| `WebApp.gs` | 웹앱 진입점(`doGet`) + 프록시 조회 + HTML 렌더링. |

## 데이터 경로

```
GAS 웹앱  →  https://iamchart-proxy.inan1105.workers.dev/?market=&period=&code=&limit=
            (Worker 가 내부에서 was002.iamchart.com 의 history/v3 로 전달)
```

`fetchProxyCandles()` 가 만드는 URL 예시:

```
https://iamchart-proxy.inan1105.workers.dev/?market=kospi&period=d&code=000660&limit=120
```

## 적용한 수정 — "종목코드 입력 후 먹통"

원인은 데이터가 아니라 **입력 폼의 제출 대상**이었다.

GAS 웹앱은 `doGet` 출력을 `googleusercontent.com` 의 **샌드박스 iframe** 안에서
렌더링한다. 입력 폼에 `target="_top"` 과 `action`(배포 `/exec` URL)이 없으면
폼 제출이 그 죽은 iframe 내부로 들어가 `doGet` 이 다시 호출되지 않는다 →
화면이 그대로 멈춘다(=먹통).

`renderForm()` 에 `target="_top"` 과 배포 URL `action` 을 복원하여 해결했다.
부수적으로 `fetchProxyCandles()` 의 오류 메시지를 더 구체적으로 보강했다.

## 배포(비개발자용)

1. <https://script.google.com> 에서 새 프로젝트 생성.
2. `Core.gs`, `WebApp.gs` 두 파일 내용을 각각 붙여넣기(파일명 동일 권장).
3. **배포 → 새 배포 → 유형: 웹 앱** 선택.
   - 실행 사용자: 나
   - 액세스 권한: 모든 사용자(또는 필요 범위)
4. 생성된 **웹 앱 URL(/exec)** 로 접속 → 종목코드 입력 → **예측하기**.
5. 네트워크 없이 점검하려면 URL 뒤에 `?code=000660&source=demo` 를 붙인다.

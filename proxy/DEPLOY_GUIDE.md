# Cloudflare Worker 배포 가이드

## 문제 원인

IamChart API 서버(`was002.iamchart.com`)는 브라우저 외의 요청(GPT Actions, curl 등)을
차단합니다. Custom GPT에서 직접 호출하면 403 Forbidden이 반환됩니다.

## 해결 방법

Cloudflare Worker를 프록시로 사용하여 브라우저와 동일한 헤더로 요청을 전달합니다.

```
[Custom GPT] → [Cloudflare Worker 프록시] → [IamChart API]
                (브라우저 헤더 추가)
```

## 배포 절차

### 1. Cloudflare 계정 생성 (무료)

https://dash.cloudflare.com/sign-up 에서 가입합니다.

### 2. Worker 생성

1. Cloudflare 대시보드 → **Workers & Pages** → **Create**
2. **Create Worker** 클릭
3. Worker 이름 입력 (예: `iamchart-proxy`)
4. **Deploy** 클릭

### 3. 코드 붙여넣기

1. 생성된 Worker의 **Quick edit** 클릭
2. 기본 코드를 모두 삭제
3. `cloudflare-worker.js` 파일의 내용을 전체 붙여넣기
4. **Save and deploy** 클릭

### 4. Worker URL 확인

배포 후 URL이 표시됩니다:
```
https://iamchart-proxy.<your-subdomain>.workers.dev
```

### 5. 테스트

브라우저에서 아래 URL을 열어 JSON 응답이 오는지 확인합니다:
```
https://iamchart-proxy.<your-subdomain>.workers.dev?market=kospi&period=d&code=005930&limit=5
```

### 6. Custom GPT 설정

1. GPT 편집 → **Configure** 탭
2. **Instructions**에 `gpt-instructions.md`의 내용을 붙여넣기
   - `<YOUR_WORKER_NAME>.workers.dev` 부분을 실제 Worker URL로 교체
3. **Actions** → **Create new action**
4. **Schema**에 `openapi-schema.json`의 내용을 붙여넣기
   - `servers[0].url`의 `<YOUR_WORKER_NAME>.workers.dev`를 실제 Worker URL로 교체
5. **Authentication**: None
6. **Privacy policy**: 해당 없음 (개인용)

## 무료 제한

Cloudflare Workers 무료 플랜:
- **일 100,000 요청** (충분)
- **요청당 10ms CPU 시간** (충분)
- 커스텀 도메인 연결 가능

## 대안: Vercel Serverless Function

Cloudflare 대신 Vercel을 사용할 수도 있습니다.
`vercel-alternative/` 디렉토리의 코드를 참고하세요.

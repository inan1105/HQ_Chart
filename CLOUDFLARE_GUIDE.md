# Cloudflare 프록시 서버 만들기 (비개발자용 따라하기)

이 문서는 **개발 경험이 없어도** Cloudflare Worker 로 프록시 서버를 만들고,
그 주소를 웹앱·커스텀GPT 에 연결하는 전체 과정을 그대로 따라 할 수 있게 정리한 안내서입니다.

> **왜 필요한가요?**
> 브라우저에서 IAMChart 원격 API 를 직접 부르면 보안 정책(CORS) 때문에 막힙니다.
> 그래서 "중간에서 대신 호출해 주는 서버(프록시)"가 필요합니다.
> Cloudflare Worker 는 **무료**이고, 신용카드 없이, 5분이면 만들 수 있습니다.

완성되면 아래와 같은 **나만의 주소**가 생깁니다.

```
https://iamchart-proxy.<내계정>.workers.dev/
```

---

## 1단계 · Cloudflare 무료 가입

1. 웹브라우저에서 <https://dash.cloudflare.com/sign-up> 로 이동합니다.
2. 이메일과 비밀번호를 입력하고 **Sign Up(가입)** 을 누릅니다.
3. 받은 이메일에서 인증 링크를 눌러 계정을 활성화합니다.
4. 다시 로그인하면 Cloudflare 대시보드가 보입니다. (카드 등록 불필요)

---

## 2단계 · Worker(프록시 서버) 새로 만들기

1. 왼쪽 메뉴에서 **Compute(Workers)** 또는 **Workers & Pages** 를 클릭합니다.
2. **Create application(애플리케이션 만들기)** → **Create Worker(워커 만들기)** 를 누릅니다.
3. 이름(Name)을 정합니다. 예: `iamchart-proxy`
   - 이 이름이 주소가 됩니다 → `https://iamchart-proxy.<내계정>.workers.dev`
4. **Deploy(배포)** 를 눌러 일단 기본 워커를 만듭니다. (코드는 다음 단계에서 교체)

---

## 3단계 · 프록시 코드 붙여넣기

1. 방금 만든 Worker 화면에서 **Edit code(코드 편집)** 버튼을 누릅니다.
2. 편집기에 보이는 **기존 코드를 전부 지웁니다.**
3. 이 저장소의 [`cloudflare-worker.js`](./cloudflare-worker.js) 파일 내용을
   **전체 복사**해서 편집기에 **붙여넣습니다.**
   - (아래 "부록 A" 에도 같은 코드가 있습니다. 복사해서 쓰세요.)
4. 오른쪽 위 **Deploy(배포)** 를 누릅니다.
5. "Success / 배포됨" 메시지가 뜨면 완료입니다.

---

## 4단계 · 잘 작동하는지 확인

브라우저 주소창에 아래 주소를 붙여넣고 엔터를 누릅니다.
(`<내계정>` 부분은 본인 주소로 바꾸세요)

```
https://iamchart-proxy.<내계정>.workers.dev/be.asp/ty.a/api/iamchart/SeriES/stock/history/v3?market=kospi&period=d&code=000660&limit=200
```

- 숫자와 날짜가 가득한 **JSON 데이터**가 보이면 **성공** 입니다. 🎉
- 그냥 주소 끝까지만(`.../workers.dev/`) 입력하면 사용법 안내 메시지가 나옵니다.

> 본인 Worker 주소는 Cloudflare 대시보드의 Worker 화면 위쪽에 표시됩니다.
> 그 주소를 복사해 두세요. 다음 단계에서 씁니다.

---

## 5단계 · 웹앱을 내 Cloudflare 주소에 연결

이 저장소의 웹앱(차트 화면)이 Vercel 대신 **내 Cloudflare 프록시**를 쓰도록 바꿉니다.
**파일 한 곳, 한 줄만** 고치면 됩니다.

1. 저장소의 [`config.js`](./config.js) 파일을 엽니다.
2. `base: ""` 부분을 내 Worker 주소로 바꿉니다. **끝에 `/` 를 꼭 붙입니다.**

   ```js
   window.IAMCHART_PROXY = {
     base: "https://iamchart-proxy.inan1105.workers.dev/",
   };
   ```

3. 저장하고 GitHub `main` 브랜치에 올리면 Vercel 이 자동 재배포합니다.
   - GitHub 웹에서 `config.js` 를 열고 연필(✏️) 아이콘으로 직접 수정 → **Commit** 해도 됩니다.
4. 끝입니다. 이제 차트 화면은 내 Cloudflare 프록시를 통해 데이터를 가져옵니다.

> 다시 Vercel 프록시로 되돌리려면 `base: ""` 로 비워 두기만 하면 됩니다.

---

## 6단계(선택) · 커스텀GPT 에 연결

커스텀GPT 의 **Actions → Schema** 에서 서버 주소만 내 Worker 주소로 바꾸면 됩니다.

```yaml
servers:
  - url: https://iamchart-proxy.inan1105.workers.dev
paths:
  /be.asp/ty.a/api/iamchart/SeriES/stock/history/v3:
    get:
      operationId: getStockHistory
      summary: 종목 시세 history 조회
      parameters:
        - { name: market, in: query, required: true,  schema: { type: string, enum: [kospi, kosdaq] } }
        - { name: period, in: query, required: true,  schema: { type: string, enum: [d, w, m] } }
        - { name: code,   in: query, required: true,  schema: { type: string, pattern: "^[A-Za-z0-9]{6}$" } }
        - { name: limit,  in: query, required: true,  schema: { type: integer, minimum: 1, maximum: 1000 } }
      responses:
        "200": { description: 시세 JSON, content: { application/json: { schema: { type: object } } } }
```

- **operationId**: `getStockHistory`
- **Server(Base URL)**: `https://iamchart-proxy.inan1105.workers.dev`
- **Path**: `/be.asp/ty.a/api/iamchart/SeriES/stock/history/v3`
- 인증(Authentication)은 **None** 으로 둡니다.

---

## 자주 묻는 질문

**Q. 돈이 드나요?**
A. Cloudflare Worker 무료 플랜은 하루 10만 요청까지 무료입니다. 개인 사용은 충분합니다.

**Q. 주소를 까먹었어요.**
A. Cloudflare 대시보드 → Workers & Pages → 내 Worker 클릭 → 위쪽에 주소가 있습니다.

**Q. JSON 대신 빈 화면/에러가 나와요.**
A. ① 코드를 다시 붙여넣고 Deploy 했는지, ② 주소 뒤 경로(`be.asp/...`)를 정확히 입력했는지 확인하세요.

**Q. 종목코드는 어디서 보나요?**
A. 6자리 숫자입니다. 예: SK하이닉스 `000660`, 삼성전자 `005930`.

---

## 부록 A · Worker 전체 코드

> 아래 코드는 [`cloudflare-worker.js`](./cloudflare-worker.js) 와 동일합니다.
> 이 저장소 파일을 복사해서 쓰는 것을 권장합니다(항상 최신).

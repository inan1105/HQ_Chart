# KOStockCrewAI 📊

한국 주식 종목코드(또는 종목명)를 입력하면
**DART 재무 · ECOS 거시 · 코스콤 시세/수급 · 기술적/기본적/수급/거시 분석 · 리스크 스코어링 · GPT 투자 브리프 · PDF 리포트 · Streamlit 화면 · Telegram 봇**까지
한 번에 처리하는 MVP 프로젝트입니다.

> ⚠️ **투자자문 고지문**
> 본 자료는 정보 제공 목적의 자동 생성 리포트이며, 특정 종목의 매수·매도 권유가 아닙니다. 투자 판단과 책임은 투자자 본인에게 있습니다.

---

## 🎓 바이브코딩 교육생이라면 여기부터

- 📘 **실습 매뉴얼(따라하기)**: [`docs/바이브코딩_실습_매뉴얼.md`](docs/바이브코딩_실습_매뉴얼.md)
  - 바이브코딩 원리, **프롬프트 필요충분조건 12개**, 최초 프롬프트부터 배포까지 8단계 재현
- 🌐 **원클릭 공개 배포(Render)**: 아래 버튼 한 번으로 **API + UI + DB**를 한꺼번에 배포하고 공개 도메인을 발급받으세요.

  [![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/inan1105/HQ_Chart)

  - 버튼이 안 보이면 이 주소로 접속: `https://render.com/deploy?repo=https://github.com/inan1105/HQ_Chart`
  - 배포 후 화면 URL(`https://kostock-ui-XXXX.onrender.com`)을 교육생에게 공유하면 모두 체험 가능
  - 📗 **상세 절차/접속/문제해결**: [`배포_및_접속_가이드.md`](배포_및_접속_가이드.md)

---

## 🧰 이 프로젝트로 할 수 있는 것
- API Key 없이도 **샘플 데이터**로 전체 화면/리포트 흐름을 체험
- 실제 API Key 입력 시 DART/ECOS/코스콤으로 **실데이터 확장**
- FastAPI `/docs` 에서 클릭만으로 테스트
- Streamlit 웹 화면, Telegram 봇, PDF 리포트 제공

---

## 🪟 Windows 기준 실행 순서 (비개발자용 상세 가이드)

### 1. Python 3.11 설치
- https://www.python.org/downloads/ 접속 → **Python 3.11.x** 다운로드
- 설치 시 **"Add Python to PATH"** 체크박스를 꼭 켜세요.
- 설치 후 명령 프롬프트(cmd)에서 확인:
  ```
  python --version
  ```

### 2. VS Code 설치
- https://code.visualstudio.com/ 에서 다운로드 후 설치
- 확장(Extensions)에서 "Python" 확장을 설치하면 편합니다.

### 3. Docker Desktop 설치
- https://www.docker.com/products/docker-desktop/ 에서 다운로드 후 설치
- 설치 후 Docker Desktop 을 실행해 둡니다(PostgreSQL 을 쉽게 띄우기 위함).

### 4. 프로젝트 열기
- VS Code 실행 → `File > Open Folder` → `KOStockCrewAI` 폴더 선택
- VS Code 상단 메뉴 `Terminal > New Terminal` 로 터미널을 엽니다.

### 5. 가상환경 생성 및 활성화
```bat
python -m venv venv
venv\Scripts\activate
```
> 활성화되면 프롬프트 앞에 `(venv)` 가 표시됩니다.

### 6. 패키지 설치
```bat
pip install -r requirements.txt
```
> 처음에는 시간이 다소 걸릴 수 있습니다.

### 7. .env 파일 만들기
```bat
copy .env.example .env
```

### 8. API Key 입력
- VS Code 에서 `.env` 파일을 열고, 각 값에 본인의 실제 키를 입력합니다.
- **키가 없어도 앱은 실행됩니다.** 샘플 데이터로 먼저 체험할 수 있습니다.
- 키를 모르면 일단 그대로 두고 다음 단계로 진행하세요.

### 9. PostgreSQL 실행 (Docker)
```bat
docker compose up -d postgres
```
> Docker Desktop 이 켜져 있어야 합니다.

### 10. DB 테이블 생성
```bat
docker exec -i kostockcrewai_postgres psql -U postgres -d kostockcrewai < app/db/schema.sql
```
> 위 명령이 안 되면(파이프 `<` 문제) 아래 대안을 쓰세요:
> ```bat
> type app\db\schema.sql | docker exec -i kostockcrewai_postgres psql -U postgres -d kostockcrewai
> ```

### 11. FastAPI 실행
```bat
uvicorn main:app --reload
```

### 12. 브라우저 접속
- http://127.0.0.1:8000/docs 로 접속하면 모든 API 를 화면에서 테스트할 수 있습니다.

### 13. 샘플 데이터 로드
- `/docs` 에서 **GET `/sample/load/005930`** 실행 (또는 브라우저에서 http://127.0.0.1:8000/sample/load/005930 )
- > 📌 **샘플 데이터는 실데이터가 아니며 UI와 파이프라인 검증용입니다.**

### 14. 리포트 테스트
- **GET `/report/005930`** → 분석 결과(JSON) 확인
- **GET `/report/005930/pdf`** → PDF 리포트 다운로드

### 15. Streamlit 실행 (웹 화면)
> FastAPI 를 켠 채로, **새 터미널**을 하나 더 열고 가상환경을 활성화한 뒤:
```bat
venv\Scripts\activate
streamlit run streamlit_app.py
```
- 브라우저가 자동으로 열립니다. 종목코드 입력 후 "분석 리포트 생성"을 누르세요.

### 16. Telegram 봇 실행 (선택)
```bat
python -m app.bots.telegram_bot
```
- `.env` 의 `TELEGRAM_BOT_TOKEN` 이 필요합니다(@BotFather 에서 발급).
- 봇에게 `005930` 같은 종목코드를 보내면 요약과 PDF 를 받습니다.

### (선택) 스케줄러 실행
```bat
python -m app.scheduler.main_scheduler
```
- 매일 06:00~07:00 데이터 수집/브리핑을 자동 실행합니다(수집 로직은 MVP placeholder).

---

## 🐳 Docker 로 한 번에 실행하기 (대안)
```bat
docker compose up -d
```
- `postgres` 와 `api` 컨테이너가 함께 뜹니다.
- 컨테이너 내부에서는 DB 주소가 `localhost` 가 아니라 `postgres` 입니다.
  그래서 `docker-compose.yml` 에서 다음과 같이 설정되어 있습니다:
  ```
  DATABASE_URL=postgresql+psycopg2://postgres:postgres@postgres:5432/kostockcrewai
  ```
- API 접속: http://127.0.0.1:8000/docs

---

## 🖥️ 사용자 웹 화면 구성 (Streamlit)

Streamlit 화면은 왼쪽 사이드바에서 이동하는 3개 메뉴로 구성됩니다.

1. **🏠 홈(초화면)** — 서버/DB/각 API 키의 운용 상태를 한눈에 표시합니다.
   키가 없어도 샘플 모드로 동작함을 안내합니다.
2. **🔑 API 키 설정** — 개별 API 키를 등록/수정합니다.
   - 입력은 가려지며(●●●), 저장된 키 '값'은 화면에 다시 표시되지 않습니다(설정됨/미설정만 표시).
   - 저장 시 즉시 적용되고 `.env` 에 보관됩니다(재시작 불필요).
   - **연동 점검** 버튼으로 실제 연결 여부를 확인합니다.
3. **📈 리포트 조회** — **종목명 또는 종목코드**를 입력해 1페이지 리포트를 조회합니다.
   - 예: `삼성전자` 또는 `005930` (종목명은 자동으로 코드로 변환)
   - 점수·AI 브리프·세부 관점·리스크·대응전략을 화면에서 확인
   - **📄 PDF 리포트 다운로드** 버튼으로 저장

> API 키는 화면에 표시되지 않으며, 서버 측에만 저장됩니다(보안 원칙).

---

## 17. 자주 나는 오류와 해결법

| 증상 | 원인 | 해결 |
|------|------|------|
| `ModuleNotFoundError` | 가상환경 미활성화 / 패키지 미설치 | `venv\Scripts\activate` 후 `pip install -r requirements.txt` |
| `database connection failed` | PostgreSQL 미실행 / DATABASE_URL 오류 | `docker compose up -d postgres`, `.env` 의 `DATABASE_URL` 확인 |
| `OpenAI key missing` | OPENAI_API_KEY 미설정 | 없어도 mock 브리프로 동작. 실제 GPT 사용 시 `.env` 에 키 입력 |
| `Koscom 401` | 코스콤 인증 실패 | `KOSCOM_API_KEY`, `KOSCOM_AUTH_TYPE`(bearer/x-api-key) 확인 |
| `Telegram chat_id error` | chat_id 오류 | `.env` 의 `TELEGRAM_CHAT_ID` 확인(본인 채팅 ID) |
| PDF 한글 깨짐 | 한글 폰트 없음 | 나눔고딕 설치 또는 `app/static/fonts/NanumGothic.ttf` 추가 |

> 명령을 실행했는데 `psql` 파이프(`<`)가 동작하지 않으면 10번의 대안 명령을 사용하세요.

---

## 18. 보안 주의사항
- **`.env` 파일을 GitHub 등에 절대 올리지 마세요.** (`.gitignore` 에 이미 포함)
- API Key 가 보이는 화면을 **캡처/공유하지 마세요.**
- API Key 를 **프론트엔드(브라우저)에 노출하지 마세요.** (이 프로젝트는 서버에서만 키 사용)

## 19. 데이터 라이선스 주의사항
- **DART / ECOS / 코스콤**의 이용약관과 데이터 이용 범위를 반드시 확인하세요.
- 특히 **코스콤 데이터는 계약 범위 밖 재배포가 제한**될 수 있습니다.
- 호출 빈도 제한(rate limit)을 준수하세요.

## 20. 투자자문 고지문
> 본 자료는 정보 제공 목적의 자동 생성 리포트이며, 특정 종목의 매수·매도 권유가 아닙니다.
> 투자 판단과 책임은 투자자 본인에게 있습니다.

---

## 🌐 공개 인터넷 배포 (Render — 무료)

KOStockCrewAI 는 FastAPI + Streamlit + PostgreSQL 스택이라 Vercel(정적/서버리스)에는 맞지 않습니다.
대신 **Render** 로 한 번에 공개 배포할 수 있도록 저장소 **루트에 `render.yaml`** 블루프린트가 준비되어 있습니다.
(저장소 루트의 기존 JS 앱/Vercel 배포는 전혀 영향받지 않습니다.)

`render.yaml` 이 생성하는 것:
1. **PostgreSQL** 데이터베이스 (관리형, free)
2. **kostock-api** — FastAPI 서버 → 공개 https 도메인 (`/docs` 에서 테스트)
3. **kostock-ui** — Streamlit 화면 → 공개 https 도메인

### 배포 순서
1. https://render.com 가입 후 GitHub 계정 연결
2. 대시보드 → **New +** → **Blueprint** 선택
3. 이 저장소(`inan1105/HQ_Chart`)와 배포할 **브랜치**를 선택
   - Render 가 루트의 `render.yaml` 을 자동으로 읽어 3개 리소스를 만듭니다.
4. **Apply** 클릭 → 빌드가 시작되고, 잠시 후 두 개의 공개 URL 이 발급됩니다:
   - API: `https://kostock-api-xxxx.onrender.com/docs`
   - UI : `https://kostock-ui-xxxx.onrender.com`
5. **API Key 입력**: Render 대시보드 → `kostock-api` 서비스 → **Environment** 에서
   `OPENAI_API_KEY`, `DART_API_KEY`, `ECOS_API_KEY`, `KOSCOM_API_KEY`, `KOSCOM_BASE_URL` 값을 입력
   - 키는 코드/저장소에 절대 올리지 않고 **대시보드에서만** 설정합니다.
   - 키가 없어도 `/sample/load/005930` → `/report/005930` 샘플 흐름은 동작합니다.

### 동작 원리(자동화)
- 앱 시작 시 `schema.sql` 을 자동 실행해 **테이블을 스스로 생성**합니다(별도 마이그레이션 불필요).
- Render 가 주는 `DATABASE_URL`(`postgresql://...`)을 코드가 `postgresql+psycopg2://...` 로 자동 정규화합니다.
- UI 서비스의 `API_BASE` 는 API 서비스 주소로 자동 연결됩니다.

> ⚠️ **무료 플랜 주의**: Render free 서비스는 일정 시간 미사용 시 잠자기(cold start)에 들어가
> 첫 접속이 느릴 수 있습니다. 또한 데이터 라이선스(특히 코스콤 재배포 제한)를 반드시 준수하세요.

---

## 🌐 다른 호스트로 배포하기 (Railway / Fly.io)

Render 외에 Railway, Fly.io 설정도 준비되어 있습니다. 셋 다 같은 Dockerfile 을 사용합니다.

### Railway (`railway.json`)
1. https://railway.app 가입 → **New Project** → 이 저장소 연결
2. 서비스 **Settings → Root Directory** 를 `KOStockCrewAI` 로 지정
3. **New → Database → PostgreSQL** 추가
4. 서비스 **Variables** 에 `DATABASE_URL=${{Postgres.DATABASE_URL}}` 연결,
   그리고 `OPENAI_API_KEY` 등 실제 키 입력
5. 배포되면 **Settings → Networking → Generate Domain** 으로 공개 URL 발급

### Fly.io (`fly.toml`)
`KOStockCrewAI` 폴더 안에서 실행합니다:
```bash
fly auth login
fly launch --no-deploy          # fly.toml 재사용(앱 이름/리전 확인)
fly postgres create             # 관리형 Postgres 생성
fly postgres attach <DB앱이름>   # DATABASE_URL 시크릿 자동 설정
fly secrets set OPENAI_API_KEY=... DART_API_KEY=... ECOS_API_KEY=... \
                KOSCOM_API_KEY=... KOSCOM_BASE_URL=...
fly deploy
```
배포 후 `https://<앱이름>.fly.dev/docs` 로 접속합니다.

> 세 호스트 모두 API Key 는 **대시보드/시크릿**으로만 입력하고 저장소에는 올리지 않습니다.

---

## 🔎 연동 점검 (실제 API Key 확인)

실제 키를 넣은 뒤 연결이 잘 되는지 확인하는 도구가 있습니다. **키 값 자체는 노출하지 않고** 설정·연결 여부만 알려줍니다.

- 브라우저/`/docs`: **GET `/diagnostics`** (빠른 확인, 외부 호출 없음)
- 실제 연결까지 확인: **GET `/diagnostics?live=true`**
- 터미널:
  ```bash
  python -m app.core.diagnostics
  ```
  예시 출력:
  ```
  ✅ openai    | OpenAI 연결 정상.
  ⚠️  dart      | 응답이 비어 있음 — 키/권한 확인 필요.
  ⛔ koscom    | 키 또는 BASE_URL 미설정 — 시세/수급 수집 불가.
  ✅ database  | DB 연결 정상.
  ```
  (✅ 정상 / ⚠️ 설정됐으나 연결 실패 / ⛔ 미설정)

---

## 🧪 테스트 실행
```bat
pytest -q
```
- 외부 API 호출이 없는 단위 테스트만 포함되어 있습니다(health, scoring).

## 📁 폴더 구조
```
KOStockCrewAI/
├ app/
│  ├ api/routes.py            FastAPI 엔드포인트
│  ├ core/                    설정(config)·로깅(logging)
│  ├ db/                      DB 연결·스키마·저장/조회
│  ├ collectors/             DART·ECOS·코스콤 수집기
│  ├ analysis/               기술/기본/수급/거시/스코어링
│  ├ agents/                 핵심 파이프라인·GPT 브리프·CrewAI
│  ├ reports/pdf_report.py   PDF 생성
│  ├ rag/news_rag.py         뉴스 RAG(ChromaDB)
│  ├ bots/telegram_bot.py    텔레그램 봇
│  └ scheduler/              데일리 브리핑·스케줄러
├ main.py                    FastAPI 앱
├ streamlit_app.py           웹 화면
├ requirements.txt
├ .env.example
├ Dockerfile / docker-compose.yml
└ README.md
```

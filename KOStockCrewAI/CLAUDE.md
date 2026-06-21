# CLAUDE.md — KOStockCrewAI

> 이 파일은 향후 Claude Code(또는 다른 AI) 세션이 이 프로젝트를 빠르게 이해하고
> **지속적으로 바이브코딩**을 이어가도록 돕는 프로젝트 메모리입니다.

## 프로젝트 개요
한국 주식 종목코드/종목명을 입력하면 데이터 수집 → 분석 → 스코어링 →
GPT 투자 브리프 → PDF 리포트 → 화면/봇 제공까지 수행하는 MVP.
**API Key 가 없어도 샘플 데이터로 전체 흐름이 동작**합니다.

## 기술 스택
- 백엔드: FastAPI (`main.py`, `app/api/routes.py`)
- 화면: Streamlit (`streamlit_app.py`) — 사이드바 3메뉴(홈/API키설정/리포트조회)
- DB: PostgreSQL + SQLAlchemy (`app/db/`)
- 분석: pandas/numpy (`app/analysis/`)
- 리포트: ReportLab PDF (`app/reports/pdf_report.py`)
- 선택: CrewAI, ChromaDB(RAG), Telegram, APScheduler(모두 지연 로딩/선택)

## 디렉토리 지도
```
app/
  api/routes.py        엔드포인트(/health /diagnostics /settings /resolve /report /sample ...)
  core/                config(설정·키관리), logging, diagnostics, ticker_map(종목명↔코드)
  db/                  database(engine·init_db), schema.sql, repositories
  collectors/          dart / ecos / koscom(Adapter 구조)
  analysis/            technical / fundamental / flow / macro / scoring
  agents/              investment_agent(핵심 파이프라인) / gpt_brief_agent / crew
  reports/pdf_report.py
  rag/ bots/ scheduler/
main.py                FastAPI 앱(시작 시 init_db 로 테이블 자동 생성)
streamlit_app.py       사용자 화면
docs/바이브코딩_실습_매뉴얼.md   교육 매뉴얼
```

## 실행 방법
```bash
uvicorn main:app --reload          # API → http://127.0.0.1:8000/docs
streamlit run streamlit_app.py     # 화면 → http://127.0.0.1:8501
pytest -q                          # 테스트(외부 호출 없음, DB 불필요)
python -m app.core.diagnostics     # API 키 연동 점검(CLI)
```
DB 는 `docker compose up -d postgres` 또는 호스트 관리형 Postgres. 앱이 `init_db()` 로
`schema.sql` 을 자동 적용하므로 별도 마이그레이션 불필요.

## ⚠️ 반드시 지킬 규칙 (변경 시 유지)
1. **API Key 는 `.env`/환경변수에서만** 읽는다. 코드/저장소/화면에 키 값 노출 금지.
   - `/settings` 응답과 Streamlit 화면은 '설정됨/미설정'만 표시(값 비노출).
2. **키가 없어도 죽지 않는다** — 친절한 메시지 + 샘플/mock fallback 유지.
3. **투자자문 고지문**을 브리프/PDF/화면에 항상 포함(매수·매도 권유 아님).
4. 외부 API(코스콤 등) 응답 필드가 다르면 **Adapter mapping** 만 수정한다.
5. 테스트는 **외부 호출 없이** 동작해야 한다(샘플/합성 데이터 사용).
6. 되돌리기 어려운 작업(머지·삭제·외부 전송)은 **사람 승인** 후 진행.

## 테스트/품질
- `tests/` : scoring, koscom normalize, analysis, db_url, diagnostics, health (총 27개).
- 새 기능 추가 시 대응 단위 테스트를 함께 추가한다.

## 배포
- Render(`render.yaml`, API+UI+DB), Railway(`railway.json`), Fly.io(`fly.toml`).
- 클라우드 `DATABASE_URL`(postgresql://)은 코드가 `+psycopg2` 로 자동 정규화.

## 다음에 해볼 만한 것 (백로그)
- 종목 검색 자동완성, 가격 차트 이미지 PDF 포함, 다종목 비교 화면, 영어 토글,
  `on_event`→`lifespan` 현대화, 실데이터 수집(스케줄러) 연동 테스트.

## 세션 시작 훅
`.claude/hooks/session-start.sh` 가 세션 시작 시 Python 의존성을 설치합니다(동기 실행).
독립 저장소 루트/모노레포 하위 모두 지원합니다.

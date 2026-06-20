"""
main.py
-------
FastAPI 애플리케이션의 시작점(entry point)입니다.

실행:
  uvicorn main:app --reload

브라우저에서 http://127.0.0.1:8000/docs 로 접속하면
모든 API 를 화면에서 직접 테스트할 수 있습니다.
"""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router
from app.core.logging import logger

# FastAPI 앱 생성
app = FastAPI(
    title="KOStockCrewAI",
    description="한국 주식 분석 MVP — DART/ECOS/코스콤 데이터 기반 투자 브리프 자동 생성",
    version="1.0.0",
)

# CORS 설정: Streamlit 등 다른 출처에서의 호출을 허용합니다.
# (MVP 라 모든 출처 허용. 운영에서는 허용 도메인을 좁히세요.)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 라우터 등록
app.include_router(router)


@app.get("/")
def root():
    """루트 주소: 간단한 사용법을 안내합니다."""
    return {
        "service": "KOStockCrewAI",
        "message": "한국 주식 분석 MVP 에 오신 것을 환영합니다.",
        "how_to_use": {
            "1_문서": "GET /docs  (브라우저에서 모든 API 테스트 가능)",
            "2_샘플적재": "GET /sample/load/005930  (Key 없이 더미 데이터 적재)",
            "3_리포트": "GET /report/005930  (분석 결과 JSON)",
            "4_PDF": "GET /report/005930/pdf  (PDF 다운로드)",
            "5_연동점검": "GET /diagnostics?live=true  (API Key 연결 상태 확인)",
        },
        "disclaimer": "본 서비스 결과는 정보 제공용이며 투자 권유가 아닙니다.",
    }


@app.on_event("startup")
def on_startup():
    """서버 시작 시 한 번 실행됩니다."""
    # 배포 환경에서 별도 마이그레이션 없이 동작하도록 테이블을 자동 생성합니다.
    # (IF NOT EXISTS 라 안전하며, 실패해도 앱은 계속 시작합니다.)
    try:
        from app.db.database import init_db

        init_db()
    except Exception as exc:
        logger.warning(f"[Startup] DB 초기화 건너뜀: {exc}")
    logger.info("KOStockCrewAI API 서버가 시작되었습니다. /docs 에서 테스트하세요.")

"""
routes.py
---------
FastAPI 엔드포인트(주소) 정의.

엔드포인트:
  GET  /health                      서버 상태 확인
  GET  /report/{ticker}             종목 리포트(JSON) 생성/조회
  GET  /report/{ticker}/pdf         리포트 PDF 다운로드
  POST /collect/dart/{ticker}       DART 재무 수집 후 저장
  POST /collect/ecos/base-rate      ECOS 기준금리 수집 후 저장
  GET  /sample/load/{ticker}        샘플(더미) 데이터 적재
"""

from __future__ import annotations

from datetime import date
from typing import Optional

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel

from app.core.config import settings
from app.core.logging import logger
from app.db import repositories as repo
from app.db.database import check_connection

router = APIRouter()


@router.get("/health")
def health():
    """서버와 DB 상태를 알려줍니다."""
    db_ok = check_connection()
    return {
        "status": "ok",
        "service": "KOStockCrewAI",
        "database_connected": db_ok,
        "time": date.today().isoformat(),
    }


@router.get("/diagnostics")
def diagnostics(live: bool = False):
    """
    API Key 연동 상태를 점검합니다.
    - live=false(기본): 키 설정 여부만 확인(빠름, 외부 호출 없음).
    - live=true: 각 서비스에 가벼운 실제 호출을 시도해 연결 여부까지 확인.

    ※ 응답에 실제 키 값은 절대 포함하지 않습니다(설정 여부만 표시). ※
    """
    from app.core.diagnostics import diagnose

    return diagnose(live=live)


# ---------- 설정(API 키) 관리 ----------
class SettingsBody(BaseModel):
    """설정 등록/수정 요청 본문. 모두 선택값이며, 보낸 항목만 갱신됩니다."""
    OPENAI_API_KEY: Optional[str] = None
    DART_API_KEY: Optional[str] = None
    ECOS_API_KEY: Optional[str] = None
    KOSCOM_API_KEY: Optional[str] = None
    KOSCOM_BASE_URL: Optional[str] = None
    KOSCOM_AUTH_TYPE: Optional[str] = None
    OPENAI_MODEL: Optional[str] = None
    ECOS_BASE_RATE_STAT_CODE: Optional[str] = None
    ECOS_BASE_RATE_ITEM_CODE: Optional[str] = None


@router.get("/settings")
def get_settings_status():
    """
    현재 설정 상태(설정됨/미설정)를 반환합니다.
    ※ 보안: 실제 키 값은 절대 반환하지 않습니다(설정 여부만). ※
    """
    from app.core.config import settings_status

    return {"status": settings_status()}


@router.post("/settings")
def update_settings_endpoint(body: SettingsBody):
    """
    API 키 등 설정을 등록/수정합니다.
    - 보낸 항목만 반영(빈 값은 무시 = 기존 유지)
    - 실행 중 설정에 즉시 반영 + .env 에 저장(재시작 없이 적용)
    """
    from app.core.config import update_settings, settings_status

    applied = update_settings(body.model_dump())
    return {
        "applied": list(applied.keys()),
        "message": "설정이 저장·적용되었습니다." if applied else "변경된 값이 없습니다.",
        "status": settings_status(),
    }


@router.get("/resolve/{query}")
def resolve_ticker(query: str):
    """
    종목명 또는 종목코드를 받아 표준 종목코드로 변환합니다.
    찾는 순서: 숫자코드 → 내장 사전 → DB(stocks) → DART 매핑(키 필요).
    """
    q = (query or "").strip()
    # 1) 숫자면 코드로 간주
    digits = q.replace(" ", "")
    if digits.isdigit():
        code = digits.zfill(6)
        from app.core.ticker_map import CODE_TO_NAME

        # DB 가 잠시 불가하더라도 코드 변환은 실패하지 않도록 방어적으로 조회
        name = CODE_TO_NAME.get(code)
        try:
            info = repo.load_stock_info(code)
            if info and info.get("corp_name"):
                name = info["corp_name"]
        except Exception as exc:
            logger.warning(f"[Resolve] 코드 조회 중 DB 건너뜀: {exc}")
        return {"ticker": code, "corp_name": name, "source": "code"}

    # 2) 내장 사전
    from app.core.ticker_map import builtin_name_to_code

    code = builtin_name_to_code(q)
    if code:
        from app.core.ticker_map import CODE_TO_NAME

        return {"ticker": code, "corp_name": CODE_TO_NAME.get(code, q), "source": "builtin"}

    # 3) DB(stocks) 이름 부분일치
    try:
        from app.db.database import get_db_session
        from sqlalchemy import text

        with get_db_session() as db:
            row = db.execute(
                text("SELECT ticker, corp_name FROM stocks WHERE corp_name ILIKE :q LIMIT 1"),
                {"q": f"%{q}%"},
            ).fetchone()
        if row:
            m = row._mapping
            return {"ticker": m["ticker"], "corp_name": m["corp_name"], "source": "db"}
    except Exception as exc:
        logger.warning(f"[Resolve] DB 조회 건너뜀: {exc}")

    # 4) DART 매핑(키 있을 때만)
    try:
        from app.collectors.dart_collector import download_corp_code_map

        for code, info in download_corp_code_map().items():
            if info.get("corp_name", "").replace(" ", "").lower() == q.replace(" ", "").lower():
                return {"ticker": code, "corp_name": info["corp_name"], "source": "dart"}
    except Exception as exc:
        logger.warning(f"[Resolve] DART 조회 건너뜀: {exc}")

    raise HTTPException(
        status_code=404,
        detail=f"'{q}' 에 해당하는 종목을 찾지 못했습니다. 종목코드(숫자)로 입력하거나 정확한 종목명을 사용하세요.",
    )


@router.get("/report/{ticker}")
def get_report(ticker: str):
    """
    종목 리포트를 생성합니다(JSON).
    데이터가 없으면 자동으로 샘플 데이터를 만들어 결과를 돌려줍니다.
    """
    try:
        from app.agents.investment_agent import generate_full_report

        result = generate_full_report(ticker)
        # PDF 바이너리 경로는 그대로 두되, 다운로드는 별도 엔드포인트로 안내
        return {
            "ticker": result["ticker"],
            "corp_name": result["corp_name"],
            "scores": result["scores"],
            "brief": result["brief"],
            "pdf_download_url": f"/report/{result['ticker']}/pdf",
        }
    except Exception as exc:
        logger.error(f"[API] 리포트 생성 실패: {exc}")
        raise HTTPException(
            status_code=500,
            detail=(
                "리포트 생성 중 오류가 발생했습니다. PostgreSQL 실행 여부와 "
                ".env 설정을 확인하세요. 자세한 내용은 logs/app.log 를 참고하세요."
            ),
        )


@router.get("/report/{ticker}/pdf")
def get_report_pdf(ticker: str):
    """
    종목 리포트 PDF 를 생성/반환합니다.
    파일이 없으면 새로 생성합니다.
    """
    try:
        from app.agents.investment_agent import generate_full_report

        result = generate_full_report(ticker)
        pdf_path = result.get("pdf_path")
        if not pdf_path:
            raise HTTPException(status_code=500, detail="PDF 생성에 실패했습니다.")
        filename = f"{result['ticker']}_{date.today().isoformat()}.pdf"
        return FileResponse(pdf_path, media_type="application/pdf", filename=filename)
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"[API] PDF 생성 실패: {exc}")
        raise HTTPException(status_code=500, detail="PDF 리포트 생성 중 오류가 발생했습니다.")


@router.post("/collect/dart/{ticker}")
def collect_dart(ticker: str, fiscal_year: str | None = None):
    """
    DART 에서 재무 주요계정을 수집하여 DB 에 저장합니다.
    fiscal_year 미지정 시 직전 연도를 사용합니다.
    """
    from app.collectors.dart_collector import get_single_company_accounts, find_corp_code

    year = fiscal_year or str(date.today().year - 1)
    rows = get_single_company_accounts(ticker, year)
    if not rows:
        return {
            "ticker": ticker,
            "fiscal_year": year,
            "saved": 0,
            "message": "수집된 재무 데이터가 없습니다. DART_API_KEY 설정과 종목코드를 확인하세요.",
        }

    # 종목명 갱신(있으면)
    found = find_corp_code(ticker)
    if found:
        repo.upsert_stock(ticker=ticker.zfill(6), corp_name=found.get("corp_name"),
                          corp_code=found.get("corp_code"))

    saved = repo.insert_financial_rows(ticker.zfill(6), rows)
    return {"ticker": ticker, "fiscal_year": year, "saved": saved, "message": "재무 데이터 저장 완료"}


@router.post("/collect/ecos/base-rate")
def collect_ecos_base_rate(start_period: str | None = None, end_period: str | None = None):
    """
    ECOS 에서 기준금리를 수집하여 macro_indicators 에 저장합니다.
    기간 미지정 시 최근 12개월(월 주기)을 사용합니다.
    """
    from app.collectors.ecos_collector import fetch_base_rate

    today = date.today()
    end_period = end_period or today.strftime("%Y%m")
    start_period = start_period or (today.replace(day=1) - __import_timedelta(365)).strftime("%Y%m")

    rows = fetch_base_rate(start_period, end_period)
    if not rows:
        return {
            "saved": 0,
            "message": "수집된 ECOS 데이터가 없습니다. ECOS_API_KEY 와 통계표/항목 코드를 확인하세요.",
        }

    macro_rows = []
    for r in rows:
        # ECOS row 예: {"TIME": "202401", "DATA_VALUE": "3.5", ...}
        time_str = str(r.get("TIME", ""))
        value = r.get("DATA_VALUE")
        ind_date = _ecos_time_to_date(time_str)
        try:
            value_f = float(value) if value not in (None, "") else None
        except ValueError:
            value_f = None
        if ind_date and value_f is not None:
            macro_rows.append(
                {"indicator": "base_rate", "indicator_date": ind_date, "value": value_f, "unit": "%"}
            )

    saved = repo.insert_macro_rows(macro_rows) if macro_rows else 0
    return {"saved": saved, "message": "기준금리 저장 완료" if saved else "저장할 값이 없습니다."}


@router.get("/sample/load/{ticker}")
def sample_load(ticker: str):
    """
    샘플(더미) 데이터를 DB 에 적재합니다.
    외부 API Key 없이도 /report/{ticker} 를 테스트할 수 있게 합니다.

    ※ 주의: 이 데이터는 실데이터가 아니며 UI/파이프라인 검증용입니다. ※
    """
    try:
        from app.agents.investment_agent import load_sample_data

        counts = load_sample_data(ticker)
        return {
            "ticker": ticker.zfill(6),
            "loaded": counts,
            "message": "샘플 데이터 적재 완료(실데이터 아님, 검증용).",
        }
    except Exception as exc:
        logger.error(f"[API] 샘플 적재 실패: {exc}")
        raise HTTPException(
            status_code=500,
            detail="샘플 데이터 적재 실패. PostgreSQL 실행과 테이블 생성(schema.sql) 여부를 확인하세요.",
        )


# ------------------------------------------------------------------
# 내부 도우미
# ------------------------------------------------------------------
def __import_timedelta(days: int):
    """timedelta 를 지연 import 하여 상단을 깔끔하게 유지합니다."""
    from datetime import timedelta

    return timedelta(days=days)


def _ecos_time_to_date(time_str: str):
    """ECOS TIME('YYYYMM' 또는 'YYYYMMDD' 또는 'YYYY')을 YYYY-MM-DD 로 변환."""
    s = time_str.strip()
    if len(s) == 6:  # YYYYMM
        return f"{s[0:4]}-{s[4:6]}-01"
    if len(s) == 8:  # YYYYMMDD
        return f"{s[0:4]}-{s[4:6]}-{s[6:8]}"
    if len(s) == 4:  # YYYY
        return f"{s}-12-31"
    return None

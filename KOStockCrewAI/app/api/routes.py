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

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

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

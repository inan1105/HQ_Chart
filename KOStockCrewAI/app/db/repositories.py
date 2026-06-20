"""
repositories.py
---------------
데이터베이스에 데이터를 저장(upsert/insert)하고 불러오는(load) 함수 모음입니다.
다른 모듈은 SQL 을 직접 쓰지 않고 여기 함수를 호출합니다.

- upsert: 있으면 갱신, 없으면 새로 삽입
- insert: 새로 삽입 (중복 시 UNIQUE 제약으로 건너뜀)
- load:   읽어오기
"""

from __future__ import annotations

import json
from datetime import date, datetime
from typing import Any, Dict, List, Optional

import pandas as pd
from sqlalchemy import text

from app.db.database import get_db_session
from app.core.logging import logger


# ------------------------------------------------------------------
# 저장(Write) 함수들
# ------------------------------------------------------------------

def upsert_stock(
    ticker: str,
    corp_name: Optional[str] = None,
    corp_code: Optional[str] = None,
    market: Optional[str] = None,
    sector: Optional[str] = None,
) -> None:
    """종목 기본정보를 저장합니다. 이미 있으면 갱신합니다."""
    sql = text(
        """
        INSERT INTO stocks (ticker, corp_name, corp_code, market, sector, updated_at)
        VALUES (:ticker, :corp_name, :corp_code, :market, :sector, :updated_at)
        ON CONFLICT (ticker) DO UPDATE SET
            corp_name = COALESCE(EXCLUDED.corp_name, stocks.corp_name),
            corp_code = COALESCE(EXCLUDED.corp_code, stocks.corp_code),
            market    = COALESCE(EXCLUDED.market, stocks.market),
            sector    = COALESCE(EXCLUDED.sector, stocks.sector),
            updated_at = EXCLUDED.updated_at
        """
    )
    with get_db_session() as db:
        db.execute(
            sql,
            {
                "ticker": ticker,
                "corp_name": corp_name,
                "corp_code": corp_code,
                "market": market,
                "sector": sector,
                "updated_at": datetime.utcnow(),
            },
        )
    logger.info(f"[DB] 종목정보 저장: {ticker} ({corp_name})")


def insert_price_rows(ticker: str, rows: List[Dict[str, Any]]) -> int:
    """
    일별 시세(OHLCV) 여러 건을 저장합니다.
    rows 예시: [{"trade_date": "2024-01-02", "open":.., "high":.., "low":.., "close":.., "volume":..}, ...]
    중복(ticker, trade_date)은 갱신합니다.
    """
    sql = text(
        """
        INSERT INTO stock_prices (ticker, trade_date, open, high, low, close, volume)
        VALUES (:ticker, :trade_date, :open, :high, :low, :close, :volume)
        ON CONFLICT (ticker, trade_date) DO UPDATE SET
            open = EXCLUDED.open, high = EXCLUDED.high,
            low = EXCLUDED.low, close = EXCLUDED.close, volume = EXCLUDED.volume
        """
    )
    count = 0
    with get_db_session() as db:
        for r in rows:
            db.execute(sql, {"ticker": ticker, **r})
            count += 1
    logger.info(f"[DB] 시세 {count}건 저장: {ticker}")
    return count


def insert_flow_rows(ticker: str, rows: List[Dict[str, Any]]) -> int:
    """투자자별 수급 데이터 여러 건을 저장합니다."""
    sql = text(
        """
        INSERT INTO investor_flows (ticker, trade_date, foreign_net, institution_net, individual_net)
        VALUES (:ticker, :trade_date, :foreign_net, :institution_net, :individual_net)
        ON CONFLICT (ticker, trade_date) DO UPDATE SET
            foreign_net = EXCLUDED.foreign_net,
            institution_net = EXCLUDED.institution_net,
            individual_net = EXCLUDED.individual_net
        """
    )
    count = 0
    with get_db_session() as db:
        for r in rows:
            db.execute(sql, {"ticker": ticker, **r})
            count += 1
    logger.info(f"[DB] 수급 {count}건 저장: {ticker}")
    return count


def insert_financial_rows(ticker: str, rows: List[Dict[str, Any]]) -> int:
    """재무제표 주요계정 여러 건을 저장합니다."""
    sql = text(
        """
        INSERT INTO financial_statements (ticker, fiscal_year, report_code, account_name, amount)
        VALUES (:ticker, :fiscal_year, :report_code, :account_name, :amount)
        ON CONFLICT (ticker, fiscal_year, report_code, account_name) DO UPDATE SET
            amount = EXCLUDED.amount
        """
    )
    count = 0
    with get_db_session() as db:
        for r in rows:
            db.execute(sql, {"ticker": ticker, **r})
            count += 1
    logger.info(f"[DB] 재무 {count}건 저장: {ticker}")
    return count


def insert_macro_rows(rows: List[Dict[str, Any]]) -> int:
    """거시지표 여러 건을 저장합니다."""
    sql = text(
        """
        INSERT INTO macro_indicators (indicator, indicator_date, value, unit)
        VALUES (:indicator, :indicator_date, :value, :unit)
        ON CONFLICT (indicator, indicator_date) DO UPDATE SET
            value = EXCLUDED.value, unit = EXCLUDED.unit
        """
    )
    count = 0
    with get_db_session() as db:
        for r in rows:
            db.execute(sql, r)
            count += 1
    logger.info(f"[DB] 거시지표 {count}건 저장")
    return count


def insert_analysis_score(ticker: str, analysis_date: str, scores: Dict[str, Any]) -> None:
    """종합 분석 점수를 저장합니다."""
    sql = text(
        """
        INSERT INTO analysis_scores
            (ticker, analysis_date, fundamental_score, technical_score, flow_score,
             macro_score, total_score, risk_score, rating)
        VALUES
            (:ticker, :analysis_date, :fundamental_score, :technical_score, :flow_score,
             :macro_score, :total_score, :risk_score, :rating)
        ON CONFLICT (ticker, analysis_date) DO UPDATE SET
            fundamental_score = EXCLUDED.fundamental_score,
            technical_score = EXCLUDED.technical_score,
            flow_score = EXCLUDED.flow_score,
            macro_score = EXCLUDED.macro_score,
            total_score = EXCLUDED.total_score,
            risk_score = EXCLUDED.risk_score,
            rating = EXCLUDED.rating
        """
    )
    with get_db_session() as db:
        db.execute(
            sql,
            {
                "ticker": ticker,
                "analysis_date": analysis_date,
                "fundamental_score": scores.get("fundamental_score"),
                "technical_score": scores.get("technical_score"),
                "flow_score": scores.get("flow_score"),
                "macro_score": scores.get("macro_score"),
                "total_score": scores.get("total_score"),
                "risk_score": scores.get("risk_score"),
                "rating": scores.get("rating"),
            },
        )
    logger.info(f"[DB] 분석점수 저장: {ticker} ({analysis_date})")


def insert_generated_report(
    ticker: str,
    corp_name: Optional[str],
    report_date: str,
    total_score: Optional[float],
    rating: Optional[str],
    pdf_path: Optional[str],
    brief: Optional[Dict[str, Any]] = None,
) -> None:
    """생성된 리포트 이력을 저장합니다."""
    sql = text(
        """
        INSERT INTO generated_reports
            (ticker, corp_name, report_date, total_score, rating, pdf_path, brief_json)
        VALUES
            (:ticker, :corp_name, :report_date, :total_score, :rating, :pdf_path, :brief_json)
        ON CONFLICT (ticker, report_date) DO UPDATE SET
            corp_name = EXCLUDED.corp_name,
            total_score = EXCLUDED.total_score,
            rating = EXCLUDED.rating,
            pdf_path = EXCLUDED.pdf_path,
            brief_json = EXCLUDED.brief_json
        """
    )
    with get_db_session() as db:
        db.execute(
            sql,
            {
                "ticker": ticker,
                "corp_name": corp_name,
                "report_date": report_date,
                "total_score": total_score,
                "rating": rating,
                "pdf_path": pdf_path,
                "brief_json": json.dumps(brief, ensure_ascii=False) if brief else None,
            },
        )
    logger.info(f"[DB] 리포트 이력 저장: {ticker} ({report_date})")


# ------------------------------------------------------------------
# 불러오기(Read) 함수들
# ------------------------------------------------------------------

def load_price_df(ticker: str, limit: int = 200) -> pd.DataFrame:
    """
    시세 데이터를 pandas DataFrame 으로 불러옵니다(날짜 오름차순).
    기술적 분석에서 사용합니다.
    """
    sql = text(
        """
        SELECT trade_date, open, high, low, close, volume
        FROM stock_prices
        WHERE ticker = :ticker
        ORDER BY trade_date DESC
        LIMIT :limit
        """
    )
    with get_db_session() as db:
        result = db.execute(sql, {"ticker": ticker, "limit": limit})
        rows = result.fetchall()
        columns = result.keys()
    df = pd.DataFrame(rows, columns=list(columns))
    if not df.empty:
        # 숫자형으로 변환하고 날짜 오름차순으로 정렬
        df = df.sort_values("trade_date").reset_index(drop=True)
        for col in ["open", "high", "low", "close", "volume"]:
            df[col] = pd.to_numeric(df[col], errors="coerce")
    return df


def load_flow_df(ticker: str, limit: int = 60) -> pd.DataFrame:
    """수급 데이터를 DataFrame 으로 불러옵니다(날짜 오름차순)."""
    sql = text(
        """
        SELECT trade_date, foreign_net, institution_net, individual_net
        FROM investor_flows
        WHERE ticker = :ticker
        ORDER BY trade_date DESC
        LIMIT :limit
        """
    )
    with get_db_session() as db:
        result = db.execute(sql, {"ticker": ticker, "limit": limit})
        rows = result.fetchall()
        columns = result.keys()
    df = pd.DataFrame(rows, columns=list(columns))
    if not df.empty:
        df = df.sort_values("trade_date").reset_index(drop=True)
        for col in ["foreign_net", "institution_net", "individual_net"]:
            df[col] = pd.to_numeric(df[col], errors="coerce")
    return df


def load_financial_rows(ticker: str) -> List[Dict[str, Any]]:
    """재무제표 계정들을 리스트(dict)로 불러옵니다. 최신 연도 우선."""
    sql = text(
        """
        SELECT fiscal_year, report_code, account_name, amount
        FROM financial_statements
        WHERE ticker = :ticker
        ORDER BY fiscal_year DESC
        """
    )
    with get_db_session() as db:
        result = db.execute(sql, {"ticker": ticker})
        rows = [dict(r._mapping) for r in result.fetchall()]
    return rows


def load_stock_info(ticker: str) -> Optional[Dict[str, Any]]:
    """종목 기본정보를 dict 로 불러옵니다. 없으면 None."""
    sql = text("SELECT * FROM stocks WHERE ticker = :ticker")
    with get_db_session() as db:
        result = db.execute(sql, {"ticker": ticker})
        row = result.fetchone()
    return dict(row._mapping) if row else None


def load_macro_snapshot() -> Dict[str, Any]:
    """
    각 거시지표의 '가장 최근값' 하나씩을 모아 snapshot dict 로 반환합니다.
    예: {"base_rate": 3.5, "usd_krw": 1320.0, "cpi_yoy": 2.8}
    """
    sql = text(
        """
        SELECT DISTINCT ON (indicator) indicator, indicator_date, value, unit
        FROM macro_indicators
        ORDER BY indicator, indicator_date DESC
        """
    )
    snapshot: Dict[str, Any] = {}
    with get_db_session() as db:
        result = db.execute(sql)
        for r in result.fetchall():
            m = r._mapping
            snapshot[m["indicator"]] = {
                "value": float(m["value"]) if m["value"] is not None else None,
                "date": str(m["indicator_date"]),
                "unit": m["unit"],
            }
    return snapshot

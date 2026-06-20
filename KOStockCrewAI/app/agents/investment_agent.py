"""
investment_agent.py
-------------------
KOStockCrewAI 의 '핵심 파이프라인'입니다.
종목코드를 받아 데이터 로드 → 분석 → 스코어링 → GPT 브리프 → PDF 생성 → DB 저장까지
정해진 순서대로(결정론적으로) 실행합니다.

이 모듈이 MVP 의 기본 실행 엔진이며, CrewAI(crew.py)는 선택적 확장입니다.
"""

from __future__ import annotations

import math
import random
from datetime import date, datetime, timedelta
from typing import Any, Dict, List

from app.core.config import settings
from app.core.logging import logger
from app.db import repositories as repo
from app.analysis.technical import analyze_technical
from app.analysis.fundamental import analyze_fundamental
from app.analysis.flow import analyze_flow
from app.analysis.macro import analyze_macro
from app.analysis.scoring import compute_scores
from app.agents.gpt_brief_agent import generate_brief
from app.reports.pdf_report import build_pdf_report


def generate_full_report(ticker: str, allow_sample: bool = True) -> Dict[str, Any]:
    """
    종목 하나에 대한 전체 리포트를 생성합니다.

    실행 순서:
      1. 종목정보 로드
      2. 가격 데이터 로드
      3. 수급 데이터 로드
      4. 재무 데이터 로드
      5. 거시 데이터 로드
      6. 기술적 분석
      7. 기본적 분석
      8. 수급 분석
      9. 거시 분석
      10. 종합 스코어링
      11. GPT 브리프 생성
      12. PDF 생성
      13. generated_reports 저장

    매개변수:
        ticker: 종목코드 (예: '005930')
        allow_sample: 가격 데이터가 없을 때 샘플 데이터를 자동 생성할지 여부

    반환:
        {ticker, corp_name, scores, brief, pdf_path}
    """
    ticker = ticker.strip().zfill(6)
    logger.info(f"[Pipeline] 리포트 생성 시작: {ticker}")

    # 1) 종목정보 로드
    stock_info = repo.load_stock_info(ticker)
    corp_name = stock_info.get("corp_name") if stock_info else None

    # 2) 가격 데이터 로드
    price_df = repo.load_price_df(ticker)

    # 가격 데이터가 없으면 (옵션에 따라) 샘플 데이터를 만들고 다시 로드
    if (price_df is None or price_df.empty) and allow_sample:
        logger.warning(f"[Pipeline] {ticker} 가격 데이터 없음 → 샘플 데이터 생성")
        load_sample_data(ticker)
        stock_info = repo.load_stock_info(ticker)
        corp_name = stock_info.get("corp_name") if stock_info else corp_name
        price_df = repo.load_price_df(ticker)

    # 3) 수급 데이터 로드
    flow_df = repo.load_flow_df(ticker)

    # 4) 재무 데이터 로드
    financial_rows = repo.load_financial_rows(ticker)

    # 5) 거시 데이터 로드 (최신 snapshot)
    macro_snapshot = repo.load_macro_snapshot()

    # 6~9) 각 분석 수행
    tech = analyze_technical(price_df)
    fund = analyze_fundamental(financial_rows)
    flow = analyze_flow(flow_df)
    macro = analyze_macro(macro_snapshot)

    # 10) 종합 스코어링
    scores = compute_scores(
        fundamental_score=fund["fundamental_score"],
        technical_score=tech["technical_score"],
        flow_score=flow["flow_score"],
        macro_score=macro["macro_score"],
    )

    # 분석 점수 DB 저장
    today = date.today().isoformat()
    try:
        repo.insert_analysis_score(ticker, today, scores)
    except Exception as exc:
        logger.warning(f"[Pipeline] 분석점수 저장 실패(계속 진행): {exc}")

    # 11) GPT 브리프 생성
    brief_context = {
        "ticker": ticker,
        "corp_name": corp_name or ticker,
        "total_score": scores["total_score"],
        "rating": scores["rating"],
        "fundamental_score": scores["fundamental_score"],
        "technical_score": scores["technical_score"],
        "flow_score": scores["flow_score"],
        "macro_score": scores["macro_score"],
        "risk_score": scores["risk_score"],
        "details": {
            "technical": tech.get("indicators"),
            "fundamental": fund.get("metrics"),
            "flow": flow.get("metrics"),
            "macro": macro.get("metrics"),
            "warnings": {
                "technical": tech.get("warning"),
                "fundamental": fund.get("warning"),
                "flow": flow.get("warning"),
                "macro": macro.get("warning"),
            },
        },
    }
    brief = generate_brief(brief_context)

    # 12) PDF 생성
    try:
        pdf_path = build_pdf_report(
            ticker=ticker,
            corp_name=corp_name or ticker,
            scores=scores,
            brief=brief,
        )
    except Exception as exc:
        logger.error(f"[Pipeline] PDF 생성 실패(계속 진행): {exc}")
        pdf_path = None

    # 13) generated_reports 저장
    try:
        repo.insert_generated_report(
            ticker=ticker,
            corp_name=corp_name,
            report_date=today,
            total_score=scores["total_score"],
            rating=scores["rating"],
            pdf_path=pdf_path,
            brief=brief,
        )
    except Exception as exc:
        logger.warning(f"[Pipeline] 리포트 이력 저장 실패(계속 진행): {exc}")

    logger.info(f"[Pipeline] 리포트 생성 완료: {ticker} (등급 {scores['rating']})")

    return {
        "ticker": ticker,
        "corp_name": corp_name or ticker,
        "scores": scores,
        "brief": brief,
        "pdf_path": pdf_path,
        "analysis": {
            "technical": tech,
            "fundamental": fund,
            "flow": flow,
            "macro": macro,
        },
    }


# ------------------------------------------------------------------
# 샘플(더미) 데이터 생성
# ------------------------------------------------------------------
def load_sample_data(ticker: str = "005930") -> Dict[str, int]:
    """
    외부 API Key 가 없어도 UI/파이프라인을 검증할 수 있도록
    더미 데이터를 DB 에 저장합니다.

    ※ 주의: 이 데이터는 실데이터가 아니며, UI/파이프라인 검증용입니다. ※

    생성 내용:
      - 종목정보 1건 (005930 이면 삼성전자로 표기)
      - 90일 OHLCV 더미
      - 20일 수급 더미
      - 간단한 재무 데이터
    """
    ticker = ticker.strip().zfill(6)

    # 잘 알려진 몇 종목은 이름을 채워 줍니다(샘플 표시용).
    sample_names = {
        "005930": ("삼성전자", "KOSPI", 70000),
        "000660": ("SK하이닉스", "KOSPI", 130000),
        "035420": ("NAVER", "KOSPI", 200000),
        "051910": ("LG화학", "KOSPI", 400000),
    }
    corp_name, market, base_price = sample_names.get(ticker, (f"샘플종목_{ticker}", "KOSPI", 50000))

    # 1) 종목정보 저장
    repo.upsert_stock(ticker=ticker, corp_name=corp_name, market=market, sector="샘플")

    # 2) 90일 OHLCV 더미 (랜덤워크로 그럴듯하게 생성)
    random.seed(int(ticker))  # 같은 종목은 항상 같은 더미가 나오도록 고정
    price_rows: List[Dict[str, Any]] = []
    price = float(base_price)
    today = date.today()
    days = _recent_business_days(today, 90)
    for d in days:
        change = random.uniform(-0.02, 0.02)  # 하루 ±2%
        price = max(1000.0, price * (1 + change))
        open_p = price * (1 + random.uniform(-0.005, 0.005))
        high_p = max(open_p, price) * (1 + random.uniform(0, 0.01))
        low_p = min(open_p, price) * (1 - random.uniform(0, 0.01))
        volume = random.randint(1_000_000, 20_000_000)
        price_rows.append(
            {
                "trade_date": d.isoformat(),
                "open": round(open_p, 2),
                "high": round(high_p, 2),
                "low": round(low_p, 2),
                "close": round(price, 2),
                "volume": volume,
            }
        )
    repo.insert_price_rows(ticker, price_rows)

    # 3) 20일 수급 더미
    flow_rows: List[Dict[str, Any]] = []
    for d in days[-20:]:
        foreign = random.randint(-500_000, 600_000)
        institution = random.randint(-400_000, 500_000)
        individual = -(foreign + institution)  # 합이 0 에 가깝도록
        flow_rows.append(
            {
                "trade_date": d.isoformat(),
                "foreign_net": foreign,
                "institution_net": institution,
                "individual_net": individual,
            }
        )
    repo.insert_flow_rows(ticker, flow_rows)

    # 4) 간단한 재무 데이터 (단위: 원, 예시 수치)
    fiscal_year = str(today.year - 1)
    fin_rows = [
        {"fiscal_year": fiscal_year, "report_code": "11011", "account_name": "매출액", "amount": 2_500_000_000_000},
        {"fiscal_year": fiscal_year, "report_code": "11011", "account_name": "영업이익", "amount": 350_000_000_000},
        {"fiscal_year": fiscal_year, "report_code": "11011", "account_name": "당기순이익", "amount": 280_000_000_000},
        {"fiscal_year": fiscal_year, "report_code": "11011", "account_name": "자산총계", "amount": 4_000_000_000_000},
        {"fiscal_year": fiscal_year, "report_code": "11011", "account_name": "부채총계", "amount": 1_500_000_000_000},
        {"fiscal_year": fiscal_year, "report_code": "11011", "account_name": "자본총계", "amount": 2_500_000_000_000},
    ]
    repo.insert_financial_rows(ticker, fin_rows)

    logger.info(f"[Sample] 샘플 데이터 생성 완료: {ticker} ({corp_name})")
    return {
        "prices": len(price_rows),
        "flows": len(flow_rows),
        "financials": len(fin_rows),
    }


def _recent_business_days(end: date, count: int) -> List[date]:
    """
    end 날짜로부터 거꾸로 세어 영업일(주말 제외) count 개를 만들어
    오래된 순으로 정렬해 반환합니다.
    """
    days: List[date] = []
    cur = end
    while len(days) < count:
        if cur.weekday() < 5:  # 0~4 가 월~금
            days.append(cur)
        cur -= timedelta(days=1)
    return list(reversed(days))

"""
fundamental.py
--------------
DART 재무 계정 데이터로 기본적 분석을 수행합니다.

추출 계정: 매출액, 영업이익, 당기순이익, 자산총계, 부채총계, 자본총계
계산 지표: 영업이익률, 부채비율, ROE
점수: fundamental_score (0~100)

값이 없으면 50점(중립)으로 처리하여 앱이 멈추지 않게 합니다.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

# DART 계정명이 회사/보고서마다 조금씩 다를 수 있어, 여러 후보 이름을 둡니다.
_ACCOUNT_ALIASES = {
    "revenue": ["매출액", "수익(매출액)", "영업수익"],
    "operating_profit": ["영업이익", "영업이익(손실)"],
    "net_income": ["당기순이익", "당기순이익(손실)", "당기순이익(손실)"],
    "total_assets": ["자산총계"],
    "total_liabilities": ["부채총계"],
    "total_equity": ["자본총계"],
}


def _pick_amount(rows: List[Dict[str, Any]], aliases: List[str]) -> Optional[float]:
    """
    재무 row 목록에서 별칭(aliases)에 해당하는 계정의 금액을 찾습니다.
    가장 먼저 발견되는 값을 사용합니다(rows 는 최신연도 우선 정렬 가정).
    """
    for row in rows:
        name = (row.get("account_name") or "").strip()
        if name in aliases:
            amount = row.get("amount")
            if amount is not None:
                try:
                    return float(amount)
                except (TypeError, ValueError):
                    continue
    return None


def analyze_fundamental(financial_rows: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    재무 데이터로 기본적 분석을 수행합니다.

    반환 dict:
        {
          "fundamental_score": 0~100,
          "metrics": {revenue, operating_profit, ..., operating_margin, debt_ratio, roe},
          "warning": None 또는 메시지
        }
    """
    result: Dict[str, Any] = {
        "fundamental_score": 50.0,
        "metrics": {},
        "warning": None,
    }

    if not financial_rows:
        result["warning"] = "재무 데이터가 없어 기본적 분석을 중립(50점)으로 처리합니다."
        return result

    # 주요 계정 추출
    revenue = _pick_amount(financial_rows, _ACCOUNT_ALIASES["revenue"])
    operating_profit = _pick_amount(financial_rows, _ACCOUNT_ALIASES["operating_profit"])
    net_income = _pick_amount(financial_rows, _ACCOUNT_ALIASES["net_income"])
    total_assets = _pick_amount(financial_rows, _ACCOUNT_ALIASES["total_assets"])
    total_liabilities = _pick_amount(financial_rows, _ACCOUNT_ALIASES["total_liabilities"])
    total_equity = _pick_amount(financial_rows, _ACCOUNT_ALIASES["total_equity"])

    # ----- 비율 계산 (분모가 0/None 이면 None) -----
    operating_margin = None
    if revenue and revenue != 0 and operating_profit is not None:
        operating_margin = operating_profit / revenue * 100  # 영업이익률(%)

    debt_ratio = None
    if total_equity and total_equity != 0 and total_liabilities is not None:
        debt_ratio = total_liabilities / total_equity * 100  # 부채비율(%)

    roe = None
    if total_equity and total_equity != 0 and net_income is not None:
        roe = net_income / total_equity * 100  # 자기자본이익률(%)

    result["metrics"] = {
        "revenue": revenue,
        "operating_profit": operating_profit,
        "net_income": net_income,
        "total_assets": total_assets,
        "total_liabilities": total_liabilities,
        "total_equity": total_equity,
        "operating_margin": round(operating_margin, 2) if operating_margin is not None else None,
        "debt_ratio": round(debt_ratio, 2) if debt_ratio is not None else None,
        "roe": round(roe, 2) if roe is not None else None,
    }

    # ----- 점수 산출 -----
    # 각 항목을 0~100 으로 환산한 뒤 평균. 값이 없으면 중립 50.
    sub_scores: List[float] = []

    # 영업이익률: 높을수록 좋음 (0%->40, 20%+->90)
    if operating_margin is not None:
        sub_scores.append(_clip(40 + operating_margin * 2.5))
    else:
        sub_scores.append(50.0)

    # 부채비율: 낮을수록 좋음 (100% 기준선, 200%+ 낮은 점수)
    if debt_ratio is not None:
        sub_scores.append(_clip(90 - debt_ratio * 0.25))
    else:
        sub_scores.append(50.0)

    # ROE: 높을수록 좋음 (0%->40, 20%+->90)
    if roe is not None:
        sub_scores.append(_clip(40 + roe * 2.5))
    else:
        sub_scores.append(50.0)

    fundamental_score = sum(sub_scores) / len(sub_scores)
    result["fundamental_score"] = round(fundamental_score, 2)

    # 일부 값이라도 비어있으면 안내
    if None in (revenue, operating_profit, net_income, total_equity):
        result["warning"] = "일부 재무 항목이 비어 있어 점수 신뢰도가 낮을 수 있습니다."

    return result


def _clip(value: float, low: float = 0.0, high: float = 100.0) -> float:
    """점수를 0~100 범위로 잘라냅니다."""
    return round(max(low, min(high, value)), 2)

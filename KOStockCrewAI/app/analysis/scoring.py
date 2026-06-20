"""
scoring.py
----------
네 가지 분석(기본/기술/수급/거시) 점수를 가중 합산하여
종합점수(total_score)와 리스크점수(risk_score), 등급(rating)을 계산합니다.

가중치:
- fundamental(기본적) 35%
- technical(기술적)   30%
- flow(수급)         20%
- macro(거시)        15%

※ 주의 ※
여기서 나오는 rating(STRONG_BUY 등)은 '확정적 매수 권유'가 아니라
정량 점수를 등급으로 표현한 '분석 등급'일 뿐입니다.
투자 판단과 책임은 투자자 본인에게 있습니다.
"""

from __future__ import annotations

from typing import Any, Dict

# 가중치 정의
WEIGHTS = {
    "fundamental": 0.35,
    "technical": 0.30,
    "flow": 0.20,
    "macro": 0.15,
}


def compute_scores(
    fundamental_score: float,
    technical_score: float,
    flow_score: float,
    macro_score: float,
) -> Dict[str, Any]:
    """
    개별 점수(0~100)들을 받아 종합점수/리스크점수/등급을 계산합니다.

    반환 dict:
        {
          "fundamental_score", "technical_score", "flow_score", "macro_score",
          "total_score", "risk_score", "rating"
        }
    """
    # 입력값을 0~100 범위로 안전하게 보정
    f = _clip(fundamental_score)
    t = _clip(technical_score)
    fl = _clip(flow_score)
    m = _clip(macro_score)

    # 가중 합산
    total = (
        f * WEIGHTS["fundamental"]
        + t * WEIGHTS["technical"]
        + fl * WEIGHTS["flow"]
        + m * WEIGHTS["macro"]
    )

    # 리스크 점수: 점수가 낮을수록 위험이 크다고 단순 정의 (100 - total)
    # 변동성/수급 약세를 추가로 반영해 약간 가중.
    risk = (100 - total)
    # 수급/기술 점수가 매우 낮으면 리스크 가산
    if fl < 40:
        risk += 5
    if t < 40:
        risk += 5
    risk = _clip(risk)

    rating = _rating_from_score(total)

    return {
        "fundamental_score": round(f, 2),
        "technical_score": round(t, 2),
        "flow_score": round(fl, 2),
        "macro_score": round(m, 2),
        "total_score": round(total, 2),
        "risk_score": round(risk, 2),
        "rating": rating,
    }


def _rating_from_score(total: float) -> str:
    """
    종합점수를 분석 등급으로 변환합니다.
    (확정적 매수 권유가 아니라 점수 구간을 라벨로 표현한 것입니다.)
    """
    if total >= 75:
        return "STRONG_BUY"
    elif total >= 62:
        return "BUY"
    elif total >= 48:
        return "HOLD"
    elif total >= 38:
        return "WATCH"
    else:
        return "RISK"


def _clip(value: Any, low: float = 0.0, high: float = 100.0) -> float:
    """값을 0~100 범위로 보정합니다. 숫자가 아니면 50(중립)."""
    try:
        v = float(value)
    except (TypeError, ValueError):
        return 50.0
    return max(low, min(high, v))

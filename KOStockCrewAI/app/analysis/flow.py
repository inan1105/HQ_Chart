"""
flow.py
-------
투자자 수급(외국인/기관 순매수) 데이터로 수급 분석을 수행합니다.

- 최근 20거래일 외국인/기관 순매수 합산
- flow_score 산출 (0~100)
- 데이터가 부족하면 50점(중립)으로 처리
"""

from __future__ import annotations

from typing import Any, Dict

import pandas as pd


def analyze_flow(df: pd.DataFrame, window: int = 20) -> Dict[str, Any]:
    """
    수급 DataFrame(컬럼: foreign_net, institution_net, individual_net)으로 분석합니다.

    반환 dict:
        {
          "flow_score": 0~100,
          "metrics": {"foreign_sum":.., "institution_sum":.., "days":..},
          "warning": None 또는 메시지
        }
    """
    result: Dict[str, Any] = {
        "flow_score": 50.0,
        "metrics": {},
        "warning": None,
    }

    if df is None or df.empty:
        result["warning"] = "수급 데이터가 없어 중립(50점)으로 처리합니다."
        return result

    # 최근 window(기본 20) 거래일만 사용
    recent = df.tail(window)
    foreign_sum = float(pd.to_numeric(recent["foreign_net"], errors="coerce").fillna(0).sum())
    institution_sum = float(pd.to_numeric(recent["institution_net"], errors="coerce").fillna(0).sum())
    days = len(recent)

    result["metrics"] = {
        "foreign_sum": foreign_sum,
        "institution_sum": institution_sum,
        "days": days,
    }

    if days < 5:
        result["warning"] = (
            f"수급 데이터가 {days}일로 부족합니다. 신뢰도가 낮아 중립(50점)으로 처리합니다."
        )
        return result

    # ----- 점수 산출 -----
    # 외국인+기관 합산 순매수의 방향과 강도로 점수화.
    combined = foreign_sum + institution_sum

    # 기준 스케일: 거래일당 평균 순매수 규모로 정규화
    avg_per_day = combined / max(days, 1)

    score = 50.0
    if avg_per_day > 0:
        # 순매수(유입) -> 가점
        score = 50 + min(40, (avg_per_day / 1_000_00) * 5)  # 스케일은 운영 데이터에 맞게 조정 가능
    elif avg_per_day < 0:
        # 순매도(유출) -> 감점
        score = 50 + max(-40, (avg_per_day / 1_000_00) * 5)

    # 외국인과 기관이 같은 방향이면 신뢰도 가중
    if (foreign_sum > 0 and institution_sum > 0):
        score = min(100, score + 5)
    elif (foreign_sum < 0 and institution_sum < 0):
        score = max(0, score - 5)

    result["flow_score"] = round(max(0.0, min(100.0, score)), 2)
    return result

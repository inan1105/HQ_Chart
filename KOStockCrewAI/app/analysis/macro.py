"""
macro.py
--------
거시경제 지표로 거시 분석을 수행합니다.

MVP 에서는 기준금리/USD-KRW/CPI(YoY) 예시값을 사용합니다.
운영에서는 macro_indicators 테이블의 최신값(load_macro_snapshot)으로 확장할 수 있도록
snapshot dict 를 받아 처리하는 구조로 작성했습니다.
"""

from __future__ import annotations

from typing import Any, Dict, Optional

# 예시(기본) 거시값. 실제 데이터가 없을 때만 사용합니다.
_DEFAULT_MACRO = {
    "base_rate": 3.5,   # 기준금리(%)
    "usd_krw": 1330.0,  # 원/달러 환율
    "cpi_yoy": 2.5,     # 소비자물가 상승률(전년동월비, %)
}


def analyze_macro(snapshot: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """
    거시 분석을 수행합니다.

    매개변수:
        snapshot: load_macro_snapshot() 결과(dict). 없으면 예시값 사용.

    반환 dict:
        {
          "macro_score": 0~100,
          "metrics": {"base_rate":.., "usd_krw":.., "cpi_yoy":..},
          "warning": None 또는 메시지
        }
    """
    result: Dict[str, Any] = {
        "macro_score": 50.0,
        "metrics": {},
        "warning": None,
    }

    # snapshot 에서 값 꺼내기 (구조: {"base_rate": {"value":..}, ...})
    def get_val(name: str, default: float) -> float:
        if snapshot and name in snapshot:
            v = snapshot[name]
            if isinstance(v, dict):
                return float(v.get("value") or default)
            try:
                return float(v)
            except (TypeError, ValueError):
                return default
        return default

    base_rate = get_val("base_rate", _DEFAULT_MACRO["base_rate"])
    usd_krw = get_val("usd_krw", _DEFAULT_MACRO["usd_krw"])
    cpi_yoy = get_val("cpi_yoy", _DEFAULT_MACRO["cpi_yoy"])

    if not snapshot:
        result["warning"] = "실데이터가 없어 예시 거시값을 사용했습니다(운영에서는 ECOS 최신값 사용)."

    result["metrics"] = {
        "base_rate": base_rate,
        "usd_krw": usd_krw,
        "cpi_yoy": cpi_yoy,
    }

    # ----- 점수 산출 -----
    # 일반적으로 '낮은 금리 / 안정적 환율 / 낮은 물가'가 증시에 우호적이라고 단순 가정.
    score = 50.0

    # 기준금리: 낮을수록 우호적 (2%->+15, 5%->-15 대략)
    score += (3.5 - base_rate) * 5

    # 환율: 너무 높으면(원화 약세 과도) 소폭 부정
    if usd_krw > 1400:
        score -= 10
    elif usd_krw < 1250:
        score += 5

    # 물가(CPI YoY): 2% 안팎이 안정적, 높을수록 부정
    score -= (cpi_yoy - 2.0) * 4

    result["macro_score"] = round(max(0.0, min(100.0, score)), 2)
    return result

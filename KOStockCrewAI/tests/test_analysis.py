"""
test_analysis.py
----------------
기술/기본/수급/거시 분석 모듈 단위 테스트. 외부 호출 없음(합성 데이터 사용).
"""

import pandas as pd

from app.analysis.technical import analyze_technical
from app.analysis.fundamental import analyze_fundamental
from app.analysis.flow import analyze_flow
from app.analysis.macro import analyze_macro


def _make_price_df(n: int):
    """완만한 상승 추세의 가격 DataFrame 을 만든다."""
    rows = []
    base = 100.0
    for i in range(n):
        base = base * 1.005  # 매일 0.5% 상승
        rows.append(
            {
                "trade_date": f"2024-{(i // 28) + 1:02d}-{(i % 28) + 1:02d}",
                "open": base * 0.99,
                "high": base * 1.01,
                "low": base * 0.98,
                "close": base,
                "volume": 1_000_000 + i,
            }
        )
    return pd.DataFrame(rows)


# ---------- 기술적 분석 ----------
def test_technical_enough_data():
    """80개 데이터면 경고 없이 점수가 0~100 범위로 나와야 한다."""
    df = _make_price_df(80)
    res = analyze_technical(df)
    assert res["warning"] is None
    assert 0 <= res["technical_score"] <= 100
    assert res["indicators"]["ma60"] is not None


def test_technical_insufficient_data_warns_but_continues():
    """60개 미만이면 경고가 있되 중단하지 않고 점수를 반환해야 한다."""
    df = _make_price_df(30)
    res = analyze_technical(df)
    assert res["warning"] is not None
    assert 0 <= res["technical_score"] <= 100


def test_technical_empty_is_neutral():
    """데이터가 없으면 중립 50점 + 경고."""
    res = analyze_technical(pd.DataFrame())
    assert res["technical_score"] == 50.0
    assert res["warning"] is not None


# ---------- 기본적 분석 ----------
def test_fundamental_with_data():
    """재무 계정이 주어지면 비율과 점수가 계산되어야 한다."""
    rows = [
        {"account_name": "매출액", "amount": 1000.0},
        {"account_name": "영업이익", "amount": 200.0},
        {"account_name": "당기순이익", "amount": 150.0},
        {"account_name": "자산총계", "amount": 2000.0},
        {"account_name": "부채총계", "amount": 800.0},
        {"account_name": "자본총계", "amount": 1200.0},
    ]
    res = analyze_fundamental(rows)
    m = res["metrics"]
    assert round(m["operating_margin"], 1) == 20.0   # 200/1000
    assert round(m["debt_ratio"], 1) == round(800 / 1200 * 100, 1)
    assert round(m["roe"], 1) == round(150 / 1200 * 100, 1)
    assert 0 <= res["fundamental_score"] <= 100


def test_fundamental_empty_is_neutral():
    """재무 데이터 없으면 중립 50점."""
    res = analyze_fundamental([])
    assert res["fundamental_score"] == 50.0
    assert res["warning"] is not None


# ---------- 수급 분석 ----------
def test_flow_positive_inflow():
    """외국인/기관 순매수면 50점 이상이어야 한다."""
    rows = [
        {"foreign_net": 100000, "institution_net": 50000, "individual_net": -150000}
        for _ in range(20)
    ]
    res = analyze_flow(pd.DataFrame(rows))
    assert res["flow_score"] >= 50
    assert res["metrics"]["days"] == 20


def test_flow_empty_is_neutral():
    """수급 데이터 없으면 중립 50점."""
    res = analyze_flow(pd.DataFrame())
    assert res["flow_score"] == 50.0
    assert res["warning"] is not None


# ---------- 거시 분석 ----------
def test_macro_default_when_no_snapshot():
    """snapshot 이 없으면 예시값 사용 + 경고, 점수는 0~100."""
    res = analyze_macro(None)
    assert res["warning"] is not None
    assert 0 <= res["macro_score"] <= 100
    assert "base_rate" in res["metrics"]


def test_macro_with_snapshot():
    """snapshot 값이 metrics 에 반영되어야 한다."""
    snap = {
        "base_rate": {"value": 2.0},
        "usd_krw": {"value": 1200.0},
        "cpi_yoy": {"value": 2.0},
    }
    res = analyze_macro(snap)
    assert res["metrics"]["base_rate"] == 2.0
    assert res["metrics"]["usd_krw"] == 1200.0
    assert 0 <= res["macro_score"] <= 100

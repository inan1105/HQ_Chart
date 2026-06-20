"""
technical.py
------------
가격(OHLCV) 데이터로 기술적 지표를 계산하고 점수를 매깁니다.

계산 지표:
- 이동평균: MA5, MA20, MA60
- RSI14
- MACD, MACD Signal
- 볼린저밴드 Upper/Lower
- ATR14

점수:
- trend_score(추세), momentum_score(모멘텀), volatility_score(변동성)
- technical_score(0~100)

데이터가 60개 미만이면 '경고'를 담은 결과를 돌려주되 중단하지 않습니다.
"""

from __future__ import annotations

from typing import Any, Dict

import numpy as np
import pandas as pd


def _rsi(close: pd.Series, period: int = 14) -> pd.Series:
    """RSI(상대강도지수)를 계산합니다. 0~100 사이 값."""
    delta = close.diff()
    gain = delta.clip(lower=0)          # 상승분만
    loss = -delta.clip(upper=0)         # 하락분만(양수로)
    avg_gain = gain.rolling(window=period, min_periods=period).mean()
    avg_loss = loss.rolling(window=period, min_periods=period).mean()
    rs = avg_gain / avg_loss.replace(0, np.nan)
    return 100 - (100 / (1 + rs))


def _macd(close: pd.Series):
    """MACD 와 Signal 선을 계산합니다."""
    ema12 = close.ewm(span=12, adjust=False).mean()
    ema26 = close.ewm(span=26, adjust=False).mean()
    macd = ema12 - ema26
    signal = macd.ewm(span=9, adjust=False).mean()
    return macd, signal


def _atr(df: pd.DataFrame, period: int = 14) -> pd.Series:
    """ATR(평균진폭) — 변동성 지표를 계산합니다."""
    high, low, close = df["high"], df["low"], df["close"]
    prev_close = close.shift(1)
    # True Range = max(고-저, |고-전일종가|, |저-전일종가|)
    tr = pd.concat(
        [high - low, (high - prev_close).abs(), (low - prev_close).abs()],
        axis=1,
    ).max(axis=1)
    return tr.rolling(window=period, min_periods=period).mean()


def analyze_technical(df: pd.DataFrame) -> Dict[str, Any]:
    """
    가격 DataFrame(컬럼: open/high/low/close/volume) 으로 기술적 분석을 수행합니다.

    반환 dict 예시:
        {
          "technical_score": 64.2,
          "trend_score": ..., "momentum_score": ..., "volatility_score": ...,
          "indicators": {"ma5":.., "rsi14":.., ...},
          "warning": None 또는 "데이터 부족" 메시지
        }
    """
    result: Dict[str, Any] = {
        "technical_score": 50.0,
        "trend_score": 50.0,
        "momentum_score": 50.0,
        "volatility_score": 50.0,
        "indicators": {},
        "warning": None,
    }

    # 데이터가 아예 없으면 중립 처리하고 종료
    if df is None or df.empty:
        result["warning"] = "가격 데이터가 없어 기술적 분석을 수행할 수 없습니다(중립 50점 처리)."
        return result

    close = pd.to_numeric(df["close"], errors="coerce")

    # 지표 계산 (데이터가 적으면 NaN 이 많이 생기지만 오류는 나지 않음)
    ma5 = close.rolling(5).mean()
    ma20 = close.rolling(20).mean()
    ma60 = close.rolling(60).mean()
    rsi14 = _rsi(close, 14)
    macd, macd_signal = _macd(close)
    std20 = close.rolling(20).std()
    bb_upper = ma20 + 2 * std20
    bb_lower = ma20 - 2 * std20
    atr14 = _atr(df, 14)

    # 가장 최근 값(마지막 행)을 꺼냅니다. NaN 이면 None 으로.
    def last(series: pd.Series):
        val = series.iloc[-1] if len(series) else np.nan
        return None if pd.isna(val) else round(float(val), 4)

    result["indicators"] = {
        "ma5": last(ma5),
        "ma20": last(ma20),
        "ma60": last(ma60),
        "rsi14": last(rsi14),
        "macd": last(macd),
        "macd_signal": last(macd_signal),
        "bb_upper": last(bb_upper),
        "bb_lower": last(bb_lower),
        "atr14": last(atr14),
        "close": last(close),
    }

    # 데이터 60개 미만이면 경고만 남기고 계속 진행
    if len(df) < 60:
        result["warning"] = (
            f"가격 데이터가 {len(df)}개로 60개 미만입니다. "
            "지표 신뢰도가 낮을 수 있습니다(분석은 계속 진행)."
        )

    # ----- 점수 산출 (0~100) -----
    ind = result["indicators"]

    # 1) 추세 점수: 정배열(MA5>MA20>MA60)일수록 높게
    trend = 50.0
    if ind["ma5"] and ind["ma20"] and ind["ma60"]:
        if ind["ma5"] > ind["ma20"] > ind["ma60"]:
            trend = 80.0
        elif ind["ma5"] > ind["ma20"]:
            trend = 65.0
        elif ind["ma5"] < ind["ma20"] < ind["ma60"]:
            trend = 25.0
        else:
            trend = 45.0

    # 2) 모멘텀 점수: RSI 와 MACD 로 판단
    momentum = 50.0
    if ind["rsi14"] is not None:
        r = ind["rsi14"]
        if r >= 70:
            momentum = 60.0      # 과열이지만 강세
        elif r >= 55:
            momentum = 70.0
        elif r >= 45:
            momentum = 50.0
        elif r >= 30:
            momentum = 40.0
        else:
            momentum = 35.0      # 과매도
    if ind["macd"] is not None and ind["macd_signal"] is not None:
        if ind["macd"] > ind["macd_signal"]:
            momentum = min(100.0, momentum + 10.0)
        else:
            momentum = max(0.0, momentum - 10.0)

    # 3) 변동성 점수: ATR 비율이 낮을수록(안정적일수록) 높은 점수
    volatility = 50.0
    if ind["atr14"] and ind["close"]:
        atr_ratio = ind["atr14"] / ind["close"]  # 종가 대비 변동폭 비율
        if atr_ratio < 0.015:
            volatility = 75.0
        elif atr_ratio < 0.03:
            volatility = 60.0
        elif atr_ratio < 0.05:
            volatility = 45.0
        else:
            volatility = 30.0

    # 종합 기술 점수: 추세 50% + 모멘텀 30% + 변동성 20%
    technical_score = trend * 0.5 + momentum * 0.3 + volatility * 0.2

    result["trend_score"] = round(trend, 2)
    result["momentum_score"] = round(momentum, 2)
    result["volatility_score"] = round(volatility, 2)
    result["technical_score"] = round(technical_score, 2)
    return result

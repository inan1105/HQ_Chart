"""
test_koscom_normalize.py
------------------------
코스콤 응답 정규화(Adapter) 로직 단위 테스트. 외부 호출 없음.
"""

from app.collectors.koscom_collector import (
    KoscomClient,
    _to_iso_date,
)


def test_to_iso_date_variants():
    """다양한 날짜 형식이 YYYY-MM-DD 로 통일되는지 확인."""
    assert _to_iso_date("20240102") == "2024-01-02"
    assert _to_iso_date("2024.01.02") == "2024-01-02"
    assert _to_iso_date("2024/01/02") == "2024-01-02"
    assert _to_iso_date("2024-01-02") == "2024-01-02"
    # 비정상/빈 값은 원본 유지
    assert _to_iso_date("") == ""
    assert _to_iso_date(None) is None


def test_normalize_ohlcv_response():
    """코스콤 필드명이 우리 표준 필드로 매핑되는지 확인."""
    raw = {
        "output": [
            {"trd_dd": "20240102", "opnprc": 100, "hgprc": 110,
             "lwprc": 95, "clsprc": 105, "trqu": 12345},
        ]
    }
    rows = KoscomClient.normalize_ohlcv_response(raw)
    assert len(rows) == 1
    r = rows[0]
    assert r["trade_date"] == "2024-01-02"
    assert r["open"] == 100
    assert r["high"] == 110
    assert r["low"] == 95
    assert r["close"] == 105
    assert r["volume"] == 12345


def test_normalize_flow_response():
    """수급 응답 매핑 확인 + 다른 래핑 키(data)도 인식하는지 확인."""
    raw = {
        "data": [
            {"trd_dd": "20240103", "frgn_ntby": 1000,
             "orgn_ntby": -500, "indv_ntby": -500},
        ]
    }
    rows = KoscomClient.normalize_flow_response(raw)
    assert len(rows) == 1
    r = rows[0]
    assert r["trade_date"] == "2024-01-03"
    assert r["foreign_net"] == 1000
    assert r["institution_net"] == -500
    assert r["individual_net"] == -500


def test_normalize_empty_response():
    """빈/None 응답은 빈 리스트를 반환해야 한다."""
    assert KoscomClient.normalize_ohlcv_response({}) == []
    assert KoscomClient.normalize_flow_response({}) == []
    assert KoscomClient.normalize_ohlcv_response(None) == []

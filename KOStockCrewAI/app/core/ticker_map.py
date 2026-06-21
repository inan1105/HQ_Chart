"""
ticker_map.py
-------------
종목명 ↔ 종목코드 변환을 돕는 모듈입니다.

- 자주 찾는 한국 주요 종목의 내장 사전을 제공합니다(오프라인/샘플 모드용).
- 더 폭넓은 변환은 DART corp 매핑(키 필요) 또는 DB(stocks 테이블)에서 보완합니다.
"""

from __future__ import annotations

from typing import Optional

# 자주 쓰는 종목명 → 코드 (필요 시 자유롭게 추가하세요)
NAME_TO_CODE = {
    "삼성전자": "005930",
    "삼성전자우": "005935",
    "sk하이닉스": "000660",
    "하이닉스": "000660",
    "네이버": "035420",
    "naver": "035420",
    "카카오": "035720",
    "lg화학": "051910",
    "현대차": "005380",
    "현대자동차": "005380",
    "기아": "000270",
    "기아차": "000270",
    "포스코홀딩스": "005490",
    "삼성바이오로직스": "207940",
    "셀트리온": "068270",
    "삼성sdi": "006400",
    "lg에너지솔루션": "373220",
    "kb금융": "105560",
    "신한지주": "055550",
    "현대모비스": "012330",
    "삼성물산": "028260",
}

# 코드 → 이름(역방향)
CODE_TO_NAME = {code: name for name, code in NAME_TO_CODE.items()}


def normalize_name(name: str) -> str:
    """비교를 위해 공백 제거 + 소문자화."""
    return (name or "").strip().replace(" ", "").lower()


def builtin_name_to_code(name: str) -> Optional[str]:
    """내장 사전에서 종목명으로 코드를 찾습니다(없으면 None)."""
    return NAME_TO_CODE.get(normalize_name(name))

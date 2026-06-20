"""
koscom_collector.py
-------------------
코스콤(Koscom) API 에서 OHLCV(시세)와 투자자 수급 데이터를 수집합니다.

※ 매우 중요 ※
코스콤 API 는 '계약별로 명세(엔드포인트, 필드명, 인증방식)가 다릅니다'.
그래서 이 파일은 Adapter 구조로 작성되어 있습니다:
- 실제 응답 필드명이 다르면 상단의 mapping dict 만 수정하면 됩니다.
- base_url / 인증방식은 .env 에서 읽습니다.

※ 호출 제한 / 재배포 범위 주의 ※
코스콤 데이터는 계약 범위 밖 재배포가 제한될 수 있습니다.
호출 빈도 제한(rate limit)과 데이터 재사용 범위를 반드시 계약서로 확인하세요.
"""

from __future__ import annotations

from typing import Any, Dict, List

import requests

from app.core.config import settings, is_key_set, missing_key_message
from app.core.logging import logger


# ------------------------------------------------------------------
# [Adapter 포인트] 코스콤 실제 응답 필드명 -> 우리 내부 표준 필드명 매핑
# 실제 계약 명세서를 보고 좌측 값(코스콤 필드)을 수정하세요.
# ------------------------------------------------------------------
OHLCV_FIELD_MAP = {
    # 코스콤 응답 필드명 : 우리 표준 필드명
    "trd_dd": "trade_date",   # 거래일
    "opnprc": "open",         # 시가
    "hgprc": "high",          # 고가
    "lwprc": "low",           # 저가
    "clsprc": "close",        # 종가
    "trqu": "volume",         # 거래량
}

FLOW_FIELD_MAP = {
    "trd_dd": "trade_date",       # 거래일
    "frgn_ntby": "foreign_net",   # 외국인 순매수
    "orgn_ntby": "institution_net",  # 기관 순매수
    "indv_ntby": "individual_net",   # 개인 순매수
}


class KoscomClient:
    """코스콤 API 호출을 담당하는 클라이언트입니다."""

    def __init__(self) -> None:
        # base_url 과 인증방식을 .env 에서 읽어옵니다.
        self.base_url = (settings.KOSCOM_BASE_URL or "").rstrip("/")
        self.api_key = settings.KOSCOM_API_KEY
        self.auth_type = (settings.KOSCOM_AUTH_TYPE or "bearer").lower()

    # ----- 내부 도우미 -----
    def _headers(self) -> Dict[str, str]:
        """
        인증 헤더를 만듭니다.
        KOSCOM_AUTH_TYPE 값에 따라 bearer 또는 x-api-key 방식을 사용합니다.
        """
        if self.auth_type == "x-api-key":
            return {"x-api-key": self.api_key}
        # 기본은 bearer 토큰 방식
        return {"Authorization": f"Bearer {self.api_key}"}

    def _ready(self) -> bool:
        """API 호출이 가능한 상태인지(키/주소 설정 여부) 확인합니다."""
        problems = []
        if not is_key_set("KOSCOM_API_KEY"):
            problems.append(missing_key_message("KOSCOM_API_KEY"))
        if not is_key_set("KOSCOM_BASE_URL"):
            problems.append(missing_key_message("KOSCOM_BASE_URL"))
        if problems:
            for p in problems:
                logger.warning(p)
            return False
        return True

    def _get(self, path: str, params: Dict[str, Any]) -> Dict[str, Any]:
        """
        실제 GET 요청을 보냅니다. (Adapter: 경로/파라미터는 계약 명세에 맞게 수정)
        """
        url = f"{self.base_url}/{path.lstrip('/')}"
        try:
            resp = requests.get(url, headers=self._headers(), params=params, timeout=30)
            if resp.status_code == 401:
                logger.error("[Koscom] 401 인증 실패. API Key/인증방식(KOSCOM_AUTH_TYPE)을 확인하세요.")
                return {}
            resp.raise_for_status()
            return resp.json()
        except requests.RequestException as exc:
            logger.error(f"[Koscom] 요청 실패: {exc}")
            return {}
        except ValueError:
            logger.error("[Koscom] 응답을 JSON 으로 해석할 수 없습니다.")
            return {}

    # ----- 공개 메서드 -----
    def get_ohlcv(self, ticker: str, start_date: str, end_date: str) -> List[Dict[str, Any]]:
        """
        일별 시세(OHLCV)를 조회합니다.
        날짜 형식은 'YYYYMMDD' 를 기본 가정합니다(계약에 맞게 수정).
        """
        if not self._ready():
            return []
        # [Adapter] 실제 엔드포인트 경로/파라미터명을 계약서에 맞게 수정하세요.
        raw = self._get(
            "marketdata/ohlcv",
            {"isin": ticker, "startDate": start_date, "endDate": end_date},
        )
        return self.normalize_ohlcv_response(raw)

    def get_investor_flow(self, ticker: str, start_date: str, end_date: str) -> List[Dict[str, Any]]:
        """투자자별 수급 데이터를 조회합니다."""
        if not self._ready():
            return []
        # [Adapter] 실제 엔드포인트 경로/파라미터명을 계약서에 맞게 수정하세요.
        raw = self._get(
            "marketdata/investor",
            {"isin": ticker, "startDate": start_date, "endDate": end_date},
        )
        return self.normalize_flow_response(raw)

    # ----- 정규화(normalize) 함수: 코스콤 필드 -> 우리 표준 필드 -----
    @staticmethod
    def _extract_rows(raw: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        응답 안에서 실제 데이터 리스트를 찾아냅니다.
        코스콤 응답 구조가 다양할 수 있어 흔한 키들을 차례로 시도합니다.
        """
        if not raw:
            return []
        for key in ("output", "data", "list", "items", "rows", "result"):
            value = raw.get(key)
            if isinstance(value, list):
                return value
        # 최상위가 곧바로 리스트인 경우
        if isinstance(raw, list):
            return raw
        return []

    @classmethod
    def normalize_ohlcv_response(cls, raw: Dict[str, Any]) -> List[Dict[str, Any]]:
        """코스콤 OHLCV 응답을 우리 표준 형태로 변환합니다."""
        rows = cls._extract_rows(raw)
        normalized: List[Dict[str, Any]] = []
        for item in rows:
            record: Dict[str, Any] = {}
            for koscom_field, std_field in OHLCV_FIELD_MAP.items():
                record[std_field] = item.get(koscom_field)
            # 날짜 형식 정리 (YYYYMMDD -> YYYY-MM-DD)
            record["trade_date"] = _to_iso_date(record.get("trade_date"))
            normalized.append(record)
        return normalized

    @classmethod
    def normalize_flow_response(cls, raw: Dict[str, Any]) -> List[Dict[str, Any]]:
        """코스콤 수급 응답을 우리 표준 형태로 변환합니다."""
        rows = cls._extract_rows(raw)
        normalized: List[Dict[str, Any]] = []
        for item in rows:
            record: Dict[str, Any] = {}
            for koscom_field, std_field in FLOW_FIELD_MAP.items():
                record[std_field] = item.get(koscom_field)
            record["trade_date"] = _to_iso_date(record.get("trade_date"))
            normalized.append(record)
        return normalized


def _to_iso_date(value: Any) -> Any:
    """
    'YYYYMMDD' 또는 'YYYY-MM-DD' 를 'YYYY-MM-DD' 로 통일합니다.
    값이 비정상이면 원본을 그대로 돌려줍니다.
    """
    if not value:
        return value
    s = str(value).strip().replace(".", "-").replace("/", "-")
    if len(s) == 8 and s.isdigit():
        return f"{s[0:4]}-{s[4:6]}-{s[6:8]}"
    return s

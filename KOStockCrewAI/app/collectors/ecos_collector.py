"""
ecos_collector.py
-----------------
한국은행 ECOS(경제통계시스템) 에서 거시지표를 수집합니다.

- StatisticSearch API 를 호출합니다.
- 통계표코드(stat_code)와 항목코드(item_code)는 config(.env)에서 읽습니다.

※ 매우 중요 ※
ECOS 의 통계표/항목 코드, 주기(D/M/Q/A) 등은 통계마다 다릅니다.
실제 운영 전에 ECOS 사이트(https://ecos.bok.or.kr)에서
원하는 통계의 코드/주기를 반드시 직접 확인하세요.
아래 기준금리 예시는 코드가 바뀌었을 수 있습니다.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

import requests

from app.core.config import settings, is_key_set, missing_key_message
from app.core.logging import logger

# ECOS API 기본 주소. 형식:
# https://ecos.bok.or.kr/api/{서비스}/{인증키}/{요청타입}/{언어}/{시작}/{끝}/{통계표}/{주기}/{시작일}/{종료일}/{항목코드}
_ECOS_BASE = "https://ecos.bok.or.kr/api"


def fetch_statistic_search(
    stat_code: str,
    cycle: str,
    start_period: str,
    end_period: str,
    item_code: Optional[str] = None,
    start_row: int = 1,
    end_row: int = 100,
) -> List[Dict[str, Any]]:
    """
    ECOS StatisticSearch 를 호출하여 통계 데이터를 가져옵니다.

    매개변수:
        stat_code:   통계표코드 (예: 기준금리 722Y001)
        cycle:       주기. D(일) M(월) Q(분기) A(연)
        start_period/end_period: 조회 기간.
            주기에 맞춰 형식이 다릅니다. (월='YYYYMM', 일='YYYYMMDD', 연='YYYY')
        item_code:   항목코드 (예: 0101000)

    반환:
        ECOS 가 주는 row 리스트. 오류/키 누락 시 빈 리스트.
    """
    if not is_key_set("ECOS_API_KEY"):
        logger.warning(missing_key_message("ECOS_API_KEY"))
        return []

    # URL 경로를 순서대로 구성합니다.
    parts = [
        _ECOS_BASE,
        "StatisticSearch",
        settings.ECOS_API_KEY,
        "json",
        "kr",
        str(start_row),
        str(end_row),
        stat_code,
        cycle,
        start_period,
        end_period,
    ]
    if item_code:
        parts.append(item_code)
    url = "/".join(parts)

    try:
        resp = requests.get(url, timeout=30)
        resp.raise_for_status()
        data = resp.json()
    except requests.RequestException as exc:
        logger.error(f"[ECOS] 요청 실패: {exc}")
        return []
    except ValueError:
        logger.error("[ECOS] 응답을 JSON 으로 해석할 수 없습니다.")
        return []

    # ECOS 오류 응답 처리
    if "RESULT" in data:
        result = data["RESULT"]
        logger.error(
            f"[ECOS] 응답 오류 code={result.get('CODE')}, message={result.get('MESSAGE')}"
        )
        return []

    try:
        rows = data["StatisticSearch"]["row"]
    except (KeyError, TypeError):
        logger.warning("[ECOS] 결과 데이터가 비어 있습니다.")
        return []

    logger.info(f"[ECOS] {stat_code} {len(rows)}건 조회")
    return rows


def fetch_base_rate(start_period: str, end_period: str) -> List[Dict[str, Any]]:
    """
    기준금리 예시 함수.
    통계표코드/항목코드는 config(.env)의 ECOS_BASE_RATE_STAT_CODE / _ITEM_CODE 값을 사용합니다.

    ※ 운영 전 코드 확인 필요 ※
    기준금리는 보통 월(M) 주기로 제공됩니다(예: '202401' 형태).
    실제 통계의 주기/코드를 ECOS 사이트에서 확인 후 사용하세요.
    """
    return fetch_statistic_search(
        stat_code=settings.ECOS_BASE_RATE_STAT_CODE,
        cycle="M",  # 월 주기 가정. 실제 통계 주기를 확인하세요.
        start_period=start_period,
        end_period=end_period,
        item_code=settings.ECOS_BASE_RATE_ITEM_CODE,
    )

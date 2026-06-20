"""
dart_collector.py
-----------------
OpenDART(전자공시) 에서 재무정보를 수집합니다.

핵심 흐름:
1) corpCode.xml 을 다운로드하여 종목코드 ↔ corp_code 매핑을 얻는다.
2) 종목코드로 corp_code 를 찾는다.
3) 단일회사 주요계정(fnlttSinglAcnt) API 로 재무 주요계정을 조회한다.

주의:
- 실제 DART_API_KEY 가 필요합니다(.env).
- 키가 없으면 친절한 안내 메시지를 출력하고 빈 결과를 반환합니다(앱은 죽지 않음).
"""

from __future__ import annotations

import io
import zipfile
import xml.etree.ElementTree as ET
from typing import Dict, List, Optional

import requests

from app.core.config import settings, is_key_set, missing_key_message
from app.core.logging import logger

# DART API 엔드포인트
_CORP_CODE_URL = "https://opendart.fss.or.kr/api/corpCode.xml"
_SINGLE_ACNT_URL = "https://opendart.fss.or.kr/api/fnlttSinglAcnt.json"

# corp_code 매핑을 매번 다운로드하지 않도록 메모리에 캐시합니다.
_CORP_MAP_CACHE: Optional[Dict[str, Dict[str, str]]] = None


def download_corp_code_map() -> Dict[str, Dict[str, str]]:
    """
    DART corpCode.xml(zip)을 내려받아 {종목코드: {corp_code, corp_name}} 형태로 만듭니다.

    - DART 는 zip 파일 안에 CORPCODE.xml 을 담아 줍니다.
    - stock_code 가 비어있는(비상장) 회사는 제외합니다.
    """
    global _CORP_MAP_CACHE
    if _CORP_MAP_CACHE is not None:
        return _CORP_MAP_CACHE

    if not is_key_set("DART_API_KEY"):
        logger.warning(missing_key_message("DART_API_KEY"))
        return {}

    try:
        resp = requests.get(
            _CORP_CODE_URL,
            params={"crtfc_key": settings.DART_API_KEY},
            timeout=30,
        )
        resp.raise_for_status()
    except requests.RequestException as exc:
        logger.error(f"[DART] corpCode 다운로드 실패: {exc}")
        return {}

    # 응답이 zip 이 아닌 경우(보통 키 오류 시 XML 에러 메시지가 옴)를 처리
    try:
        zf = zipfile.ZipFile(io.BytesIO(resp.content))
        xml_bytes = zf.read("CORPCODE.xml")
    except zipfile.BadZipFile:
        logger.error(
            "[DART] corpCode 응답이 zip 이 아닙니다. DART_API_KEY 가 올바른지 확인하세요.\n"
            f"응답 일부: {resp.text[:200]}"
        )
        return {}

    root = ET.fromstring(xml_bytes)
    mapping: Dict[str, Dict[str, str]] = {}
    for item in root.iter("list"):
        stock_code = (item.findtext("stock_code") or "").strip()
        corp_code = (item.findtext("corp_code") or "").strip()
        corp_name = (item.findtext("corp_name") or "").strip()
        if stock_code:  # 상장사만
            mapping[stock_code] = {"corp_code": corp_code, "corp_name": corp_name}

    _CORP_MAP_CACHE = mapping
    logger.info(f"[DART] corp_code 매핑 {len(mapping)}건 로드 완료")
    return mapping


def find_corp_code(ticker: str) -> Optional[Dict[str, str]]:
    """
    종목코드(예: '005930')로 corp_code 와 corp_name 을 찾습니다.
    찾지 못하면 None 을 반환합니다.
    """
    ticker = ticker.strip().zfill(6)  # 6자리로 맞춤 (예: '5930' -> '005930')
    mapping = download_corp_code_map()
    return mapping.get(ticker)


def get_single_company_accounts(
    ticker: str,
    fiscal_year: str,
    report_code: str = "11011",
) -> List[Dict[str, str]]:
    """
    단일회사 주요계정을 조회합니다.

    매개변수:
        ticker: 종목코드 (예: '005930')
        fiscal_year: 사업연도 (예: '2023')
        report_code: 보고서코드
            11011=사업보고서, 11012=반기, 11013=1분기, 11014=3분기

    반환:
        [{"account_name": "매출액", "amount": "...", ...}, ...]
        오류/키 누락 시 빈 리스트.
    """
    if not is_key_set("DART_API_KEY"):
        logger.warning(missing_key_message("DART_API_KEY"))
        return []

    found = find_corp_code(ticker)
    if not found:
        logger.error(f"[DART] 종목코드 {ticker} 의 corp_code 를 찾지 못했습니다.")
        return []

    try:
        resp = requests.get(
            _SINGLE_ACNT_URL,
            params={
                "crtfc_key": settings.DART_API_KEY,
                "corp_code": found["corp_code"],
                "bsns_year": fiscal_year,
                "reprt_code": report_code,
            },
            timeout=30,
        )
        resp.raise_for_status()
        data = resp.json()
    except requests.RequestException as exc:
        logger.error(f"[DART] 재무 조회 요청 실패: {exc}")
        return []
    except ValueError:
        logger.error("[DART] 재무 응답을 JSON 으로 해석할 수 없습니다.")
        return []

    # DART 응답에는 status/message 가 들어옵니다. 000 이 정상입니다.
    status = data.get("status")
    message = data.get("message")
    if status != "000":
        logger.error(f"[DART] 응답 오류 status={status}, message={message}")
        return []

    rows: List[Dict[str, str]] = []
    for item in data.get("list", []):
        # 금액 문자열에서 콤마 제거
        amount_raw = (item.get("thstrm_amount") or "").replace(",", "").strip()
        try:
            amount = float(amount_raw) if amount_raw and amount_raw != "-" else None
        except ValueError:
            amount = None
        rows.append(
            {
                "fiscal_year": fiscal_year,
                "report_code": report_code,
                "account_name": item.get("account_nm", ""),
                "amount": amount,
            }
        )
    logger.info(f"[DART] {ticker} {fiscal_year} 주요계정 {len(rows)}건 조회")
    return rows

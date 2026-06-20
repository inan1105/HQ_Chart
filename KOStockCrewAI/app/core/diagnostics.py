"""
diagnostics.py
--------------
실제 API Key 연동 상태를 '점검'하는 도구입니다.

- 각 서비스(OpenAI/DART/ECOS/코스콤/DB)의 키 설정 여부를 확인합니다.
- live=True 이면 가벼운 실제 호출(ping)을 시도해 연결 가능 여부까지 확인합니다.
- 어떤 경우에도 예외로 죽지 않고, 사람이 읽기 좋은 상태 메시지를 돌려줍니다.

사용:
  - 코드:   from app.core.diagnostics import diagnose; diagnose(live=True)
  - API :   GET /diagnostics?live=true
  - CLI :   python -m app.core.diagnostics
"""

from __future__ import annotations

from datetime import date, timedelta
from typing import Any, Dict

from app.core.config import is_key_set
from app.core.logging import logger


def _status(configured: bool, ok: bool | None, detail: str) -> Dict[str, Any]:
    """한 서비스의 점검 결과를 표준 형태로 만듭니다."""
    return {"configured": configured, "reachable": ok, "detail": detail}


def _check_openai(live: bool) -> Dict[str, Any]:
    """OpenAI 키 설정 여부 확인(비용 방지를 위해 기본은 호출하지 않음)."""
    if not is_key_set("OPENAI_API_KEY"):
        return _status(False, None, "키 미설정 — mock 브리프로 동작합니다.")
    if not live:
        return _status(True, None, "키 설정됨(실호출 생략).")
    try:
        # 가장 가벼운 호출: 모델 목록 조회
        from openai import OpenAI

        client = OpenAI()
        client.models.list()
        return _status(True, True, "OpenAI 연결 정상.")
    except Exception as exc:
        return _status(True, False, f"연결 실패: {exc}")


def _check_dart(live: bool) -> Dict[str, Any]:
    """DART 키 확인 + (live) corpCode 매핑 다운로드 시도."""
    if not is_key_set("DART_API_KEY"):
        return _status(False, None, "키 미설정 — 재무 수집 불가.")
    if not live:
        return _status(True, None, "키 설정됨(실호출 생략).")
    try:
        from app.collectors.dart_collector import download_corp_code_map

        mapping = download_corp_code_map()
        if mapping:
            return _status(True, True, f"DART 정상 — corp_code {len(mapping)}건 확인.")
        return _status(True, False, "응답이 비어 있음 — 키/권한 확인 필요.")
    except Exception as exc:
        return _status(True, False, f"연결 실패: {exc}")


def _check_ecos(live: bool) -> Dict[str, Any]:
    """ECOS 키 확인 + (live) 최근 1개월 기준금리 조회 시도."""
    if not is_key_set("ECOS_API_KEY"):
        return _status(False, None, "키 미설정 — 거시 수집 불가.")
    if not live:
        return _status(True, None, "키 설정됨(실호출 생략).")
    try:
        from app.collectors.ecos_collector import fetch_base_rate

        today = date.today()
        period = today.strftime("%Y%m")
        rows = fetch_base_rate(period, period)
        if rows:
            return _status(True, True, f"ECOS 정상 — {len(rows)}건 수신.")
        return _status(True, False, "응답이 비어 있음 — 통계표/항목 코드 확인 필요.")
    except Exception as exc:
        return _status(True, False, f"연결 실패: {exc}")


def _check_koscom(live: bool) -> Dict[str, Any]:
    """코스콤 키/URL 확인 + (live) 최근 5일 시세 조회 시도."""
    if not (is_key_set("KOSCOM_API_KEY") and is_key_set("KOSCOM_BASE_URL")):
        return _status(False, None, "키 또는 BASE_URL 미설정 — 시세/수급 수집 불가.")
    if not live:
        return _status(True, None, "키/URL 설정됨(실호출 생략).")
    try:
        from app.collectors.koscom_collector import KoscomClient

        client = KoscomClient()
        today = date.today()
        start = (today - timedelta(days=5)).strftime("%Y%m%d")
        end = today.strftime("%Y%m%d")
        rows = client.get_ohlcv("005930", start, end)
        if rows:
            return _status(True, True, f"코스콤 정상 — {len(rows)}건 수신.")
        return _status(
            True, False,
            "응답이 비어 있음 — 엔드포인트/필드 매핑(koscom_collector mapping) 확인 필요.",
        )
    except Exception as exc:
        return _status(True, False, f"연결 실패: {exc}")


def _check_db() -> Dict[str, Any]:
    """데이터베이스 연결 가능 여부 확인."""
    try:
        from app.db.database import check_connection

        ok = check_connection()
        return _status(True, ok, "DB 연결 정상." if ok else "DB 연결 실패 — DATABASE_URL/PostgreSQL 확인.")
    except Exception as exc:
        return _status(True, False, f"DB 점검 실패: {exc}")


def diagnose(live: bool = False) -> Dict[str, Any]:
    """
    전체 서비스 점검 결과를 dict 로 반환합니다.

    매개변수:
        live: True 이면 실제 호출(ping)까지 수행. False(기본)는 키 설정 여부만 확인.
    """
    return {
        "live_check": live,
        "services": {
            "openai": _check_openai(live),
            "dart": _check_dart(live),
            "ecos": _check_ecos(live),
            "koscom": _check_koscom(live),
            "database": _check_db(),
        },
        "note": "configured=키설정여부, reachable=실연결여부(null=미확인). 키가 없어도 샘플로 동작합니다.",
    }


def main() -> None:
    """CLI 로 점검 결과를 보기 좋게 출력합니다."""
    print("=" * 56)
    print(" KOStockCrewAI 연동 점검 (live 호출 포함)")
    print("=" * 56)
    result = diagnose(live=True)
    for name, st in result["services"].items():
        mark = "✅" if st["reachable"] else ("⚠️ " if st["configured"] else "⛔")
        print(f"{mark} {name:9s} | {st['detail']}")
    print("-" * 56)
    print("※ 키가 없어도 /sample/load → /report 샘플 흐름은 동작합니다.")


if __name__ == "__main__":
    main()

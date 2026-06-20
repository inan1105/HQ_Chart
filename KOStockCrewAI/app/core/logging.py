"""
logging.py
----------
앱 전체에서 같은 방식으로 로그를 남기기 위한 설정입니다.
loguru 가 설치되어 있으면 loguru 를, 없으면 표준 logging 을 사용합니다.
"""

from __future__ import annotations

import os
import sys

# logs 폴더가 없으면 만들어 둡니다.
os.makedirs("logs", exist_ok=True)

try:
    # loguru 는 사용하기 쉬운 로깅 라이브러리입니다.
    from loguru import logger as _logger

    # 기본 출력 설정을 지우고 우리가 원하는 형식으로 다시 설정합니다.
    _logger.remove()
    _logger.add(
        sys.stderr,
        level="INFO",
        format="<green>{time:YYYY-MM-DD HH:mm:ss}</green> | <level>{level: <8}</level> | {message}",
    )
    # 파일에도 로그를 남깁니다(하루 단위 회전, 7일 보관).
    _logger.add(
        "logs/app.log",
        level="INFO",
        rotation="1 day",
        retention="7 days",
        encoding="utf-8",
    )

    def get_logger():
        """앱에서 사용할 로거를 반환합니다."""
        return _logger

except Exception:  # loguru 가 없거나 설정 실패 시 표준 logging 으로 대체
    import logging

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s | %(levelname)-8s | %(message)s",
    )

    def get_logger():
        """표준 logging 로거를 반환합니다(대체 경로)."""
        return logging.getLogger("kostockcrewai")


# 공용 로거 인스턴스
logger = get_logger()

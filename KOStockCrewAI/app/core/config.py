"""
config.py
---------
앱 전체에서 사용하는 설정값(환경변수)을 한 곳에서 관리합니다.

- pydantic-settings 를 사용하여 .env 파일의 값을 자동으로 읽습니다.
- 실제 API Key 는 코드에 직접 쓰지 않고 .env 에서만 읽습니다.
- API Key 가 비어 있어도 앱이 죽지 않도록, 검사용 helper 함수를 제공합니다.
"""

from __future__ import annotations

from functools import lru_cache
from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """모든 환경변수를 담는 설정 클래스입니다."""

    # pydantic-settings 동작 방식 정의
    model_config = SettingsConfigDict(
        env_file=".env",            # .env 파일에서 값을 읽음
        env_file_encoding="utf-8",
        case_sensitive=False,        # 대소문자 구분 안 함
        extra="ignore",             # .env 에 정의되지 않은 추가 값은 무시
    )

    # --- OpenAI ---
    OPENAI_API_KEY: str = ""
    # GPT 모델명. 필요 시 여기만 바꾸면 됩니다.
    OPENAI_MODEL: str = "gpt-5-mini"

    # --- DART ---
    DART_API_KEY: str = ""

    # --- ECOS ---
    ECOS_API_KEY: str = ""
    ECOS_BASE_RATE_STAT_CODE: str = "722Y001"
    ECOS_BASE_RATE_ITEM_CODE: str = "0101000"

    # --- 코스콤 ---
    KOSCOM_API_KEY: str = ""
    KOSCOM_BASE_URL: str = ""
    KOSCOM_AUTH_TYPE: str = "bearer"  # bearer 또는 x-api-key

    # --- 데이터베이스 ---
    DATABASE_URL: str = (
        "postgresql+psycopg2://postgres:postgres@localhost:5432/kostockcrewai"
    )

    # --- Telegram ---
    TELEGRAM_BOT_TOKEN: str = ""
    TELEGRAM_CHAT_ID: str = ""

    # --- 리포트 저장 폴더 ---
    REPORT_DIR: str = "reports"


@lru_cache
def get_settings() -> Settings:
    """
    설정 객체를 한 번만 생성해서 재사용합니다(캐시).
    어디서든 `from app.core.config import get_settings` 로 불러 쓰세요.
    """
    return Settings()


# 모듈 어디서나 간단히 import 할 수 있도록 전역 인스턴스도 제공합니다.
settings = get_settings()


# ------------------------------------------------------------------
# 아래는 "API Key 누락"을 사용자 친화적으로 안내하기 위한 helper 들입니다.
# ------------------------------------------------------------------

# 키 이름 -> 사람이 읽기 좋은 설명
_KEY_GUIDE = {
    "OPENAI_API_KEY": "OpenAI API Key (GPT 브리프 생성에 필요). https://platform.openai.com 에서 발급",
    "DART_API_KEY": "DART API Key (재무정보 수집에 필요). https://opendart.fss.or.kr 에서 발급",
    "ECOS_API_KEY": "ECOS API Key (거시지표 수집에 필요). https://ecos.bok.or.kr 에서 발급",
    "KOSCOM_API_KEY": "코스콤 API Key (시세/수급 수집에 필요). 코스콤 계약 후 발급",
    "KOSCOM_BASE_URL": "코스콤 API 기본 주소(Base URL). 계약 명세서 참고",
    "DATABASE_URL": "PostgreSQL 접속 주소",
    "TELEGRAM_BOT_TOKEN": "Telegram 봇 토큰. @BotFather 에서 발급",
}


def is_key_set(key_name: str) -> bool:
    """
    주어진 환경변수가 비어 있지 않은지(=설정되었는지) 확인합니다.
    예시값(_here, your_, 123456789 등)을 그대로 둔 경우도 '미설정'으로 봅니다.
    """
    value = getattr(settings, key_name, "") or ""
    value = value.strip()
    if not value:
        return False
    # .env.example 의 예시 placeholder 가 그대로면 미설정으로 간주
    placeholders = ["your_", "_here", "your-koscom", "123456789:"]
    lowered = value.lower()
    return not any(p in lowered for p in placeholders)


def missing_key_message(key_name: str) -> str:
    """
    누락된 키에 대해 비개발자도 이해할 수 있는 안내 문구를 만들어 줍니다.
    """
    guide = _KEY_GUIDE.get(key_name, f"{key_name} 값")
    return (
        f"[설정 필요] '{key_name}' 값이 비어 있거나 예시값 그대로입니다.\n"
        f"  → {guide}\n"
        f"  → 프로젝트 폴더의 .env 파일을 열어 실제 값을 입력한 뒤 다시 실행하세요."
    )


def require_keys(*key_names: str) -> List[str]:
    """
    여러 키가 설정되어 있는지 확인하고, 누락된 키들의 안내 메시지 목록을 반환합니다.
    반환 목록이 비어 있으면 모두 정상 설정된 것입니다.
    """
    problems: List[str] = []
    for name in key_names:
        if not is_key_set(name):
            problems.append(missing_key_message(name))
    return problems


# ------------------------------------------------------------------
# 런타임에 키/설정을 등록·수정하기 위한 함수들.
# (Streamlit '키 설정' 화면에서 사용 — 입력값은 .env 에 저장되고
#  실행 중인 설정 객체에도 즉시 반영되어 재시작 없이 적용됩니다.)
# ------------------------------------------------------------------

# UI 에서 등록/수정 가능한 설정 키 목록(민감/비민감 구분)
EDITABLE_SECRET_KEYS = [
    "OPENAI_API_KEY",
    "DART_API_KEY",
    "ECOS_API_KEY",
    "KOSCOM_API_KEY",
]
EDITABLE_PLAIN_KEYS = [
    "KOSCOM_BASE_URL",
    "KOSCOM_AUTH_TYPE",
    "OPENAI_MODEL",
    "ECOS_BASE_RATE_STAT_CODE",
    "ECOS_BASE_RATE_ITEM_CODE",
]

_ENV_PATH = ".env"


def _persist_env(values: dict) -> None:
    """
    제공된 키들을 .env 파일에 병합 저장합니다(기존 내용 보존).
    값이 비어 있는 항목은 건드리지 않습니다.
    """
    import os

    existing: dict = {}
    # 기존 .env 읽기(있으면)
    if os.path.exists(_ENV_PATH):
        with open(_ENV_PATH, "r", encoding="utf-8") as f:
            for line in f:
                line = line.rstrip("\n")
                if not line or line.lstrip().startswith("#") or "=" not in line:
                    continue
                k, v = line.split("=", 1)
                existing[k.strip()] = v
    # 새 값 병합(비어있지 않은 것만)
    for k, v in values.items():
        if v is None:
            continue
        v = str(v).strip()
        if v == "":
            continue
        existing[k] = v
    # 다시 쓰기
    with open(_ENV_PATH, "w", encoding="utf-8") as f:
        f.write("# KOStockCrewAI 환경설정 (UI 또는 수동 편집으로 생성)\n")
        for k, v in existing.items():
            f.write(f"{k}={v}\n")


def update_settings(values: dict) -> dict:
    """
    설정 값을 실행 중인 settings 객체에 즉시 반영하고 .env 에 저장합니다.

    - 빈 값은 무시합니다(기존 값 유지).
    - 반환: 실제로 적용된 키 이름 -> True
    """
    applied: dict = {}
    allowed = set(EDITABLE_SECRET_KEYS + EDITABLE_PLAIN_KEYS)
    for k, v in values.items():
        if k not in allowed:
            continue
        if v is None or str(v).strip() == "":
            continue
        # 실행 중인 객체에 즉시 반영(모든 `from config import settings` 사용처가 공유)
        setattr(settings, k, str(v).strip())
        applied[k] = True
    if applied:
        _persist_env({k: getattr(settings, k) for k in applied})
    return applied


def settings_status() -> dict:
    """
    각 설정의 '설정 여부'만 반환합니다(키 값 자체는 절대 포함하지 않음).
    """
    status: dict = {}
    for k in EDITABLE_SECRET_KEYS:
        status[k] = {"configured": is_key_set(k), "secret": True}
    for k in EDITABLE_PLAIN_KEYS:
        val = getattr(settings, k, "") or ""
        status[k] = {
            "configured": is_key_set(k) if k == "KOSCOM_BASE_URL" else bool(val),
            "secret": False,
            # 비민감 값은 그대로 보여줘도 됨(키가 아님)
            "value": val if k != "KOSCOM_BASE_URL" else ("설정됨" if is_key_set(k) else ""),
        }
    return status

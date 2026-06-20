"""
test_db_url.py
--------------
DATABASE_URL 정규화 로직 테스트. DB 연결은 하지 않음(엔진 생성만).
"""

from app.db.database import _normalize_db_url


def test_legacy_postgres_scheme():
    """옛 postgres:// 스킴이 psycopg2 형식으로 바뀌어야 한다."""
    got = _normalize_db_url("postgres://u:p@h:5432/db")
    assert got == "postgresql+psycopg2://u:p@h:5432/db"


def test_standard_postgresql_scheme():
    """postgresql:// 가 psycopg2 형식으로 바뀌어야 한다."""
    got = _normalize_db_url("postgresql://u:p@h/db")
    assert got == "postgresql+psycopg2://u:p@h/db"


def test_already_has_driver():
    """이미 +psycopg2 가 있으면 그대로 둬야 한다."""
    url = "postgresql+psycopg2://u:p@h/db"
    assert _normalize_db_url(url) == url


def test_empty_url():
    """빈 문자열은 그대로 반환."""
    assert _normalize_db_url("") == ""

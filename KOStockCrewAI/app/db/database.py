"""
database.py
-----------
PostgreSQL 데이터베이스 연결을 담당합니다.
SQLAlchemy 의 engine / session 을 만들어 다른 모듈에서 사용합니다.
"""

from __future__ import annotations

from contextlib import contextmanager
from typing import Iterator

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import settings
from app.core.logging import logger

# create_engine: 실제 DB 연결을 관리하는 엔진을 만듭니다.
# pool_pre_ping=True: 연결이 끊겼는지 미리 확인해서 끊긴 연결로 인한 오류를 줄입니다.
engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
    future=True,
)

# SessionLocal: DB 와 대화(쿼리)하기 위한 세션을 만들어 주는 공장(factory)입니다.
SessionLocal = sessionmaker(
    bind=engine,
    autocommit=False,
    autoflush=False,
    future=True,
)


@contextmanager
def get_db_session() -> Iterator[Session]:
    """
    DB 세션을 안전하게 열고 닫아주는 context manager 입니다.

    사용 예:
        with get_db_session() as db:
            db.execute(...)

    - 정상 처리되면 commit
    - 오류가 나면 rollback 후 친절한 메시지와 함께 다시 raise
    - 끝나면 항상 close
    """
    db = SessionLocal()
    try:
        yield db
        db.commit()
    except Exception as exc:
        db.rollback()
        logger.error(f"[DB] 작업 중 오류가 발생하여 롤백했습니다: {exc}")
        raise RuntimeError(
            "데이터베이스 작업 중 오류가 발생했습니다. "
            "PostgreSQL 이 실행 중인지, .env 의 DATABASE_URL 이 올바른지 확인하세요."
        ) from exc
    finally:
        db.close()


def check_connection() -> bool:
    """
    DB 에 실제로 접속이 되는지 가볍게 확인합니다.
    실패해도 예외를 던지지 않고 False 를 반환하여 앱이 죽지 않게 합니다.
    """
    try:
        from sqlalchemy import text

        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return True
    except Exception as exc:
        logger.warning(f"[DB] 연결 확인 실패: {exc}")
        return False

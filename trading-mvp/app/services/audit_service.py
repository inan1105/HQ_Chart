import uuid
from datetime import datetime

from app.db import SessionLocal
from app.models import AuditLogModel


def write_audit(event_type: str, entity_id: str, status: str, message: str) -> None:
    db = SessionLocal()
    try:
        record = AuditLogModel(
            audit_id=str(uuid.uuid4()),
            event_type=event_type,
            entity_id=entity_id,
            status=status,
            message=message,
            created_at=datetime.utcnow()
        )
        db.add(record)
        db.commit()
    finally:
        db.close()

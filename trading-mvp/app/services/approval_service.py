from datetime import datetime, timedelta
import uuid

from app.db import SessionLocal
from app.models import ApprovalModel
from app.services.audit_service import write_audit


def _to_dict(record: ApprovalModel | None) -> dict | None:
    if record is None:
        return None

    return {
        "approval_id": record.approval_id,
        "ticker": record.ticker,
        "direction": record.direction,
        "decision": record.decision,
        "score": record.score,
        "qty": record.qty,
        "limit_price": record.limit_price,
        "stop_loss": record.stop_loss,
        "take_profit": record.take_profit,
        "status": record.status,
        "user_response": record.user_response,
        "created_at": record.created_at.isoformat() if record.created_at else None,
        "expires_at": record.expires_at.isoformat() if record.expires_at else None
    }


def create_approval(
    decision: dict,
    qty: int,
    limit_price: float,
    stop_loss: float,
    take_profit: float,
    timeout_seconds: int = 60
) -> dict:
    approval_id = str(uuid.uuid4())
    now = datetime.utcnow()
    expires_at = now + timedelta(seconds=timeout_seconds)

    db = SessionLocal()
    try:
        record = ApprovalModel(
            approval_id=approval_id,
            ticker=decision["ticker"],
            direction=decision["direction"],
            decision=decision["decision"],
            score=decision["score"],
            qty=qty,
            limit_price=limit_price,
            stop_loss=stop_loss,
            take_profit=take_profit,
            status="WAIT_CONFIRM",
            user_response=None,
            created_at=now,
            expires_at=expires_at
        )
        db.add(record)
        db.commit()
        db.refresh(record)

        write_audit("APPROVAL_CREATED", approval_id, "OK", "approval created")
        return _to_dict(record)
    finally:
        db.close()


def get_approval(approval_id: str) -> dict | None:
    db = SessionLocal()
    try:
        record = db.query(ApprovalModel).filter(
            ApprovalModel.approval_id == approval_id
        ).first()
        return _to_dict(record)
    finally:
        db.close()


def _set_response(approval_id: str, status: str, response: str) -> dict | None:
    db = SessionLocal()
    try:
        record = db.query(ApprovalModel).filter(
            ApprovalModel.approval_id == approval_id
        ).first()

        if not record:
            return None

        if datetime.utcnow() > record.expires_at:
            record.status = "EXPIRED"
            record.user_response = "expired"
        else:
            record.status = status
            record.user_response = response

        db.commit()
        db.refresh(record)

        write_audit("APPROVAL_RESPONSE", approval_id, record.status, response)
        return _to_dict(record)
    finally:
        db.close()


def approve(approval_id: str) -> dict | None:
    return _set_response(approval_id, "APPROVED", "approve")


def reject(approval_id: str) -> dict | None:
    return _set_response(approval_id, "REJECTED", "reject")


def review(approval_id: str) -> dict | None:
    return _set_response(approval_id, "REVIEW_REQUESTED", "review")

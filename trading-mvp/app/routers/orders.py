import uuid
from datetime import datetime

from fastapi import APIRouter

from app.adapters.mock_broker import MockBroker
from app.db import SessionLocal
from app.models import OrderModel
from app.services.audit_service import write_audit

router = APIRouter(prefix="/orders", tags=["orders"])

broker = MockBroker()


@router.post("/send")
def send_order():
    result = broker.send_order({
        "ticker": "NVDA",
        "direction": "BUY",
        "qty": 10,
        "limit_price": 150
    })

    db = SessionLocal()
    try:
        order_id = str(uuid.uuid4())
        order_record = OrderModel(
            order_id=order_id,
            ticker=result["ticker"],
            direction=result["direction"],
            qty=result["qty"],
            filled_qty=result["filled_qty"],
            limit_price=result["avg_fill_price"],
            avg_fill_price=result["avg_fill_price"],
            broker_order_id=result["broker_order_id"],
            status=result["status"],
            created_at=datetime.utcnow()
        )

        db.add(order_record)
        db.commit()

        write_audit("ORDER_SENT", result["broker_order_id"], result["status"], "mock order sent")

        return {
            "order_id": order_id,
            "broker_result": result
        }
    finally:
        db.close()

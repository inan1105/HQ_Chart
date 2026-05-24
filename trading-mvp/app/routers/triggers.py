from fastapi import APIRouter
from pydantic import BaseModel

from app.services.approval_service import create_approval
from app.services.message_builder import build_approval_message
from app.services.telegram_service import send_message
from app.services.audit_service import write_audit

router = APIRouter(prefix="/triggers", tags=["triggers"])


class PriceUpdate(BaseModel):
    ticker: str
    market: str
    current_price: float
    entry_price: float
    stop_loss: float
    take_profit: float
    qty: int


@router.post("/check")
def check_triggers(update: PriceUpdate):
    triggered = None
    direction = None

    if update.current_price <= update.stop_loss:
        triggered = "STOP_LOSS"
        direction = "SELL"
    elif update.current_price >= update.take_profit:
        triggered = "TAKE_PROFIT"
        direction = "SELL"

    if not triggered:
        return {
            "triggered": False,
            "ticker": update.ticker,
            "current_price": update.current_price,
            "message": "가격이 SL/TP 범위 내에 있습니다."
        }

    decision = {
        "ticker": update.ticker,
        "direction": direction,
        "decision": direction,
        "score": 100.0 if triggered == "STOP_LOSS" else 90.0
    }

    approval = create_approval(
        decision=decision,
        qty=update.qty,
        limit_price=update.current_price,
        stop_loss=update.stop_loss,
        take_profit=update.take_profit
    )

    telegram_result = send_message(build_approval_message(approval))

    write_audit(
        f"{triggered}_TRIGGERED",
        update.ticker,
        "SELL_SIGNAL",
        f"{triggered} at {update.current_price} (entry={update.entry_price})"
    )

    return {
        "triggered": True,
        "trigger_type": triggered,
        "ticker": update.ticker,
        "current_price": update.current_price,
        "direction": direction,
        "approval": approval,
        "telegram": telegram_result
    }

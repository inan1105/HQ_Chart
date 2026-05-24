from fastapi import APIRouter

from app.schemas.signal_schema import SignalInput, PortfolioState, UserPolicy
from app.engines.decision_engine import evaluate_decision
from app.engines.risk_engine import hard_gate
from app.services.approval_service import create_approval
from app.services.message_builder import build_approval_message
from app.services.telegram_service import send_message

router = APIRouter(prefix="/signals", tags=["signals"])


@router.post("/evaluate")
def evaluate_signal(signal: SignalInput):
    portfolio = PortfolioState(
        total_equity=50000000,
        cash=12000000,
        daily_loss_ratio=-0.005,
        monthly_loss_ratio=-0.03,
        positions=[]
    )

    policy = UserPolicy(
        max_daily_loss_ratio=0.02,
        max_monthly_loss_ratio=0.10,
        max_single_position_ratio=0.15,
        max_sector_ratio=0.35,
        min_rrr=1.80
    )

    decision = evaluate_decision(signal)
    risk = hard_gate(signal, portfolio, policy)

    approval = None
    telegram_result = None

    if decision["order_allowed"] and risk["passed"]:
        approval = create_approval(
            decision=decision,
            qty=10,
            limit_price=signal.price,
            stop_loss=signal.rrr.stop_loss,
            take_profit=signal.rrr.take_profit
        )
        telegram_result = send_message(build_approval_message(approval))

    return {
        "decision": decision,
        "risk": risk,
        "approval": approval,
        "telegram": telegram_result
    }

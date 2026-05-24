from fastapi import APIRouter

from app.schemas.signal_schema import SignalInput
from app.engines.decision_engine import evaluate_decision
from app.engines.risk_engine import hard_gate
from app.engines.sizing_engine import calculate_order_qty
from app.engines.session_engine import check_session
from app.services.config_loader import load_user_policy, load_portfolio_state
from app.services.approval_service import create_approval
from app.services.message_builder import build_approval_message
from app.services.telegram_service import send_message
from app.services.audit_service import write_audit

router = APIRouter(prefix="/signals", tags=["signals"])


@router.post("/evaluate")
def evaluate_signal(signal: SignalInput):
    portfolio = load_portfolio_state()
    policy = load_user_policy()

    event_dict = signal.event_flags.model_dump() if signal.event_flags else None
    session_check = check_session(signal.market, event_dict)

    decision = evaluate_decision(signal, portfolio)
    risk = hard_gate(signal, portfolio, policy)

    sizing = None
    approval = None
    telegram_result = None

    if not session_check["allowed"]:
        write_audit("SESSION_BLOCKED", signal.signal_id, "BLOCKED", session_check["reason"])
        return {
            "decision": decision,
            "risk": risk,
            "session": session_check,
            "sizing": None,
            "approval": None,
            "telegram": None
        }

    if decision["order_allowed"] and risk["passed"]:
        sizing = calculate_order_qty(signal, portfolio)
        approval = create_approval(
            decision=decision,
            qty=sizing["qty"],
            limit_price=signal.price,
            stop_loss=signal.rrr.stop_loss,
            take_profit=signal.rrr.take_profit
        )
        telegram_result = send_message(build_approval_message(approval))

    write_audit(
        "SIGNAL_EVALUATED",
        signal.signal_id,
        decision["decision"],
        f"score={decision['score']} gate={'PASS' if risk['passed'] else 'FAIL'}"
    )

    return {
        "decision": decision,
        "risk": risk,
        "session": session_check,
        "sizing": sizing,
        "approval": approval,
        "telegram": telegram_result
    }

from app.services.approval_service import create_approval
from app.services.message_builder import build_approval_message
from app.adapters.mock_broker import MockBroker

decision = {
    "ticker": "NVDA",
    "direction": "BUY",
    "decision": "BUY",
    "score": 78
}

approval = create_approval(
    decision=decision,
    qty=10,
    limit_price=150,
    stop_loss=142,
    take_profit=170
)

print(build_approval_message(approval))

broker = MockBroker()

result = broker.send_order({
    "ticker": "NVDA",
    "direction": "BUY",
    "qty": 10,
    "limit_price": 150
})

print(result)

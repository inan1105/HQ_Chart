import uuid
import random
from datetime import datetime


class MockBroker:
    def send_order(self, order: dict) -> dict:
        broker_order_id = str(uuid.uuid4())

        fill_type = random.choice(["FILLED", "PARTIAL", "REJECTED"])

        if fill_type == "FILLED":
            filled_qty = order["qty"]
        elif fill_type == "PARTIAL":
            filled_qty = max(1, int(order["qty"] * 0.5))
        else:
            filled_qty = 0

        return {
            "broker_order_id": broker_order_id,
            "status": fill_type,
            "ticker": order["ticker"],
            "direction": order["direction"],
            "qty": order["qty"],
            "filled_qty": filled_qty,
            "avg_fill_price": order["limit_price"],
            "timestamp": datetime.utcnow().isoformat()
        }

    def cancel_order(self, broker_order_id: str) -> dict:
        return {
            "broker_order_id": broker_order_id,
            "status": "CANCELLED"
        }

    def get_balance(self) -> dict:
        return {
            "cash": 12000000,
            "equity": 50000000
        }

    def get_positions(self) -> list:
        return [
            {
                "ticker": "QQQ",
                "qty": 20,
                "market_value": 8000000
            }
        ]

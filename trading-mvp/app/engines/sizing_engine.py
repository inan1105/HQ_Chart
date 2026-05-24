import math

from app.schemas.signal_schema import SignalInput, PortfolioState
from app.services.config_loader import load_sizing_rules, load_json


def get_fx_rate(currency: str) -> float:
    if currency == "KRW":
        return 1.0
    portfolio_data = load_json("portfolio_positions.json")
    fx_rates = portfolio_data.get("fx_rates", {})
    key = f"{currency}_KRW"
    return fx_rates.get(key, 1360.0)


def calculate_order_qty(signal: SignalInput, portfolio: PortfolioState) -> dict:
    rules = load_sizing_rules()
    method = rules["default_method"]
    caps = rules["caps"]

    fx_rate = get_fx_rate(signal.currency)

    entry = signal.rrr.entry_price
    stop = signal.rrr.stop_loss
    risk_per_unit = abs(entry - stop)

    if risk_per_unit == 0:
        return {"qty": 0, "method": "error", "reason": "stop_loss equals entry_price"}

    risk_per_unit_krw = risk_per_unit * fx_rate
    entry_krw = entry * fx_rate

    if method == "risk_based":
        params = rules["methods"]["risk_based"]
        risk_ratio = params["risk_per_trade_ratio"]
        risk_budget_krw = portfolio.total_equity * risk_ratio
        qty = math.floor(risk_budget_krw / risk_per_unit_krw)
    elif method == "fixed_cash":
        cash = rules["methods"]["fixed_cash"]["default_cash_krw"]
        qty = math.floor(cash / entry_krw)
    else:
        qty = rules["methods"]["fixed_qty"]["default_qty"]

    order_cash_krw = qty * entry_krw
    max_cash = portfolio.total_equity * caps["max_order_cash_ratio"]
    if order_cash_krw > max_cash:
        qty = math.floor(max_cash / entry_krw)

    if order_cash_krw > caps["max_order_cash_krw"]:
        qty = math.floor(caps["max_order_cash_krw"] / entry_krw)

    order_cash_krw = qty * entry_krw
    min_cash = caps["min_order_cash_krw"]
    if order_cash_krw < min_cash:
        qty = math.ceil(min_cash / entry_krw)

    qty = max(1, qty)

    return {
        "qty": qty,
        "method": method,
        "estimated_cash_krw": round(qty * entry_krw, 0),
        "estimated_cash_local": round(qty * entry, 2),
        "currency": signal.currency,
        "fx_rate": fx_rate,
        "risk_per_unit": round(risk_per_unit, 4),
    }

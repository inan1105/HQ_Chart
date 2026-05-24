from app.schemas.signal_schema import SignalInput, PortfolioState
from app.engines.portfolio_engine import calculate_cash_ratio, portfolio_fit_score


WEIGHTS = {
    "trend": 6,
    "momentum": 5,
    "volume": 5,
    "news": 4,
    "orderflow": 5,
    "volatility": 3
}

LAYER_WEIGHTS = {
    "user_policy": 15,
    "portfolio": 20,
    "macro_regime": 15,
    "security_signal": 35,
    "execution_quality": 15,
}


def normalize_score(score: float) -> float:
    return score + 5


def calculate_security_score(signal: SignalInput) -> float:
    scores = signal.scores
    total = (
        normalize_score(scores.trend) * WEIGHTS["trend"] +
        normalize_score(scores.momentum) * WEIGHTS["momentum"] +
        normalize_score(scores.volume) * WEIGHTS["volume"] +
        normalize_score(scores.news) * WEIGHTS["news"] +
        normalize_score(scores.orderflow) * WEIGHTS["orderflow"] +
        normalize_score(scores.volatility) * WEIGHTS["volatility"]
    )
    max_total = 10 * sum(WEIGHTS.values())
    return round((total / max_total) * 100, 2)


def calculate_user_policy_score(signal: SignalInput) -> float:
    rrr = signal.rrr.rrr_value
    if rrr >= 3.0:
        return 95
    if rrr >= 2.0:
        return 80
    if rrr >= 1.5:
        return 60
    return 30


def calculate_portfolio_score(portfolio: PortfolioState | None) -> float:
    if portfolio is None:
        return 70
    return float(portfolio_fit_score(portfolio))


def calculate_macro_score(signal: SignalInput) -> float:
    return 70.0


def calculate_execution_score(signal: SignalInput) -> float:
    if signal.execution_quality is None:
        return 70.0

    eq = signal.execution_quality
    score = 50.0

    if eq.spread_ratio <= 0.001:
        score += 20
    elif eq.spread_ratio <= 0.005:
        score += 10

    if eq.liquidity_score >= 8:
        score += 20
    elif eq.liquidity_score >= 5:
        score += 10

    if eq.session_state == "regular":
        score += 10

    return min(100.0, score)


def calculate_weighted_score(signal: SignalInput, portfolio: PortfolioState | None = None) -> tuple[float, dict]:
    l1 = calculate_user_policy_score(signal)
    l2 = calculate_portfolio_score(portfolio)
    l3 = calculate_macro_score(signal)
    l4 = calculate_security_score(signal)
    l5 = calculate_execution_score(signal)

    breakdown = {
        "user_policy": round(l1 * LAYER_WEIGHTS["user_policy"] / 100, 2),
        "portfolio": round(l2 * LAYER_WEIGHTS["portfolio"] / 100, 2),
        "macro_regime": round(l3 * LAYER_WEIGHTS["macro_regime"] / 100, 2),
        "security_signal": round(l4 * LAYER_WEIGHTS["security_signal"] / 100, 2),
        "execution_quality": round(l5 * LAYER_WEIGHTS["execution_quality"] / 100, 2),
    }

    total = sum(breakdown.values())

    return round(total, 2), breakdown


def resolve_direction(signal: SignalInput) -> str:
    return signal.direction


def decision_label(score: float, direction: str) -> str:
    if score >= 85:
        return f"STRONG_{direction}"
    if score >= 70:
        return direction
    if score >= 55:
        return "WATCH"
    if score >= 40:
        return "WAIT"
    return "REJECT"


def evaluate_decision(signal: SignalInput, portfolio: PortfolioState | None = None) -> dict:
    score, breakdown = calculate_weighted_score(signal, portfolio)
    direction = resolve_direction(signal)
    label = decision_label(score, direction)

    return {
        "ticker": signal.ticker,
        "direction": direction,
        "score": score,
        "score_breakdown": breakdown,
        "decision": label,
        "order_allowed": label in ["BUY", "SELL", "STRONG_BUY", "STRONG_SELL"]
    }

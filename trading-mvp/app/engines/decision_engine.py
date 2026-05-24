from app.schemas.signal_schema import SignalInput


WEIGHTS = {
    "trend": 6,
    "momentum": 5,
    "volume": 5,
    "news": 4,
    "orderflow": 5,
    "volatility": 3
}


def normalize_score(score: float) -> float:
    return score + 5


def calculate_weighted_score(signal: SignalInput) -> float:
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


def evaluate_decision(signal: SignalInput) -> dict:
    score = calculate_weighted_score(signal)
    direction = resolve_direction(signal)
    label = decision_label(score, direction)

    return {
        "ticker": signal.ticker,
        "direction": direction,
        "score": score,
        "decision": label,
        "order_allowed": label in ["BUY", "SELL", "STRONG_BUY", "STRONG_SELL"]
    }

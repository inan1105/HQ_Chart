from app.schemas.signal_schema import (
    SignalInput,
    ScoreBlock,
    RRRBlock,
    PortfolioState,
    Position,
    UserPolicy,
    ExecutionQuality,
    EventFlags,
    SignalMetadata,
)
from app.engines.decision_engine import evaluate_decision
from app.engines.risk_engine import hard_gate
from app.engines.portfolio_engine import (
    calculate_cash_ratio,
    calculate_sector_exposure,
    detect_overlap
)

signal = SignalInput(
    signal_id="SIG001",
    ticker="NVDA",
    market="US",
    direction="BUY",
    instrument_type="stock",
    sector="semiconductor",
    country="US",
    currency="USD",
    price=150,
    scores=ScoreBlock(
        trend=4,
        momentum=3,
        volume=4,
        news=2,
        orderflow=3,
        volatility=1
    ),
    rrr=RRRBlock(
        entry_price=150,
        stop_loss=142,
        take_profit=170,
        rrr_value=2.5
    ),
    execution_quality=ExecutionQuality(
        spread_ratio=0.0005,
        liquidity_score=9,
        session_state="regular"
    ),
    metadata=SignalMetadata(latency_ms=200)
)

portfolio = PortfolioState(
    total_equity=50000000,
    cash=12000000,
    daily_loss_ratio=-0.005,
    monthly_loss_ratio=-0.03,
    positions=[
        Position(
            ticker="QQQ",
            market="US",
            sector="technology",
            country="US",
            currency="USD",
            market_value=8000000
        )
    ]
)

policy = UserPolicy(
    max_daily_loss_ratio=0.02,
    max_monthly_loss_ratio=0.10,
    max_single_position_ratio=0.15,
    max_sector_ratio=0.35,
    max_spread_ratio=0.01,
    min_rrr=1.80
)

print("=== Decision Engine ===")
result = evaluate_decision(signal, portfolio)
print(f"  score: {result['score']}")
print(f"  breakdown: {result['score_breakdown']}")
print(f"  decision: {result['decision']}")
print(f"  order_allowed: {result['order_allowed']}")

print()
print("=== Risk Hard Gate ===")
risk = hard_gate(signal, portfolio, policy)
print(f"  passed: {risk['passed']}")
print(f"  checks: {risk['checks']}")
print(f"  warnings: {risk['warnings']}")

print()
print("=== Portfolio ===")
print(f"  cash_ratio: {calculate_cash_ratio(portfolio)}")
print(f"  sector_exposure: {calculate_sector_exposure(portfolio)}")
print(f"  overlaps: {detect_overlap(portfolio)}")

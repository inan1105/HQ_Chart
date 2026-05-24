from app.schemas.signal_schema import SignalInput, PortfolioState, UserPolicy


def check_daily_loss(portfolio: PortfolioState, policy: UserPolicy) -> bool:
    return portfolio.daily_loss_ratio > -policy.max_daily_loss_ratio


def check_monthly_loss(portfolio: PortfolioState, policy: UserPolicy) -> bool:
    return portfolio.monthly_loss_ratio > -policy.max_monthly_loss_ratio


def check_rrr(signal: SignalInput, policy: UserPolicy) -> bool:
    return signal.rrr.rrr_value >= policy.min_rrr


def check_single_position_limit(
    signal: SignalInput,
    portfolio: PortfolioState,
    policy: UserPolicy,
    planned_order_value: float | None = None
) -> bool:
    order_value = planned_order_value if planned_order_value is not None else signal.price
    target_ratio = order_value / portfolio.total_equity
    return target_ratio <= policy.max_single_position_ratio


def check_sector_limit(signal: SignalInput, portfolio: PortfolioState, policy: UserPolicy) -> bool:
    sector_total = sum(
        p.market_value for p in portfolio.positions if p.sector == signal.sector
    )
    sector_ratio = sector_total / portfolio.total_equity
    return sector_ratio <= policy.max_sector_ratio


def hard_gate(signal: SignalInput, portfolio: PortfolioState, policy: UserPolicy) -> dict:
    checks = {
        "daily_loss": check_daily_loss(portfolio, policy),
        "monthly_loss": check_monthly_loss(portfolio, policy),
        "rrr": check_rrr(signal, policy),
        "single_position": check_single_position_limit(signal, portfolio, policy),
        "sector_limit": check_sector_limit(signal, portfolio, policy)
    }

    failed = [k for k, v in checks.items() if not v]

    return {
        "passed": len(failed) == 0,
        "failed_rules": failed,
        "checks": checks
    }

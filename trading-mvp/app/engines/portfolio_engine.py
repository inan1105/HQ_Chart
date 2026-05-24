from app.schemas.signal_schema import PortfolioState


def calculate_cash_ratio(portfolio: PortfolioState) -> float:
    return round(portfolio.cash / portfolio.total_equity, 4)


def calculate_sector_exposure(portfolio: PortfolioState) -> dict:
    result = {}
    for p in portfolio.positions:
        result[p.sector] = result.get(p.sector, 0) + p.market_value

    return {
        k: round(v / portfolio.total_equity, 4)
        for k, v in result.items()
    }


def calculate_country_exposure(portfolio: PortfolioState) -> dict:
    result = {}
    for p in portfolio.positions:
        result[p.country] = result.get(p.country, 0) + p.market_value

    return {
        k: round(v / portfolio.total_equity, 4)
        for k, v in result.items()
    }


def detect_overlap(portfolio: PortfolioState) -> list:
    tickers = [p.ticker for p in portfolio.positions]

    overlap_groups = [
        ["NVDA", "QQQ", "SOXX"],
        ["AAPL", "QQQ"],
        ["005930", "KODEX200"]
    ]

    overlaps = []
    for group in overlap_groups:
        matched = [x for x in group if x in tickers]
        if len(matched) >= 2:
            overlaps.append(matched)

    return overlaps


def portfolio_fit_score(portfolio: PortfolioState) -> int:
    cash_ratio = calculate_cash_ratio(portfolio)

    if cash_ratio >= 0.20:
        return 90
    if cash_ratio >= 0.10:
        return 70
    return 45

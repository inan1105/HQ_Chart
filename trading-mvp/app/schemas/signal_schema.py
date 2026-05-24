from pydantic import BaseModel, Field
from typing import Literal, List


class ScoreBlock(BaseModel):
    trend: float = Field(ge=-5, le=5)
    momentum: float = Field(ge=-5, le=5)
    volume: float = Field(ge=-5, le=5)
    news: float = Field(ge=-5, le=5)
    orderflow: float = Field(ge=-5, le=5)
    volatility: float = Field(ge=-5, le=5)


class RRRBlock(BaseModel):
    entry_price: float
    stop_loss: float
    take_profit: float
    rrr_value: float


class SignalInput(BaseModel):
    signal_id: str
    ticker: str
    market: Literal["KR", "US"]
    direction: Literal["BUY", "SELL"]
    instrument_type: Literal["stock", "etf"]
    sector: str
    country: str
    currency: str
    price: float
    scores: ScoreBlock
    rrr: RRRBlock


class Position(BaseModel):
    ticker: str
    market: str
    sector: str
    country: str
    currency: str
    market_value: float


class PortfolioState(BaseModel):
    total_equity: float
    cash: float
    daily_loss_ratio: float
    monthly_loss_ratio: float
    positions: List[Position]


class UserPolicy(BaseModel):
    max_daily_loss_ratio: float
    max_monthly_loss_ratio: float
    max_single_position_ratio: float
    max_sector_ratio: float
    min_rrr: float

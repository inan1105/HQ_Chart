from pydantic import BaseModel, Field
from typing import Literal, List, Optional


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


class PlannedOrder(BaseModel):
    order_type: Literal["MARKET", "LIMIT", "STOP", "STOP_LIMIT"] = "LIMIT"
    planned_qty: float = 0
    planned_cash: float = 0
    limit_price: Optional[float] = None
    time_in_force: Literal["DAY", "IOC", "FOK", "GTC"] = "DAY"


class EventFlags(BaseModel):
    earnings: bool = False
    fomc: bool = False
    cpi: bool = False
    disclosure: bool = False
    halt: bool = False
    market_closed: bool = False
    blackout: bool = False


class ExecutionQuality(BaseModel):
    spread_ratio: float = 0.0
    expected_slippage_ratio: float = 0.0
    liquidity_score: float = Field(default=10.0, ge=0, le=10)
    session_state: Literal["pre_open", "regular", "after_hours", "closed", "auction"] = "regular"


class SignalMetadata(BaseModel):
    source_system: str = ""
    created_by: str = ""
    data_quality_score: float = Field(default=10.0, ge=0, le=10)
    latency_ms: int = 0


class SignalInput(BaseModel):
    signal_id: str
    source: Literal["manual", "google_sheets", "tradingview", "telegram", "api", "webhook", "scanner"] = "manual"
    timestamp: Optional[str] = None
    ticker: str
    market: Literal["KR", "US"]
    direction: Literal["BUY", "SELL"]
    instrument_type: Literal["stock", "etf", "etn", "reit"] = "stock"
    sector: str
    country: str
    currency: str
    theme: Optional[str] = None
    price: float
    scores: ScoreBlock
    rrr: RRRBlock
    planned_order: Optional[PlannedOrder] = None
    event_flags: Optional[EventFlags] = None
    execution_quality: Optional[ExecutionQuality] = None
    metadata: Optional[SignalMetadata] = None


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
    max_spread_ratio: float = 0.01
    min_rrr: float

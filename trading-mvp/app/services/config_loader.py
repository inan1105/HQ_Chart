import json
import os
from pathlib import Path

import yaml

from app.schemas.signal_schema import PortfolioState, Position, UserPolicy

CONFIG_DIR = Path(__file__).resolve().parent.parent.parent / "config"


def load_yaml(filename: str) -> dict:
    path = CONFIG_DIR / filename
    with open(path, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)


def load_json(filename: str) -> dict:
    path = CONFIG_DIR / filename
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def load_user_policy() -> UserPolicy:
    data = load_yaml("user_policy.yaml")
    limits = data["risk_limits"]
    return UserPolicy(
        max_daily_loss_ratio=limits["max_daily_loss_ratio"],
        max_monthly_loss_ratio=limits["max_monthly_loss_ratio"],
        max_single_position_ratio=limits["max_single_position_ratio"],
        max_sector_ratio=limits["max_sector_ratio"],
        min_rrr=limits["min_rrr"]
    )


def load_portfolio_state() -> PortfolioState:
    data = load_json("portfolio_positions.json")
    summary = data["summary"]
    positions = [
        Position(
            ticker=p["ticker"],
            market=p["market"],
            sector=p["sector"],
            country=p["country"],
            currency=p["currency"],
            market_value=p["market_value_krw"]
        )
        for p in data["positions"]
    ]
    return PortfolioState(
        total_equity=summary["total_equity_krw"],
        cash=summary["cash_krw"],
        daily_loss_ratio=summary["daily_loss_ratio"],
        monthly_loss_ratio=summary["monthly_loss_ratio"],
        positions=positions
    )


def load_session_rules() -> dict:
    return load_yaml("session_rules.yaml")


def load_sizing_rules() -> dict:
    return load_yaml("order_sizing_rules.yaml")

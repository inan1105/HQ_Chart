from sqlalchemy import Column, String, Float, Integer, DateTime, Text
from datetime import datetime
from app.db import Base


class ApprovalModel(Base):
    __tablename__ = "approvals"

    approval_id = Column(String, primary_key=True, index=True)
    ticker = Column(String)
    direction = Column(String)
    decision = Column(String)
    score = Column(Float)

    qty = Column(Integer)
    limit_price = Column(Float)
    stop_loss = Column(Float)
    take_profit = Column(Float)

    status = Column(String)
    user_response = Column(String)

    created_at = Column(DateTime)
    expires_at = Column(DateTime)


class OrderModel(Base):
    __tablename__ = "orders"

    order_id = Column(String, primary_key=True, index=True)
    ticker = Column(String)
    direction = Column(String)

    qty = Column(Integer)
    filled_qty = Column(Integer)

    limit_price = Column(Float)
    avg_fill_price = Column(Float)

    broker_order_id = Column(String)
    status = Column(String)

    created_at = Column(DateTime, default=datetime.utcnow)


class AuditLogModel(Base):
    __tablename__ = "audit_logs"

    audit_id = Column(String, primary_key=True)
    event_type = Column(String)
    entity_id = Column(String)
    status = Column(String)
    message = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

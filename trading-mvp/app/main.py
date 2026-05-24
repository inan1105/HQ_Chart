from fastapi import FastAPI

from app.routers import monitoring, signals, approvals, orders, webhooks

app = FastAPI(
    title="Trading MVP API",
    version="1.0"
)

app.include_router(monitoring.router)
app.include_router(signals.router)
app.include_router(approvals.router)
app.include_router(orders.router)
app.include_router(webhooks.router)

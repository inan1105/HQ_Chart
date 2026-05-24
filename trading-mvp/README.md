# Trading MVP

Human-in-the-loop Trading Copilot MVP.

Signal Input → Decision Engine → Risk Engine → Approval Queue → Telegram → Mock Broker → DB Log → Dashboard

## Setup

```bash
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
```

## Initialize DB

```bash
python -m app.init_db
```

## Run API

```bash
uvicorn app.main:app --reload
```

Open: http://127.0.0.1:8000/docs

## Run Dashboard

```bash
streamlit run dashboard.py
```

## Test Signal

POST `/signals/evaluate`

```json
{
  "signal_id": "SIG001",
  "ticker": "NVDA",
  "market": "US",
  "direction": "BUY",
  "instrument_type": "stock",
  "sector": "semiconductor",
  "country": "US",
  "currency": "USD",
  "price": 150,
  "scores": {
    "trend": 4,
    "momentum": 3,
    "volume": 4,
    "news": 2,
    "orderflow": 3,
    "volatility": 1
  },
  "rrr": {
    "entry_price": 150,
    "stop_loss": 142,
    "take_profit": 170,
    "rrr_value": 2.5
  }
}
```

## System Flow

```text
Signal Input
→ Decision Engine (weighted score 0~100)
→ Risk Engine (Hard Gate: daily loss, monthly loss, RRR, position limit, sector limit)
→ Portfolio Check (cash ratio, sector exposure, overlap)
→ Approval Queue (DB + timeout 60s)
→ Telegram Message (승인/거절/재검토)
→ Mock Broker Execute (FILLED/PARTIAL/REJECTED)
→ Order DB Log
→ Audit Log
→ Dashboard Monitoring
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /monitoring/health | Health check |
| POST | /signals/evaluate | Evaluate signal → decision → risk → approval |
| POST | /approvals/request | Create test approval |
| GET | /approvals/{id} | Get approval status |
| POST | /approvals/approve/{id} | Approve |
| POST | /approvals/reject/{id} | Reject |
| POST | /approvals/review/{id} | Request review |
| POST | /orders/send | Send mock order |
| POST | /webhooks/signal | Receive webhook signal |

## Warning

본 프로젝트는 MVP/교육용 예제입니다.
실제 주문 API와 연결하기 전에는 반드시 Mock Broker 상태로 충분히 테스트해야 합니다.
LLM 출력만으로 주문을 실행하면 안 됩니다.
주문 전 Risk Hard Gate, User Approval, Broker Adapter 검증을 반드시 통과해야 합니다.

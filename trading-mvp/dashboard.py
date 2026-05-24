import sqlite3
import json
from datetime import datetime
from pathlib import Path

import pandas as pd
import streamlit as st
import yaml

st.set_page_config(
    page_title="TradingMVP Dashboard",
    page_icon="📊",
    layout="wide",
)

DB_PATH = "trading_mvp.db"
CONFIG_DIR = Path(__file__).parent / "config"


def read_table(table_name: str) -> pd.DataFrame:
    conn = sqlite3.connect(DB_PATH)
    try:
        return pd.read_sql(f"SELECT * FROM {table_name}", conn)
    except Exception:
        return pd.DataFrame()
    finally:
        conn.close()


def load_config(filename: str):
    path = CONFIG_DIR / filename
    if not path.exists():
        return {}
    with open(path, "r", encoding="utf-8") as f:
        if filename.endswith(".yaml"):
            return yaml.safe_load(f)
        return json.load(f)


# --- Header ---
st.title("📊 TradingMVP 모니터링 대시보드")
st.caption(f"마지막 새로고침: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

# --- Load Data ---
approvals_df = read_table("approvals")
orders_df = read_table("orders")
audit_df = read_table("audit_logs")

portfolio = load_config("portfolio_positions.json")
policy_data = load_config("user_policy.yaml")

# --- Top Metrics ---
st.markdown("---")
col1, col2, col3, col4, col5 = st.columns(5)

with col1:
    st.metric("총 신호 처리", f"{len(audit_df)}건")
with col2:
    pending = len(approvals_df[approvals_df["status"] == "WAIT_CONFIRM"]) if not approvals_df.empty else 0
    st.metric("승인 대기", f"{pending}건", delta="긴급" if pending > 0 else None)
with col3:
    approved = len(approvals_df[approvals_df["status"] == "APPROVED"]) if not approvals_df.empty else 0
    st.metric("승인 완료", f"{approved}건")
with col4:
    filled = len(orders_df[orders_df["status"] == "FILLED"]) if not orders_df.empty else 0
    st.metric("체결 완료", f"{filled}건")
with col5:
    rejected_gates = len(audit_df[audit_df["status"] == "BLOCKED"]) if not audit_df.empty else 0
    st.metric("차단/거절", f"{rejected_gates}건")

# --- Portfolio Status ---
st.markdown("---")
st.subheader("💰 포트폴리오 현황")

if portfolio:
    summary = portfolio.get("summary", {})
    positions = portfolio.get("positions", [])

    pcol1, pcol2, pcol3, pcol4 = st.columns(4)
    with pcol1:
        equity = summary.get("total_equity_krw", 0)
        st.metric("총 평가금", f"{equity:,.0f}원")
    with pcol2:
        cash = summary.get("cash_krw", 0)
        cash_ratio = summary.get("cash_ratio", 0)
        st.metric("현금", f"{cash:,.0f}원", delta=f"{cash_ratio*100:.1f}%")
    with pcol3:
        daily = summary.get("daily_loss_ratio", 0)
        color = "off" if daily < -0.015 else "normal"
        st.metric("일간 손익", f"{daily*100:.2f}%")
    with pcol4:
        monthly = summary.get("monthly_loss_ratio", 0)
        st.metric("월간 손익", f"{monthly*100:.2f}%")

    if positions:
        st.markdown("**보유 종목**")
        pos_data = []
        for p in positions:
            pnl = p.get("unrealized_pnl_krw", 0)
            pos_data.append({
                "종목": p["ticker"],
                "시장": p["market"],
                "섹터": p.get("sector", ""),
                "수량": p["qty"],
                "평균가": f"{p['avg_price']:,.0f}",
                "현재가": f"{p['market_price']:,.0f}",
                "평가금(KRW)": f"{p['market_value_krw']:,.0f}",
                "미실현손익": f"{pnl:+,.0f}",
                "비중": f"{p.get('position_weight', 0)*100:.1f}%",
            })
        st.dataframe(pd.DataFrame(pos_data), use_container_width=True, hide_index=True)
else:
    st.info("config/portfolio_positions.json 파일이 없습니다.")

# --- Risk Policy Status ---
st.markdown("---")
st.subheader("🛡️ 리스크 정책 상태")

if policy_data:
    limits = policy_data.get("risk_limits", {})
    summary = portfolio.get("summary", {}) if portfolio else {}

    rcol1, rcol2, rcol3, rcol4, rcol5 = st.columns(5)
    with rcol1:
        daily_used = abs(summary.get("daily_loss_ratio", 0))
        daily_limit = limits.get("max_daily_loss_ratio", 0.02)
        pct = daily_used / daily_limit * 100 if daily_limit else 0
        st.metric("일간 손실한도", f"{pct:.0f}% 소진", delta=f"한도 {daily_limit*100}%")
    with rcol2:
        monthly_used = abs(summary.get("monthly_loss_ratio", 0))
        monthly_limit = limits.get("max_monthly_loss_ratio", 0.10)
        pct_m = monthly_used / monthly_limit * 100 if monthly_limit else 0
        st.metric("월간 손실한도", f"{pct_m:.0f}% 소진", delta=f"한도 {monthly_limit*100}%")
    with rcol3:
        st.metric("최소 RRR", f"{limits.get('min_rrr', 1.8)}")
    with rcol4:
        st.metric("단일종목 한도", f"{limits.get('max_single_position_ratio', 0.15)*100:.0f}%")
    with rcol5:
        st.metric("섹터 한도", f"{limits.get('max_sector_ratio', 0.35)*100:.0f}%")
else:
    st.info("config/user_policy.yaml 파일이 없습니다.")

# --- Approval Queue ---
st.markdown("---")
st.subheader("📋 승인 대기열")

if not approvals_df.empty:
    display_cols = ["approval_id", "ticker", "direction", "decision", "score", "qty", "limit_price", "stop_loss", "take_profit", "status", "created_at"]
    available_cols = [c for c in display_cols if c in approvals_df.columns]
    sorted_df = approvals_df[available_cols].sort_values("created_at", ascending=False) if "created_at" in approvals_df.columns else approvals_df[available_cols]

    def highlight_status(row):
        if row.get("status") == "WAIT_CONFIRM":
            return ["background-color: #fef3c7"] * len(row)
        elif row.get("status") == "APPROVED":
            return ["background-color: #d1fae5"] * len(row)
        elif row.get("status") in ("REJECTED", "EXPIRED"):
            return ["background-color: #fee2e2"] * len(row)
        return [""] * len(row)

    st.dataframe(
        sorted_df.style.apply(highlight_status, axis=1),
        use_container_width=True,
        hide_index=True,
    )
else:
    st.info("승인 대기 건이 없습니다.")

# --- Orders ---
st.markdown("---")
st.subheader("📦 주문 이력")

if not orders_df.empty:
    order_cols = ["order_id", "ticker", "direction", "qty", "filled_qty", "limit_price", "avg_fill_price", "status", "created_at"]
    available_order_cols = [c for c in order_cols if c in orders_df.columns]
    st.dataframe(
        orders_df[available_order_cols].sort_values("created_at", ascending=False) if "created_at" in orders_df.columns else orders_df[available_order_cols],
        use_container_width=True,
        hide_index=True,
    )
else:
    st.info("주문 이력이 없습니다.")

# --- Audit Trail ---
st.markdown("---")
st.subheader("📝 감사 로그")

if not audit_df.empty:
    audit_cols = ["created_at", "event_type", "entity_id", "status", "message"]
    available_audit_cols = [c for c in audit_cols if c in audit_df.columns]
    sorted_audit = audit_df[available_audit_cols].sort_values("created_at", ascending=False) if "created_at" in audit_df.columns else audit_df[available_audit_cols]
    st.dataframe(sorted_audit.head(50), use_container_width=True, hide_index=True)
else:
    st.info("감사 로그가 없습니다.")

# --- System Info ---
st.markdown("---")
with st.expander("⚙️ 시스템 정보"):
    st.json({
        "db_path": DB_PATH,
        "config_dir": str(CONFIG_DIR),
        "policy_version": policy_data.get("policy_version", "N/A") if policy_data else "N/A",
        "user": policy_data.get("user_name", "N/A") if policy_data else "N/A",
        "timezone": policy_data.get("timezone", "N/A") if policy_data else "N/A",
        "approval_timeout_sec": policy_data.get("approval", {}).get("approval_timeout_sec", 60) if policy_data else 60,
        "broker_mode": "mock",
    })

# --- Auto Refresh ---
st.markdown("---")
st.caption("💡 이 페이지를 새로고침(F5)하면 최신 데이터를 확인할 수 있습니다.")

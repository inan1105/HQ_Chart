import sqlite3

import pandas as pd
import streamlit as st


DB_PATH = "trading_mvp.db"

st.title("Trading MVP Dashboard")


def read_table(table_name: str) -> pd.DataFrame:
    conn = sqlite3.connect(DB_PATH)
    try:
        return pd.read_sql(f"SELECT * FROM {table_name}", conn)
    except Exception:
        return pd.DataFrame()
    finally:
        conn.close()


st.subheader("Approvals")
st.dataframe(read_table("approvals"))

st.subheader("Orders")
st.dataframe(read_table("orders"))

st.subheader("Audit Logs")
st.dataframe(read_table("audit_logs"))

"""
streamlit_app.py
----------------
KOStockCrewAI 의 간단한 웹 화면(Streamlit)입니다.

실행:
  streamlit run streamlit_app.py

동작:
  - 종목코드를 입력하고 '분석 리포트 생성' 버튼을 누르면
  - FastAPI 서버의 /report/{ticker} 를 호출해 결과를 보여줍니다.

주의:
  - API Key 는 화면에 절대 표시하지 않습니다.
  - FastAPI 서버(uvicorn main:app)가 먼저 실행되어 있어야 합니다.
"""

from __future__ import annotations

import os

import requests
import streamlit as st

# FastAPI 서버 주소. 환경변수 API_BASE 가 있으면 그것을, 없으면 로컬 기본값 사용.
API_BASE = os.getenv("API_BASE", "http://127.0.0.1:8000")

# 클라우드 호스트(Render 등)는 도메인만(scheme 없이) 넘겨줄 수 있습니다.
# 'http' 로 시작하지 않으면 https:// 를 붙여 줍니다.
if API_BASE and not API_BASE.startswith("http"):
    API_BASE = f"https://{API_BASE}"
API_BASE = API_BASE.rstrip("/")

# 페이지 기본 설정
st.set_page_config(page_title="KOStockCrewAI MVP", page_icon="📊", layout="centered")

st.title("📊 KOStockCrewAI MVP")
st.caption("한국 주식 분석 리포트 자동 생성 · 본 결과는 정보 제공용이며 투자 권유가 아닙니다.")

# 종목코드 입력 (기본값 005930 = 삼성전자)
ticker = st.text_input("종목코드를 입력하세요", value="005930", max_chars=6)

col_a, col_b = st.columns(2)
with col_a:
    run = st.button("🔍 분석 리포트 생성", use_container_width=True)
with col_b:
    load_sample = st.button("🧪 샘플 데이터 적재", use_container_width=True)


def _show_error(message: str):
    """비개발자도 이해할 수 있는 오류 메시지를 보여줍니다."""
    st.error(message)
    st.info(
        "확인할 점:\n"
        "1) FastAPI 서버가 실행 중인가요? (터미널에서 `uvicorn main:app --reload`)\n"
        "2) PostgreSQL 이 실행 중인가요? (`docker compose up -d postgres`)\n"
        "3) 종목코드가 올바른가요? (예: 005930)"
    )


# 샘플 데이터 적재 버튼 처리
if load_sample:
    try:
        resp = requests.get(f"{API_BASE}/sample/load/{ticker}", timeout=60)
        if resp.status_code == 200:
            st.success(f"샘플 데이터 적재 완료: {ticker} (실데이터 아님, 검증용)")
        else:
            _show_error(f"샘플 적재 실패 (코드 {resp.status_code}): {resp.text[:200]}")
    except requests.RequestException:
        _show_error("FastAPI 서버에 연결할 수 없습니다.")


# 리포트 생성 버튼 처리
if run:
    if not ticker.strip().isdigit():
        st.warning("종목코드는 숫자로 입력하세요. 예: 005930")
    else:
        with st.spinner("분석 리포트를 생성하는 중입니다... 잠시만 기다려 주세요."):
            try:
                resp = requests.get(f"{API_BASE}/report/{ticker}", timeout=120)
            except requests.RequestException:
                resp = None
                _show_error("FastAPI 서버에 연결할 수 없습니다.")

        if resp is not None and resp.status_code == 200:
            data = resp.json()
            scores = data.get("scores", {})
            brief = data.get("brief", {})

            st.subheader(f"{data.get('corp_name')} ({data.get('ticker')})")
            st.markdown(f"### 분석등급: **{scores.get('rating')}**")

            # 점수 metric 카드
            c1, c2, c3 = st.columns(3)
            c1.metric("종합점수", scores.get("total_score"))
            c2.metric("리스크점수", scores.get("risk_score"))
            c3.metric("기본점수", scores.get("fundamental_score"))
            c4, c5, c6 = st.columns(3)
            c4.metric("기술점수", scores.get("technical_score"))
            c5.metric("수급점수", scores.get("flow_score"))
            c6.metric("거시점수", scores.get("macro_score"))

            st.divider()

            # GPT 브리프 표시
            st.markdown("#### 📝 핵심 요약")
            st.write(brief.get("one_line_summary", ""))
            st.write(brief.get("investment_opinion", ""))

            st.markdown("#### ✅ 주요 포인트")
            for p in brief.get("key_points", []) or []:
                st.write(f"- {p}")

            with st.expander("세부 관점 보기 (기본/기술/수급/거시)"):
                st.write("**기본적 관점**:", brief.get("fundamental_view", ""))
                st.write("**기술적 관점**:", brief.get("technical_view", ""))
                st.write("**수급 관점**:", brief.get("flow_view", ""))
                st.write("**거시 관점**:", brief.get("macro_view", ""))

            st.markdown("#### ⚠️ 리스크 요인")
            for r in brief.get("risk_factors", []) or []:
                st.write(f"- {r}")

            st.markdown("#### 🎯 대응 전략")
            st.write(brief.get("action_strategy", ""))

            # PDF 다운로드 링크
            st.divider()
            pdf_url = f"{API_BASE}/report/{data.get('ticker')}/pdf"
            st.markdown(f"📄 [PDF 리포트 다운로드]({pdf_url})")

            # 고지문
            st.caption(brief.get("disclaimer", ""))

        elif resp is not None:
            _show_error(f"리포트 생성 실패 (코드 {resp.status_code}). 서버 로그를 확인하세요.")

"""
streamlit_app.py
----------------
KOStockCrewAI 사용자 웹 화면(Streamlit).

세 개의 화면으로 구성됩니다(왼쪽 사이드바에서 이동):
  1) 🏠 홈(초화면)     — 서비스 정상 운용 상태를 한눈에 확인
  2) 🔑 API 키 설정     — 개별 API 키를 등록/수정(완료 여부 표시)
  3) 📈 리포트 조회     — 종목명/종목코드로 1페이지 리포트 조회 + PDF 다운로드

보안 원칙:
  - API 키 '값'은 화면에 절대 표시하지 않습니다(설정됨/미설정만 표시, 입력은 가림).
  - FastAPI 서버(uvicorn main:app)가 먼저 실행되어 있어야 합니다.
"""

from __future__ import annotations

import os

import requests
import streamlit as st

# FastAPI 서버 주소. 환경변수 API_BASE 가 있으면 그것을, 없으면 로컬 기본값 사용.
API_BASE = os.getenv("API_BASE", "http://127.0.0.1:8000")
# 클라우드 호스트는 도메인만(scheme 없이) 넘겨줄 수 있어 https:// 보정.
if API_BASE and not API_BASE.startswith("http"):
    API_BASE = f"https://{API_BASE}"
API_BASE = API_BASE.rstrip("/")

st.set_page_config(page_title="KOStockCrewAI MVP", page_icon="📊", layout="centered")


# ------------------------------------------------------------------
# 공통 도우미: API 호출 (오류는 비개발자용 메시지로 처리)
# ------------------------------------------------------------------
def api_get(path: str, timeout: int = 120):
    """GET 요청. (성공 dict, 오류메시지) 튜플 반환."""
    try:
        r = requests.get(f"{API_BASE}{path}", timeout=timeout)
        if r.status_code == 200:
            return r.json(), None
        try:
            detail = r.json().get("detail", r.text[:200])
        except Exception:
            detail = r.text[:200]
        return None, f"(코드 {r.status_code}) {detail}"
    except requests.RequestException:
        return None, "FastAPI 서버에 연결할 수 없습니다."


def api_post(path: str, payload: dict, timeout: int = 60):
    """POST 요청. (성공 dict, 오류메시지) 튜플 반환."""
    try:
        r = requests.post(f"{API_BASE}{path}", json=payload, timeout=timeout)
        if r.status_code == 200:
            return r.json(), None
        return None, f"(코드 {r.status_code}) {r.text[:200]}"
    except requests.RequestException:
        return None, "FastAPI 서버에 연결할 수 없습니다."


def server_help():
    """서버 연결 실패 시 공통 안내."""
    st.info(
        "확인할 점:\n"
        "1) FastAPI 서버 실행 여부 — 터미널에서 `uvicorn main:app --reload`\n"
        "2) PostgreSQL 실행 여부 — `docker compose up -d postgres`\n"
        "3) 주소(API_BASE) 설정 확인"
    )


# ------------------------------------------------------------------
# 사이드바 내비게이션
# ------------------------------------------------------------------
st.sidebar.title("📊 KOStockCrewAI")
st.sidebar.caption("한국 주식 분석 MVP")
page = st.sidebar.radio(
    "메뉴",
    ["🏠 홈", "🔑 API 키 설정", "📈 리포트 조회"],
    index=0,
)
st.sidebar.divider()
st.sidebar.caption("결과는 정보 제공용이며 투자 권유가 아닙니다.")


# ==================================================================
# 1) 홈(초화면) — 서비스 정상 운용 상태
# ==================================================================
def render_home():
    st.title("🏠 KOStockCrewAI")
    st.write("한국 주식 종목을 입력하면 **분석 점수 · AI 투자 브리프 · PDF 리포트**를 자동 생성합니다.")
    st.caption("※ 본 서비스 결과는 정보 제공용이며 투자 권유가 아닙니다.")

    st.subheader("서비스 운용 상태")
    health, herr = api_get("/health", timeout=10)
    diag, derr = api_get("/diagnostics", timeout=15)

    if herr:
        st.error(f"서버 상태 확인 실패: {herr}")
        server_help()
        return

    c1, c2 = st.columns(2)
    c1.metric("API 서버", "정상 ✅" if health.get("status") == "ok" else "이상 ⚠️")
    c2.metric("데이터베이스", "연결됨 ✅" if health.get("database_connected") else "미연결 ⛔")

    # 키 설정 요약
    if diag:
        svc = diag.get("services", {})
        labels = {"openai": "OpenAI", "dart": "DART", "ecos": "ECOS", "koscom": "코스콤"}
        cols = st.columns(4)
        for col, key in zip(cols, ["openai", "dart", "ecos", "koscom"]):
            configured = svc.get(key, {}).get("configured")
            col.metric(labels[key], "설정됨 ✅" if configured else "미설정 ⛔")

        all_set = all(svc.get(k, {}).get("configured") for k in ["openai", "dart", "ecos", "koscom"])
        if not all_set:
            st.warning(
                "일부 API 키가 미설정 상태입니다. 왼쪽 **🔑 API 키 설정** 에서 등록하세요.\n"
                "키가 없어도 **샘플 데이터**로 화면/리포트를 체험할 수 있습니다."
            )
        else:
            st.success("모든 API 키가 설정되었습니다. **📈 리포트 조회** 에서 실데이터 분석을 진행하세요.")

    st.divider()
    st.markdown(
        "**시작하기**\n"
        "1. 🔑 **API 키 설정** 에서 키를 등록(선택 — 없으면 샘플 모드)\n"
        "2. 📈 **리포트 조회** 에서 종목명/코드 입력 → 리포트 확인 → PDF 다운로드"
    )


# ==================================================================
# 2) API 키 설정 — 등록/수정 (값은 표시하지 않음)
# ==================================================================
def render_settings():
    st.title("🔑 API 키 설정")
    st.write("각 서비스의 API 키를 등록·수정합니다. 키가 없어도 샘플 모드로 동작합니다.")
    st.caption("🔒 보안: 입력한 키 값은 화면에 다시 표시되지 않으며, 서버에만 저장됩니다.")

    status, err = api_get("/settings", timeout=10)
    if err:
        st.error(f"설정 상태를 불러오지 못했습니다: {err}")
        server_help()
        return

    s = status.get("status", {})

    def badge(key: str) -> str:
        return "✅ 설정됨" if s.get(key, {}).get("configured") else "⛔ 미설정"

    st.subheader("현재 상태")
    st.write(
        f"- OpenAI: **{badge('OPENAI_API_KEY')}**  ·  DART: **{badge('DART_API_KEY')}**\n"
        f"- ECOS: **{badge('ECOS_API_KEY')}**  ·  코스콤 키: **{badge('KOSCOM_API_KEY')}**  ·  코스콤 URL: **{badge('KOSCOM_BASE_URL')}**"
    )

    st.divider()
    st.subheader("키 등록 / 수정")
    st.caption("입력란을 비워두면 기존 값이 그대로 유지됩니다. 변경할 항목만 입력하세요.")

    with st.form("settings_form"):
        openai_key = st.text_input("OpenAI API Key", type="password",
                                   placeholder="sk-... (GPT 브리프/임베딩)")
        dart_key = st.text_input("DART API Key", type="password",
                                 placeholder="DART 전자공시 재무")
        ecos_key = st.text_input("ECOS API Key", type="password",
                                 placeholder="한국은행 거시지표")
        koscom_key = st.text_input("코스콤 API Key", type="password",
                                   placeholder="코스콤 시세/수급")
        koscom_url = st.text_input("코스콤 Base URL",
                                   value=s.get("KOSCOM_BASE_URL", {}).get("value", ""),
                                   placeholder="https://...")
        col1, col2 = st.columns(2)
        koscom_auth = col1.selectbox(
            "코스콤 인증방식", ["bearer", "x-api-key"],
            index=0 if s.get("KOSCOM_AUTH_TYPE", {}).get("value", "bearer") == "bearer" else 1,
        )
        openai_model = col2.text_input(
            "OpenAI 모델명", value=s.get("OPENAI_MODEL", {}).get("value", "gpt-5-mini")
        )
        submitted = st.form_submit_button("💾 저장 / 적용", use_container_width=True)

    if submitted:
        payload = {
            "OPENAI_API_KEY": openai_key,
            "DART_API_KEY": dart_key,
            "ECOS_API_KEY": ecos_key,
            "KOSCOM_API_KEY": koscom_key,
            "KOSCOM_BASE_URL": koscom_url,
            "KOSCOM_AUTH_TYPE": koscom_auth,
            "OPENAI_MODEL": openai_model,
        }
        # 빈 문자열은 보내지 않음(기존 유지)
        payload = {k: v for k, v in payload.items() if v not in (None, "")}
        res, perr = api_post("/settings", payload)
        if perr:
            st.error(f"저장 실패: {perr}")
        else:
            st.success(res.get("message", "저장되었습니다."))
            if res.get("applied"):
                st.write("적용된 항목:", ", ".join(res["applied"]))
            st.rerun()

    st.divider()
    st.subheader("연동 점검 (실제 연결 확인)")
    st.caption("키를 등록한 뒤, 각 서비스에 실제로 연결되는지 확인합니다.")
    if st.button("🔎 실연결 점검 실행"):
        with st.spinner("각 서비스에 연결을 시도하는 중..."):
            diag, derr = api_get("/diagnostics?live=true", timeout=90)
        if derr:
            st.error(derr)
        else:
            for name, st_ in diag.get("services", {}).items():
                if st_["reachable"]:
                    st.success(f"{name}: {st_['detail']}")
                elif st_["configured"]:
                    st.warning(f"{name}: {st_['detail']}")
                else:
                    st.info(f"{name}: {st_['detail']}")


# ==================================================================
# 3) 리포트 조회 — 종목명/코드 입력 → 1페이지 리포트 + PDF
# ==================================================================
def render_report():
    st.title("📈 리포트 조회")
    st.write("종목명 또는 종목코드를 입력하고 조회하세요. (예: `삼성전자` 또는 `005930`)")

    query = st.text_input("종목명 또는 종목코드", value="005930")
    go = st.button("🔍 리포트 조회", use_container_width=True)

    if not go:
        return

    if not query.strip():
        st.warning("종목명 또는 종목코드를 입력하세요.")
        return

    # 1) 종목명/코드 → 표준 코드 변환
    with st.spinner("종목을 확인하는 중..."):
        resolved, rerr = api_get(f"/resolve/{query.strip()}", timeout=60)
    if rerr:
        st.error(f"종목을 찾을 수 없습니다: {rerr}")
        server_help()
        return

    ticker = resolved["ticker"]
    st.caption(f"확인된 종목: {resolved.get('corp_name') or ''} ({ticker})")

    # 2) 리포트 생성/조회
    with st.spinner("분석 리포트를 생성하는 중입니다... 잠시만 기다려 주세요."):
        data, derr = api_get(f"/report/{ticker}", timeout=180)
    if derr:
        st.error(f"리포트 생성 실패: {derr}")
        server_help()
        return

    _render_report_body(data, ticker)


def _render_report_body(data: dict, ticker: str):
    """리포트 결과(JSON)를 1페이지 화면으로 렌더링한다."""
    scores = data.get("scores", {})
    brief = data.get("brief", {})

    st.subheader(f"{data.get('corp_name')} ({data.get('ticker')})")
    st.markdown(f"### 분석등급: **{scores.get('rating')}**")

    # 점수 카드
    c1, c2, c3 = st.columns(3)
    c1.metric("종합점수", scores.get("total_score"))
    c2.metric("리스크점수", scores.get("risk_score"))
    c3.metric("기본점수", scores.get("fundamental_score"))
    c4, c5, c6 = st.columns(3)
    c4.metric("기술점수", scores.get("technical_score"))
    c5.metric("수급점수", scores.get("flow_score"))
    c6.metric("거시점수", scores.get("macro_score"))

    st.divider()

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

    st.divider()
    # PDF 다운로드 버튼(메뉴) — 서버에서 PDF 바이트를 받아 다운로드 제공
    try:
        pdf_resp = requests.get(f"{API_BASE}/report/{ticker}/pdf", timeout=120)
        if pdf_resp.status_code == 200:
            st.download_button(
                label="📄 PDF 리포트 다운로드",
                data=pdf_resp.content,
                file_name=f"{ticker}_report.pdf",
                mime="application/pdf",
                use_container_width=True,
            )
        else:
            st.warning("PDF 생성에 실패했습니다. 잠시 후 다시 시도하세요.")
    except requests.RequestException:
        st.warning("PDF 다운로드 중 서버에 연결할 수 없습니다.")

    st.caption(brief.get("disclaimer", ""))


# ------------------------------------------------------------------
# 라우팅
# ------------------------------------------------------------------
if page == "🏠 홈":
    render_home()
elif page == "🔑 API 키 설정":
    render_settings()
else:
    render_report()

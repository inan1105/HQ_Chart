"""
gpt_brief_agent.py
------------------
OpenAI GPT 를 사용해 '투자 브리프'를 생성합니다.

특징:
- OpenAI Responses API 사용 (구조화 출력 / JSON Schema)
- 모델명은 config(OPENAI_MODEL) 또는 아래 상수에서 쉽게 변경 가능 (기본 gpt-5-mini)
- OpenAI API Key 가 없으면 'mock 브리프'를 반환하는 개발용 fallback 제공
  → 키가 없어도 앱과 UI 를 끝까지 테스트할 수 있습니다.
"""

from __future__ import annotations

import json
from typing import Any, Dict

from app.core.config import settings, is_key_set
from app.core.logging import logger

# 기본 모델명. config 의 OPENAI_MODEL 이 우선 적용됩니다.
DEFAULT_MODEL = "gpt-5-mini"

# 모든 브리프에 반드시 들어가야 하는 고지문
DISCLAIMER_TEXT = (
    "본 자료는 정보 제공 목적의 자동 생성 리포트이며, 특정 종목의 매수·매도 권유가 "
    "아닙니다. 투자 판단과 책임은 투자자 본인에게 있습니다."
)

# 구조화 출력(JSON Schema). 모델이 이 형식으로만 답하도록 강제합니다.
BRIEF_JSON_SCHEMA = {
    "type": "object",
    "properties": {
        "one_line_summary": {"type": "string"},
        "investment_opinion": {"type": "string"},
        "key_points": {"type": "array", "items": {"type": "string"}},
        "fundamental_view": {"type": "string"},
        "technical_view": {"type": "string"},
        "flow_view": {"type": "string"},
        "macro_view": {"type": "string"},
        "risk_factors": {"type": "array", "items": {"type": "string"}},
        "action_strategy": {"type": "string"},
        "disclaimer": {"type": "string"},
    },
    "required": [
        "one_line_summary",
        "investment_opinion",
        "key_points",
        "fundamental_view",
        "technical_view",
        "flow_view",
        "macro_view",
        "risk_factors",
        "action_strategy",
        "disclaimer",
    ],
    "additionalProperties": False,
}


def _build_prompt(context: Dict[str, Any]) -> str:
    """분석 결과를 사람이 읽기 좋은 텍스트로 정리해 프롬프트에 넣습니다."""
    return (
        "다음은 한 종목의 정량 분석 결과입니다. 이를 바탕으로 투자 브리프를 작성하세요.\n\n"
        f"종목코드: {context.get('ticker')}\n"
        f"종목명: {context.get('corp_name')}\n"
        f"종합점수: {context.get('total_score')}\n"
        f"등급(분석등급): {context.get('rating')}\n"
        f"기본적점수: {context.get('fundamental_score')}\n"
        f"기술적점수: {context.get('technical_score')}\n"
        f"수급점수: {context.get('flow_score')}\n"
        f"거시점수: {context.get('macro_score')}\n"
        f"리스크점수: {context.get('risk_score')}\n\n"
        f"세부지표(JSON):\n{json.dumps(context.get('details', {}), ensure_ascii=False, indent=2)}\n\n"
        "주의: 매수/매도를 강요하지 말고, 균형 있게 작성하세요. "
        "disclaimer 필드에는 반드시 다음 문구를 그대로 넣으세요:\n"
        f"\"{DISCLAIMER_TEXT}\""
    )


def generate_brief(context: Dict[str, Any]) -> Dict[str, Any]:
    """
    투자 브리프를 생성합니다.

    매개변수:
        context: ticker, corp_name, 각종 점수와 details 를 담은 dict

    반환:
        BRIEF_JSON_SCHEMA 형태의 dict.
        OpenAI Key 가 없거나 호출 실패 시 mock 브리프를 반환합니다.
    """
    # 키가 없으면 곧바로 mock 브리프 반환 (앱이 죽지 않게)
    if not is_key_set("OPENAI_API_KEY"):
        logger.warning("[GPT] OPENAI_API_KEY 가 없어 mock 브리프를 반환합니다(개발용).")
        return _mock_brief(context)

    model = settings.OPENAI_MODEL or DEFAULT_MODEL
    system_prompt = (
        "당신은 신중하고 균형 잡힌 한국 주식 애널리스트입니다. "
        "사실 기반으로, 매수/매도를 강요하지 않고, 초보자도 이해할 수 있게 한국어로 작성하세요."
    )
    user_prompt = _build_prompt(context)

    try:
        from openai import OpenAI

        client = OpenAI(api_key=settings.OPENAI_API_KEY)

        # Responses API + 구조화 출력(JSON Schema) 사용
        response = client.responses.create(
            model=model,
            input=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            text={
                "format": {
                    "type": "json_schema",
                    "name": "investment_brief",
                    "schema": BRIEF_JSON_SCHEMA,
                    "strict": True,
                }
            },
        )

        # 모델이 돌려준 JSON 텍스트를 파싱
        raw_text = _extract_output_text(response)
        brief = json.loads(raw_text)

        # 고지문은 어떤 경우에도 정확한 문구로 보장
        brief["disclaimer"] = DISCLAIMER_TEXT
        logger.info("[GPT] 투자 브리프 생성 완료")
        return brief

    except Exception as exc:  # 네트워크/쿼터/모델명 등 어떤 오류든 안전하게 처리
        logger.error(f"[GPT] 브리프 생성 실패 → mock 으로 대체합니다: {exc}")
        return _mock_brief(context, error=str(exc))


def _extract_output_text(response: Any) -> str:
    """
    Responses API 결과에서 텍스트(JSON 문자열)를 꺼냅니다.
    SDK 버전에 따라 output_text 속성이 있을 수도, 없을 수도 있어 모두 대비합니다.
    """
    # 최신 SDK 편의 속성
    text = getattr(response, "output_text", None)
    if text:
        return text
    # 구조를 직접 순회
    try:
        for item in response.output:
            for content in getattr(item, "content", []):
                if getattr(content, "type", "") in ("output_text", "text"):
                    return content.text
    except Exception:
        pass
    raise ValueError("OpenAI 응답에서 텍스트를 추출하지 못했습니다.")


def _mock_brief(context: Dict[str, Any], error: str | None = None) -> Dict[str, Any]:
    """
    개발용 mock 브리프. 점수 값을 활용해 그럴듯한 텍스트를 구성합니다.
    실제 GPT 호출 없이도 PDF/화면을 테스트할 수 있게 해 줍니다.
    """
    corp = context.get("corp_name") or context.get("ticker")
    rating = context.get("rating", "HOLD")
    total = context.get("total_score", 50)

    note = " (참고: OpenAI 호출 실패로 자동 생성된 임시 브리프입니다.)" if error else \
           " (참고: OPENAI_API_KEY 미설정으로 생성된 샘플 브리프입니다.)"

    return {
        "one_line_summary": f"{corp}의 종합 분석 등급은 {rating}, 종합점수는 {total}점입니다.{note}",
        "investment_opinion": (
            f"정량 분석 결과 종합점수 {total}점으로 '{rating}' 등급입니다. "
            "이는 매수 권유가 아니라 점수 기반의 분석 등급입니다."
        ),
        "key_points": [
            f"기본적 점수 {context.get('fundamental_score')}점",
            f"기술적 점수 {context.get('technical_score')}점",
            f"수급 점수 {context.get('flow_score')}점",
            f"거시 점수 {context.get('macro_score')}점",
        ],
        "fundamental_view": "재무 지표(영업이익률, 부채비율, ROE)를 종합한 기본적 관점입니다.",
        "technical_view": "이동평균, RSI, MACD 등 추세·모멘텀을 종합한 기술적 관점입니다.",
        "flow_view": "최근 외국인·기관 수급 흐름을 반영한 관점입니다.",
        "macro_view": "기준금리·환율·물가 등 거시 환경을 반영한 관점입니다.",
        "risk_factors": [
            "시장 전체 변동성 확대 가능성",
            "수급 약화 또는 실적 변동 가능성",
        ],
        "action_strategy": (
            "분할 접근과 손절 기준 설정 등 리스크 관리를 우선하세요. "
            "본 자료는 참고용이며 최종 판단은 투자자 본인의 몫입니다."
        ),
        "disclaimer": DISCLAIMER_TEXT,
    }

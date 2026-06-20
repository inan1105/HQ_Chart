"""
crew.py
-------
CrewAI 멀티에이전트 정의(확장 옵션).

※ 중요 ※
MVP 의 안정성을 위해, 실제 리포트 생성은 investment_agent.py 의
'결정론적(deterministic) 파이프라인'을 기본으로 사용합니다.
CrewAI 는 선택적 확장 기능이며, 패키지/네트워크 문제로 앱 전체가
멈추지 않도록 모든 import/실행을 try/except 로 감쌌습니다.

여기서는 6개 역할(Agent)을 정의만 해 두고, 필요 시 build_crew() 로 구성합니다.
"""

from __future__ import annotations

from typing import Any, Optional

from app.core.config import settings, is_key_set
from app.core.logging import logger

# CrewAI 사용 가능 여부를 먼저 확인합니다.
try:
    from crewai import Agent, Crew, Task  # type: ignore

    _CREWAI_AVAILABLE = True
except Exception as exc:  # 설치 안 됨 / 버전 문제 등
    _CREWAI_AVAILABLE = False
    logger.warning(f"[CrewAI] 사용할 수 없습니다(선택 기능). 기본 파이프라인을 사용하세요: {exc}")


def crewai_available() -> bool:
    """CrewAI 를 실제로 사용할 수 있는 상태인지 반환합니다."""
    return _CREWAI_AVAILABLE and is_key_set("OPENAI_API_KEY")


def build_crew() -> Optional[Any]:
    """
    6개 역할의 CrewAI 팀을 구성합니다.
    사용 불가 상태면 None 을 반환합니다(앱은 계속 동작).

    역할:
        1. DataCollectorAgent   - 데이터 수집
        2. FundamentalAnalystAgent - 기본적 분석
        3. TechnicalAnalystAgent   - 기술적 분석
        4. FlowAnalystAgent        - 수급 분석
        5. MacroRiskAgent          - 거시/리스크 분석
        6. ReportWriterAgent       - 리포트 작성
    """
    if not crewai_available():
        logger.info("[CrewAI] 비활성화 상태입니다. investment_agent 파이프라인을 사용하세요.")
        return None

    try:
        # 각 에이전트의 역할/목표/배경을 정의합니다.
        data_collector = Agent(
            role="DataCollectorAgent",
            goal="DART/ECOS/코스콤/DB 에서 분석에 필요한 데이터를 수집한다.",
            backstory="여러 데이터 소스를 다루는 데이터 엔지니어입니다.",
            verbose=False,
        )
        fundamental_analyst = Agent(
            role="FundamentalAnalystAgent",
            goal="재무제표를 분석해 기업의 펀더멘털을 평가한다.",
            backstory="재무제표 분석에 능한 애널리스트입니다.",
            verbose=False,
        )
        technical_analyst = Agent(
            role="TechnicalAnalystAgent",
            goal="가격/거래량으로 추세와 모멘텀을 분석한다.",
            backstory="차트 기술적 분석 전문가입니다.",
            verbose=False,
        )
        flow_analyst = Agent(
            role="FlowAnalystAgent",
            goal="외국인/기관 수급 흐름을 해석한다.",
            backstory="수급 데이터 해석 전문가입니다.",
            verbose=False,
        )
        macro_risk = Agent(
            role="MacroRiskAgent",
            goal="거시환경과 리스크 요인을 평가한다.",
            backstory="거시경제와 리스크 관리 전문가입니다.",
            verbose=False,
        )
        report_writer = Agent(
            role="ReportWriterAgent",
            goal="모든 분석을 종합해 투자 브리프를 작성한다.",
            backstory="복잡한 분석을 쉬운 글로 풀어내는 작가입니다.",
            verbose=False,
        )

        agents = [
            data_collector,
            fundamental_analyst,
            technical_analyst,
            flow_analyst,
            macro_risk,
            report_writer,
        ]

        # 간단한 보고서 작성 태스크 예시(확장용 placeholder)
        task = Task(
            description="수집된 데이터를 바탕으로 종목 투자 브리프를 작성하라.",
            expected_output="구조화된 한국어 투자 브리프",
            agent=report_writer,
        )

        crew = Crew(agents=agents, tasks=[task], verbose=False)
        logger.info("[CrewAI] Crew 구성 완료(확장 옵션).")
        return crew

    except Exception as exc:
        logger.error(f"[CrewAI] 구성 실패. 기본 파이프라인을 사용하세요: {exc}")
        return None

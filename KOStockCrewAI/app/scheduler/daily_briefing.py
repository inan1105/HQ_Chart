"""
daily_briefing.py
-----------------
관심종목(WATCHLIST)에 대해 매일 아침 브리핑을 생성하고
Telegram 으로 요약 메시지를 전송합니다.

- 각 종목 처리 중 오류가 나도 전체가 멈추지 않고, 해당 종목만 오류로 표시합니다.
"""

from __future__ import annotations

import asyncio
from typing import List

from app.core.config import settings, is_key_set
from app.core.logging import logger

# 기본 관심종목
WATCHLIST: List[str] = ["005930", "000660", "035420", "051910"]


def _build_line(ticker: str) -> str:
    """종목 하나를 분석해 한 줄 요약 문자열을 만듭니다. 오류 시 오류 문구 반환."""
    try:
        from app.agents.investment_agent import generate_full_report

        result = generate_full_report(ticker)
        scores = result.get("scores", {})
        return (
            f"• {result.get('corp_name')}({ticker}): "
            f"{scores.get('rating')} / 종합 {scores.get('total_score')}"
        )
    except Exception as exc:
        logger.error(f"[Briefing] {ticker} 처리 실패: {exc}")
        return f"• {ticker}: 분석 실패(개별 오류, 전체는 계속 진행)"


def build_briefing_message(watchlist: List[str] | None = None) -> str:
    """관심종목 전체에 대한 브리핑 메시지를 만듭니다."""
    watchlist = watchlist or WATCHLIST
    lines = ["📅 오늘의 관심종목 브리핑", ""]
    for ticker in watchlist:
        lines.append(_build_line(ticker))
    lines.append("")
    lines.append("※ 본 자료는 정보 제공용이며 매수·매도 권유가 아닙니다.")
    return "\n".join(lines)


async def _send_telegram(message: str) -> None:
    """텔레그램으로 메시지를 비동기 전송합니다."""
    from telegram import Bot

    bot = Bot(token=settings.TELEGRAM_BOT_TOKEN)
    await bot.send_message(chat_id=settings.TELEGRAM_CHAT_ID, text=message)


def run_daily_briefing() -> str:
    """
    매일 오전 브리핑을 실행합니다(스케줄러가 07:00 에 호출).
    반환값은 만들어진 메시지(로그/테스트 확인용).
    """
    message = build_briefing_message()
    logger.info("[Briefing] 브리핑 메시지 생성 완료")

    # 텔레그램 키가 있으면 전송, 없으면 콘솔 출력만
    if is_key_set("TELEGRAM_BOT_TOKEN") and settings.TELEGRAM_CHAT_ID:
        try:
            asyncio.run(_send_telegram(message))
            logger.info("[Briefing] 텔레그램 전송 완료")
        except Exception as exc:
            logger.error(f"[Briefing] 텔레그램 전송 실패: {exc}")
    else:
        logger.warning("[Briefing] 텔레그램 설정이 없어 콘솔에만 출력합니다.")
        print(message)

    return message


if __name__ == "__main__":
    # 단독 실행 시 즉시 브리핑 1회 수행
    run_daily_briefing()

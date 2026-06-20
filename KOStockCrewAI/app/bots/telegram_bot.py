"""
telegram_bot.py
---------------
Telegram 봇으로 종목 분석 결과(요약 + PDF)를 전달합니다.

사용법:
  - 봇과 대화창에서 /start 를 보내면 사용법을 안내합니다.
  - '005930' 처럼 종목코드를 보내면 리포트를 생성해 요약과 PDF 를 전송합니다.

실행:
  python -m app.bots.telegram_bot

TELEGRAM_BOT_TOKEN 이 없으면 실행 전에 안내하고 종료합니다(앱이 죽지 않음).
"""

from __future__ import annotations

import os

from app.core.config import settings, is_key_set, missing_key_message
from app.core.logging import logger


def _build_summary_text(result: dict) -> str:
    """리포트 결과 dict 를 텔레그램용 요약 텍스트로 만듭니다."""
    scores = result.get("scores", {})
    brief = result.get("brief", {})
    lines = [
        f"📊 *{result.get('corp_name')}* ({result.get('ticker')})",
        f"분석등급: *{scores.get('rating')}*  /  종합점수: *{scores.get('total_score')}*",
        "",
        f"• 기본: {scores.get('fundamental_score')}  • 기술: {scores.get('technical_score')}",
        f"• 수급: {scores.get('flow_score')}  • 거시: {scores.get('macro_score')}",
        f"• 리스크: {scores.get('risk_score')}",
        "",
        f"📝 {brief.get('one_line_summary', '')}",
        "",
        "※ 본 자료는 정보 제공용이며 매수·매도 권유가 아닙니다.",
    ]
    return "\n".join(lines)


async def _start_handler(update, context):
    """/start 명령 처리: 사용법 안내."""
    await update.message.reply_text(
        "안녕하세요! KOStockCrewAI 봇입니다.\n"
        "종목코드를 보내주세요. 예: 005930\n"
        "그러면 분석 요약과 PDF 리포트를 보내드립니다.\n\n"
        "※ 결과는 정보 제공용이며 투자 권유가 아닙니다."
    )


async def _message_handler(update, context):
    """일반 메시지 처리: 종목코드면 리포트를 생성/전송."""
    text = (update.message.text or "").strip()

    # 숫자 6자리(또는 그 이하) 형태면 종목코드로 간주
    digits = text.replace(" ", "")
    if not digits.isdigit():
        await update.message.reply_text("종목코드(숫자)를 보내주세요. 예: 005930")
        return

    ticker = digits.zfill(6)
    await update.message.reply_text(f"⏳ {ticker} 분석을 시작합니다. 잠시만 기다려 주세요...")

    try:
        # 무거운 작업이므로 함수는 여기서 import (봇 시작을 빠르게)
        from app.agents.investment_agent import generate_full_report

        result = generate_full_report(ticker)
        # 요약 텍스트 전송
        await update.message.reply_text(_build_summary_text(result), parse_mode="Markdown")

        # PDF 전송
        pdf_path = result.get("pdf_path")
        if pdf_path and os.path.exists(pdf_path):
            with open(pdf_path, "rb") as f:
                await update.message.reply_document(document=f, filename=os.path.basename(pdf_path))
        else:
            await update.message.reply_text("PDF 생성에 실패하여 요약만 전달했습니다.")

    except Exception as exc:
        logger.error(f"[Telegram] 리포트 처리 실패: {exc}")
        await update.message.reply_text(
            "분석 중 오류가 발생했습니다. 잠시 후 다시 시도하거나 종목코드를 확인해 주세요."
        )


def main() -> None:
    """봇을 실행합니다."""
    if not is_key_set("TELEGRAM_BOT_TOKEN"):
        print(missing_key_message("TELEGRAM_BOT_TOKEN"))
        print("→ .env 에 TELEGRAM_BOT_TOKEN 을 입력한 뒤 다시 실행하세요.")
        return

    try:
        from telegram.ext import (
            ApplicationBuilder,
            CommandHandler,
            MessageHandler,
            filters,
        )
    except Exception as exc:
        print(f"[Telegram] python-telegram-bot 패키지를 불러올 수 없습니다: {exc}")
        print("→ pip install python-telegram-bot 후 다시 시도하세요.")
        return

    app = ApplicationBuilder().token(settings.TELEGRAM_BOT_TOKEN).build()
    app.add_handler(CommandHandler("start", _start_handler))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, _message_handler))

    logger.info("[Telegram] 봇을 시작합니다. (Ctrl+C 로 종료)")
    print("✅ Telegram 봇이 실행 중입니다. 텔레그램에서 봇에게 종목코드를 보내보세요.")
    app.run_polling()


if __name__ == "__main__":
    main()

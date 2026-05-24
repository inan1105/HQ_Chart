import os

from telegram import Update
from telegram.ext import ApplicationBuilder, CommandHandler, ContextTypes

from app.services.approval_service import approve, reject, review

BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")


async def approve_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not context.args:
        await update.message.reply_text("approval_id가 필요합니다.")
        return

    result = approve(context.args[0])
    await update.message.reply_text(f"APPROVED: {result}")


async def reject_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not context.args:
        await update.message.reply_text("approval_id가 필요합니다.")
        return

    result = reject(context.args[0])
    await update.message.reply_text(f"REJECTED: {result}")


async def review_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not context.args:
        await update.message.reply_text("approval_id가 필요합니다.")
        return

    result = review(context.args[0])
    await update.message.reply_text(f"REVIEW: {result}")


def run_bot():
    if not BOT_TOKEN:
        raise RuntimeError("TELEGRAM_BOT_TOKEN is not configured")

    app = ApplicationBuilder().token(BOT_TOKEN).build()

    app.add_handler(CommandHandler("approve", approve_cmd))
    app.add_handler(CommandHandler("reject", reject_cmd))
    app.add_handler(CommandHandler("review", review_cmd))

    app.run_polling()

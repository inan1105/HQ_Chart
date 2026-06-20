"""
main_scheduler.py
-----------------
APScheduler 로 매일 정해진 시간에 데이터 수집과 브리핑을 실행합니다.

스케줄(Asia/Seoul 기준):
  06:00  DART 재무 수집
  06:10  ECOS 거시 수집
  06:20  코스콤 시세(prices) 수집
  06:30  코스콤 수급(flows) 수집
  07:00  관심종목 데일리 브리핑

실행:
  python -m app.scheduler.main_scheduler

※ MVP 안내 ※
아래 수집 함수들은 placeholder(자리표시)이며, TODO 주석에 실제 연결 지점을 표시했습니다.
실제 운영에서는 각 collector 와 repository 를 연결해 채우세요.
"""

from __future__ import annotations

from datetime import datetime, timedelta

from app.core.logging import logger
from app.scheduler.daily_briefing import run_daily_briefing, WATCHLIST


# ------------------------------------------------------------------
# 아래 4개는 MVP placeholder 입니다. 실제 수집 로직으로 채우세요.
# ------------------------------------------------------------------
def job_collect_dart() -> None:
    """06:00 - DART 재무 수집(placeholder)."""
    logger.info("[Scheduler] (06:00) DART 수집 시작")
    # TODO: WATCHLIST 순회하며 dart_collector.get_single_company_accounts() 호출 →
    #       repositories.insert_financial_rows() 저장
    for ticker in WATCHLIST:
        logger.info(f"[Scheduler] TODO: DART 재무 수집 {ticker}")


def job_collect_ecos() -> None:
    """06:10 - ECOS 거시 수집(placeholder)."""
    logger.info("[Scheduler] (06:10) ECOS 수집 시작")
    # TODO: ecos_collector.fetch_base_rate() 등 호출 → repositories.insert_macro_rows() 저장


def job_collect_koscom_prices() -> None:
    """06:20 - 코스콤 시세 수집(placeholder)."""
    logger.info("[Scheduler] (06:20) 코스콤 시세 수집 시작")
    # TODO: KoscomClient().get_ohlcv() 호출 → repositories.insert_price_rows() 저장
    for ticker in WATCHLIST:
        logger.info(f"[Scheduler] TODO: 코스콤 시세 수집 {ticker}")


def job_collect_koscom_flows() -> None:
    """06:30 - 코스콤 수급 수집(placeholder)."""
    logger.info("[Scheduler] (06:30) 코스콤 수급 수집 시작")
    # TODO: KoscomClient().get_investor_flow() 호출 → repositories.insert_flow_rows() 저장
    for ticker in WATCHLIST:
        logger.info(f"[Scheduler] TODO: 코스콤 수급 수집 {ticker}")


def job_daily_briefing() -> None:
    """07:00 - 데일리 브리핑 전송."""
    logger.info("[Scheduler] (07:00) 데일리 브리핑 시작")
    run_daily_briefing()


def main() -> None:
    """스케줄러를 구성하고 실행합니다(블로킹)."""
    try:
        from apscheduler.schedulers.blocking import BlockingScheduler
        from apscheduler.triggers.cron import CronTrigger
    except Exception as exc:
        print(f"[Scheduler] APScheduler 를 불러올 수 없습니다: {exc}")
        print("→ pip install apscheduler 후 다시 시도하세요.")
        return

    scheduler = BlockingScheduler(timezone="Asia/Seoul")

    # 매일 지정 시각에 실행되도록 cron 트리거 등록
    scheduler.add_job(job_collect_dart, CronTrigger(hour=6, minute=0), id="dart")
    scheduler.add_job(job_collect_ecos, CronTrigger(hour=6, minute=10), id="ecos")
    scheduler.add_job(job_collect_koscom_prices, CronTrigger(hour=6, minute=20), id="koscom_prices")
    scheduler.add_job(job_collect_koscom_flows, CronTrigger(hour=6, minute=30), id="koscom_flows")
    scheduler.add_job(job_daily_briefing, CronTrigger(hour=7, minute=0), id="briefing")

    logger.info("[Scheduler] 시작됨 (Asia/Seoul). Ctrl+C 로 종료.")
    print("✅ 스케줄러 실행 중 (06:00 DART, 06:10 ECOS, 06:20 시세, 06:30 수급, 07:00 브리핑)")
    try:
        scheduler.start()
    except (KeyboardInterrupt, SystemExit):
        logger.info("[Scheduler] 종료되었습니다.")


if __name__ == "__main__":
    main()

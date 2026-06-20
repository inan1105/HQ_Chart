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

※ 안내 ※
각 수집 함수는 collector → repository 를 실제로 연결합니다.
API Key 가 없으면 collector 가 빈 결과를 돌려주므로 안전하게 건너뜁니다(앱은 죽지 않음).
종목별 오류는 개별 격리하여 전체 스케줄이 중단되지 않습니다.
단, 코스콤 엔드포인트/필드는 계약 명세에 맞춰 koscom_collector.py 의 mapping 을 조정하세요.
"""

from __future__ import annotations

from datetime import datetime, timedelta

from app.core.logging import logger
from app.scheduler.daily_briefing import run_daily_briefing, WATCHLIST


# ------------------------------------------------------------------
# 실제 수집 작업들.
# - API Key 가 없으면 각 collector 가 빈 결과를 돌려주므로 안전합니다(앱 죽지 않음).
# - 종목별 오류는 개별 격리하여 전체가 중단되지 않게 합니다.
# ------------------------------------------------------------------
def _date_range_yyyymmdd(days: int = 120) -> tuple[str, str]:
    """오늘로부터 days 일 전 ~ 오늘을 'YYYYMMDD' 문자열로 반환합니다(코스콤용)."""
    today = date.today()
    start = today - timedelta(days=days)
    return start.strftime("%Y%m%d"), today.strftime("%Y%m%d")


def job_collect_dart() -> None:
    """06:00 - DART 재무 수집. WATCHLIST 종목별 직전 연도 주요계정을 저장."""
    logger.info("[Scheduler] (06:00) DART 수집 시작")
    from app.collectors.dart_collector import get_single_company_accounts, find_corp_code
    from app.db import repositories as repo

    fiscal_year = str(date.today().year - 1)
    for ticker in WATCHLIST:
        try:
            rows = get_single_company_accounts(ticker, fiscal_year)
            if not rows:
                logger.warning(f"[Scheduler] DART 재무 없음(키/코드 확인): {ticker}")
                continue
            # 종목명/ corp_code 갱신
            found = find_corp_code(ticker)
            if found:
                repo.upsert_stock(
                    ticker=ticker.zfill(6),
                    corp_name=found.get("corp_name"),
                    corp_code=found.get("corp_code"),
                )
            saved = repo.insert_financial_rows(ticker.zfill(6), rows)
            logger.info(f"[Scheduler] DART 재무 {saved}건 저장: {ticker}")
        except Exception as exc:  # 개별 종목 오류 격리
            logger.error(f"[Scheduler] DART 수집 실패 {ticker}: {exc}")


def job_collect_ecos() -> None:
    """06:10 - ECOS 거시 수집. 최근 12개월 기준금리를 macro_indicators 에 저장."""
    logger.info("[Scheduler] (06:10) ECOS 수집 시작")
    from app.collectors.ecos_collector import fetch_base_rate
    from app.db import repositories as repo

    try:
        today = date.today()
        end_period = today.strftime("%Y%m")
        start_period = (today.replace(day=1) - timedelta(days=365)).strftime("%Y%m")
        rows = fetch_base_rate(start_period, end_period)
        if not rows:
            logger.warning("[Scheduler] ECOS 데이터 없음(키/통계코드 확인).")
            return

        macro_rows = []
        for r in rows:
            time_str = str(r.get("TIME", "")).strip()
            value = r.get("DATA_VALUE")
            # TIME(YYYYMM) -> YYYY-MM-01
            ind_date = f"{time_str[0:4]}-{time_str[4:6]}-01" if len(time_str) == 6 else None
            try:
                value_f = float(value) if value not in (None, "") else None
            except ValueError:
                value_f = None
            if ind_date and value_f is not None:
                macro_rows.append(
                    {"indicator": "base_rate", "indicator_date": ind_date,
                     "value": value_f, "unit": "%"}
                )
        saved = repo.insert_macro_rows(macro_rows) if macro_rows else 0
        logger.info(f"[Scheduler] ECOS 기준금리 {saved}건 저장")
    except Exception as exc:
        logger.error(f"[Scheduler] ECOS 수집 실패: {exc}")


def job_collect_koscom_prices() -> None:
    """06:20 - 코스콤 시세 수집. WATCHLIST 종목별 OHLCV 를 저장."""
    logger.info("[Scheduler] (06:20) 코스콤 시세 수집 시작")
    from app.collectors.koscom_collector import KoscomClient
    from app.db import repositories as repo

    client = KoscomClient()
    start, end = _date_range_yyyymmdd(120)
    for ticker in WATCHLIST:
        try:
            rows = client.get_ohlcv(ticker, start, end)
            # trade_date 가 비어있는 행은 제외
            rows = [r for r in rows if r.get("trade_date")]
            if not rows:
                logger.warning(f"[Scheduler] 코스콤 시세 없음(키/URL 확인): {ticker}")
                continue
            saved = repo.insert_price_rows(ticker.zfill(6), rows)
            logger.info(f"[Scheduler] 코스콤 시세 {saved}건 저장: {ticker}")
        except Exception as exc:  # 개별 종목 오류 격리
            logger.error(f"[Scheduler] 코스콤 시세 수집 실패 {ticker}: {exc}")


def job_collect_koscom_flows() -> None:
    """06:30 - 코스콤 수급 수집. WATCHLIST 종목별 투자자 순매수를 저장."""
    logger.info("[Scheduler] (06:30) 코스콤 수급 수집 시작")
    from app.collectors.koscom_collector import KoscomClient
    from app.db import repositories as repo

    client = KoscomClient()
    start, end = _date_range_yyyymmdd(120)
    for ticker in WATCHLIST:
        try:
            rows = client.get_investor_flow(ticker, start, end)
            rows = [r for r in rows if r.get("trade_date")]
            if not rows:
                logger.warning(f"[Scheduler] 코스콤 수급 없음(키/URL 확인): {ticker}")
                continue
            saved = repo.insert_flow_rows(ticker.zfill(6), rows)
            logger.info(f"[Scheduler] 코스콤 수급 {saved}건 저장: {ticker}")
        except Exception as exc:  # 개별 종목 오류 격리
            logger.error(f"[Scheduler] 코스콤 수급 수집 실패 {ticker}: {exc}")


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

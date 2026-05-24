from datetime import datetime, timezone, timedelta

from app.services.config_loader import load_session_rules


KST = timezone(timedelta(hours=9))
EST = timezone(timedelta(hours=-4))


def check_session(market: str, event_flags: dict | None = None) -> dict:
    rules = load_session_rules()

    if event_flags:
        if event_flags.get("halt"):
            return {"allowed": False, "reason": "거래정지 상태", "code": "ERR_HALT"}
        if event_flags.get("market_closed"):
            return {"allowed": False, "reason": "장 마감 상태", "code": "ERR_MARKET_CLOSED"}

    now_utc = datetime.now(timezone.utc)

    if market == "KR":
        now_local = now_utc.astimezone(KST)
        session = rules["KR"]["regular_session"]
    elif market == "US":
        now_local = now_utc.astimezone(EST)
        session = rules["US"]["regular_session"]
    else:
        return {"allowed": False, "reason": "알 수 없는 시장", "code": "ERR_MARKET_CLOSED"}

    weekday = now_local.weekday()
    if weekday >= 5:
        return {"allowed": False, "reason": "주말 거래 불가", "code": "ERR_MARKET_CLOSED"}

    start_h, start_m = map(int, session["start"].split(":"))
    end_h, end_m = map(int, session["end"].split(":"))

    start_time = now_local.replace(hour=start_h, minute=start_m, second=0, microsecond=0)
    end_time = now_local.replace(hour=end_h, minute=end_m, second=0, microsecond=0)

    if start_time <= now_local <= end_time:
        return {"allowed": True, "reason": "정규장 시간", "code": "OK"}
    else:
        return {"allowed": False, "reason": "정규장 시간 외", "code": "ERR_MARKET_CLOSED"}
